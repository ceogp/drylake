### Architectural Approach

KYA blockchain support should extend the current certificate pipeline instead of replacing it. The certificate remains the primary trust object: Xupra reviews the company and asset, creates canonical certificate JSON, signs it with AWS KMS, publishes encrypted artifacts through the existing trust publication path, and exposes the hosted certificate/API for agents. Blockchain is added as a public tamper-evidence layer by anchoring certificate hashes and timestamps only.

The first production path should use a low-cost public network through AWS Managed Blockchain Access, with Polygon as the default candidate and Ethereum mainnet reserved for higher-assurance or customer-requested anchoring. No private evidence, company survey answers, remediation notes, keys, or full certificate payloads should be written on-chain. The chain record stores enough data for an external verifier to prove that the hosted certificate hash existed at or before a block timestamp.

AWS KMS should continue to sign KYA certificates. If the anchoring worker signs blockchain transactions directly, use a separate KMS asymmetric key suitable for chain transaction signing. Certificate signing and transaction signing must remain separate keys, separate IAM permissions, and separate audit trails.

Certificate issuance should not fail just because blockchain anchoring is delayed. The hosted certificate can become active after KMS signing and publication, while the blockchain proof starts as `pending` and transitions to `anchored` after transaction confirmation. Failed anchoring should be visible to operators and verifiers, but it should not revoke an otherwise valid certificate unless policy later requires blockchain anchoring for a specific trust level.

### Data Model

Add a blockchain anchor record tied one-to-one or one-to-many to `TrustCertificate`, depending on whether a certificate can later be anchored to multiple chains.

```prisma
model TrustCertificateBlockchainAnchor {
  id                         String   @id @default(cuid())
  certificateDbId            String
  certificateId              String
  canonicalSha256            String
  signedCertificateSha256    String
  chain                      String
  chainId                    Int
  network                    String
  contractAddress            String?
  transactionHash            String?
  blockNumber                String?
  blockTimestamp             DateTime?
  status                     String
  failureReason              String?
  anchoredAt                 DateTime?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}
```

The hosted certificate API should expose a normalized `blockchainProof` object with `status`, `chain`, `chainId`, `canonicalSha256`, `transactionHash`, `blockNumber`, and `anchoredAt` when available. The public page can show pending, anchored, or failed states. Internal operator views need enough metadata to retry a failed anchor without reissuing the certificate.

Environment and secret configuration should include the AMB endpoint/network, chain ID, anchoring contract or calldata mode, transaction signer KMS key ID, confirmation policy, and optional gas limits. These values belong in AWS Secrets Manager or production env bundles, not source code.

### Component Architecture

Certificate issuance keeps its current flow through `KYAregistry/services/certificates.ts` and the operator issuance path. After canonical JSON and signed certificate artifacts are produced, an anchoring service computes the canonical and signed artifact hashes and creates a pending anchor record.

An AWS-backed anchoring worker submits the hash proof through AWS Managed Blockchain Access. The worker signs the transaction with the dedicated blockchain signing key, broadcasts the transaction, polls for confirmation, and updates the anchor record. The worker should be idempotent by certificate ID, chain ID, and canonical hash.

The public certificate service reads the certificate, publication metadata, and latest blockchain anchor record together. The page and API render blockchain proof as additive verification metadata, not as the source of truth. Agent verification continues to validate KMS signature, issuer metadata, certificate status, subject binding, expiry, policy, and optional MCP live challenge; blockchain verification adds an independent hash timestamp check when available.

AWS provisioning should be added as a separate script so deployment can create or verify KMS keys, IAM policies, AMB Access configuration, and Secrets Manager entries without changing the application runtime path. Tests should cover hash determinism, pending/anchored/failed states, API shape, and retry idempotency.
