-- CreateTable
CREATE TABLE "TrustCompany" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "sizeClass" TEXT NOT NULL DEFAULT 'small',
    "websiteUrl" TEXT NOT NULL,
    "primaryProductUrl" TEXT,
    "businessContactEmail" TEXT,
    "securityContactEmail" TEXT,
    "privacyContactEmail" TEXT,
    "githubOrganizationUrl" TEXT,
    "packageRegistryLinksJson" JSONB,
    "description" TEXT,
    "categoriesJson" JSONB,
    "japanMarketInterestJson" JSONB,
    "verifiedDomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCompanyDomain" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "txtRecordName" TEXT NOT NULL,
    "txtRecordValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustCompanyDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCompanyContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustCompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoriesJson" JSONB,
    "productUrl" TEXT,
    "repositoryUrl" TEXT,
    "packageName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustMcpServer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "packageType" TEXT,
    "packageIdentifier" TEXT,
    "repositoryUrl" TEXT,
    "officialRegistryUrl" TEXT,
    "remoteEndpoint" TEXT,
    "authMethod" TEXT,
    "requiredEnvVarsJson" JSONB,
    "requiresSecrets" BOOLEAN NOT NULL DEFAULT false,
    "filesystemAccess" TEXT NOT NULL DEFAULT 'none',
    "shellExecution" BOOLEAN NOT NULL DEFAULT false,
    "networkAccess" BOOLEAN NOT NULL DEFAULT false,
    "databaseWriteAccess" BOOLEAN NOT NULL DEFAULT false,
    "emailMessageAccess" BOOLEAN NOT NULL DEFAULT false,
    "walletPaymentAccess" BOOLEAN NOT NULL DEFAULT false,
    "productionWriteAccess" BOOLEAN NOT NULL DEFAULT false,
    "declaredToolsJson" JSONB,
    "discoveredToolsJson" JSONB,
    "declaredResourcesJson" JSONB,
    "discoveredResourcesJson" JSONB,
    "declaredPromptsJson" JSONB,
    "discoveredPromptsJson" JSONB,
    "declaredPermissionsJson" JSONB,
    "observedPermissionsJson" JSONB,
    "riskClass" TEXT NOT NULL DEFAULT 'MCP-R0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustMcpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustKyaQuestionnaire" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "answersJson" JSONB NOT NULL,
    "evidenceJson" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "kyaLevel" TEXT NOT NULL DEFAULT 'KYA-L0',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustKyaQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScanOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "billingInvoiceId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "scanType" TEXT NOT NULL DEFAULT 'basic_safety_scan',
    "requestedByEmail" TEXT,
    "submittedByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustScanOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScanRun" (
    "id" TEXT NOT NULL,
    "scanOrderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "recommendation" TEXT,
    "riskClass" TEXT,
    "kyaLevel" TEXT,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "highFindings" INTEGER NOT NULL DEFAULT 0,
    "mediumFindings" INTEGER NOT NULL DEFAULT 0,
    "lowFindings" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScanFinding" (
    "id" TEXT NOT NULL,
    "scanRunId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "recommendation" TEXT,
    "publicDisclosure" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustReviewDecision" (
    "id" TEXT NOT NULL,
    "scanOrderId" TEXT NOT NULL,
    "scanRunId" TEXT,
    "reviewerUserId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "stateAfter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCertificate" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "scanRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "scopeJson" JSONB NOT NULL,
    "standardVersion" TEXT NOT NULL DEFAULT 'mcp-kya-basic-v0.1',
    "riskClass" TEXT,
    "kyaLevel" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "evidenceHash" TEXT NOT NULL,
    "canonicalJson" JSONB NOT NULL,
    "signedCertificateJson" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL,
    "publicUrl" TEXT,
    "badgeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCertificateStatusEvent" (
    "id" TEXT NOT NULL,
    "certificateDbId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustCertificateStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustBadge" (
    "id" TEXT NOT NULL,
    "certificateDbId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "svgHash" TEXT,
    "lastRenderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustBillingInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "amountUsdCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "lineItemsJson" JSONB NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeInvoiceId" TEXT,
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustBillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustBillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "productId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountUsdCents" INTEGER NOT NULL DEFAULT 1000,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "customerEmail" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustBillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustSurveyInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "companyId" TEXT,
    "productId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "surveyType" TEXT NOT NULL DEFAULT 'kya_controls',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustSurveyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustCompany_slug_key" ON "TrustCompany"("slug");

-- CreateIndex
CREATE INDEX "TrustCompany_organizationId_idx" ON "TrustCompany"("organizationId");

-- CreateIndex
CREATE INDEX "TrustCompany_status_idx" ON "TrustCompany"("status");

-- CreateIndex
CREATE INDEX "TrustCompany_country_idx" ON "TrustCompany"("country");

-- CreateIndex
CREATE INDEX "TrustCompany_verifiedDomain_idx" ON "TrustCompany"("verifiedDomain");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCompanyDomain_companyId_domain_key" ON "TrustCompanyDomain"("companyId", "domain");

-- CreateIndex
CREATE INDEX "TrustCompanyDomain_domain_idx" ON "TrustCompanyDomain"("domain");

-- CreateIndex
CREATE INDEX "TrustCompanyDomain_status_idx" ON "TrustCompanyDomain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCompanyContact_companyId_kind_email_key" ON "TrustCompanyContact"("companyId", "kind", "email");

-- CreateIndex
CREATE INDEX "TrustCompanyContact_email_idx" ON "TrustCompanyContact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TrustProduct_companyId_slug_key" ON "TrustProduct"("companyId", "slug");

-- CreateIndex
CREATE INDEX "TrustProduct_companyId_idx" ON "TrustProduct"("companyId");

-- CreateIndex
CREATE INDEX "TrustProduct_status_idx" ON "TrustProduct"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustMcpServer_productId_key" ON "TrustMcpServer"("productId");

-- CreateIndex
CREATE INDEX "TrustMcpServer_companyId_idx" ON "TrustMcpServer"("companyId");

-- CreateIndex
CREATE INDEX "TrustMcpServer_riskClass_idx" ON "TrustMcpServer"("riskClass");

-- CreateIndex
CREATE INDEX "TrustMcpServer_transport_idx" ON "TrustMcpServer"("transport");

-- CreateIndex
CREATE INDEX "TrustKyaQuestionnaire_companyId_idx" ON "TrustKyaQuestionnaire"("companyId");

-- CreateIndex
CREATE INDEX "TrustKyaQuestionnaire_productId_idx" ON "TrustKyaQuestionnaire"("productId");

-- CreateIndex
CREATE INDEX "TrustKyaQuestionnaire_kyaLevel_idx" ON "TrustKyaQuestionnaire"("kyaLevel");

-- CreateIndex
CREATE INDEX "TrustScanOrder_companyId_state_idx" ON "TrustScanOrder"("companyId", "state");

-- CreateIndex
CREATE INDEX "TrustScanOrder_productId_idx" ON "TrustScanOrder"("productId");

-- CreateIndex
CREATE INDEX "TrustScanOrder_billingInvoiceId_idx" ON "TrustScanOrder"("billingInvoiceId");

-- CreateIndex
CREATE INDEX "TrustScanRun_scanOrderId_idx" ON "TrustScanRun"("scanOrderId");

-- CreateIndex
CREATE INDEX "TrustScanRun_companyId_createdAt_idx" ON "TrustScanRun"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustScanRun_productId_idx" ON "TrustScanRun"("productId");

-- CreateIndex
CREATE INDEX "TrustScanRun_status_idx" ON "TrustScanRun"("status");

-- CreateIndex
CREATE INDEX "TrustScanRun_riskClass_idx" ON "TrustScanRun"("riskClass");

-- CreateIndex
CREATE INDEX "TrustScanRun_kyaLevel_idx" ON "TrustScanRun"("kyaLevel");

-- CreateIndex
CREATE INDEX "TrustScanFinding_scanRunId_idx" ON "TrustScanFinding"("scanRunId");

-- CreateIndex
CREATE INDEX "TrustScanFinding_severity_idx" ON "TrustScanFinding"("severity");

-- CreateIndex
CREATE INDEX "TrustScanFinding_module_idx" ON "TrustScanFinding"("module");

-- CreateIndex
CREATE INDEX "TrustReviewDecision_scanOrderId_createdAt_idx" ON "TrustReviewDecision"("scanOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustReviewDecision_scanRunId_idx" ON "TrustReviewDecision"("scanRunId");

-- CreateIndex
CREATE INDEX "TrustReviewDecision_decision_idx" ON "TrustReviewDecision"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCertificate_certificateId_key" ON "TrustCertificate"("certificateId");

-- CreateIndex
CREATE INDEX "TrustCertificate_companyId_idx" ON "TrustCertificate"("companyId");

-- CreateIndex
CREATE INDEX "TrustCertificate_productId_idx" ON "TrustCertificate"("productId");

-- CreateIndex
CREATE INDEX "TrustCertificate_status_idx" ON "TrustCertificate"("status");

-- CreateIndex
CREATE INDEX "TrustCertificate_expiresAt_idx" ON "TrustCertificate"("expiresAt");

-- CreateIndex
CREATE INDEX "TrustCertificate_riskClass_idx" ON "TrustCertificate"("riskClass");

-- CreateIndex
CREATE INDEX "TrustCertificate_kyaLevel_idx" ON "TrustCertificate"("kyaLevel");

-- CreateIndex
CREATE INDEX "TrustCertificateStatusEvent_certificateDbId_createdAt_idx" ON "TrustCertificateStatusEvent"("certificateDbId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustCertificateStatusEvent_status_idx" ON "TrustCertificateStatusEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustBadge_certificateDbId_key" ON "TrustBadge"("certificateDbId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustBadge_certificateId_key" ON "TrustBadge"("certificateId");

-- CreateIndex
CREATE INDEX "TrustBadge_status_idx" ON "TrustBadge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustBillingInvoice_stripeInvoiceId_key" ON "TrustBillingInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "TrustBillingInvoice_organizationId_createdAt_idx" ON "TrustBillingInvoice"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustBillingInvoice_companyId_idx" ON "TrustBillingInvoice"("companyId");

-- CreateIndex
CREATE INDEX "TrustBillingInvoice_purpose_idx" ON "TrustBillingInvoice"("purpose");

-- CreateIndex
CREATE INDEX "TrustBillingInvoice_status_idx" ON "TrustBillingInvoice"("status");

-- CreateIndex
CREATE INDEX "TrustBillingInvoice_customerEmail_idx" ON "TrustBillingInvoice"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TrustBillingSubscription_stripeSubscriptionId_key" ON "TrustBillingSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "TrustBillingSubscription_organizationId_createdAt_idx" ON "TrustBillingSubscription"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustBillingSubscription_companyId_idx" ON "TrustBillingSubscription"("companyId");

-- CreateIndex
CREATE INDEX "TrustBillingSubscription_productId_idx" ON "TrustBillingSubscription"("productId");

-- CreateIndex
CREATE INDEX "TrustBillingSubscription_status_idx" ON "TrustBillingSubscription"("status");

-- CreateIndex
CREATE INDEX "TrustBillingSubscription_customerEmail_idx" ON "TrustBillingSubscription"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TrustSurveyInvite_tokenHash_key" ON "TrustSurveyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TrustSurveyInvite_organizationId_createdAt_idx" ON "TrustSurveyInvite"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustSurveyInvite_companyId_idx" ON "TrustSurveyInvite"("companyId");

-- CreateIndex
CREATE INDEX "TrustSurveyInvite_productId_idx" ON "TrustSurveyInvite"("productId");

-- CreateIndex
CREATE INDEX "TrustSurveyInvite_email_idx" ON "TrustSurveyInvite"("email");

-- CreateIndex
CREATE INDEX "TrustSurveyInvite_status_expiresAt_idx" ON "TrustSurveyInvite"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "TrustCompany" ADD CONSTRAINT "TrustCompany_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCompanyDomain" ADD CONSTRAINT "TrustCompanyDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCompanyContact" ADD CONSTRAINT "TrustCompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustProduct" ADD CONSTRAINT "TrustProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustMcpServer" ADD CONSTRAINT "TrustMcpServer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustKyaQuestionnaire" ADD CONSTRAINT "TrustKyaQuestionnaire_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanOrder" ADD CONSTRAINT "TrustScanOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanOrder" ADD CONSTRAINT "TrustScanOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanRun" ADD CONSTRAINT "TrustScanRun_scanOrderId_fkey" FOREIGN KEY ("scanOrderId") REFERENCES "TrustScanOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanRun" ADD CONSTRAINT "TrustScanRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanRun" ADD CONSTRAINT "TrustScanRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScanFinding" ADD CONSTRAINT "TrustScanFinding_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "TrustScanRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReviewDecision" ADD CONSTRAINT "TrustReviewDecision_scanOrderId_fkey" FOREIGN KEY ("scanOrderId") REFERENCES "TrustScanOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReviewDecision" ADD CONSTRAINT "TrustReviewDecision_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "TrustScanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "TrustScanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificateStatusEvent" ADD CONSTRAINT "TrustCertificateStatusEvent_certificateDbId_fkey" FOREIGN KEY ("certificateDbId") REFERENCES "TrustCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBadge" ADD CONSTRAINT "TrustBadge_certificateDbId_fkey" FOREIGN KEY ("certificateDbId") REFERENCES "TrustCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBillingInvoice" ADD CONSTRAINT "TrustBillingInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBillingInvoice" ADD CONSTRAINT "TrustBillingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBillingSubscription" ADD CONSTRAINT "TrustBillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBillingSubscription" ADD CONSTRAINT "TrustBillingSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustBillingSubscription" ADD CONSTRAINT "TrustBillingSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSurveyInvite" ADD CONSTRAINT "TrustSurveyInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSurveyInvite" ADD CONSTRAINT "TrustSurveyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSurveyInvite" ADD CONSTRAINT "TrustSurveyInvite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
