/**
 * Minimal CSInterface shim.
 *
 * Adobe ships a ~1000 line CSInterface.js with the CEP samples, but the panel
 * only needs three of its entry points, and every one is a thin wrapper over the
 * `window.__adobe_cep__` object that CEP injects. Keeping our own copy avoids
 * vendoring a large file we do not otherwise use.
 */

/* global window */

var SystemPath = {
  EXTENSION: "extension",
  USER_DATA: "userData",
  COMMON_FILES: "commonFiles",
  MY_DOCUMENTS: "myDocuments",
  HOST_APPLICATION: "hostApplication",
};

function CSInterface() {}

/** Run ExtendScript in the host application. The callback receives a string. */
CSInterface.prototype.evalScript = function (script, callback) {
  if (typeof callback !== "function") {
    callback = function () {};
  }
  window.__adobe_cep__.evalScript(script, callback);
};

/** { appName: "PPRO", appVersion: "24.6.1", appLocale: "ja_JP", ... } */
CSInterface.prototype.getHostEnvironment = function () {
  return JSON.parse(window.__adobe_cep__.getHostEnvironment());
};

/** Absolute path of a well known folder, with the file:// scheme stripped. */
CSInterface.prototype.getSystemPath = function (type) {
  var path = decodeURI(window.__adobe_cep__.getSystemPath(type));
  var prefix = "file://";
  if (path.indexOf(prefix) === 0) {
    path = path.slice(prefix.length);
  }
  // Windows comes back as /C:/Users/... — drop the leading slash.
  if (/^\/[a-zA-Z]:/.test(path)) {
    path = path.slice(1);
  }
  return path;
};
