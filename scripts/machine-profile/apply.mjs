#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const profileRoot = path.join(repoRoot, "config");

function parseArgs(argv) {
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function backupIfExists(target) {
  if (!fs.existsSync(target)) {
    return "";
  }

  const backup = `${target}.bak-${timestamp()}`;
  fs.cpSync(target, backup, { recursive: true });
  return backup;
}

function copyFileWithBackup(source, target) {
  ensureDir(path.dirname(target));
  const backup = backupIfExists(target);
  fs.copyFileSync(source, target);
  if (backup) {
    console.log(`Backed up ${target} -> ${backup}`);
  }
}

function copyDirectoryContents(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      copyFileWithBackup(sourcePath, targetPath);
    }
  }
}

function commandExists(command, versionArgs = ["--version"]) {
  const result = spawnSync(command, versionArgs, {
    shell: process.platform === "win32",
    stdio: "ignore",
  });

  return !result.error && result.status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    shell: process.platform === "win32",
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return {
    ok: result.status === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
    status: result.status,
  };
}

function vscodeUserDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Code", "User");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Code", "User");
  }

  return path.join(os.homedir(), ".config", "Code", "User");
}

function vscodeCommand() {
  if (process.env.VSCODE_BIN) {
    return process.env.VSCODE_BIN;
  }

  if (process.platform === "win32") {
    const candidate = path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "bin", "code.cmd");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "code";
}

function applyVscode(flags) {
  if (flags["skip-vscode"] === "true") {
    console.log("Skipping VS Code profile.");
    return;
  }

  const source = path.join(profileRoot, "vscode-profile");
  const target = vscodeUserDir();

  console.log("Applying VS Code settings and keybindings.");
  copyFileWithBackup(path.join(source, "settings.json"), path.join(target, "settings.json"));
  copyFileWithBackup(path.join(source, "keybindings.json"), path.join(target, "keybindings.json"));

  if (flags["skip-vscode-extensions"] === "true") {
    console.log("Skipping VS Code extensions.");
    return;
  }

  const code = vscodeCommand();
  if (!commandExists(code)) {
    console.log("VS Code CLI was not found. Settings were copied, but extensions were not installed.");
    return;
  }

  const extensions = fs
    .readFileSync(path.join(source, "extensions.txt"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const failures = [];
  for (const extension of extensions) {
    const result = run(code, ["--install-extension", extension, "--force"], { capture: true });
    if (!result.ok) {
      failures.push(extension);
    }
  }

  if (failures.length > 0) {
    console.log(`VS Code extensions not installed: ${failures.join(", ")}`);
  } else {
    console.log(`VS Code extensions installed or already present: ${extensions.length}`);
  }
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function projectTrustBlock() {
  const projectPath = repoRoot.replace(/'/g, "\\'");
  return ["", `[projects.'${projectPath}']`, 'trust_level = "trusted"', ""].join("\n");
}

function applyCodex(flags) {
  if (flags["skip-codex"] === "true") {
    console.log("Skipping Codex profile.");
    return;
  }

  const source = path.join(profileRoot, "codex-profile");
  const target = codexHome();
  ensureDir(target);

  console.log("Applying Codex portable profile.");
  copyFileWithBackup(path.join(source, "AGENTS.md"), path.join(target, "AGENTS.md"));

  const configSource = path.join(source, "config.toml");
  const configTarget = path.join(target, "config.toml");
  const backup = backupIfExists(configTarget);
  fs.writeFileSync(configTarget, `${fs.readFileSync(configSource, "utf8").trimEnd()}${projectTrustBlock()}`);
  if (backup) {
    console.log(`Backed up ${configTarget} -> ${backup}`);
  }

  copyDirectoryContents(path.join(source, "agents"), path.join(target, "agents"));
  copyDirectoryContents(path.join(source, "rules"), path.join(target, "rules"));
  copyDirectoryContents(path.join(source, "skills"), path.join(target, "skills"));

  console.log("Codex auth is not copied. Run `codex login` on the new machine if needed.");
}

function installGlobalTools(flags) {
  if (flags["skip-global-tools"] === "true") {
    console.log("Skipping global npm tools.");
    return;
  }

  if (!commandExists("npm", ["--version"])) {
    console.log("npm was not found. Skipping global CLI tools.");
    return;
  }

  const listPath = path.join(profileRoot, "machine-profile", "npm-global.txt");
  const packages = fs
    .readFileSync(listPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const failures = [];
  for (const packageName of packages) {
    const result = run("npm", ["install", "-g", packageName], { capture: true });
    if (!result.ok) {
      failures.push(packageName);
    }
  }

  if (failures.length > 0) {
    console.log(`Global npm tools not installed: ${failures.join(", ")}`);
  } else {
    console.log(`Global npm tools installed or updated: ${packages.length}`);
  }
}

function main() {
  const flags = parseArgs(process.argv.slice(2));

  installGlobalTools(flags);
  applyVscode(flags);
  applyCodex(flags);

  console.log("Machine profile apply complete.");
}

main();
