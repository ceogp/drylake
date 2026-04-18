# Xupra DryLake Plan

## 1. Product thesis

Xupra DryLake is a system for storing, versioning, transforming, exporting, and deploying AI agent projects across multiple agent ecosystems.

The first-class transfer targets are:

- Cursor
- Claude Code
- Codex
- Claude Agents / Claude Agent SDK

Secondary or experimental targets:

- OpenClaw
- NemoClaw
- Zapier
- Slack / WhatsApp as control surfaces, not primary agent package formats

The core idea is not "save random files in a folder." The core idea is a canonical agent package in the middle, plus import/export adapters per platform.

## 2. Product goals

- Let users upload or import agent files and related assets.
- Normalize those assets into one internal package format.
- Preserve raw source files for auditability and re-export.
- Export a package for another platform with either:
  - deterministic conversion, or
  - LLM-assisted conversion with a review step.
- Track versions, deployments, credentials, and audit events.
- Support enterprise-grade data modeling from day one, even if auth and cloud are deferred.

## 3. Constraints and assumptions

- Authentication is deferred. Clerk comes later.
- Database starts on SQLite for local testing and fast iteration.
- The schema must migrate cleanly to PostgreSQL later.
- Cloud is not settled yet. You mentioned GCP first and AWS later for PostgreSQL, so the system should stay cloud-neutral until infra is finalized.
- The current workspace is greenfield. There is no existing app scaffold yet.
- Because this repo does not currently contain an installed Next.js version, implementation should consult the local Next docs only after scaffolding the project.

## 4. MVP definition

MVP should prove five things:

1. A user can create an account record and full profile in the database, even if sign-in is temporarily stubbed.
2. A user can store agent projects, configs, files, versions, and credentials.
3. A user can import from and export to Codex, Claude Code, Cursor, and Claude Agents.
4. A user can review conversions before saving or deploying.
5. A paid user can trigger an automated deployment/export job to a connected repository or target bundle.

Non-goals for MVP:

- Full enterprise SSO
- Fine-grained RBAC beyond owner/admin/member
- Full OpenClaw or NemoClaw parity
- Mature billing implementation
- Deep analytics beyond essential operational reporting

## 5. Canonical package model

This is the most important architecture decision.

Represent every agent project internally as an `AgentPackage` with these logical parts:

- `manifest`
  - package name
  - slug
  - version
  - source platform
  - target platform
  - compatibility status
- `agent_definition`
  - system instructions
  - description
  - model hints
  - tools / capabilities
  - approval and sandbox preferences
- `subagents`
  - name
  - description
  - tool restrictions
  - model hints
  - instruction body
- `skills_or_rules`
  - project rules
  - skills
  - reusable prompts
- `artifacts`
  - markdown files
  - python files
  - yaml/toml/json configs
  - images or templates
- `credentials_refs`
  - references only, never raw secrets inside exports unless explicitly requested
- `deploy_targets`
  - repo target
  - branch strategy
  - bundle target
  - messaging target
- `raw_source_snapshot`
  - exact uploaded files for traceability

## 6. Import and conversion pipeline

Every import goes through one of three modes:

### A. Raw passthrough

Use when the source file already matches the destination or can be stored directly.

Examples:

- `AGENTS.md` for Codex
- `CLAUDE.md` or `.claude/agents/*.md` for Claude Code
- `.cursor/rules/*.mdc` stored without semantic loss

### B. Deterministic transform

Use when the file is structured enough to map safely without an LLM.

Examples:

- YAML frontmatter to canonical subagent records
- TOML custom agent definitions to canonical metadata
- OpenClaw JSON config fragments to canonical channel/config records

### C. LLM-assisted transform

Use when the input is partially structured or freeform.

Examples:

- drag-and-drop `.py` file that contains agent behavior but no formal manifest
- freeform markdown prompt packs
- mixed instruction folders with unclear platform intent

LLM-assisted transforms must produce:

- normalized package output
- confidence score
- human-readable summary of assumptions
- line-level or file-level diff preview
- explicit approval before final save or deploy

## 7. Platform support strategy

### Codex

Support level: `first-class`

What to support first:

- `AGENTS.md`
- project instruction layering
- custom agents in `.codex/agents/*.toml`

Why this is feasible:

