CREATE TABLE "ProductAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "productKey" TEXT NOT NULL DEFAULT 'drylake',
    "status" TEXT NOT NULL DEFAULT 'active',
    "planIntent" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductAccount_userId_productKey_key" ON "ProductAccount"("userId", "productKey");
CREATE INDEX "ProductAccount_productKey_createdAt_idx" ON "ProductAccount"("productKey", "createdAt");
CREATE INDEX "ProductAccount_organizationId_productKey_idx" ON "ProductAccount"("organizationId", "productKey");
CREATE INDEX "ProductAccount_planIntent_idx" ON "ProductAccount"("planIntent");
CREATE INDEX "ProductAccount_status_idx" ON "ProductAccount"("status");

ALTER TABLE "ProductAccount" ADD CONSTRAINT "ProductAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAccount" ADD CONSTRAINT "ProductAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE VIEW "UserTrackingReport" AS
SELECT
    u."id" AS "userId",
    u."email",
    u."authProvider",
    u."status" AS "userStatus",
    u."createdAt" AS "userCreatedAt",
    p."displayName",
    p."phoneNumber",
    p."country",
    p."addressLine1",
    p."addressLine2",
    p."city",
    p."region",
    p."postalCode",
    p."timezone",
    p."locale",
    p."signupPlanIntent",
    p."onboardingCompletedAt",
    pa."productKey",
    pa."status" AS "productStatus",
    pa."planIntent" AS "productPlanIntent",
    pa."firstSeenAt",
    pa."lastSeenAt",
    o."id" AS "organizationId",
    o."name" AS "organizationName",
    o."tier" AS "organizationTier",
    latest_subscription."tier" AS "subscriptionTier",
    latest_subscription."status" AS "subscriptionStatus",
    latest_subscription."provider" AS "subscriptionProvider",
    latest_subscription."currentPeriodEndsAt" AS "subscriptionCurrentPeriodEnd",
    COALESCE(session_counts."sessionCount", 0) AS "sessionCount",
    COALESCE(auth_counts."authEventCount", 0) AS "authEventCount",
    COALESCE(guard_counts."guardScanCount", 0) AS "guardScanCount",
    COALESCE(cloud_counts."cloudAnalysisJobCount", 0) AS "cloudAnalysisJobCount"
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u."id"
LEFT JOIN "ProductAccount" pa ON pa."userId" = u."id"
LEFT JOIN "Organization" o ON o."id" = pa."organizationId"
LEFT JOIN LATERAL (
    SELECT s."tier", s."status", s."provider", s."currentPeriodEndsAt"
    FROM "Subscription" s
    WHERE s."organizationId" = o."id"
    ORDER BY s."updatedAt" DESC
    LIMIT 1
) latest_subscription ON true
LEFT JOIN (
    SELECT "userId", COUNT(*)::INT AS "sessionCount"
    FROM "AppSession"
    GROUP BY "userId"
) session_counts ON session_counts."userId" = u."id"
LEFT JOIN (
    SELECT "actorUserId", COUNT(*)::INT AS "authEventCount"
    FROM "AuthEvent"
    GROUP BY "actorUserId"
) auth_counts ON auth_counts."actorUserId" = u."id"
LEFT JOIN (
    SELECT "actorUserId", COUNT(*)::INT AS "guardScanCount"
    FROM "GuardScan"
    GROUP BY "actorUserId"
) guard_counts ON guard_counts."actorUserId" = u."id"
LEFT JOIN (
    SELECT "actorUserId", COUNT(*)::INT AS "cloudAnalysisJobCount"
    FROM "CloudAnalysisJob"
    GROUP BY "actorUserId"
) cloud_counts ON cloud_counts."actorUserId" = u."id";
