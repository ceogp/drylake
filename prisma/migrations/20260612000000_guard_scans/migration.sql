CREATE TABLE "GuardScan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "sourceClient" TEXT NOT NULL DEFAULT 'vscode',
  "workspaceHash" TEXT,
  "score" INTEGER NOT NULL,
  "rank" TEXT NOT NULL,
  "consentMode" TEXT NOT NULL DEFAULT 'local',
  "uploadedArtifactCount" INTEGER NOT NULL DEFAULT 0,
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summaryJson" JSONB NOT NULL,
  "categoryScoresJson" JSONB NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "connectionMapJson" JSONB,
  CONSTRAINT "GuardScan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardArtifact" (
  "id" TEXT NOT NULL,
  "guardScanId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "logicalPath" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "redacted" BOOLEAN NOT NULL DEFAULT true,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardWatchEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "guardScanId" TEXT,
  "workspaceHash" TEXT,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "logicalPath" TEXT NOT NULL,
  "previousHash" TEXT,
  "currentHash" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardWatchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuardScan_organizationId_createdAt_idx" ON "GuardScan"("organizationId", "createdAt");
CREATE INDEX "GuardScan_organizationId_workspaceHash_createdAt_idx" ON "GuardScan"("organizationId", "workspaceHash", "createdAt");
CREATE INDEX "GuardScan_organizationId_score_idx" ON "GuardScan"("organizationId", "score");
CREATE INDEX "GuardArtifact_guardScanId_idx" ON "GuardArtifact"("guardScanId");
CREATE INDEX "GuardArtifact_organizationId_createdAt_idx" ON "GuardArtifact"("organizationId", "createdAt");
CREATE INDEX "GuardArtifact_organizationId_logicalPath_idx" ON "GuardArtifact"("organizationId", "logicalPath");
CREATE INDEX "GuardArtifact_contentHash_idx" ON "GuardArtifact"("contentHash");
CREATE INDEX "GuardWatchEvent_organizationId_createdAt_idx" ON "GuardWatchEvent"("organizationId", "createdAt");
CREATE INDEX "GuardWatchEvent_organizationId_workspaceHash_createdAt_idx" ON "GuardWatchEvent"("organizationId", "workspaceHash", "createdAt");
CREATE INDEX "GuardWatchEvent_organizationId_eventType_createdAt_idx" ON "GuardWatchEvent"("organizationId", "eventType", "createdAt");

ALTER TABLE "GuardScan"
  ADD CONSTRAINT "GuardScan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardScan"
  ADD CONSTRAINT "GuardScan_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardArtifact"
  ADD CONSTRAINT "GuardArtifact_guardScanId_fkey"
  FOREIGN KEY ("guardScanId") REFERENCES "GuardScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardArtifact"
  ADD CONSTRAINT "GuardArtifact_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardArtifact"
  ADD CONSTRAINT "GuardArtifact_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardWatchEvent"
  ADD CONSTRAINT "GuardWatchEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardWatchEvent"
  ADD CONSTRAINT "GuardWatchEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuardWatchEvent"
  ADD CONSTRAINT "GuardWatchEvent_guardScanId_fkey"
  FOREIGN KEY ("guardScanId") REFERENCES "GuardScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
