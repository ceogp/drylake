# Xupra DryLake v1 Spec

## 1. Scope

This document turns the product plan into a buildable v1 specification for `Xupra DryLake`.

Primary v1 goals:

- local-first validation using SQLite
- clean migration path to AWS
- canonical package model for agent transfer
- first-class support for:
  - Codex
  - Claude Code
  - Claude Agents / Claude Agent SDK
  - Cursor
- manual export for all supported targets
- Git-based assisted deployment for paid tiers
- secure credential storage

Not in v1:

- Clerk integration
- full enterprise SSO / SCIM
- OpenClaw or NemoClaw as first-class targets
- direct vendor-hosted "one-click deploy" unless the target contract is stable

## 2. Deployment target after local validation

### Local

- Next.js web app
- Prisma ORM
- SQLite database
- local filesystem artifact storage
- in-process or separate Node worker using DB-backed jobs

### AWS target

- Amazon ECS on AWS Fargate for:
  - `web` service
  - `worker` service
- Amazon RDS for PostgreSQL
- Amazon S3 for artifact storage
- AWS KMS for encryption keys
- AWS Secrets Manager for runtime secrets
- Application Load Balancer in front of the web service
- CloudWatch for logs and alarms

### Why this target

- RDS for PostgreSQL gives a managed PostgreSQL path with backups, Multi-AZ options, encryption, and standard PostgreSQL compatibility.
- Fargate runs containers without managing servers, which fits a web app plus background worker layout.
- S3 gives strongly consistent object storage for package artifacts and export bundles.
- Secrets Manager and KMS fit the secret-vault and audit requirements better than custom secret files in production.

For v1, do **not** add SQS unless job volume or worker isolation actually requires it. A DB-backed job table is simpler for local dev and early production.

## 3. Core architecture

### Services

- `web`
  - UI
  - authenticated API routes later
  - file upload entrypoints
  - export preview
- `worker`
  - parse/import jobs
  - LLM normalization jobs
  - export/build jobs
  - deployment jobs
- `db`
  - app metadata
  - package graph
  - secrets metadata
  - audit events
  - job queue
- `artifact_store`
  - raw uploaded files
  - generated export bundles
  - preview diffs

### Architectural decisions

- Use one canonical `AgentPackageVersion` as the system of record.
- Preserve raw source files separately from normalized package records.
- Make every transformation versioned and reproducible.
- Treat deployment as a job against a frozen package version.

## 4. Domain model

### Main entities

- `User`
- `Profile`
- `Organization`
- `OrganizationMembership`
- `Project`
- `AgentPackage`
- `PackageVersion`
- `PackageFile`
- `Subagent`
- `SkillRule`
- `Credential`
- `Integration`
- `DeploymentTarget`
- `TransformJob`
- `DeploymentJob`
- `AuditEvent`
- `Subscription`

### Canonical package shape

Each `PackageVersion` represents one immutable normalized package.

It contains:

- manifest
- main agent definition
- subagents
- rules / skills / prompt fragments
- raw file references
- target compatibility data
- export/build outputs
- deployment metadata

## 5. Concrete schema

The schema below is the logical v1 model. Use Prisma with UUID-like string IDs so SQLite and PostgreSQL both work cleanly.

### 5.1 Users and orgs

#### `users`

- `id`
- `email`
- `auth_provider`
  - `dev`
  - `clerk`
- `auth_subject`
- `status`
  - `active`
  - `invited`
  - `disabled`
- `created_at`
- `updated_at`

Indexes:

- unique on `email`
- unique on `(auth_provider, auth_subject)`

#### `profiles`

- `id`
- `user_id`
- `display_name`
- `avatar_url`
- `job_title`
- `timezone`
- `locale`
- `created_at`
- `updated_at`

Indexes:

- unique on `user_id`

#### `organizations`

- `id`
- `name`
- `slug`
- `tier`
  - `free`
  - `pro`
  - `enterprise`
- `status`
  - `active`
  - `suspended`
- `created_at`
- `updated_at`

Indexes:

- unique on `slug`

#### `organization_memberships`

- `id`
- `organization_id`
- `user_id`
- `role`
  - `owner`
  - `admin`
  - `member`
