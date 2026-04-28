import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recordAuditEvent(params: {
  organizationId: string;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      metadataJson: params.metadata,
    },
  });
}
