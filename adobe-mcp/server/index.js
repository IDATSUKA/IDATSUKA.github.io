#!/usr/bin/env node
/**
 * adobe-mcp — an MCP server that drives Adobe applications through a CEP panel.
 *
 * Claude talks to this process over stdio. This process talks to the CEP panels
 * over a localhost WebSocket (see bridge.js). Only Premiere Pro has a tool set
 * today; After Effects, Photoshop and Illustrator connect through the same panel
 * and are reachable via the generic escape hatch until their modules land.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Bridge, APP_NAMES } from "./bridge.js";
import { premiereTools } from "./tools/premiere.js";

// stdout is the MCP transport, so every diagnostic has to go to stderr.
const log = (...args) => console.error("[adobe-mcp]", ...args);

const statusTool = {
  name: "adobe_status",
  appId: null,
  description:
    "Report which Adobe applications currently have the MCP Bridge panel connected. Call this when a tool reports that an application is not connected, or to confirm the setup works.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

const tools = [statusTool, ...premiereTools];
const byName = new Map(tools.map((t) => [t.name, t]));

const bridge = new Bridge({ log });

const server = new Server(
  { name: "adobe-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = byName.get(request.params.name);
  if (!tool) {
    return textResult(`Unknown tool: ${request.params.name}`, true);
  }

  try {
    if (tool === statusTool) {
      const apps = bridge.connectedApps();
      return jsonResult({
        bridge: `ws://${bridge.host}:${bridge.port}`,
        connected: apps,
        hint: apps.length
          ? undefined
          : "No panel is connected. In the Adobe application, open Window > Extensions > MCP Bridge.",
      });
    }

    const data = await bridge.exec(tool.appId, tool.action, request.params.arguments || {});
    return jsonResult(data);
  } catch (err) {
    return textResult(describeError(err, tool), true);
  }
});

function describeError(err, tool) {
  const appName = APP_NAMES[tool.appId] || tool.appId || "the application";
  const message = err?.message || String(err);
  return `${tool.name} failed in ${appName}: ${message}`;
}

function jsonResult(data) {
  return {
    content: [
      { type: "text", text: JSON.stringify(data ?? null, null, 2) },
    ],
  };
}

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

async function main() {
  await bridge.start();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`ready — ${tools.length} tools registered`);
}

main().catch((err) => {
  log("fatal:", err?.message || err);
  process.exit(1);
});
