import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string, dev?: boolean) => void;
};

loadEnvConfig(process.cwd(), true);

async function main() {
  const [{ processQueuedDeploymentJobs }, { processQueuedTransformJobs }, { prisma }] =
    await Promise.all([
    import("../lib/services/deployments"),
    import("../lib/services/import-export"),
    import("../lib/prisma"),
    ]);

  const transformResults = await processQueuedTransformJobs({
    limit: Number(process.env.WORKER_BATCH_SIZE ?? 5),
  });
  const deploymentResults = await processQueuedDeploymentJobs({
    limit: Number(process.env.WORKER_BATCH_SIZE ?? 5),
  });

  console.log(
    JSON.stringify(
      {
        processedTransforms: transformResults.length,
        processedDeployments: deploymentResults.length,
        statuses: [
          ...transformResults.map((result) => ({
            id: result.job.id,
            status: result.job.status,
            kind: "transform",
          })),
          ...deploymentResults.map((result) => ({
            id: result.job.id,
            status: result.job.status,
            kind: "deployment",
          })),
        ],
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