- Codex explicitly supports `AGENTS.md`.
- Codex also supports custom agents via TOML files in `.codex/agents/`.

### Claude Code

Support level: `first-class`

What to support first:

- `.claude/agents/*.md`
- YAML frontmatter
- subagent prompts
- tool restrictions
- optional skills metadata

Why this is feasible:

- Claude Code subagents are filesystem-backed and well-structured.

### Claude Agents / Agent SDK

Support level: `first-class`

What to support first:

- filesystem-compatible `.claude/agents/*.md`
- generated SDK config snippets for programmatic `agents` definitions

Why this is feasible:

- Anthropic documents both filesystem-based and programmatic subagent definitions.

### Cursor

Support level: `first-class`, but narrower than Claude Code

What to support first:

- `.cursor/rules/*.mdc`
- `AGENTS.md` compatibility path
- optional environment metadata when present

Why this is feasible:

- Cursor supports scoped rules in `.cursor/rules`.
- Cursor also recognizes `AGENTS.md` as a simpler instruction format.

### OpenClaw

Support level: `experimental`

What to support first:

- import/export of workspace instruction files
- import/export of config fragments
- channel configuration fragments for Slack / WhatsApp where clearly mappable

Why not first-class in MVP:

- OpenClaw is a broader runtime and messaging platform, not just a coding-agent format.
- It has its own gateway, channel, plugin, and workspace concepts that do not map cleanly to Cursor/Codex/Claude abstractions.

### NemoClaw

Support level: `defer`

Recommendation:

- Treat NemoClaw as an OpenClaw-adjacent deployment environment, not as a primary package format.
- Do not promise first-class transfer in MVP.

Reason:

- Public documentation describes NemoClaw primarily as a governed sandbox/runtime around OpenClaw, not as a stable standalone package standard.

## 8. Messaging surfaces

Slack and WhatsApp should be implemented as control interfaces for Xupra DryLake itself.

Users should be able to:

- ask for deployment status
- trigger an export
- request a conversion
- approve a deployment
- receive failure or completion notifications

Recommended order:

1. Slack
2. WhatsApp

Slack first because:

- better admin workflows
- better threading for job updates
- easier enterprise adoption

WhatsApp second because:

- useful for founders/operators
- operationally heavier
- typically needs stricter sender controls and business messaging setup

## 9. Deployment model

"Deploy" should mean one of four concrete actions:

1. Export target bundle as zip or folder.
2. Commit target-specific files into a connected repo branch.
3. Open a pull request with converted files.
4. Push package/config into a supported target integration later.

For MVP, automatic deployment should mean Git-based deployment, not direct vendor-hosted agent provisioning.

That is the reliable path across Codex, Claude Code, Cursor, and Claude Agents.

## 10. Application architecture

Recommended shape:

- `web-app`
  - current Next.js app for UI and authenticated routes later
- `api`
  - route handlers inside the web app for now
- `worker`
  - background job runner for imports, transforms, exports, and deploys
- `db`
  - Prisma schema and migrations
- `storage`
  - local file storage abstraction now
  - S3-compatible object storage abstraction later

For MVP, keep web and API together. Keep the worker as a separate process.

## 11. Database recommendation

Use Prisma with SQLite now and PostgreSQL later.

Why:

- good support for both SQLite and PostgreSQL
- straightforward schema and migration workflow
- good TypeScript ergonomics for a greenfield app

Use SQLite only for app data and basic jobs in MVP. Do not over-engineer queue infrastructure yet.

## 12. Data model

Core tables:

- `users`
- `profiles`
- `organizations`
- `organization_memberships`
- `projects`
- `agent_packages`
- `package_versions`
- `package_files`
- `subagents`
- `transform_jobs`
- `deployment_jobs`
- `deployment_targets`
- `credentials`
- `credential_access_logs`
- `integrations`
- `integration_accounts`
- `billing_plans`
- `subscriptions`
- `audit_events`
- `usage_events`

Important modeling choices:

- Build multi-tenant data structures now, even if MVP runs effectively single-tenant.
- Keep versions immutable.
- Separate package files from package metadata.
- Separate secrets from integration metadata.

## 13. Credential storage

This must be enterprise-oriented from the beginning.

Recommended approach:

