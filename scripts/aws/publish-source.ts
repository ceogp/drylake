import { loadEnvConfig } from "@next/env";
import { CodePipelineClient, GetPipelineCommand, StartPipelineExecutionCommand } from "@aws-sdk/client-codepipeline";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

loadEnvConfig(process.cwd());

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const codepipeline = new CodePipelineClient({ region });
const s3 = new S3Client({ region });

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function run(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "inherit"],
      shell: false,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output.trim());
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

function pipelineNameForTarget(targetEnv: string) {
  return process.env.PIPELINE_NAME || `xupra-drylake-${targetEnv}`;
}

async function resolveS3Source(pipelineName: string) {
  const response = await codepipeline.send(new GetPipelineCommand({ name: pipelineName }));
  const sourceAction = response.pipeline?.stages?.find((stage) => stage.name === "Source")?.actions?.[0];

  if (!sourceAction) {
    throw new Error(`Pipeline ${pipelineName} is missing a Source stage.`);
  }

  if (sourceAction.actionTypeId?.provider !== "S3") {
    throw new Error(`Pipeline ${pipelineName} source provider is ${sourceAction.actionTypeId?.provider ?? "unknown"}, not S3.`);
  }

  const bucket = sourceAction.configuration?.S3Bucket;
  const objectKey = sourceAction.configuration?.S3ObjectKey;

  if (!bucket || !objectKey) {
    throw new Error(`Pipeline ${pipelineName} S3 source is missing S3Bucket or S3ObjectKey.`);
  }

  return { bucket, objectKey };
}

async function main() {
  const targetEnv = requireEnv("TARGET_ENV");
  const pipelineName = pipelineNameForTarget(targetEnv);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `xupra-publish-${targetEnv}-`));
  const zipPath = path.join(tempDir, "source.zip");

  try {
    const commitSha = await run("git", ["rev-parse", "HEAD"]);
    const refName = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const { bucket, objectKey } = await resolveS3Source(pipelineName);

    await run("git", ["archive", "--format=zip", "HEAD", "-o", zipPath]);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: await fs.readFile(zipPath),
        ContentType: "application/zip",
        Metadata: {
          commitsha: commitSha,
          ref: refName,
          publishedusec: new Date().toISOString(),
        },
      }),
    );

    const started = await codepipeline.send(new StartPipelineExecutionCommand({ name: pipelineName }));

    console.log(
      JSON.stringify(
        {
          targetEnv,
          pipelineName,
          bucket,
          objectKey,
          commitSha,
          refName,
          pipelineExecutionId: started.pipelineExecutionId ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
