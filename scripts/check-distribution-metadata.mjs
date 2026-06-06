import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const extensionPackagePath = path.join(root, "extensions", "xupra-drylake-vscode", "package.json");
const cursorMarketplacePath = path.join(root, ".cursor-plugin", "marketplace.json");
const cursorPluginPath = path.join(root, "drylake-cursor-plugin", ".cursor-plugin", "plugin.json");
const cursorMcpPath = path.join(root, "drylake-cursor-plugin", "mcp.json");
const mcpPackagePath = path.join(root, "packages", "drylake-mcp", "package.json");
const mcpServerJsonPath = path.join(root, "packages", "drylake-mcp", "server.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const extensionPackage = await readJson(extensionPackagePath);
const cursorMarketplace = await readJson(cursorMarketplacePath);
const cursorPlugin = await readJson(cursorPluginPath);
const cursorMcp = await readJson(cursorMcpPath);
const mcpPackage = await readJson(mcpPackagePath);
const mcpServerJson = await readJson(mcpServerJsonPath);

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

const cursorMarketplacePlugin = cursorMarketplace.plugins?.find((plugin) => plugin.name === cursorPlugin.name);
if (!cursorMarketplacePlugin) {
  failures.push("Cursor marketplace index must list drylake-agent-preflight.");
} else if (cursorMarketplacePlugin.source !== "drylake-cursor-plugin") {
  failures.push(
    `Cursor marketplace source must stay drylake-cursor-plugin, found ${cursorMarketplacePlugin.source}.`,
  );
}

if (cursorPlugin.version !== extensionPackage.version) {
  console.warn(
    `Cursor plugin version (${cursorPlugin.version}) does not match extension version (${extensionPackage.version}); this is allowed while the MCP package is versioned independently.`,
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

if (mcpPackage.name !== "@xupracorp/drylake-mcp") {
  failures.push(`MCP package name must stay @xupracorp/drylake-mcp, found ${mcpPackage.name}.`);
}

if (mcpPackage.mcpName !== "io.github.gmkdigitalmedia/drylake-mcp") {
  failures.push(`MCP package mcpName must stay io.github.gmkdigitalmedia/drylake-mcp, found ${mcpPackage.mcpName}.`);
}

if (mcpServerJson.name !== mcpPackage.mcpName) {
  failures.push(`MCP server.json name (${mcpServerJson.name}) must match package mcpName (${mcpPackage.mcpName}).`);
}

const npmPackage = mcpServerJson.packages?.find((item) => item.registryType === "npm");
if (!npmPackage || npmPackage.identifier !== mcpPackage.name) {
  failures.push("MCP server.json npm package identifier must match @xupracorp/drylake-mcp.");
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
console.log(`mcp package: ${mcpPackage.name}@${mcpPackage.version}`);
