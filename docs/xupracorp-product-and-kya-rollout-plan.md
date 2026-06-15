# Xupra Product And KYA Rollout Plan

Status: active rollout
Date: 2026-06-15

## Purpose

This document is the execution plan for:

1. separating Xupra, DryLake, and KYA Registry into a coherent product hierarchy
2. making DryLake a clear Xupra product reachable from the corporate site
3. turning KYA Registry into a real Xupra product, not a DryLake sub-surface
4. building a public registry experience closer to the official MCP Registry pattern
5. defining the hosted certificate and agent-to-agent verification handshake well enough to implement it in phases

## Working Assumptions

1. Xupra is the company.
2. DryLake is a Xupra product.
3. Agent Control and Guard are DryLake features, not separate public products.
4. KYA Registry is a separate Xupra product.
5. Company visitors discover products from the corporate site first.
6. KYA company onboarding remains operator-led for now. Companies do not self-register.
7. Stripe is the invoicing and payment system.
8. The current short public KYA route `/kya-registry` should remain usable because it is already implemented and suitable for public certificate links.
9. `xupracorp.com` is the canonical company domain. Any remaining `xupra.com` references are rollout cleanup drift.

## Implementation Status Snapshot

Completed or materially in place:

1. Phase 0 domain standardization for public runtime, public copy, issuer DID, and test coverage.
2. Phase 1 corporate product hierarchy with Xupra product navigation for DryLake and KYA Registry.
3. Phase 2 product-boundary separation between the DryLake host and the Xupra/KYA public surface.
4. Phase 4 public KYA registry explorer and machine-readable registry API.
5. Phase 5 operator workflow foundation, including company and certificate management surfaces.
6. Phase 6A hosted attestation lookup with issuer metadata and hosted certificate APIs.
7. Phase 6C transaction-aware trust policy published through metadata, standards, and MCP tools.
8. Phase 6D AWS trust backbone using KMS signing and S3 publication.
9. Phase 7 payment gating for test execution and certificate issuance.
10. Phase 8 public standards publication.

Still in progress or not yet complete:

1. Phase 3 KYA product explanation still needs stronger outreach-grade business copy and richer certificate embedding guidance.
2. Phase 6B live handshake is implemented through Xupra-hosted MCP tools, but not yet proven end to end against a real live production certificate.
3. Phase 9 live QA is only partially complete because production currently has no published registry companies or certificates.
4. Phase 10 launch/cutover hardening still needs final redirect, data, and smoke-check completion.

## Current State Snapshot

### What already exists

1. Host-aware separation between the Xupra public host, the DryLake app host, and the internal operator portal.
2. Public Xupra product hierarchy at `/products`, `/products/drylake`, and `/products/kya-registry`.
3. A KYA public product route at `/kya-registry` with product-local navigation.
4. A searchable public KYA registry explorer at `/kya-registry/registry` and a machine-readable registry API at `/api/kya-registry/v1/registry`.
5. Hosted certificate pages, a machine-readable certificate API, issuer metadata, badge rendering, and AWS-backed trust publication.
6. Operator workflow surfaces for companies, certificates, invoices, test runs, payment gating, and publication controls.
7. MCP-hosted handshake and trust policy tools at `/api/kya-registry/v1/mcp`.
8. Database models for registry cases, registry assets, registry test runs, registry events, and certificates.

### What is still missing or wrong

1. Production has no published registry companies, assets, or certificates yet, so the public explorer is structurally correct but empty.
2. The live handshake and trust policy flow cannot be fully proven on production until at least one real certificate is issued with an operational key binding.
3. KYA product copy still needs a stronger outreach-grade explanation of the company onboarding and hosted verification model.
4. The final launch cutover still needs canonical redirect hardening and a last end-to-end production smoke pass once live data exists.

## Target Product Structure

### Corporate Site

1. `https://xupracorp.com/`
   Xupra company home
2. `https://xupracorp.com/products`
   Xupra product index
