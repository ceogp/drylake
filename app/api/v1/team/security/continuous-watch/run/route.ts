import { forbidden, internalError, ok } from "@/lib/api/http";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import { evaluateContinuousWatch } from "@/lib/services/team-security";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? "";
}

export async function POST(request: Request) {
  try {
    if (!env.CONTINUOUS_WATCH_CRON_SECRET || bearerToken(request) !== env.CONTINUOUS_WATCH_CRON_SECRET) {
      return forbidden("Continuous Watch scheduler authorization failed.");
    }

    const organizations = await prisma.organization.findMany({
      where: {
        status: "active",
        OR: [
          { tier: { in: ["team_security", "enterprise"] } },
          {
            subscriptions: {
              some: {
                tier: { in: ["team_security", "enterprise"] },
                status: { in: ["active", "trialing", "trial"] },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const results = [];

    for (const organization of organizations) {
      const { resolved } = await getEntitlementsForOrganization(organization.id);

      if (!resolved.canUseContinuousWatch) {
        continue;
      }

      const result = await evaluateContinuousWatch({
        organizationId: organization.id,
      });

      results.push({
        organizationId: organization.id,
        ...result,
      });
    }

    return ok({
      evaluatedOrganizationCount: results.length,
      results,
    });
  } catch (error) {
    console.error(error);
    return internalError("Failed to run Continuous Watch scheduler.");
  }
}
