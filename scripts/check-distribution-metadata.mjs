import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const extensionPackagePath = path.join(root, "extensions", "xupra-drylake-vscode", "package.json");
const cursorPluginPath = path.join(root, "drylake-cursor-plugin", ".cursor-plugin", "plugin.json");
const cursorMcpPath = path.join(root, "drylake-cursor-plugin", "mcp.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const extensionPackage = await readJson(extensionPackagePath);
const cursorPlugin = await readJson(cursorPluginPath);
const cursorMcp = await readJson(cursorMcpPath);

const failures = [];

if (extensionPackage.publisher !== "xupracorp") {
  failures.push(`Extension publisher must stay xupracorp, found ${extensionPackage.publisher}.`);
}

if (extensionPackage.name !== "drylake") {
  failures.push(`Extension name must stay drylake, found ${extensionPackage.name}.`);
}

if (cursorPlugin.name !== "drylake-agent-preflight") {
  failures.push(`Cursor plugin name must stay drylake-agent-preflight, found ${cursorPlugin.name}.`);
}

if (cursorPlugin.version !== extensionPackage.version) {
  failures.push(
    `Cursor plugin version (${cursorPlugin.version}) must match extension version (${extensionPackage.version}).`,
  );
}

const drylakeServer = cursorMcp?.mcpServers?.drylake;
if (!drylakeServer) {
  failures.push("Cursor MCP config must define mcpServers.drylake.");
} else {
  if (drylakeServer.command !== "npx") {
    failures.push(`Cursor MCP command must be npx, found ${drylakeServer.command}.`);
  }

  const args = Array.isArray(drylakeServer.args) ? drylakeServer.args : [];
  if (!args.includes("@xupracorp/drylake-mcp")) {
    failures.push("Cursor MCP args must include @xupracorp/drylake-mcp.");
  }
}

if (failures.length > 0) {
  console.error("Distribution metadata check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Distribution metadata check passed.");
console.log(`extension: ${extensionPackage.publisher}.${extensionPackage.name}@${extensionPackage.version}`);
console.log(`cursor plugin: ${cursorPlugin.name}@${cursorPlugin.version}`);
