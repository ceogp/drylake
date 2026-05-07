import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "..");
const buildRoot = path.join(extensionRoot, ".development-extension");

const DEV_BASE_URL = (process.env.XUPRA_DEVELOPMENT_BASE_URL ?? "https://drylake-dev.xupracorp.com").replace(/\/+$/, "");
const DEV_DISPLAY_NAME = process.env.XUPRA_DEVELOPMENT_DISPLAY_NAME ?? "Xupra DryLake Development";
const DEV_PACKAGE_NAME = "drylake-development";
const DEV_EXTENSION_ID = "xupra.drylake-development";
const DEV_PREFIX = "xupraDev";
const devVsixDir = path.join(extensionRoot, "development-vsix");
const DEV_OUTPUT = path.join(devVsixDir, `${DEV_PACKAGE_NAME}-0.1.4.vsix`);
const OWNER_DEV_EMAIL = "owner@xupra.local";
const OWNER_DEV_EMAIL_PLACEHOLDER = "__XUPRA_OWNER_DEV_EMAIL__";

function transformString(value) {
  return value
    .replaceAll(OWNER_DEV_EMAIL, OWNER_DEV_EMAIL_PLACEHOLDER)
    .replaceAll("https://drylake.xupracorp.com", DEV_BASE_URL)
    .replaceAll("@ext:xupra.drylake xupra", `@ext:${DEV_EXTENSION_ID} ${DEV_PREFIX}`)
    .replaceAll("Xupra DryLake", DEV_DISPLAY_NAME)
    .replaceAll("xupra.", `${DEV_PREFIX}.`)
    .replaceAll('"xupra"', `"${DEV_PREFIX}"`)
    .replaceAll("'xupra'", `'${DEV_PREFIX}'`)
    .replaceAll(`@ext:${DEV_PREFIX}.drylake-development ${DEV_PREFIX}`, `@ext:${DEV_EXTENSION_ID} ${DEV_PREFIX}`)
    .replaceAll(OWNER_DEV_EMAIL_PLACEHOLDER, OWNER_DEV_EMAIL);
}

function transformJson(value) {
  if (typeof value === "string") {
    return transformString(value);
  }

  if (Array.isArray(value)) {
    return value.map(transformJson);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    const nextKey =
      key === "xupra"
        ? DEV_PREFIX
        : key.startsWith("xupra.")
          ? `${DEV_PREFIX}.${key.slice("xupra.".length)}`
          : key;
    next[nextKey] = transformJson(child);
  }
  return next;
}

async function copyDirectory(source, target) {
  await fs.cp(source, target, {
    recursive: true,
    filter: (item) => !item.includes(`${path.sep}.development-extension${path.sep}`),
  });
}

async function transformSourceDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await transformSourceDirectory(sourcePath, targetPath);
      continue;
    }

    const content = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(targetPath, transformString(content), "utf8");
  }
}

async function writePackageJson() {
  const packagePath = path.join(extensionRoot, "package.json");
  const sourcePackage = JSON.parse(await fs.readFile(packagePath, "utf8"));
  const pkg = {
    ...sourcePackage,
    name: DEV_PACKAGE_NAME,
    displayName: DEV_DISPLAY_NAME,
    description:
      "Development build of Xupra DryLake. Uses the development DryLake backend by default and can be installed beside production.",
    homepage: `${DEV_BASE_URL}/app`,
    main: "./dist/extension.js",
    activationEvents: transformJson(sourcePackage.activationEvents),
    contributes: transformJson(sourcePackage.contributes),
    scripts: {},
  };

  pkg.contributes.configuration.title = DEV_DISPLAY_NAME;
  pkg.contributes.configuration.properties[`${DEV_PREFIX}.baseUrl`].default = DEV_BASE_URL;
  pkg.contributes.configuration.properties[`${DEV_PREFIX}.baseUrl`].description =
    "Base URL for the Xupra DryLake development backend.";

  await fs.writeFile(path.join(buildRoot, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function main() {
  await fs.rm(buildRoot, { recursive: true, force: true });
  await fs.mkdir(buildRoot, { recursive: true });
  await fs.mkdir(devVsixDir, { recursive: true });

  await Promise.all([
    copyDirectory(path.join(extensionRoot, "media"), path.join(buildRoot, "media")),
    fs.copyFile(path.join(extensionRoot, "LICENSE.txt"), path.join(buildRoot, "LICENSE.txt")),
    fs.copyFile(path.join(extensionRoot, "README.md"), path.join(buildRoot, "README.md")),
    fs.copyFile(path.join(extensionRoot, ".vscodeignore"), path.join(buildRoot, ".vscodeignore")),
    transformSourceDirectory(path.join(extensionRoot, "src"), path.join(buildRoot, "src")),
    writePackageJson(),
  ]);

  await esbuild.build({
    entryPoints: [path.join(buildRoot, "src", "extension.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(buildRoot, "dist", "extension.js"),
    external: ["vscode"],
    sourcemap: true,
    target: "node20",
    logLevel: "info",
  });

  const vsceBin = process.platform === "win32"
    ? path.join(extensionRoot, "node_modules", ".bin", "vsce.cmd")
    : path.join(extensionRoot, "node_modules", ".bin", "vsce");

  const packageCommand = existsSync(vsceBin) ? vsceBin : "npx";
  const packageArgs = existsSync(vsceBin)
    ? ["package", "--allow-star-activation", "--out", DEV_OUTPUT]
    : ["@vscode/vsce", "package", "--allow-star-activation", "--out", DEV_OUTPUT];

  run(packageCommand, packageArgs, { cwd: buildRoot });

  console.log("");
  console.log(`Created ${DEV_OUTPUT}`);
  console.log(`Extension ID: ${DEV_EXTENSION_ID}`);
  console.log(`Configuration namespace: ${DEV_PREFIX}`);
  console.log(`Default backend: ${DEV_BASE_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
