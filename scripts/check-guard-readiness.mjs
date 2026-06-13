import { existsSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const mediaRoot = path.join(root, "public", "marketplace", "extension", "media");
const requiredFiles = [
  {
    name: "agent-control.gif",
    requiredForRelease: true,
    description: "Agent Control / coding workflow GIF",
  },
  {
    name: "guard-security.gif",
    requiredForRelease: process.env.REQUIRE_GUARD_SECURITY_GIF === "true",
    description: "DryLake Guard security workflow GIF",
  },
  {
    name: "guard-paid-features.gif",
    requiredForRelease: true,
    description: "DryLake Guard paid security workflow GIF",
  },
];
const failures = [];
const warnings = [];

for (const file of requiredFiles) {
  const fullPath = path.join(mediaRoot, file.name);

  if (!existsSync(fullPath)) {
    const message = `${file.description} is missing at ${path.relative(root, fullPath)}`;

    if (file.requiredForRelease) {
      failures.push(message);
    } else {
      warnings.push(`${message}. Set REQUIRE_GUARD_SECURITY_GIF=true to enforce this before release.`);
    }

    continue;
  }

  const size = statSync(fullPath).size;

  if (size <= 0) {
    failures.push(`${file.description} exists but is empty at ${path.relative(root, fullPath)}`);
  } else {
    console.log(`PASS ${file.name}: ${size} bytes`);
  }
}

if (!process.env.CONTINUOUS_WATCH_CRON_SECRET) {
  warnings.push("CONTINUOUS_WATCH_CRON_SECRET is not set in the current environment. Scheduler deployment still needs this secret.");
} else {
  console.log("PASS CONTINUOUS_WATCH_CRON_SECRET is present in this environment.");
}

if (!process.env.APP_BASE_URL) {
  warnings.push("APP_BASE_URL is not set in the current environment. Deployed URL verification needs APP_BASE_URL.");
} else {
  console.log(`PASS APP_BASE_URL=${process.env.APP_BASE_URL}`);
}

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }

  process.exit(1);
}

console.log("DryLake Guard readiness check completed.");
