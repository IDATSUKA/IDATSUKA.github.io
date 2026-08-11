/**
 * WebSocket bridge between the MCP server and the CEP panels running inside
 * the Adobe applications.
 *
 * The MCP server owns the listening socket; each CEP panel connects to it as a
 * client and announces which host application it lives in ("PPRO", "AEFT", ...).
 * Tool calls are then routed to the matching panel, executed as ExtendScript,
 * and the JSON result travels back over the same socket.
 */

import { WebSocketServer } from "ws";

const DEFAULT_PORT = Number(process.env.ADOBE_MCP_PORT || 8765);
const DEFAULT_HOST = process.env.ADOBE_MCP_HOST || "127.0.0.1";

/** How long we wait for a panel to answer before giving up. */
const DEFAULT_TIMEOUT_MS = Number(process.env.ADOBE_MCP_TIMEOUT_MS || 120000);

/** Human readable names, used in error messages. */
export const APP_NAMES = {
  PPRO: "Premiere Pro",
  AEFT: "After Effects",
  PHXS: "Photoshop",
  PHXM: "Photoshop",
  ILST: "Illustrator",
  AUDT: "Audition",
};

export class Bridge {
  constructor({ port = DEFAULT_PORT, host = DEFAULT_HOST, log = () => {} } = {}) {
    this.port = port;
    this.host = host;
    this.log = log;
    /** @type {Map<string, {socket: import("ws").WebSocket, appId: string, appVersion: string, connectedAt: number}>} */
    this.panels = new Map();
    /** @type {Map<string, {resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
    this.pending = new Map();
    this.seq = 0;
    this.wss = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.port, host: this.host });
      this.wss = wss;

      wss.on("listening", () => {
        this.log(`bridge listening on ws://${this.host}:${this.port}`);
        resolve();
      });

      wss.on("error", (err) => {
        if (err && err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${this.port} is already in use. Another adobe-mcp server is probably ` +
                `already running (for example one started by Claude Desktop). Close it, or set ` +
                `ADOBE_MCP_PORT to a different port in both the MCP config and the panel.`
            )
          );
        } else {
          reject(err);
        }
      });

      wss.on("connection", (socket) => this._onConnection(socket));
    });
  }

  _onConnection(socket) {
    let appId = null;

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this.log(`ignoring malformed frame from panel`);
        return;
      }

      if (msg.type === "hello") {
        appId = String(msg.appId || "UNKNOWN").toUpperCase();
        this.panels.set(appId, {
          socket,
          appId,
          appVersion: String(msg.appVersion || ""),
          connectedAt: Date.now(),
        });
        this.log(`panel connected: ${appId} ${msg.appVersion || ""}`);
        socket.send(JSON.stringify({ type: "hello-ack" }));
        return;
      }

      if (msg.type === "result") {
        const waiter = this.pending.get(msg.id);
        if (!waiter) return;
        this.pending.delete(msg.id);
        clearTimeout(waiter.timer);
        if (msg.ok) waiter.resolve(msg.data);
        else waiter.reject(new Error(msg.error || "ExtendScript reported an unknown failure"));
      }
    });

    const drop = () => {
      if (appId && this.panels.get(appId)?.socket === socket) {
        this.panels.delete(appId);
        this.log(`panel disconnected: ${appId}`);
      }
    };
    socket.on("close", drop);
    socket.on("error", drop);
  }

  /** Applications that currently have a live panel. */
  connectedApps() {
    return [...this.panels.values()].map((p) => ({
      appId: p.appId,
      appName: APP_NAMES[p.appId] || p.appId,
      appVersion: p.appVersion,
      connectedSince: new Date(p.connectedAt).toISOString(),
    }));
  }

  /**
   * Run an action inside the given host application.
   *
   * @param {string} appId  e.g. "PPRO"
   * @param {string} action action name understood by the app's .jsx module
   * @param {object} params
   */
  exec(appId, action, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const panel = this.panels.get(appId);
    if (!panel) {
      const name = APP_NAMES[appId] || appId;
      throw new Error(
        `${name} is not connected. Launch ${name}, then open ` +
          `Window > Extensions > MCP Bridge and confirm the panel says "Connected".`
      );
    }

    const id = `r${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `${APP_NAMES[appId] || appId} did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
              `It may be showing a modal dialog — check the application window.`
          )
        );
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      panel.socket.send(JSON.stringify({ type: "exec", id, action, params }));
    });
  }
}