3. `https://xupracorp.com/products/drylake`
   DryLake product page
4. `https://xupracorp.com/products/kya-registry`
   KYA Registry product page

### DryLake Product

1. `https://drylake.xupracorp.com/`
   DryLake app and product-specific landing surface
2. DryLake public/product navigation includes:
   Agent Control, Guard, Install, Pricing, Sign In
3. DryLake app-auth and customer-account flows stay on the DryLake host

### KYA Registry Product

1. `https://xupracorp.com/kya-registry`
   public product overview and explanation
2. `https://xupracorp.com/kya-registry/registry`
   searchable public registry catalog
3. `https://xupracorp.com/kya-registry/certificates/:certificateId`
   hosted human-readable certificate page
4. `https://xupracorp.com/api/kya-registry/v1/certificates/:certificateId`
   hosted machine-readable certificate API
5. `https://xupracorp.com/.well-known/kya-registry.json`
   issuer metadata for verifiers

### Route Strategy

1. The corporate site must always expose the path to both products.
2. DryLake remains on a dedicated app host.
3. KYA operational certificate and registry routes can stay short under `/kya-registry/*`.
4. `https://xupracorp.com/products/kya-registry` can either render the same KYA product page directly or redirect to `/kya-registry`.
5. `https://xupracorp.com/products/drylake` should be a product page that explains DryLake and then links into `https://drylake.xupracorp.com`.

## Header Behavior

### Corporate Header

Used on Xupra home, products, company, and contact pages.

1. `Xupra`
2. `Home`
3. `Products`
4. `Company`
5. `Contact`
6. `Open DryLake`

### KYA Product Header

Used on `/kya-registry` public pages.

1. corporate header remains visible
2. a second product row or product-local nav shows:
   `KYA Registry`, `Overview`, `Registry`, `Standards`, `Verification API`

### DryLake Header

Used on the DryLake host only.

1. `DryLake`
2. `Agent Control`
3. `Guard`
4. `Install`
5. `Pricing`
6. auth/account actions

## Architectural Approach

1. Treat the corporate site, DryLake app, and KYA Registry as separate surfaces sharing one codebase but not one navigation model.
2. Keep host-based routing for Xupra vs DryLake, and add explicit public-section routing for KYA and product-index pages.
3. Keep KYA certificate and registry URLs stable while the product hierarchy improves around them.
4. Make the public KYA catalog read from the existing registry case and registry asset tables rather than inventing a second publication system.
5. Build the verification system in phases:
   first hosted attestation lookup,
   then live challenge-response,
   then optional mutual-policy negotiation.
6. Preserve the operator-led onboarding workflow. Do not build self-service registration yet.
7. Reuse existing Stripe invoice flow, test-run recording, and certificate issuance services rather than replacing them.
8. Make the public registry explorer data-first. The public UX should be driven by searchable assets, company pages, certificate state, and protocol metadata.
9. Keep the first implementation simple enough to ship quickly:
   one corporate product index,
   one DryLake product page,
   one KYA product page,
   one searchable public registry explorer,
   one hosted certificate verification contract.
10. Move the trust layer onto AWS primitives as it hardens:
    KMS for signing,
    S3 for certificate artifact publication,
    Secrets Manager for deployed environment bundles.

## Data Model

### Existing Entities To Reuse

1. `TrustCompany`
   accountable company
2. `TrustProduct`
   product-level record where needed
3. `TrustRegistryCase`
   operator workflow record for discovery, contact, invoice, testing, and publication
4. `TrustRegistryAsset`
   the public thing being reviewed and potentially listed
5. `TrustRegistryTestRun`
   recorded evidence of scans and review runs
6. `TrustCertificate`
   hosted certificate record

### Data Additions Needed

1. Public registry presentation fields
   add searchable display fields and tags such as:
   `listingTitle`, `listingSummary`, `industryTags`, `rippleTags`, `countryCode`, `verificationStatus`
2. Asset discovery metadata
   distinguish:
   `mcp_server`, `agent`, `agent_card`, `tool_gateway`, `package`, `repository`
