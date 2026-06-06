CREATE TABLE "AgentToken" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdByUserId" TEXT,
  "name" TEXT NOT NULL,
  "sourceClient" TEXT NOT NULL DEFAULT 'unknown',
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'trial',
  "plan" TEXT NOT NULL DEFAULT 'agent_trial',
  "scopesJson" JSONB NOT NULL,
  "balanceCredits" INTEGER NOT NULL DEFAULT 3,
  "freeCreditsUsed" INTEGER NOT NULL DEFAULT 0,
  "paidCreditsPurchased" INTEGER NOT NULL DEFAULT 0,
  "registrationIpHash" TEXT,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPreflightRun" (
  "id" TEXT NOT NULL,
  "agentTokenId" TEXT NOT NULL,
  "organizationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'created',
  "tier" TEXT NOT NULL,
  "sourceClient" TEXT NOT NULL DEFAULT 'unknown',
  "targetAgent" TEXT,
  "taskPreview" TEXT NOT NULL,
  "taskHash" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "creditsDebited" INTEGER NOT NULL,
  "estimatedOriginalTokens" INTEGER NOT NULL,
  "estimatedHandoffTokens" INTEGER NOT NULL,
  "planJson" JSONB NOT NULL,
  "handoffJson" JSONB NOT NULL,
  "assuranceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPreflightRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentToken_externalId_key" ON "AgentToken"("externalId");
CREATE UNIQUE INDEX "AgentToken_tokenHash_key" ON "AgentToken"("tokenHash");
CREATE INDEX "AgentToken_organizationId_status_idx" ON "AgentToken"("organizationId", "status");
CREATE INDEX "AgentToken_status_expiresAt_idx" ON "AgentToken"("status", "expiresAt");
CREATE INDEX "AgentToken_registrationIpHash_createdAt_idx" ON "AgentToken"("registrationIpHash", "createdAt");
CREATE INDEX "AgentPreflightRun_agentTokenId_createdAt_idx" ON "AgentPreflightRun"("agentTokenId", "createdAt");
CREATE INDEX "AgentPreflightRun_organizationId_createdAt_idx" ON "AgentPreflightRun"("organizationId", "createdAt");
CREATE INDEX "AgentPreflightRun_taskHash_idx" ON "AgentPreflightRun"("taskHash");

ALTER TABLE "AgentToken"
  ADD CONSTRAINT "AgentToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentToken"
  ADD CONSTRAINT "AgentToken_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentPreflightRun"
  ADD CONSTRAINT "AgentPreflightRun_agentTokenId_fkey"
  FOREIGN KEY ("agentTokenId") REFERENCES "AgentToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentPreflightRun"
  ADD CONSTRAINT "AgentPreflightRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
