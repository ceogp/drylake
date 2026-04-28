import { readFile } from "node:fs/promises";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

const failures = [];
const warnings = [];
const allowedContributionKeys = new Set(["commands", "configuration", "menus", "views", "viewsContainers"]);

if (packageJson.enabledApiProposals) {
  failures.push("enabledApiProposals is not allowed for the shared VS Code/Cursor build.");
}

if (packageJson.browser) {
  warnings.push("browser entry detected. Keep the main extension on standard desktop APIs unless Cursor proves parity.");
}

for (const key of Object.keys(packageJson.contributes ?? {})) {
  if (!allowedContributionKeys.has(key)) {
    warnings.push(`Contribution '${key}' should be reviewed against Cursor compatibility.`);
  }
}

for (const activationEvent of packageJson.activationEvents ?? []) {
  if (!String(activationEvent).startsWith("on")) {
    warnings.push(`Activation event '${activationEvent}' is unusual for the compatibility profile.`);
  }
}

if (failures.length > 0) {
  console.error("Cursor compatibility check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Cursor compatibility check passed.");

if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