- `created_at`

Indexes:

- unique on `(organization_id, user_id)`

### 5.2 Projects and packages

#### `projects`

- `id`
- `organization_id`
- `name`
- `slug`
- `description`
- `created_by_user_id`
- `archived_at`
- `created_at`
- `updated_at`

Indexes:

- unique on `(organization_id, slug)`
- index on `created_by_user_id`

#### `agent_packages`

- `id`
- `project_id`
- `name`
- `slug`
- `description`
- `source_platform`
  - `codex`
  - `claude_code`
  - `claude_agents`
  - `cursor`
  - `openclaw`
  - `nemoclaw`
  - `generic`
- `default_target_platform`
- `latest_version_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

Indexes:

- unique on `(project_id, slug)`
- index on `latest_version_id`

#### `package_versions`

- `id`
- `agent_package_id`
- `version_number`
- `status`
  - `draft`
  - `ready`
  - `failed_validation`
  - `archived`
- `origin`
  - `manual`
  - `imported`
  - `transformed`
  - `cloned`
- `manifest_json`
- `agent_definition_json`
- `compatibility_json`
- `validation_json`
- `raw_snapshot_prefix`
- `created_by_user_id`
- `created_at`

Indexes:

- unique on `(agent_package_id, version_number)`
- index on `(agent_package_id, created_at desc)`

Notes:

- `manifest_json` holds canonical package metadata.
- `agent_definition_json` holds the normalized main-agent definition.
- `compatibility_json` stores target-by-target compatibility and warnings.

#### `package_files`

- `id`
- `package_version_id`
- `kind`
  - `raw_source`
  - `normalized_source`
  - `generated_export`
  - `diff_preview`
- `logical_path`
- `storage_key`
- `mime_type`
- `size_bytes`
- `checksum_sha256`
- `source_format`
  - `md`
  - `mdc`
  - `json`
  - `json5`
  - `yaml`
  - `toml`
  - `python`
  - `text`
  - `zip`
- `created_at`

Indexes:

- unique on `(package_version_id, kind, logical_path)`
- index on `package_version_id`

#### `subagents`

- `id`
- `package_version_id`
- `name`
- `slug`
- `description`
- `instructions_md`
- `tools_json`
- `model_hint`
- `permission_mode`
- `sort_order`
- `created_at`

Indexes:

- unique on `(package_version_id, slug)`

#### `skill_rules`

- `id`
- `package_version_id`
- `name`
- `kind`
  - `skill`
  - `rule`
  - `prompt_fragment`
- `body_md`
- `metadata_json`
- `created_at`

Indexes:

- index on `package_version_id`

### 5.3 Credentials and integrations

#### `credentials`

- `id`
- `organization_id`
- `name`
- `provider`
  - `github`
  - `openai`
  - `anthropic`
  - `slack`
  - `twilio`
  - `custom`
- `kind`
  - `api_key`
  - `oauth_token`
  - `ssh_key`
  - `webhook_secret`
  - `env_bundle`
- `ciphertext`
- `key_version`
- `metadata_json`
- `last_verified_at`
- `created_by_user_id`
- `created_at`
- `updated_at`

Indexes:

- unique on `(organization_id, name)`
- index on `(organization_id, provider)`

#### `credential_access_logs`

- `id`
- `credential_id`
- `actor_user_id`
- `action`
  - `create`
  - `read_for_job`
  - `update`
  - `delete`
  - `verify`
- `job_id`
- `created_at`

Indexes:

- index on `(credential_id, created_at desc)`

#### `integrations`

- `id`
- `organization_id`
- `provider`
  - `github`
  - `slack`
  - `twilio_whatsapp`
- `status`
  - `pending`
  - `active`
  - `error`
  - `disabled`
- `config_json`
- `created_at`
- `updated_at`

Indexes:

- unique on `(organization_id, provider)`

### 5.4 Deployments and jobs

#### `deployment_targets`

- `id`
- `project_id`
- `name`
- `platform`
  - `codex`
  - `claude_code`
  - `claude_agents`
  - `cursor`
  - `git_bundle`
- `delivery_mode`
  - `download`
  - `git_branch`
  - `pull_request`
- `config_json`
- `is_default`
- `created_by_user_id`
- `created_at`
- `updated_at`

Indexes:

- unique on `(project_id, name)`
- index on `(project_id, is_default)`

#### `transform_jobs`

- `id`
- `organization_id`
- `project_id`
- `agent_package_id`
- `package_version_id`
- `job_type`
  - `import_parse`
  - `normalize`
  - `compatibility_check`
  - `export_build`
- `status`
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`
- `source_platform`
- `target_platform`
- `input_json`
- `result_json`
- `error_json`
- `started_at`
- `finished_at`
- `created_by_user_id`
- `created_at`

