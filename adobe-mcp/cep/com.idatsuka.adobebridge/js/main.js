/**
 * Panel logic: load the ExtendScript modules for whichever application we are
 * running in, keep a WebSocket open to the adobe-mcp server, and execute the
 * actions it sends.
 */

/* global CSInterface, SystemPath, WebSocket, window, document */

(function () {
  "use strict";

  // Must match ADOBE_MCP_PORT in the MCP server config. To change it without
  // editing this file, run localStorage.setItem("amb_port", "9000") in the
  // panel's debug console and press 再接続.
  var PORT = Number(window.localStorage.getItem("amb_port")) || 8765;
  var URL = "ws://127.0.0.1:" + PORT;

  var RECONNECT_MS = 3000;

  /** ExtendScript modules loaded per host application. */
  var MODULES = {
    PPRO: ["json2.jsx", "premiere.jsx"],
  };
  var FALLBACK_MODULES = ["json2.jsx", "generic.jsx"];

  var cs = new CSInterface();
  var env = cs.getHostEnvironment();
  var appId = String(env.appName || "UNKNOWN").toUpperCase();
  var appVersion = String(env.appVersion || "");

  var dotEl = document.getElementById("dot");
  var stateEl = document.getElementById("state");
  var hostEl = document.getElementById("host");
  var logEl = document.getElementById("log");

  var socket = null;
  var reconnectTimer = null;
  var closing = false;

  hostEl.textContent = appId + " " + appVersion + "  ·  port " + PORT;

  function log(message, kind) {
    var line = document.createElement("div");
    if (kind) line.className = kind;
    var t = new Date();
    var stamp =
      ("0" + t.getHours()).slice(-2) +
      ":" + ("0" + t.getMinutes()).slice(-2) +
      ":" + ("0" + t.getSeconds()).slice(-2);
    line.textContent = stamp + "  " + message;
    logEl.appendChild(line);
    while (logEl.childNodes.length > 200) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setState(text, kind) {
    stateEl.textContent = text;
    dotEl.className = "dot " + kind;
  }

  // ------------------------------------------------------------ ExtendScript

  /**
   * Turn a JS value into an ExtendScript string literal. Non-ASCII is escaped
   * so that Japanese file paths survive the trip through evalScript.
   */
  function toJsxString(value) {
    return JSON.stringify(String(value)).replace(/[^\x20-\x7e]/g, function (ch) {
      return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
    });
  }

  function evalScript(script) {
    return new Promise(function (resolve) {
      cs.evalScript(script, resolve);
    });
  }

  function loadModules() {
    var root = cs.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, "/");
    var files = MODULES[appId] || FALLBACK_MODULES;
    var chain = Promise.resolve();

    files.forEach(function (file) {
      chain = chain.then(function () {
        var full = root + "/jsx/" + file;
        return evalScript("$.evalFile(" + toJsxString(full) + ")").then(function (res) {
          if (String(res).indexOf("EvalScript error") === 0) {
            log("読込失敗 " + file + ": " + res, "err");
          }
        });
      });
    });

    return chain.then(function () {
      log("ExtendScript 読込完了 (" + files.join(", ") + ")", "ok");
    });
  }

  /** Run one action and return { ok, data } or { ok:false, error }. */
  function dispatch(action, params) {
    var call =
      "AMB_dispatch(" + toJsxString(action) + ", " + toJsxString(JSON.stringify(params || {})) + ")";

    return evalScript(call).then(function (raw) {
      var text = String(raw);
      if (text === "EvalScript error." || text.indexOf("EvalScript error") === 0) {
        return { ok: false, error: "ExtendScript failed to evaluate. Press スクリプト再読込 in the panel." };
      }
      if (text === "undefined" || text === "") {
        return { ok: false, error: "No response from ExtendScript. The module may not be loaded." };
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return { ok: false, error: "Unparseable ExtendScript response: " + text.slice(0, 500) };
      }
    });
  }

  // --------------------------------------------------------------- transport

  function connect() {
    clearTimeout(reconnectTimer);
    closing = false;
    setState("接続中…", "wait");

    try {
      socket = new WebSocket(URL);
    } catch (e) {
      scheduleReconnect("接続できません: " + e.message);
      return;
    }

    socket.onopen = function () {
      setState("接続済み", "on");
      log("MCP サーバーに接続しました " + URL, "ok");
      socket.send(JSON.stringify({ type: "hello", appId: appId, appVersion: appVersion }));
    };

    socket.onmessage = function (event) {
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.type !== "exec") return;

      log("→ " + msg.action);
      dispatch(msg.action, msg.params)
        .then(function (result) {
          if (!result.ok) log("✕ " + msg.action + ": " + result.error, "err");
          socket.send(
            JSON.stringify({
              type: "result",
              id: msg.id,
              ok: !!result.ok,
              data: result.data,
              error: result.error,
            })
          );
        })
        .catch(function (err) {
          log("✕ " + msg.action + ": " + err.message, "err");
          socket.send(
            JSON.stringify({ type: "result", id: msg.id, ok: false, error: String(err.message || err) })
          );
        });
    };

    socket.onclose = function () {
      if (closing) return;
      scheduleReconnect("接続が切れました");
    };

    socket.onerror = function () {
      // onclose fires straight after, which is where the retry is scheduled.
    };
  }

  function scheduleReconnect(reason) {
    setState("未接続", "off");
    log(reason + " — " + RECONNECT_MS / 1000 + "秒後に再試行します");
    reconnectTimer = setTimeout(connect, RECONNECT_MS);
  }

  // ------------------------------------------------------------------ wiring

  document.getElementById("reload").addEventListener("click", function () {
    loadModules();
  });

  document.getElementById("reconnect").addEventListener("click", function () {
    if (socket && socket.readyState <= 1) {
      closing = true;
      socket.close();
    }
    connect();
  });

  loadModules().then(connect);
})();
