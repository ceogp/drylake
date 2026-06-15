import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    XUPRA_TRUST_PUBLICATION_DRIVER: "local",
    XUPRA_TRUST_PUBLICATION_BUCKET: undefined,
    XUPRA_TRUST_PUBLICATION_PREFIX: "kya-registry",
    AWS_S3_BUCKET: undefined,
    AWS_KMS_KEY_ID: undefined,
  },
}));

vi.mock("@/lib/aws/clients", () => ({
  getS3Client: vi.fn(() => null),
}));

import { publishTrustCertificateArtifacts } from "@/KYAregistry/services/publication";

describe("trust certificate publication", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "kya-publication-"));
    process.env.XUPRA_TRUST_PUBLICATION_ROOT = root;
  });

  afterEach(async () => {
    delete process.env.XUPRA_TRUST_PUBLICATION_ROOT;
    await rm(root, { recursive: true, force: true });
  });

  it("writes signed certificate artifacts to local publication storage", async () => {
    const result = await publishTrustCertificateArtifacts({
      certificateId: "XMKS-KYA-2026-000401",
      publicUrl: "https://xupracorp.com/kya-registry/certificates/XMKS-KYA-2026-000401",
      badgeUrl: "https://xupracorp.com/kya-registry/badges/XMKS-KYA-2026-000401",
      signedCertificateJson: {
        certificateId: "XMKS-KYA-2026-000401",
        signatureAlgorithm: "AWS-KMS-RSASSA_PSS_SHA_256",
      },
      canonicalJson: {
        certificateId: "XMKS-KYA-2026-000401",
        status: "active",
      },
      manifest: {
        companyName: "Example AI Inc.",
        assetName: "Treasury Agent",
      },
    });

    expect(result?.driver).toBe("local");
    expect(result?.signedCertificateObjectKey).toBe("certificates/XMKS-KYA-2026-000401/signed-certificate.json");
    expect(result?.canonicalObjectKey).toBe("certificates/XMKS-KYA-2026-000401/canonical-certificate.json");
    expect(result?.manifestObjectKey).toBe("certificates/XMKS-KYA-2026-000401/publication-manifest.json");

    const signed = JSON.parse(
      await readFile(path.join(root, "certificates", "XMKS-KYA-2026-000401", "signed-certificate.json"), "utf8"),
    ) as Record<string, unknown>;
    const manifest = JSON.parse(
      await readFile(path.join(root, "certificates", "XMKS-KYA-2026-000401", "publication-manifest.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(signed.certificateId).toBe("XMKS-KYA-2026-000401");
    expect(manifest.archiveBackend).toBe("local_filesystem");
    expect(manifest.companyName).toBe("Example AI Inc.");
  });
});