Indexes:

- index on `(status, created_at)`
- index on `(agent_package_id, created_at desc)`

#### `deployment_jobs`

- `id`
- `organization_id`
- `project_id`
- `package_version_id`
- `deployment_target_id`
- `status`
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `cancelled`
- `trigger_source`
  - `ui`
  - `api`
  - `slack`
  - `whatsapp`
- `git_ref`
- `output_json`
- `error_json`
- `started_at`
- `finished_at`
- `created_by_user_id`
- `created_at`

Indexes:

- index on `(deployment_target_id, created_at desc)`
- index on `(package_version_id, created_at desc)`

#### `audit_events`

- `id`
- `organization_id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action`
- `metadata_json`
- `created_at`

Indexes:

- index on `(organization_id, created_at desc)`
- index on `(entity_type, entity_id, created_at desc)`

### 5.5 Billing

#### `subscriptions`

- `id`
- `organization_id`
- `tier`
  - `free`
  - `pro`
  - `enterprise`
- `status`
  - `trial`
  - `active`
  - `cancelled`
  - `past_due`
- `limits_json`
- `created_at`
- `updated_at`

Indexes:

- unique on `organization_id`

## 6. Storage design

### Local

- store package files under `./storage`
- namespace by organization/project/package/version

Example:

```text
storage/
  org_<orgId>/
    project_<projectId>/
      package_<packageId>/
        version_<versionId>/
          raw/
          normalized/
          exports/
          previews/
```

### AWS

- single S3 bucket per environment is acceptable for v1
- use object prefixes equivalent to the local namespace

Example key:

```text
orgs/<orgId>/projects/<projectId>/packages/<packageId>/versions/<versionId>/exports/codex.zip
```

## 7. Transfer contracts

### Supported v1 adapters

#### Codex adapter

Import:

- `AGENTS.md`
- `.codex/agents/*.toml`

Export:

- root `AGENTS.md`
- optional `.codex/agents/*.toml`
- export metadata manifest

#### Claude Code adapter

Import:

- `.claude/agents/*.md`
- `CLAUDE.md` if present

Export:

- `.claude/agents/*.md`
- optional `CLAUDE.md`

#### Claude Agents / Agent SDK adapter

Import:

- `.claude/agents/*.md`

Export:

- filesystem agent files
- generated SDK example snippet for programmatic `agents`

#### Cursor adapter

Import:

- `.cursor/rules/*.mdc`
- root `AGENTS.md` if present

Export:

- `.cursor/rules/*.mdc`
- optional root `AGENTS.md`

### Conversion modes

- deterministic
  - structured known formats
- assisted
  - ambiguous text or code inputs

Assisted transforms must persist:

- source file pointer
- extracted structured fields
- confidence
- assumptions
- warnings

## 8. API v1

All routes are prefixed with `/api/v1`.

### 8.1 Session and bootstrap

#### `POST /dev/session`

Creates or reuses a local dev session user until Clerk is added.

Request:

```json
{
  "email": "owner@example.com",
  "displayName": "Owner"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "email": "owner@example.com"
  },
  "organization": {
    "id": "org_123",
    "slug": "owner-org"
  }
}
```

### 8.2 Profile and org

#### `GET /me`
#### `PATCH /me/profile`
#### `GET /organizations/:orgId`

### 8.3 Projects

#### `GET /projects`
#### `POST /projects`

Request:

```json
{
  "name": "Agent Library",
  "slug": "agent-library",
  "description": "Main transfer workspace"
}
```

