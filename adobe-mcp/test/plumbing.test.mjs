// End-to-end check: MCP stdio <-> server <-> WebSocket <-> fake CEP panel.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PORT = "8791";
const child = spawn(process.execPath, [path.join(ROOT, "server/index.js")], {
  cwd: ROOT,
  env: { ...process.env, ADOBE_MCP_PORT: PORT },
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (d) => process.stderr.write("  [srv] " + d));

let buf = "";
const waiters = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    const w = waiters.get(msg.id);
    if (w) { waiters.delete(msg.id); w(msg); }
  }
});

let seq = 0;
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = ++seq;
    waiters.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

await sleep(900);

// --- 1. handshake + tool listing
await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "test", version: "0" },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const list = await rpc("tools/list", {});
const tools = list.result.tools;
check("tools/list responds", Array.isArray(tools), `${tools?.length} tools`);
check("premiere tools registered", tools.some((t) => t.name === "pr_add_clip"));
check("every tool has a description", tools.every((t) => t.description?.length > 20));
check("every tool has an object schema", tools.every((t) => t.inputSchema?.type === "object"));

// --- 2. calling a Premiere tool with no panel connected must fail helpfully
const noPanel = await rpc("tools/call", { name: "pr_get_project_info", arguments: {} });
check(
  "unconnected app returns a guiding error",
  noPanel.result.isError && /Window > Extensions/.test(noPanel.result.content[0].text),
  noPanel.result.content[0].text.slice(0, 70) + "..."
);

// --- 3. connect a fake panel and verify routing
const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
const seen = [];
await new Promise((r) => ws.on("open", r));
ws.send(JSON.stringify({ type: "hello", appId: "PPRO", appVersion: "24.6.1" }));
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type !== "exec") return;
  seen.push(msg);
  ws.send(JSON.stringify({
    type: "result",
    id: msg.id,
    ok: true,
    data: { echoAction: msg.action, echoParams: msg.params },
  }));
});
await sleep(400);

const status = await rpc("tools/call", { name: "adobe_status", arguments: {} });
check("adobe_status sees the panel", /PPRO/.test(status.result.content[0].text));

const call = await rpc("tools/call", {
  name: "pr_add_clip",
  arguments: { projectItem: "Footage/a.mp4", trackIndex: 1, atSeconds: 2.5, mode: "insert" },
});
const payload = JSON.parse(call.result.content[0].text);
check("tool call reaches the panel", seen.length === 1 && seen[0].action === "addClip", seen[0]?.action);
check("arguments arrive intact", payload.echoParams.trackIndex === 1 && payload.echoParams.mode === "insert");
check("result travels back to MCP", payload.echoAction === "addClip");

// --- 4. panel errors surface as MCP errors
ws.removeAllListeners("message");
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type !== "exec") return;
  ws.send(JSON.stringify({ type: "result", id: msg.id, ok: false, error: "There is no active sequence." }));
});
const failed = await rpc("tools/call", { name: "pr_list_sequences", arguments: {} });
check(
  "ExtendScript failure surfaces as an error",
  failed.result.isError && /no active sequence/i.test(failed.result.content[0].text)
);

// --- 5. disconnect is noticed
ws.close();
await sleep(400);
const after = await rpc("tools/call", { name: "adobe_status", arguments: {} });
check("disconnect clears the panel", JSON.parse(after.result.content[0].text).connected.length === 0);

child.kill();
const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} passed`);
process.exit(failedCount ? 1 : 0);
