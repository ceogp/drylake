INSERT INTO "ProductAccount" (
    "id",
    "userId",
    "organizationId",
    "productKey",
    "status",
    "planIntent",
    "onboardingCompletedAt",
    "firstSeenAt",
    "lastSeenAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'drylake_' || SUBSTRING(MD5(u."id" || ':drylake') FROM 1 FOR 24),
    u."id",
    membership."organizationId",
    'drylake',
    u."status",
    p."signupPlanIntent",
    p."onboardingCompletedAt",
    u."createdAt",
    COALESCE(session_activity."lastSeenAt", u."updatedAt"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "Profile" p ON p."userId" = u."id"
LEFT JOIN LATERAL (
    SELECT om."organizationId"
    FROM "OrganizationMembership" om
    WHERE om."userId" = u."id"
    ORDER BY om."createdAt" ASC
    LIMIT 1
) membership ON true
LEFT JOIN LATERAL (
    SELECT MAX(s."lastSeenAt") AS "lastSeenAt"
    FROM "AppSession" s
    WHERE s."userId" = u."id"
) session_activity ON true
WHERE NOT EXISTS (
    SELECT 1
    FROM "ProductAccount" existing
    WHERE existing."userId" = u."id"
      AND existing."productKey" = 'drylake'
);
