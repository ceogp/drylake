CREATE TABLE "ExtensionUsageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventName" TEXT NOT NULL,
  "sessionId" TEXT,
  "workspaceHash" TEXT,
  "phaseId" TEXT,
  "phaseTitle" TEXT,
  "agentId" TEXT,
  "skillLogicalPath" TEXT,
  "actionType" TEXT,
  "launchStatus" TEXT,
  "reasonCode" TEXT,
  "promptEstimatedTokens" INTEGER,
  "promptKind" TEXT,
  "promptPreview" TEXT,
  "promptText" TEXT,
  "promptHash" TEXT,
  "promptCaptured" BOOLEAN NOT NULL DEFAULT false,
  "promptCaptureMode" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExtensionUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExtensionUsageEvent_organizationId_createdAt_idx"
  ON "ExtensionUsageEvent"("organizationId", "createdAt");

CREATE INDEX "ExtensionUsageEvent_organizationId_eventName_createdAt_idx"
  ON "ExtensionUsageEvent"("organizationId", "eventName", "createdAt");

CREATE INDEX "ExtensionUsageEvent_organizationId_agentId_idx"
  ON "ExtensionUsageEvent"("organizationId", "agentId");

CREATE INDEX "ExtensionUsageEvent_organizationId_skillLogicalPath_idx"
  ON "ExtensionUsageEvent"("organizationId", "skillLogicalPath");

CREATE INDEX "ExtensionUsageEvent_organizationId_promptHash_idx"
  ON "ExtensionUsageEvent"("organizationId", "promptHash");

ALTER TABLE "ExtensionUsageEvent"
  ADD CONSTRAINT "ExtensionUsageEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtensionUsageEvent"
  ADD CONSTRAINT "ExtensionUsageEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
