import { prisma } from "@/lib/prisma";

export async function getAuditEvents(organizationId: string) {
  return prisma.auditEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getUsageSummary(organizationId: string) {
  const [projects, packages, versions, credentials, integrations, transformJobs, deploymentJobs] =
    await Promise.all([
      prisma.project.count({ where: { organizationId, archivedAt: null } }),
      prisma.agentPackage.count({ where: { project: { organizationId } } }),
      prisma.packageVersion.count({ where: { agentPackage: { project: { organizationId } } } }),
      prisma.credential.count({ where: { organizationId } }),
      prisma.integration.count({ where: { organizationId } }),
      prisma.transformJob.count({ where: { organizationId } }),
      prisma.deploymentJob.count({ where: { organizationId } }),
    ]);

  return {
    projects,
    packages,
    versions,
    credentials,
    integrations,
    transformJobs,
    deploymentJobs,
  };
}

export async function getDeploymentSummary(organizationId: string) {
  const deploymentJobs = await prisma.deploymentJob.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      deploymentTarget: true,
      packageVersion: {
        include: {
          agentPackage: true,
        },
      },
    },
  });

  const succeeded = deploymentJobs.filter((job) => job.status === "succeeded").length;
  const failed = deploymentJobs.filter((job) => job.status === "failed").length;

  return {
    total: deploymentJobs.length,
    succeeded,
    failed,
    successRate: deploymentJobs.length > 0 ? Number((succeeded / deploymentJobs.length).toFixed(2)) : 0,
    jobs: deploymentJobs,
  };
}
