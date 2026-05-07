ALTER TABLE "ExtensionAuthRequest"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "ExtensionAuthRequest"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "deniedAt" TIMESTAMP(3),
  ADD COLUMN "pollTokenHash" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX "ExtensionAuthRequest_status_expiresAt_idx"
  ON "ExtensionAuthRequest"("status", "expiresAt");