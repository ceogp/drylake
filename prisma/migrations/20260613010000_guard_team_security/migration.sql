CREATE TABLE "GuardBaseline" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceHash" TEXT NOT NULL DEFAULT 'default',
  "guardScanId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuardBaseline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "mcpAllowlistJson" JSONB,
  "mcpDenylistJson" JSONB,
  "extensionAllowlistJson" JSONB,
  "extensionDenylistJson" JSONB,
  "uploadPolicyJson" JSONB,
  "redactionPolicyJson" JSONB,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "baselineComparisonJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CloudAnalysisJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "guardScanId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "approvedPayloadJson" JSONB NOT NULL,
  "resultJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CloudAnalysisJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardBaseline_organizationId_workspaceHash_key" ON "GuardBaseline"("organizationId", "workspaceHash");
CREATE INDEX "GuardBaseline_organizationId_createdAt_idx" ON "GuardBaseline"("organizationId", "createdAt");
CREATE INDEX "GuardBaseline_guardScanId_idx" ON "GuardBaseline"("guardScanId");

CREATE UNIQUE INDEX "TeamPolicy_organizationId_key" ON "TeamPolicy"("organizationId");

CREATE INDEX "CloudAnalysisJob_organizationId_createdAt_idx" ON "CloudAnalysisJob"("organizationId", "createdAt");
CREATE INDEX "CloudAnalysisJob_actorUserId_createdAt_idx" ON "CloudAnalysisJob"("actorUserId", "createdAt");
CREATE INDEX "CloudAnalysisJob_guardScanId_idx" ON "CloudAnalysisJob"("guardScanId");
CREATE INDEX "CloudAnalysisJob_status_createdAt_idx" ON "CloudAnalysisJob"("status", "createdAt");

ALTER TABLE "GuardBaseline" ADD CONSTRAINT "GuardBaseline_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardBaseline" ADD CONSTRAINT "GuardBaseline_guardScanId_fkey" FOREIGN KEY ("guardScanId") REFERENCES "GuardScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardBaseline" ADD CONSTRAINT "GuardBaseline_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeamPolicy" ADD CONSTRAINT "TeamPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CloudAnalysisJob" ADD CONSTRAINT "CloudAnalysisJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudAnalysisJob" ADD CONSTRAINT "CloudAnalysisJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudAnalysisJob" ADD CONSTRAINT "CloudAnalysisJob_guardScanId_fkey" FOREIGN KEY ("guardScanId") REFERENCES "GuardScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