3. Search indexing fields
   searchable normalized strings for company name, asset name, domain, protocol, repository, package, and ripple relevance
4. Verification binding fields
   bind certificates to:
   `agentCardUrl`, `endpointUrl`, `did`, `verificationKeyId`, `verificationPublicKeyPem`, `challengeMethod`
5. Certificate lifecycle fields
   explicit revocation reason, suspension reason, replaced-by certificate, and status transition timestamps
6. Optional handshake audit entity
   later-phase table for stored handshake policy decisions or live verification logs if Xupra decides to record them

### Persistence Boundaries

1. Corporate product pages are static or CMS-like page content.
2. KYA public registry is database-backed and runtime rendered.
3. Hosted certificates are database-backed and should be cacheable when active.
4. Handshake verification logic should read from issuer metadata and certificate records but should not mutate public certificate state during ordinary reads.

## Component Architecture

### Corporate Product Layer

1. Corporate home
   routes visitors to products and company information
2. Product index
   shows DryLake and KYA Registry as separate Xupra products
3. DryLake product page
   explains DryLake and links to the app host
4. KYA product page
   explains the business flow, certificate model, and public registry

### KYA Public Layer

1. Registry overview page
   explains the product, flow, standards, and certificate use case
2. Registry explorer page
   search bar, filter controls, result cards, and detail links
3. Company/asset detail presentation
   can begin as enriched cards and later expand into dedicated company pages if needed
4. Hosted certificate page
   human-readable certificate detail and verification explanation
5. Issuer metadata endpoint
   machine-readable issuer identity and public key material
6. Hosted certificate API
   machine-readable active certificate payload

### Operator Layer

1. discovery queue
2. outreach and response tracking
3. invoice issuance and payment state
4. testing and evidence recording
5. certificate issuance and publication controls

### Verification Layer

1. issuer metadata fetch
2. certificate fetch
3. signature verification
4. status/expiry/revocation checks
5. asset binding checks
6. later-phase live nonce challenge verification

## Phased Execution Plan

## Phase 0: Domain And Naming Decision

Goal: stop domain drift before more public work ships.

Steps:

1. Keep `xupracorp.com` as the canonical company domain.
2. Decide whether `xupra.com` is:
   a full secondary brand domain, or
   a redirect-only alias
3. Standardize:
   marketing URLs,
   certificate base URL,
   issuer DID host,
   contact email addresses,
   product copy
4. Remove remaining mixed copy and dead links.

Acceptance:

1. One canonical company host is documented.
2. KYA certificate URLs and issuer DID resolve to the same company host.
3. No public page mixes `xupra.com` and `xupracorp.com` accidentally.

## Phase 1: Corporate Information Architecture

Goal: make both products discoverable from the corporate site.

Steps:

1. Create a real corporate product index page.
2. Add a KYA product entry from the Xupra homepage.
3. Add a DryLake product entry from the Xupra homepage.
4. Add a DryLake product marketing page on the corporate host.
5. Add corporate header/footer consistency across public Xupra pages.
6. Add product-aware second-level navigation on KYA pages.

Acceptance:

1. A visitor can navigate:
   `Home -> Products -> DryLake`
2. A visitor can navigate:
   `Home -> Products -> KYA Registry`
3. KYA pages no longer feel detached from the Xupra site.

## Phase 2: DryLake Public/Product Separation

Goal: keep DryLake clearly separate from KYA and the corporate site.

Steps:

1. Define the public DryLake product page responsibilities.
2. Keep app auth, account, billing, workspace, Guard reports, and Agent Control flows on the DryLake host.
3. Ensure corporate-site pages do not inherit DryLake app header or auth surface.
4. Ensure DryLake host does not present KYA as a DryLake feature.

Acceptance:

1. DryLake is discoverable from Xupra products.
2. DryLake app surface remains isolated to the DryLake host.
3. Agent Control and Guard stay branded as DryLake features only.

