import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string, dev?: boolean) => void;
};

loadEnvConfig(process.cwd(), true);
process.env.JOB_EXECUTION_MODE = "worker";

async function main() {
  const [{ prisma }, { createDeploymentTarget, runDeploymentJob, processQueuedDeploymentJobs }] =
    await Promise.all([
    import("../lib/prisma"),
    import("../lib/services/deployments"),
    ]);

  const version = await prisma.packageVersion.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      agentPackage: true,
    },
  });

  if (!version) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "missing version",
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
    return;
  }

  let target = await prisma.deploymentTarget.findFirst({
    where: {
      projectId: version.agentPackage.projectId,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!target) {
    target = await createDeploymentTarget({
      projectId: version.agentPackage.projectId,
      createdByUserId: version.createdByUserId,
      name: "Worker Smoke Target",
      platform: "codex",
      deliveryMode: "local_mirror",
      repositoryPath: path.join(process.cwd(), "storage", "worker-smoke"),
      exportPath: ".",
    });
  }

  const queued = await runDeploymentJob({
    versionId: version.id,
    deploymentTargetId: target.id,
    createdByUserId: version.createdByUserId,
    triggerSource: "worker_smoke",
  });

  const processed = await processQueuedDeploymentJobs({
    limit: 1,
  });

  console.log(
    JSON.stringify(
      {
        queuedJobId: queued.job.id,
        queuedStatus: queued.job.status,
        processed: processed.map((item) => ({
          id: item.job.id,
          status: item.job.status,
        })),
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
