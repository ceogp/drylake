import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { publishTrustCertificateArtifacts } from "../../KYAregistry/services/publication";
import { env } from "../../lib/env";
import { prisma } from "../../lib/prisma";

async function main() {
  if (env.XUPRA_TRUST_PUBLICATION_DRIVER === "database") {
    throw new Error("XUPRA_TRUST_PUBLICATION_DRIVER=database. Set local or s3 before publishing KYA certificates.");
  }

  const certificateId = process.env.CERTIFICATE_ID?.trim() || null;
  const certificates = await prisma.trustCertificate.findMany({
    where: certificateId ? { certificateId } : { registryCaseId: { not: null } },
    include: {
      company: true,
      registryAsset: true,
    },
    orderBy: { issuedAt: "desc" },
  });

  if (certificates.length === 0) {
    console.log(JSON.stringify({ ok: true, published: 0, certificateId }, null, 2));
    return;
  }

  const published = [];

  for (const certificate of certificates) {
    const result = await publishTrustCertificateArtifacts({
      certificateId: certificate.certificateId,
      publicUrl: certificate.publicUrl ?? `https://xupracorp.com/kya-registry/certificates/${encodeURIComponent(certificate.certificateId)}`,
      badgeUrl: certificate.badgeUrl ?? `https://xupracorp.com/kya-registry/badges/${encodeURIComponent(certificate.certificateId)}`,
      signedCertificateJson: certificate.signedCertificateJson as Record<string, unknown>,
      canonicalJson: certificate.canonicalJson as Record<string, unknown>,
      manifest: {
        companyName: certificate.company.displayName,
        assetName: certificate.registryAsset?.name ?? null,
        assetType: certificate.registryAsset?.assetType ?? null,
        riskClass: certificate.riskClass,
        kyaLevel: certificate.kyaLevel,
        signatureAlgorithm: certificate.signatureAlgorithm,
        evidenceHash: certificate.evidenceHash,
      },
    });

    published.push({
      certificateId: certificate.certificateId,
      publication: result,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    driver: env.XUPRA_TRUST_PUBLICATION_DRIVER,
    published: published.length,
    certificates: published,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
