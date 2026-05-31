import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const vsixPath = join(root, `drylake-${version}.vsix`);
const distPath = join(root, "dist", "extension.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(existsSync(vsixPath), `Missing packaged VSIX: ${vsixPath}`);
assert(existsSync(distPath), `Missing built extension bundle: ${distPath}`);

const vsixContents = execFileSync("tar", ["-tf", vsixPath], { encoding: "utf8" });
assert(vsixContents.includes("extension/package.json"), "VSIX does not include extension/package.json.");
assert(vsixContents.includes("extension/dist/extension.js"), "VSIX does not include extension/dist/extension.js.");

const compiled = readFileSync(distPath, "utf8");
assert(
  compiled.includes("writeRunbook(runbookUri, localDraft)"),
  "Compiled bundle does not write the local draft before hosted planning.",
);
assert(
  compiled.includes("could not refine the starter plan"),
  "Compiled bundle does not contain the starter-plan failure message.",
);
assert(
  !compiled.includes("Connect your DryLake account before starting a DryLake plan."),
  "Compiled bundle still contains the old pre-card connection gate.",
);

console.log(`Card generation VSIX smoke passed for drylake-${version}.vsix`);