- store credentials encrypted at the application layer
- use envelope encryption
- store ciphertext and metadata in the database
- keep the active master key outside the database in environment variables for local dev
- move to cloud KMS later

Never embed raw secrets into exported agent bundles by default.

Exports should use:

- placeholder env var references, or
- explicit user-approved secret injection

## 14. Auth strategy

You said Clerk comes later. The right compromise is:

- build the data model as if external auth already exists
- add a temporary local auth/dev session layer for testing
- map Clerk identities later onto `users` and `organization_memberships`

Do not hardwire business logic to Clerk-specific IDs.

## 15. Pricing tiers

### Free

- import files
- store limited number of packages
- convert and preview
- export manually
- no auto-deploy

### Pro / Team

- higher storage limits
- version history
- auto-deploy to connected repo
- Slack control surface
- credential vault
- team collaboration

### Enterprise

- SSO later
- audit exports
- reporting dashboards
- policy controls
- approval workflows
- deployment governance
- usage and compliance reporting

## 16. Enterprise reporting

The first reporting slice should include:

- packages created by org / user
- exports by target platform
- deployment success rate
- transform confidence / manual review rate
- credential usage counts
- audit trail of who exported or deployed what

## 17. Risks and unknowns

### OpenClaw and NemoClaw

OpenClaw looks possible as an experimental adapter. NemoClaw should not be promised as a first-class transfer target yet.

### Automatic deployment limits

Not every platform exposes a stable "deploy my agent" API. Git-based deployment is the dependable common denominator for MVP.

### LLM conversion quality

Freeform files will create ambiguity. This is why every non-deterministic transform needs review, scoring, and versioning.

### Deferred auth

Deferring auth is fine for early validation, but credential features increase risk immediately. Even in MVP, keep strong encryption and audit logging.

### Cloud ambiguity

Because infra destination is not settled, avoid cloud-specific SDK lock-in in the app core.

## 18. Phased rollout

### Phase 0: foundation

- scaffold app
- set up Prisma + SQLite
- create core schema
- build local file storage
- add seeded dev auth

### Phase 1: package library

- create projects and packages
- upload files
- parse known formats
- version packages
- build package detail UI

### Phase 2: core transfer

- Codex adapter
- Claude Code adapter
- Claude Agents adapter
- Cursor adapter
- diff preview and approval flow

### Phase 3: deployment and messaging

- Git repo connections
- branch/PR deployment jobs
- Slack integration
- WhatsApp integration

### Phase 4: enterprise hardening

- reporting
- policy enforcement
- approval gates
- external auth with Clerk
- PostgreSQL migration

## 19. Recommended first build order

If implementation starts now, the first sprint should produce:

1. app scaffold
2. Prisma schema
3. package upload flow
4. canonical package model
5. Codex + Claude Code adapters
6. review/approve export flow

That is enough to prove the core thesis before building messaging and billing.

## 20. Remaining execution order

From the current codebase state, the remaining product work should be executed in this order:

1. credentials and deploy-job model
2. actual deploy adapters for Codex, Claude Code, Claude Agents, and Cursor where possible
3. Stripe-backed billing and entitlements
4. audit and reporting
5. Slack integration
6. WhatsApp integration
7. LLM-assisted import conversion on the backend
8. AWS production migration

### 20.1 Current recommendation per step

#### 1. Credentials and deploy-job model

- implement encrypted credential storage now
- bind credentials to organizations and deployment targets
- add deployment-target CRUD
- make deploy jobs concrete and auditable

#### 2. Deploy adapters

- use generated export bundles as the deployment source of truth
- support Git-oriented delivery first
- do not block on vendor-managed "one-click deploy" APIs

#### 3. Stripe-backed billing and entitlements

Current recommendation after checking Stripe docs:

- use Stripe Billing subscriptions for plan lifecycle
- use Stripe Entitlements for feature access instead of hardcoded tier booleans
- model Xupra features as entitlements such as:
  - `manual_export`
  - `deployment_jobs`
  - `credential_vault`
  - `slack_controls`
  - `advanced_reporting`
- keep free, paid, and enterprise product packaging configurable in Stripe

Practical implication:

- Xupra DryLake should have an internal `EntitlementService`
- that service should read subscription state plus entitlements and expose:
  - `canUseManualExport`
  - `canRunDeployment`
  - `canUseCredentialVault`
  - `canUseSlackControls`
  - `canUseAdvancedReporting`

