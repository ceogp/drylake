import { GetPublicKeyCommand, SignCommand, type SigningAlgorithmSpec } from "@aws-sdk/client-kms";

import { getKmsClient } from "@/lib/aws/clients";
import { env } from "@/lib/env";
import {
  TRUST_REGISTRY_STANDARD_LABEL,
  TRUST_REGISTRY_STANDARD_VERSION,
  getTrustRegistryUrl,
  hashJson,
  stableStringify,
  toBase64Url,
} from "@/KYAregistry/services/registry";

type JsonRecord = Record<string, unknown>;

export type TrustCertificateSubject = {
  companyName: string;
  domain: string;
  country: string;
};

export type TrustCertificateReviewedProduct = {
  name: string;
  category: string[];
  repository?: string | null;
  package?: string | null;
  url?: string | null;
};

export type TrustCertificateReview = {
  scanType: string;
  riskClass?: string | null;
  kyaLevel?: string | null;
  criticalFindings: number;
  highFindings: number;
  reviewedAt: string;
};

export type CertificateSigner = {
  sign(payload: Uint8Array): Promise<{
    signature: string;
    algorithm: string;
    keyId?: string;
  }>;
};

export type SignedTrustCertificateInput = {
  certificateId: string;
  subject: TrustCertificateSubject;
  reviewedProduct: TrustCertificateReviewedProduct;
  subjectBinding?: JsonRecord;
  review: TrustCertificateReview;
  evidence: unknown;
  issuedAt: Date;
  expiresAt: Date;
  status?: "active" | "suspended" | "revoked" | "expired";
  registryBaseUrl?: string;
  issuerName?: string;
};

export type SignedTrustCertificateResult = {
  certificate: JsonRecord;
  canonicalJson: JsonRecord;
  canonicalText: string;
  evidenceHash: string;
  signature: string;
  signatureAlgorithm: string;
  publicUrl: string;
  badgeUrl: string;
};

function trustDidForRegistry(baseUrl: string) {
  const url = new URL(baseUrl);
  return `did:web:${url.hostname.toLowerCase()}`;
}

function iso(value: Date) {
  return value.toISOString();
}

function cleanObject<T extends JsonRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
  ) as T;
}

export async function createSignedTrustCertificate(
  input: SignedTrustCertificateInput,
  signer: CertificateSigner = new KmsCertificateSigner(),
): Promise<SignedTrustCertificateResult> {
  const registryBaseUrl = input.registryBaseUrl ?? env.XUPRA_TRUST_REGISTRY_BASE_URL;
  const evidenceHash = hashJson(input.evidence);
  const publicUrl = getTrustRegistryUrl(`/kya-registry/certificates/${encodeURIComponent(input.certificateId)}`, registryBaseUrl);
  const badgeUrl = getTrustRegistryUrl(`/kya-registry/badges/${encodeURIComponent(input.certificateId)}`, registryBaseUrl);
  const canonicalJson = {
    certificateId: input.certificateId,
    issuer: {
      name: input.issuerName ?? "Xupra K.K.",
      did: trustDidForRegistry(registryBaseUrl),
    },
    subject: input.subject,
    reviewedProduct: cleanObject(input.reviewedProduct),
    ...(input.subjectBinding ? { subjectBinding: cleanObject(input.subjectBinding) } : {}),
    review: cleanObject({
      standard: TRUST_REGISTRY_STANDARD_LABEL,
      standardVersion: TRUST_REGISTRY_STANDARD_VERSION,
      scanType: input.review.scanType,
      riskClass: input.review.riskClass,
      kyaLevel: input.review.kyaLevel,
      criticalFindings: input.review.criticalFindings,
      highFindings: input.review.highFindings,
      reviewedAt: input.review.reviewedAt,
    }),
    status: input.status ?? "active",
    issuedAt: iso(input.issuedAt),
    expiresAt: iso(input.expiresAt),
    evidenceHash,
    publicUrl,
    badgeUrl,
  };
  const canonicalText = stableStringify(canonicalJson);
  const signatureResult = await signer.sign(Buffer.from(canonicalText, "utf8"));
  const certificate = {
    ...canonicalJson,
    signatureAlgorithm: signatureResult.algorithm,
    signature: signatureResult.signature,
    ...(signatureResult.keyId ? { signingKeyId: signatureResult.keyId } : {}),
  };

  return {
    certificate,
    canonicalJson,
    canonicalText,
    evidenceHash,
    signature: signatureResult.signature,
    signatureAlgorithm: signatureResult.algorithm,
    publicUrl,
    badgeUrl,
  };
}

export class KmsCertificateSigner implements CertificateSigner {
  async sign(payload: Uint8Array) {
    const kms = getKmsClient();

    if (!kms || !env.XUPRA_TRUST_KMS_KEY_ID) {
      throw new Error("Xupra trust certificate signing requires AWS_REGION and XUPRA_TRUST_KMS_KEY_ID.");
    }

    const signingAlgorithm = env.XUPRA_TRUST_KMS_SIGNING_ALGORITHM as SigningAlgorithmSpec;
    const result = await kms.send(new SignCommand({
      KeyId: env.XUPRA_TRUST_KMS_KEY_ID,
      Message: payload,
      MessageType: "RAW",
      SigningAlgorithm: signingAlgorithm,
    }));

    if (!result.Signature) {
      throw new Error("AWS KMS did not return a certificate signature.");
    }

    return {
      signature: toBase64Url(result.Signature),
      algorithm: `AWS-KMS-${signingAlgorithm}`,
      keyId: result.KeyId ?? env.XUPRA_TRUST_KMS_KEY_ID,
    };
  }
}

export async function getTrustCertificatePublicKeyPem() {
  const kms = getKmsClient();

  if (!kms || !env.XUPRA_TRUST_KMS_KEY_ID) {
    throw new Error("Xupra trust certificate public key lookup requires AWS_REGION and XUPRA_TRUST_KMS_KEY_ID.");
  }

  const result = await kms.send(new GetPublicKeyCommand({
    KeyId: env.XUPRA_TRUST_KMS_KEY_ID,
  }));

  if (!result.PublicKey) {
    throw new Error("AWS KMS did not return a public key.");
  }

  return {
    keyId: result.KeyId ?? env.XUPRA_TRUST_KMS_KEY_ID,
    keyUsage: result.KeyUsage,
    signingAlgorithms: result.SigningAlgorithms ?? [],
    pem: publicKeyDerToPem(result.PublicKey),
  };
}

export function publicKeyDerToPem(publicKey: Uint8Array) {
  const base64 = Buffer.from(publicKey).toString("base64");
  const lines = base64.match(/.{1,64}/g) ?? [];
  return ["-----BEGIN PUBLIC KEY-----", ...lines, "-----END PUBLIC KEY-----"].join("\n");
}
