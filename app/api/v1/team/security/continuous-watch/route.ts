import { Prisma } from "@prisma/client";
import { z } from "zod";

import { forbidden, fromZodError, internalError, ok, unauthorized } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForOrganization } from "@/lib/services/entitlements";
import {
  getRequestOrganizationContext,
  INVALID_EXTENSION_TOKEN_ERROR,
  REQUEST_AUTHENTICATION_REQUIRED_ERROR,
} from "@/lib/services/request-organization";
import { evaluateContinuousWatch } from "@/lib/services/team-security";

const watchSchema = z.object({
  action: z.enum(["record", "evaluate"]).default("record"),
  guardScanId: z.string().min(1).optional(),
  workspaceHash: z.string().trim().min(1).max(160).optional(),
  eventType: z.enum(["scheduled_scan", "extension_check_in", "baseline_drift", "policy_violation"]).default("extension_check_in"),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).default("info"),
  logicalPath: z.string().trim().min(1).max(1000).default("workspace"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  try {
    const context = await getRequestOrganizationContext(request);
    const { resolved } = await getEntitlementsForOrganization(context.organizationId);

    if (!resolved.canUseContinuousWatch) {
      return forbidden("Continuous Watch requires Team Security.");
    }

    const events = await prisma.guardWatchEvent.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok({
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to load Continuous Watch history");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = watchSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const context = await getRequestOrganizationContext(request);
    const { resolved } = await getEntitlementsForOrganization(context.organizationId);

    if (!resolved.canUseContinuousWatch) {
      return forbidden("Continuous Watch requires Team Security.");
    }

    if (parsed.data.action === "evaluate") {
      const result = await evaluateContinuousWatch({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        guardScanId: parsed.data.guardScanId,
        workspaceHash: parsed.data.workspaceHash,
      });

      return ok(result);
    }

    const event = await prisma.guardWatchEvent.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        guardScanId: parsed.data.guardScanId,
        workspaceHash: parsed.data.workspaceHash,
        eventType: parsed.data.eventType,
        severity: parsed.data.severity,
        logicalPath: parsed.data.logicalPath,
        metadataJson: parsed.data.metadata ? asJson(parsed.data.metadata) : undefined,
      },
    });

    return ok({
      event: {
        id: event.id,
        eventType: event.eventType,
        severity: event.severity,
        logicalPath: event.logicalPath,
        createdAt: event.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_AUTHENTICATION_REQUIRED_ERROR) {
      return unauthorized();
    }

    if (error instanceof Error && error.message === INVALID_EXTENSION_TOKEN_ERROR) {
      return unauthorized("The extension token is invalid or expired. Connect the extension again.");
    }

    console.error(error);
    return internalError("Failed to record Continuous Watch event");
  }
}