This gives flexibility if pricing changes later.

#### 4. Audit and reporting

- add deployment history
- add credential access history
- add export/deploy summaries
- add enterprise reporting views after the base audit pipeline exists

#### 5. Slack integration

- outbound notifications first
- inbound commands after outbound is stable
- Slack should act as a control surface for jobs and approvals

#### 6. WhatsApp integration

- use Twilio WhatsApp as the first integration path
- keep the first scope narrow: notifications and approval messages

#### 7. LLM-assisted import conversion

Current recommendation after checking official OpenAI docs:

- use OpenAI on the backend
- default to `gpt-5.4-mini` for assisted normalization jobs
- use the Responses API with structured outputs where the transformation contract is strongly typed
- keep deterministic parsing first and invoke the model only for ambiguous files such as loose markdown and Python scripts

The model job should persist:

- extracted structure
- confidence
- assumptions
- warnings
- source references

#### 8. AWS production migration

- move DB from SQLite to PostgreSQL on Amazon RDS
- move artifact storage to Amazon S3
- move runtime secret management to AWS Secrets Manager and KMS
- run `web` and `worker` as separate ECS/Fargate services

### 20.2 Caveats

- Some provider-specific verification and deployment flows will require real credentials later.
- Clerk, Stripe, AWS, Slack, Twilio, OpenAI, and any Git provider can all be wired after the app-side interfaces are in place.
- That means product implementation can continue now, with provider secrets injected later.

## 21. Final recommendation

Yes, the instructions are clear enough to proceed.

The correct shape for Xupra DryLake is:

- enterprise data model now
- SQLite now, PostgreSQL later
- auth deferred but schema-ready
- canonical package format in the middle
- first-class support for Codex, Claude Code, Claude Agents, and Cursor
- Slack first, WhatsApp second
- OpenClaw experimental
- NemoClaw deferred

## Sources

- OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex subagents docs: https://developers.openai.com/codex/subagents
- OpenAI Codex Slack integration: https://developers.openai.com/codex/integrations/slack
- OpenAI Codex web overview: https://developers.openai.com/codex/cloud
- Anthropic Claude Code subagents: https://code.claude.com/docs/en/subagents
- Anthropic Claude Agent SDK subagents: https://platform.claude.com/docs/agent-sdk/subagents
- Cursor rules docs: https://docs.cursor.com/en/context/rules
- Cursor background agents docs: https://docs.cursor.com/en/background-agents
- Prisma supported databases: https://www.prisma.io/docs/orm/overview/databases/sqlite
- Prisma SQLite connector: https://www.prisma.io/docs/orm/core-concepts/supported-databases/sqlite
- Twilio WhatsApp docs: https://www.twilio.com/docs/whatsapp
- Slack Events / app guidance: https://api.slack.com/tutorials/tracks/first-bolt-app
- Slack deprecation note for legacy/custom bots and RTM migration guidance: https://api.slack.com/changelog/2024-09-legacy-custom-bots-classic-apps-deprecation
- OpenClaw configuration: https://docs.openclaw.ai/gateway/configuration
- OpenClaw agents CLI: https://docs.openclaw.ai/cli/agents
- OpenClaw Slack: https://docs.openclaw.ai/slack
- OpenClaw WhatsApp: https://docs.openclaw.ai/channels/whatsapp
- OpenClaw gateway architecture: https://docs.openclaw.ai/architecture
- NemoClaw community overview: https://nemoclaw.sh/
- Stripe subscriptions: https://docs.stripe.com/payments/subscriptions
- Stripe recurring pricing models: https://docs.stripe.com/billing/subscriptions/metered-billing
- Stripe pricing tables: https://docs.stripe.com/payments/checkout/pricing-table
- Stripe entitlements: https://docs.stripe.com/billing/entitlements
- Stripe billing APIs overview: https://docs.stripe.com/billing/billing-apis
- Clerk organizations roles and permissions: https://clerk.com/docs/organizations/roles-permissions
- AWS Secrets Manager best practices: https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html
- OpenAI models catalog: https://platform.openai.com/docs/models
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/compact
- OpenAI structured outputs: https://platform.openai.com/docs/guides/structured-outputs/supported-models
