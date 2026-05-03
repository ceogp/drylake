import { prisma } from "@/lib/prisma";
import { getSetupStatus } from "@/lib/services/setup";

const recentLimit = 50;

export async function getAdminOverviewData() {
  const [
    userCount,
    activeUserCount,
    organizationCount,
    projectCount,
    packageCount,
    versionCount,
    credentialCount,
    subscriptionCount,
    queuedTransformCount,
    runningTransformCount,
    failedTransformCount,
    queuedDeploymentCount,
    runningDeploymentCount,
    failedDeploymentCount,
    recentUsers,
    recentOrganizations,
    recentTransformJobs,
    recentDeploymentJobs,
    recentAuditEvents,
    setup,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.organization.count(),
    prisma.project.count(),
    prisma.agentPackage.count(),
    prisma.packageVersion.count(),
    prisma.credential.count(),
    prisma.subscription.count(),
    prisma.transformJob.count({ where: { status: "queued" } }),
    prisma.transformJob.count({ where: { status: "running" } }),
    prisma.transformJob.count({ where: { status: "failed" } }),
    prisma.deploymentJob.count({ where: { status: "queued" } }),
    prisma.deploymentJob.count({ where: { status: "running" } }),
    prisma.deploymentJob.count({ where: { status: "failed" } }),
    prisma.user.findMany({
      include: {
        profile: true,
        memberships: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.organization.findMany({
      include: {
        memberships: true,
        projects: true,
        subscriptions: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.transformJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        organization: true,
        createdByUser: true,
        project: true,
      },
    }),
    prisma.deploymentJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        organization: true,
        deploymentTarget: true,
        createdByUser: true,
        project: true,
      },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        organization: true,
        actorUser: true,
      },
    }),
    getSetupStatus(),
  ]);

  return {
    metrics: {
      userCount,
      activeUserCount,
      organizationCount,
      projectCount,
      packageCount,
      versionCount,
      credentialCount,
      subscriptionCount,
      queuedTransformCount,
      runningTransformCount,
      failedTransformCount,
      queuedDeploymentCount,
      runningDeploymentCount,
      failedDeploymentCount,
    },
    recentUsers,
    recentOrganizations,
    recentTransformJobs,
    recentDeploymentJobs,
    recentAuditEvents,
    setup,
  };
}

export async function getAdminUsersData() {
  const users = await prisma.user.findMany({
    include: {
      profile: true,
      memberships: {
        include: {
          organization: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: recentLimit,
  });

  return { users };
}

export async function getAdminUserDetailData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      memberships: {
        include: {
          organization: {
            include: {
              subscriptions: true,
              projects: {
                orderBy: { createdAt: "desc" },
                take: 8,
              },
            },
          },
        },
      },
      extensionAuthRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const [projectCount, packageCount, versionCount, transformJobs, deploymentJobs, auditEvents] =
    await Promise.all([
      prisma.project.count({ where: { createdByUserId: userId } }),
      prisma.agentPackage.count({ where: { createdByUserId: userId } }),
      prisma.packageVersion.count({ where: { createdByUserId: userId } }),
      prisma.transformJob.findMany({
        where: { createdByUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          organization: true,
          project: true,
        },
      }),
      prisma.deploymentJob.findMany({
        where: { createdByUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          organization: true,
          project: true,
          deploymentTarget: true,
        },
      }),
      prisma.auditEvent.findMany({
        where: { actorUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          organization: true,
        },
      }),
    ]);

  return {
    user,
    counts: {
      projectCount,
      packageCount,
      versionCount,
    },
    transformJobs,
    deploymentJobs,
    auditEvents,
  };
}

export async function getAdminBillingData() {
  const [subscriptions, totalSubscriptions, activeSubscriptions, proOrEnterpriseSubscriptions, stripeSubscriptions] =
    await Promise.all([
      prisma.subscription.findMany({
        include: {
          organization: true,
        },
        orderBy: { updatedAt: "desc" },
        take: recentLimit,
      }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: { in: ["active", "trialing", "trial"] } } }),
      prisma.subscription.count({ where: { tier: { in: ["pro", "enterprise"] } } }),
      prisma.subscription.count({ where: { stripeSubscriptionId: { not: null } } }),
    ]);

  return {
    subscriptions,
    metrics: {
      totalSubscriptions,
      activeSubscriptions,
      proOrEnterpriseSubscriptions,
      stripeSubscriptions,
    },
  };
}

export async function getAdminSkillsData() {
  const [latestVersions, latestSkillRules, latestSubagents, packageFileCount, skillRuleCount, subagentCount] =
    await Promise.all([
      prisma.packageVersion.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          agentPackage: {
            include: {
              project: {
                include: {
                  organization: true,
                },
              },
            },
          },
          _count: {
            select: {
              files: true,
              subagents: true,
              skillRules: true,
            },
          },
        },
      }),
      prisma.skillRule.findMany({
        orderBy: { createdAt: "desc" },
        take: recentLimit,
        include: {
          packageVersion: {
            include: {
              agentPackage: {
                include: {
                  project: {
                    include: {
                      organization: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.subagent.findMany({
        orderBy: { createdAt: "desc" },
        take: recentLimit,
        include: {
          packageVersion: {
            include: {
              agentPackage: {
                include: {
                  project: {
                    include: {
                      organization: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.packageFile.count(),
      prisma.skillRule.count(),
      prisma.subagent.count(),
    ]);

  return {
    latestVersions,
    latestSkillRules,
    latestSubagents,
    metrics: {
      packageFileCount,
      skillRuleCount,
      subagentCount,
    },
  };
}

export async function getAdminJobsData() {
  const [
    transformJobs,
    deploymentJobs,
    queuedTransformCount,
    runningTransformCount,
    failedTransformCount,
    queuedDeploymentCount,
    runningDeploymentCount,
    failedDeploymentCount,
  ] = await Promise.all([
    prisma.transformJob.findMany({
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      include: {
        organization: true,
        project: true,
        agentPackage: true,
        packageVersion: true,
        createdByUser: true,
      },
    }),
    prisma.deploymentJob.findMany({
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      include: {
        organization: true,
        project: true,
        packageVersion: true,
        deploymentTarget: true,
        createdByUser: true,
      },
    }),
    prisma.transformJob.count({ where: { status: "queued" } }),
    prisma.transformJob.count({ where: { status: "running" } }),
    prisma.transformJob.count({ where: { status: "failed" } }),
    prisma.deploymentJob.count({ where: { status: "queued" } }),
    prisma.deploymentJob.count({ where: { status: "running" } }),
    prisma.deploymentJob.count({ where: { status: "failed" } }),
  ]);

  return {
    transformJobs,
    deploymentJobs,
    metrics: {
      queuedTransformCount,
      runningTransformCount,
      failedTransformCount,
      queuedDeploymentCount,
      runningDeploymentCount,
      failedDeploymentCount,
    },
  };
}

export async function getAdminAuditData() {
  const sinceYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [auditEvents, totalAuditEvents, recentAuditEvents] = await Promise.all([
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        organization: true,
        actorUser: true,
      },
    }),
    prisma.auditEvent.count(),
    prisma.auditEvent.count({
      where: {
        createdAt: {
          gte: sinceYesterday,
        },
      },
    }),
  ]);

  return {
    auditEvents,
    metrics: {
      totalAuditEvents,
      recentAuditEvents,
    },
  };
}
