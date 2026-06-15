-- Allow KYA registry companies and invoices to exist before a customer organization claims them.
ALTER TABLE "TrustCompany" DROP CONSTRAINT "TrustCompany_organizationId_fkey";
ALTER TABLE "TrustCompany" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "TrustCompany" ADD CONSTRAINT "TrustCompany_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrustBillingInvoice" DROP CONSTRAINT "TrustBillingInvoice_organizationId_fkey";
ALTER TABLE "TrustBillingInvoice" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "TrustBillingInvoice" ADD CONSTRAINT "TrustBillingInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrustBillingSubscription" DROP CONSTRAINT "TrustBillingSubscription_organizationId_fkey";
ALTER TABLE "TrustBillingSubscription" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "TrustBillingSubscription" ADD CONSTRAINT "TrustBillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TrustRegistryStandard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "summary" TEXT,
    "ecosystem" TEXT NOT NULL DEFAULT 'agent_to_agent',
    "controlsJson" JSONB NOT NULL,
    "credentialSchemaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustRegistryStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRegistryCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "companyId" TEXT,
    "organizationId" TEXT,
    "standardId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "outreachStatus" TEXT NOT NULL DEFAULT 'not_contacted',
    "interestStatus" TEXT NOT NULL DEFAULT 'unknown',
    "paymentStatus" TEXT NOT NULL DEFAULT 'not_invoiced',
    "reviewStatus" TEXT NOT NULL DEFAULT 'not_started',
    "companyName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "primaryContactEmail" TEXT,
    "discoveredSource" TEXT,
    "discoveredUrl" TEXT,
    "rippleEcosystemScope" TEXT,
    "notes" TEXT,
    "publicListingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustRegistryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRegistryAsset" (
    "id" TEXT NOT NULL,
    "registryCaseId" TEXT NOT NULL,
    "companyId" TEXT,
    "productId" TEXT,
    "assetType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "sourceUrl" TEXT,
    "packageName" TEXT,
    "repositoryUrl" TEXT,
    "endpointUrl" TEXT,
    "agentCardUrl" TEXT,
    "did" TEXT,
    "protocol" TEXT,
    "description" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustRegistryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRegistryTestRun" (
    "id" TEXT NOT NULL,
    "registryCaseId" TEXT NOT NULL,
    "registryAssetId" TEXT,
    "provider" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "externalJobId" TEXT,
    "recommendation" TEXT,
    "riskClass" TEXT,
    "kyaLevel" TEXT,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "highFindings" INTEGER NOT NULL DEFAULT 0,
    "mediumFindings" INTEGER NOT NULL DEFAULT 0,
    "lowFindings" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "evidenceJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustRegistryTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRegistryEvent" (
    "id" TEXT NOT NULL,
    "registryCaseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "actor" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustRegistryEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TrustScanOrder" ADD COLUMN "registryCaseId" TEXT;
ALTER TABLE "TrustCertificate" ADD COLUMN "registryCaseId" TEXT;
ALTER TABLE "TrustCertificate" ADD COLUMN "registryAssetId" TEXT;
ALTER TABLE "TrustBillingInvoice" ADD COLUMN "registryCaseId" TEXT;
ALTER TABLE "TrustSurveyInvite" ADD COLUMN "registryCaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrustRegistryStandard_slug_version_key" ON "TrustRegistryStandard"("slug", "version");
CREATE INDEX "TrustRegistryStandard_status_idx" ON "TrustRegistryStandard"("status");
CREATE INDEX "TrustRegistryStandard_ecosystem_idx" ON "TrustRegistryStandard"("ecosystem");

CREATE UNIQUE INDEX "TrustRegistryCase_caseNumber_key" ON "TrustRegistryCase"("caseNumber");
CREATE INDEX "TrustRegistryCase_companyId_idx" ON "TrustRegistryCase"("companyId");
CREATE INDEX "TrustRegistryCase_organizationId_idx" ON "TrustRegistryCase"("organizationId");
CREATE INDEX "TrustRegistryCase_standardId_idx" ON "TrustRegistryCase"("standardId");
CREATE INDEX "TrustRegistryCase_status_updatedAt_idx" ON "TrustRegistryCase"("status", "updatedAt");
CREATE INDEX "TrustRegistryCase_outreachStatus_idx" ON "TrustRegistryCase"("outreachStatus");
CREATE INDEX "TrustRegistryCase_paymentStatus_idx" ON "TrustRegistryCase"("paymentStatus");
CREATE INDEX "TrustRegistryCase_reviewStatus_idx" ON "TrustRegistryCase"("reviewStatus");
CREATE INDEX "TrustRegistryCase_publicListingEnabled_idx" ON "TrustRegistryCase"("publicListingEnabled");

CREATE INDEX "TrustRegistryAsset_registryCaseId_idx" ON "TrustRegistryAsset"("registryCaseId");
CREATE INDEX "TrustRegistryAsset_companyId_idx" ON "TrustRegistryAsset"("companyId");
CREATE INDEX "TrustRegistryAsset_productId_idx" ON "TrustRegistryAsset"("productId");
CREATE INDEX "TrustRegistryAsset_assetType_idx" ON "TrustRegistryAsset"("assetType");
CREATE INDEX "TrustRegistryAsset_status_idx" ON "TrustRegistryAsset"("status");
CREATE INDEX "TrustRegistryAsset_did_idx" ON "TrustRegistryAsset"("did");

CREATE INDEX "TrustRegistryTestRun_registryCaseId_idx" ON "TrustRegistryTestRun"("registryCaseId");
CREATE INDEX "TrustRegistryTestRun_registryAssetId_idx" ON "TrustRegistryTestRun"("registryAssetId");
CREATE INDEX "TrustRegistryTestRun_provider_idx" ON "TrustRegistryTestRun"("provider");
CREATE INDEX "TrustRegistryTestRun_testType_idx" ON "TrustRegistryTestRun"("testType");
CREATE INDEX "TrustRegistryTestRun_status_idx" ON "TrustRegistryTestRun"("status");
CREATE INDEX "TrustRegistryTestRun_riskClass_idx" ON "TrustRegistryTestRun"("riskClass");
CREATE INDEX "TrustRegistryTestRun_kyaLevel_idx" ON "TrustRegistryTestRun"("kyaLevel");

CREATE INDEX "TrustRegistryEvent_registryCaseId_createdAt_idx" ON "TrustRegistryEvent"("registryCaseId", "createdAt");
CREATE INDEX "TrustRegistryEvent_eventType_idx" ON "TrustRegistryEvent"("eventType");

CREATE INDEX "TrustScanOrder_registryCaseId_idx" ON "TrustScanOrder"("registryCaseId");
CREATE INDEX "TrustCertificate_registryCaseId_idx" ON "TrustCertificate"("registryCaseId");
CREATE INDEX "TrustCertificate_registryAssetId_idx" ON "TrustCertificate"("registryAssetId");
CREATE INDEX "TrustBillingInvoice_registryCaseId_idx" ON "TrustBillingInvoice"("registryCaseId");
CREATE INDEX "TrustSurveyInvite_registryCaseId_idx" ON "TrustSurveyInvite"("registryCaseId");

-- AddForeignKey
ALTER TABLE "TrustRegistryCase" ADD CONSTRAINT "TrustRegistryCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustRegistryCase" ADD CONSTRAINT "TrustRegistryCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustRegistryCase" ADD CONSTRAINT "TrustRegistryCase_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "TrustRegistryStandard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrustRegistryAsset" ADD CONSTRAINT "TrustRegistryAsset_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustRegistryAsset" ADD CONSTRAINT "TrustRegistryAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrustCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustRegistryAsset" ADD CONSTRAINT "TrustRegistryAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TrustProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrustRegistryTestRun" ADD CONSTRAINT "TrustRegistryTestRun_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustRegistryTestRun" ADD CONSTRAINT "TrustRegistryTestRun_registryAssetId_fkey" FOREIGN KEY ("registryAssetId") REFERENCES "TrustRegistryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrustRegistryEvent" ADD CONSTRAINT "TrustRegistryEvent_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrustScanOrder" ADD CONSTRAINT "TrustScanOrder_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_registryAssetId_fkey" FOREIGN KEY ("registryAssetId") REFERENCES "TrustRegistryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustBillingInvoice" ADD CONSTRAINT "TrustBillingInvoice_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustSurveyInvite" ADD CONSTRAINT "TrustSurveyInvite_registryCaseId_fkey" FOREIGN KEY ("registryCaseId") REFERENCES "TrustRegistryCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