#### `GET /projects/:projectId`
#### `PATCH /projects/:projectId`
#### `DELETE /projects/:projectId`

Soft delete or archive only in v1.

### 8.4 Packages

#### `GET /projects/:projectId/packages`
#### `POST /projects/:projectId/packages`

Request:

```json
{
  "name": "Backend Reviewer",
  "slug": "backend-reviewer",
  "description": "Transferable code-review package",
  "sourcePlatform": "generic"
}
```

#### `GET /packages/:packageId`
#### `PATCH /packages/:packageId`

### 8.5 Package versions

#### `GET /packages/:packageId/versions`
#### `POST /packages/:packageId/versions`

Creates a draft version, optionally cloned from latest.

Request:

```json
{
  "cloneFromVersionId": "ver_123"
}
```

#### `GET /versions/:versionId`
#### `POST /versions/:versionId/finalize`

Marks version `ready` if validations pass.

### 8.6 File upload and import

#### `POST /versions/:versionId/files`

Multipart upload endpoint for raw files.

Response:

```json
{
  "files": [
    {
      "id": "pfl_123",
      "logicalPath": ".claude/agents/reviewer.md",
      "kind": "raw_source"
    }
  ]
}
```

#### `POST /versions/:versionId/import`

Starts parse/normalize flow.

Request:

```json
{
  "sourcePlatform": "claude_code",
  "mode": "auto"
}
```

Response:

```json
{
  "jobId": "job_123",
  "status": "queued"
}
```

### 8.7 Subagents and rules

#### `GET /versions/:versionId/subagents`
#### `POST /versions/:versionId/subagents`
#### `PATCH /subagents/:subagentId`
#### `DELETE /subagents/:subagentId`

#### `GET /versions/:versionId/skill-rules`
#### `POST /versions/:versionId/skill-rules`
#### `PATCH /skill-rules/:skillRuleId`
#### `DELETE /skill-rules/:skillRuleId`

### 8.8 Compatibility and export

#### `POST /versions/:versionId/compatibility-check`

Request:

```json
{
  "targetPlatform": "codex"
}
```

#### `GET /versions/:versionId/compatibility`

#### `POST /versions/:versionId/export-preview`

Builds generated target files and preview diffs without deployment.

Request:

```json
{
  "targetPlatform": "cursor"
}
```

Response:

```json
{
  "jobId": "job_456",
  "status": "queued"
}
```

#### `GET /versions/:versionId/exports`

Returns generated exports with download URLs or storage keys.

### 8.9 Credentials

#### `GET /credentials`
#### `POST /credentials`

Request:

```json
{
  "name": "GitHub Deploy Token",
  "provider": "github",
  "kind": "oauth_token",
  "secret": "ghp_xxx",
  "metadata": {
    "scopes": ["repo"]
  }
}
```

Response returns metadata only. Never echo the raw secret.

#### `PATCH /credentials/:credentialId`
#### `DELETE /credentials/:credentialId`
#### `POST /credentials/:credentialId/verify`

### 8.10 Deployment targets

#### `GET /projects/:projectId/deployment-targets`
#### `POST /projects/:projectId/deployment-targets`

Request:

```json
{
  "name": "GitHub PR to main repo",
  "platform": "claude_code",
  "deliveryMode": "pull_request",
  "config": {
    "repository": "org/repo",
    "baseBranch": "main",
    "exportPath": "/"
  }
}
```

### 8.11 Deployment jobs

#### `POST /versions/:versionId/deploy`

Request:

```json
{
  "deploymentTargetId": "dpl_123"
}
```

Response:

```json
{
  "jobId": "dep_123",
  "status": "queued"
}
```

#### `GET /deployment-jobs/:jobId`
#### `GET /projects/:projectId/deployments`

### 8.12 Audit and reporting

#### `GET /audit-events`
#### `GET /reports/usage-summary`
#### `GET /reports/deployment-summary`

## 9. Worker jobs

### Job types

- `import_parse`
- `normalize`
- `compatibility_check`
- `export_build`
- `deploy_git_branch`
- `deploy_pull_request`
- `credential_verify`

