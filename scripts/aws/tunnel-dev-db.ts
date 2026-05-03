import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type Manifest = {
  publicIp: string;
  sshUser: string;
  sshKeyPath: string;
  devRdsDatabase?: {
    endpointAddress?: string;
    endpointPort?: number;
    name: string;
    user: string;
  };
};

const manifestPath = path.join(process.cwd(), "storage", "staging", "staging-manifest.json");
const localPort = process.env.DEV_DATABASE_TUNNEL_PORT || "5433";

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
  const database = manifest.devRdsDatabase;

  if (!database?.endpointAddress) {
    throw new Error("Missing devRdsDatabase.endpointAddress in storage/staging/staging-manifest.json.");
  }

  const remote = `${manifest.sshUser}@${manifest.publicIp}`;
  const remotePort = String(database.endpointPort ?? 5432);
  const localForward = `${localPort}:${database.endpointAddress}:${remotePort}`;

  console.log(`Opening PostgreSQL tunnel on 127.0.0.1:${localPort} for ${database.name}.`);
  console.log("Keep this process running while using the local dev app.");

  const child = spawn(
    "ssh",
    [
      "-N",
      "-L",
      localForward,
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "ServerAliveInterval=30",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-i",
      manifest.sshKeyPath,
      remote,
    ],
    { stdio: "inherit" },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