## Phase 3: KYA Product Page Completion

Goal: make the KYA overview page fully explain the business and verification model.

Steps:

1. Explain the operator-led business flow:
   discovery, contact, agreement, invoice, payment, testing, certificate, publication
2. Explain what KYA certifies:
   company identity, asset identity, risk level, KYA level, evidence, status
3. Explain the Ripple/XRPL/RLUSD relevance.
4. Explain how an agent embeds or references the hosted certificate.
5. Explain the difference between hosted certificate lookup and live verification handshake.

Acceptance:

1. A company can understand what Xupra offers before replying to outreach.
2. A technical reader can understand what the certificate is for.
3. The page can credibly support outreach emails.

## Phase 4: Public Registry Explorer

Goal: rebuild the public registry page into an MCP-style explorer.

Steps:

1. Add search by:
   company name,
   asset name,
   domain,
   repository,
   package,
   protocol,
   ripple keyword
2. Add filters for:
   asset type,
   protocol,
   KYA level,
   risk class,
   active status,
   country,
   Ripple relevance
3. Add result cards that show:
   company,
   asset,
   short summary,
   status,
   KYA level,
   risk class,
   certificate link,
   API link
4. Add expandable or linked detail view per listing.
5. Include machine-readable links similar to the official MCP Registry pattern.
6. Support query-string search for targeted lookups like `?q=ripple`.

Acceptance:

1. The public registry works as a discovery surface, not just a certificate archive.
2. The page is usable for human browsing and machine-assisted lookup.
3. Searching `ripple` or related keywords produces meaningful filtered results once data exists.

## Phase 5: Operator Workflow Hardening

Goal: make the internal process usable for real manual outreach and publication.

Steps:

1. Discovery case creation for found companies and assets.
2. Outreach state tracking:
   discovered, contacted, interested, declined, invoiced, paid, testing, remediation, certified, listed
3. Internal notes and event history.
4. Survey issuance and response tracking.
5. Payment-state synchronization from Stripe.
6. Publication controls for public listing enable/disable.
7. Certificate reissue, suspend, revoke, and replace flows.

Acceptance:

1. One operator can run the entire manual workflow inside the system.
2. Case history is sufficient to understand status without digging through email.

## Phase 6: Hosted Certificate And Handshake

Goal: turn the current hosted certificate model into a credible agent-to-agent trust flow.

### Phase 6A: Hosted Attestation Lookup

Steps:

1. Finalize issuer metadata contract.
2. Finalize hosted certificate JSON schema.
3. Include issuer DID, asset binding, evidence hash, signature metadata, and public verification URL.
4. Document how agents embed:
   certificate ID,
   certificate URL,
   issuer reference

Acceptance:

1. A verifier agent can fetch metadata and certificate and make a trust decision offline from live challenge.

### Phase 6B: Live Challenge-Response

Steps:

1. Add operational verification key fields to the certified asset.
2. Define a standard challenge endpoint or challenge transport.
3. Define nonce format, signing rules, and replay protections.
4. Define what the verifier must compare:
   certified key,
   responding key,
   endpoint or agent card identity,
   certificate status

Acceptance:

1. A verifier agent can prove it is talking to the same operational identity that the hosted certificate describes.

### Phase 6D: AWS Trust Backbone

Steps:

1. Keep certificate signing on AWS KMS.
2. Publish signed certificate artifacts to Amazon S3.
3. Surface publication status in operator and health views.
4. Add a backfill path for already-issued certificates.
5. Turn on S3 publication in deployed environment bundles once the app path is verified.

Acceptance:

1. New hosted certificates are signed in AWS and archived in AWS.
2. The deployed app reports whether trust publication is actually configured.
3. Operators have a scriptable path to republish certificates after rollout changes.

### Phase 6C: Trust Policy Layer

Steps:

1. Define minimum acceptable KYA and risk policies.
2. Define transaction-type specific trust rules.
3. Define fallback behavior when issuer metadata or live challenge is unavailable.