### Queue strategy for v1

Use DB-backed polling:

- worker selects oldest `queued` job
- atomically marks `running`
- heartbeats `updated_at`
- writes result or error payload

This is enough for local and early hosted usage.

Move to SQS only when:

- multiple workers across services are needed
- retry/dead-letter behavior becomes hard to manage in SQL
- job volume materially increases

## 10. Security spec

### Secrets

Local v1:

- encrypt at the application layer before writing to DB
- use AES-GCM
- master key provided by environment variable
- track `key_version`

AWS target:

- master encryption material backed by AWS KMS
- runtime app secrets stored in AWS Secrets Manager
- app-specific secret ciphertext can still live in PostgreSQL

### Access rules

- never return raw credential values in API responses
- only worker code may request decrypted values
- every credential use creates `credential_access_logs`
- deployment/export jobs reference credentials by ID only

### Audit

Audit these actions:

- create/update/delete package
- create/finalize version
- upload/import files
- export preview/build
- create/update/delete credential
- verify credential
- deploy package

## 11. Billing enforcement

### Free

- max organizations per user: 1
- manual export only
- no deployment jobs
- lower file/storage/version limits

### Pro

- deployment jobs enabled
- credential vault enabled
- Slack notifications enabled

### Enterprise

- advanced reporting
- approval workflows
- expanded quotas

Billing enforcement should be a policy layer, not scattered endpoint checks.

Use a central `EntitlementService` with methods like:

- `canCreatePackage()`
- `canRunDeployment()`
- `canUseCredentialVault()`

## 12. AWS landing design

### Container layout

- one image for web
- one image for worker
- same codebase, different entrypoints

### Runtime configuration

- `DATABASE_URL`
- `ARTIFACT_STORAGE_DRIVER`
- `ARTIFACT_STORAGE_BUCKET`
- `APP_ENCRYPTION_KEY` for local only
- `AWS_REGION`
- `KMS_KEY_ID`
- `SECRETS_MANAGER_PREFIX`

### RDS migration

1. stabilize Prisma schema on SQLite
2. ensure no SQLite-only assumptions remain
3. switch Prisma datasource to PostgreSQL in staging
4. run migrations
5. verify package import/export and job flows

### Initial AWS environment

- 1 ECS service for web
- 1 ECS service for worker
- 1 RDS PostgreSQL instance
- 1 S3 bucket
- 1 KMS key
- Secrets Manager secrets per environment

Do not start with multi-region or heavy microservice splits.

## 13. Implementation backlog

### Epic 0: repo bootstrap

- scaffold app and package manager baseline
- add Prisma and initial schema tooling
- add lint/format/test baseline
- add env config loader

Acceptance:

- app boots locally
- Prisma can generate and migrate SQLite DB
- CI can run lint and tests

### Epic 1: identity and organization core

- implement dev session bootstrap
- implement users, profiles, organizations, memberships
- add org-scoped authorization middleware

Acceptance:

- one command creates local dev session and seed org
- protected routes resolve active org

### Epic 2: projects and packages

- implement projects CRUD
- implement packages CRUD
- implement versions CRUD
- implement immutable finalized versions

Acceptance:

- user can create project, package, draft version
- finalized version becomes read-only except clone/archive actions

### Epic 3: file storage and uploads

- implement local artifact storage driver
- implement package file upload API
- add checksum and metadata capture

Acceptance:

- uploaded files persist and can be listed and downloaded
- duplicate logical path handling is deterministic

### Epic 4: canonical package editor

- implement `manifest_json` and `agent_definition_json` editing
- implement subagent CRUD
- implement skill/rule CRUD
- build package version detail page

Acceptance:

- user can fully define a canonical package without importing files

### Epic 5: import pipeline

- implement parser registry
- implement deterministic parsers for:
  - Codex
  - Claude Code
  - Cursor
- implement assisted normalization job contract
- store confidence, assumptions, warnings

Acceptance:

- user can upload known-format files and get normalized package data
- assisted transforms are stored with review metadata

### Epic 6: compatibility and export

- implement compatibility engine
- implement export builders for:
  - Codex
  - Claude Code
  - Claude Agents
  - Cursor
