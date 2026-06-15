# KYAregistry

This folder owns the Xupra KYA Registry product implementation.

KYA Registry is an operator-led workflow for discovering MCP servers and agents, contacting companies manually, invoicing them through Stripe, running MCP/agent/security tests after payment, sending optional KYA surveys, issuing hosted certificates, and publishing approved companies to the public registry.

The trust layer is designed to run on AWS:

- certificate signatures come from AWS KMS via `XUPRA_TRUST_KMS_KEY_ID`
- hosted certificate artifacts can be archived to local storage or Amazon S3 via `XUPRA_TRUST_PUBLICATION_DRIVER`
- the live public API still serves revocation-aware status from the application so status changes can take effect immediately

The product URL is `/kya-registry`. The source folder stays `KYAregistry` so it is easy to find in the repository.

## Contents

- `routes/app` - legacy signed-in pages for company profile, MCP submission, and KYA questionnaire.
- `routes/public` - public KYA registry, hosted certificate, and survey pages.
- `routes/api` - hosted certificate, badge, issuer metadata, and survey API route handlers.
- `actions` - Server Actions used by operator and registry forms.
- `services` - operator cases, MCP/agent assets, KYA scoring, survey invite, Stripe billing, hosted certificate, and public verification logic.
- `tests` - registry-specific backend tests.

The public Next.js URLs still use thin wrapper files under `app/`, and existing `@/lib/services/trust-*` imports still work through compatibility exports. Keep new registry implementation code in this folder.

## Public Verification

- Product page: `/kya-registry`
- Public registry: `/kya-registry/registry`
- Hosted certificate page: `/kya-registry/certificates/:certificateId`
- Agent-readable certificate API: `/api/kya-registry/v1/certificates/:certificateId`
- Hosted MCP verification server: `/api/kya-registry/v1/mcp`
- Badge SVG: `/kya-registry/badges/:certificateId`
- Issuer metadata: `/.well-known/kya-registry.json`

Agents should embed either the hosted certificate URL or the certificate ID, then fetch the API endpoint before a transaction and require `active: true`.

For live handshake verification, the remote company can also connect to the hosted MCP server and use:

- `kya_prepare_handshake`
- `kya_verify_handshake`
- `kya_evaluate_policy`

The trust policy layer is transaction-aware. Published defaults now distinguish directory lookup, tool invocation, data access, payment instruction, and wallet-signing flows by:

- minimum acceptable `KYA-L*`
- maximum acceptable `MCP-R*`
- whether live challenge is optional, preferred, or required
- whether offline fallback is allowed

## AWS trust publication

Optional environment variables for AWS-backed certificate publication:

- `XUPRA_TRUST_PUBLICATION_DRIVER=database|local|s3`
- `XUPRA_TRUST_PUBLICATION_BUCKET=<bucket name>` (optional when reusing `AWS_S3_BUCKET`)
- `XUPRA_TRUST_PUBLICATION_PREFIX=kya-registry`

When `XUPRA_TRUST_PUBLICATION_DRIVER=s3`, certificate issuance publishes:

- `signed-certificate.json`
- `canonical-certificate.json`
- `publication-manifest.json`

under `certificates/<certificateId>/...` inside the configured prefix.