Acceptance:

1. Verification is not just cryptographic; it is policy-driven and transaction-aware.

## Phase 7: Billing, Invoice, And Post-Payment Flow

Goal: connect business process to operational execution cleanly.

Steps:

1. Confirm invoice product definitions in Stripe.
2. Sync invoice paid state into registry cases.
3. Gate testing and certificate issuance on paid status.
4. Support monthly certificate maintenance subscriptions if needed later.
5. Ensure all customer-facing invoice copy matches KYA positioning, not DryLake language.

Acceptance:

1. No certificate is issued before fee payment.
2. Payment state transitions are visible to operators.

## Phase 8: Standards And Governance

Goal: make the certificate standard and public trust posture explicit.

Steps:

1. Finalize the first KYA agent transaction standard version.
2. Publish plain-language standards summary on the KYA product page.
3. Define revocation and suspension rules.
4. Define what evidence is public vs private.
5. Define which failures block certification vs allow remediation.

Acceptance:

1. Public registry entries and certificates are backed by a published standard.
2. Operators have consistent issuance rules.

## Phase 9: Testing And QA

Goal: verify the surface as a public product and the backend as a trust system.

Steps:

1. Public navigation QA:
   Xupra home -> Products -> DryLake
   Xupra home -> Products -> KYA Registry
2. Public registry QA:
   search,
   filters,
   query strings,
   empty state,
   active listing rendering
3. Certificate QA:
   human page,
   API payload,
   issuer metadata,
   invalid certificate handling
4. Operator QA:
   case creation,
   invoice send,
   payment sync,
   test run record,
   certificate issuance,
   publication toggle
5. Verification QA:
   signature validation,
   expiry handling,
   revocation handling,
   handshake challenge when implemented

Acceptance:

1. Public product flows are coherent.
2. Operator flows are usable.
3. Verification contract is testable end to end.

## Phase 10: Launch And Cutover

Goal: publish the corrected site structure and KYA product surface safely.

Steps:

1. Finalize canonical domain and redirects.
2. Publish corporate product index.
3. Publish DryLake product page.
4. Publish KYA product page and registry explorer.
5. Verify issuer metadata and hosted certificates on the production company host.
6. Run end-to-end smoke checks before outreach begins.

Acceptance:

1. Public company site exposes both products clearly.
2. DryLake and KYA Registry no longer bleed into each other.
3. Certificate links and public registry links are stable for outreach.

## Recommended Implementation Order

This is the order that produces value fastest with the least rework:

1. Phase 0: standardize domain decision
2. Phase 1: build corporate product index and homepage links
3. Phase 2: finish DryLake separation
4. Phase 3: finish KYA product explanation page
5. Phase 4: rebuild the public registry explorer
6. Phase 5: harden operator workflow
7. Phase 6A: finalize hosted attestation contract
8. Phase 7: payment and invoice hardening
9. Phase 8: standards publishing
10. Phase 9: QA pass
11. Phase 6B and 6C: live handshake and trust policy expansion
12. Phase 10: launch

## Definition Of Done

The overall initiative is done when:

1. Xupra home and products pages clearly expose both DryLake and KYA Registry.
2. DryLake is presented as a Xupra product, not the company itself.
3. KYA Registry is presented as a Xupra product, not a DryLake feature.
4. The KYA public registry behaves like a real searchable registry surface.
5. Hosted certificate pages and APIs are stable and production-branded.
6. The operator workflow supports real outreach, invoice, testing, and listing.
7. The hosted certificate handshake is at least fully specified and partially implemented in lookup form, with a clear path to live challenge-response.

## Immediate Next Steps

These are the next implementation tasks from the current state:

1. register the first real company and certified asset in production so the public registry and hosted verification flow have live data
2. complete the remaining KYA product explanation work on the public overview page
3. run a full live production handshake against a real issued certificate with subject binding and nonce verification
4. complete the final QA and launch cutover checks for redirects, listing publication, suspension, and revocation