- implement export preview files and diffs

Acceptance:

- user can preview export for each supported target
- generated files can be downloaded as a bundle

### Epic 7: credential vault

- implement encrypted credential storage
- implement verify hooks for GitHub/Slack/Twilio where possible
- add access logging

Acceptance:

- secrets are never returned raw
- verify job writes success/failure metadata

### Epic 8: deployment targets and jobs

- implement deployment target CRUD
- implement Git branch export job
- implement PR creation flow
- add job detail and logs UI

Acceptance:

- paid-tier org can deploy a package version to a configured Git target
- deployment job is auditable end-to-end

### Epic 9: billing and entitlements

- implement `subscriptions`
- implement `EntitlementService`
- gate deployment and vault features by tier

Acceptance:

- free tier cannot run deployment jobs
- pro tier can

### Epic 10: Slack integration

- connect Slack integration metadata
- add outbound notifications for job status
- add limited inbound commands:
  - export
  - deploy
  - job status

Acceptance:

- Slack message can trigger a deployment job
- job completion posts back to Slack

### Epic 11: AWS readiness

- add S3 storage driver
- add PostgreSQL staging profile
- add container build and runtime split
- add ECS/Fargate deployment config

Acceptance:

- same app runs locally and in AWS staging
- artifact storage works against both local disk and S3
- Prisma migrations run on PostgreSQL

## 14. Recommended build order

Build in this sequence:

1. Epic 0
2. Epic 1
3. Epic 2
4. Epic 3
5. Epic 4
6. Epic 5
7. Epic 6
8. Epic 7
9. Epic 8
10. Epic 9
11. Epic 10
12. Epic 11

The first meaningful internal demo should happen after Epic 6.

## 15. Post-foundation execution order

After the current scaffolded product slice, continue in this order:

1. credential vault and deploy-job execution
2. deploy adapters and Git-based delivery
3. Stripe-backed billing and entitlements
4. audit and reporting
5. Slack integration
6. WhatsApp integration
7. OpenAI-assisted import conversion
8. AWS migration

### 15.1 Billing direction

Use Stripe Billing for subscriptions and Stripe Entitlements for feature access.

Implementation direction:

- keep `subscriptions` in the app database as the local mirror of Stripe state
- add Stripe IDs and entitlement snapshots
- gate features through one app service instead of scattering plan checks across routes

Recommended feature keys:

- `manual_export`
- `deployment_jobs`
- `credential_vault`
- `slack_controls`
- `advanced_reporting`

### 15.2 Backend AI direction

Use OpenAI on the backend for assisted import conversion.

Current default recommendation:

- model: `gpt-5.4-mini`
- API: Responses API
- output mode: structured outputs when the canonical extraction contract is known

Deterministic parsers stay first. The model is only for ambiguous or lossy inputs.

## 16. Open questions to settle before coding

- Do you want `CLAUDE.md` treated as a first-class canonical field, or just as a file artifact plus parsed hints?
- Do you want one package to support multiple target exports at once, or one package per target flavor?
- Is GitHub the only deploy surface for v1, or do you want GitLab immediately too?
- Should WhatsApp stay fully out of the first shipped version, or just out of the first milestone?

## Sources

- Amazon RDS for PostgreSQL: https://aws.amazon.com/rds/postgresql
- Amazon RDS PostgreSQL user guide: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
- AWS Fargate: https://aws.amazon.com/fargate/
- ECS Fargate developer guide: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
- Amazon S3 docs overview: https://aws.amazon.com/documentation-overview/s3/
- Amazon SQS: https://aws.amazon.com/sqs/
- AWS Secrets Manager: https://aws.amazon.com/secrets-manager/
- Secrets Manager user guide: https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html
- OpenAI Codex AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex subagents: https://developers.openai.com/codex/subagents
- OpenAI Codex Slack integration: https://developers.openai.com/codex/integrations/slack
- Claude Code subagents: https://code.claude.com/docs/en/subagents
- Claude Agent SDK subagents: https://platform.claude.com/docs/agent-sdk/subagents
- Cursor rules: https://docs.cursor.com/en/context/rules
