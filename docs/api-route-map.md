# Xupra DryLake API Route Map

Base prefix: `/api/v1`

## Implemented now

### `GET /api/v1/health`

- Returns service health, environment, and timestamp.

### `POST /api/v1/dev/session`

- Creates or reuses a local development user + org bootstrap.

### `GET /api/v1/auth/session`

- Returns current auth mode, readiness, and the local session summary.

### `POST /api/v1/extension/connect`

- Bootstraps the editor client and returns auth/session status for VS Code or Cursor.

Request:

```json
{
  "email": "owner@example.com",
  "displayName": "Owner"
}
```

### `GET /api/v1/projects?organizationId=<orgId>`

- Lists active projects for an organization. Falls back to the active session organization when the query parameter is omitted.

### `POST /api/v1/projects`

- Creates a project.

### `GET /api/v1/projects/:projectId`

- Returns one project with recent package/version data.

### `GET /api/v1/projects/:projectId/packages`

- Lists packages in a project.

### `POST /api/v1/projects/:projectId/packages`

- Creates a package in a project.

### `GET /api/v1/packages/:packageId`

- Returns one package with version history.

### `GET /api/v1/packages/:packageId/versions`

- Lists versions for one package.

### `POST /api/v1/packages/:packageId/versions`

- Creates a new draft version and updates `latestVersionId`.

### `GET /api/v1/versions/:versionId`

- Returns one package version with files, subagents, and rules.

### `PATCH /api/v1/versions/:versionId`

- Updates canonical manifest and agent-definition fields for a version.

### `POST /api/v1/versions/:versionId/files`

- Uploads raw files for later normalization.

### `POST /api/v1/versions/:versionId/import`

- Parses uploaded files and merges deterministic results into the canonical package.

### `POST /api/v1/versions/:versionId/compatibility`

- Runs a target-specific compatibility check and records a transform job.

### `POST /api/v1/versions/:versionId/export-preview`

- Builds generated target files, stores them, and records an export job.

### `GET /api/v1/versions/:versionId/exports?targetPlatform=<target>`

- Lists generated export files for a target platform and returns their current content.

### `GET /api/v1/credentials`

- Lists stored credentials for the active development organization.

### `POST /api/v1/credentials`

- Creates an encrypted credential record.

### `GET /api/v1/credentials/:credentialId`

- Returns credential metadata without exposing the raw secret.

### `PATCH /api/v1/credentials/:credentialId`

- Updates credential metadata and optionally rotates the stored secret.

### `DELETE /api/v1/credentials/:credentialId`

- Deletes a credential and records audit history.

### `POST /api/v1/credentials/:credentialId/verify`

- Runs provider verification where supported and updates verification metadata.

### `GET /api/v1/projects/:projectId/deployment-targets`

- Lists deployment targets for a project.

### `POST /api/v1/projects/:projectId/deployment-targets`

- Creates a deployment target for a project.

### `GET /api/v1/integrations`

- Lists integrations for the active organization.

### `POST /api/v1/integrations`

- Creates or updates an organization integration record.

### `POST /api/v1/integrations/:integrationId/verify`

- Verifies an integration against its configured credential where supported.

### `POST /api/v1/integrations/:integrationId/test`

- Sends a test outbound notification.

### `POST /api/v1/versions/:versionId/deploy`

- Runs a deployment job against a configured target.

### `GET /api/v1/deployment-jobs/:jobId`

- Returns one deployment job with target and version context.

### `GET /api/v1/projects/:projectId/deployments`

- Lists recent deployment jobs for a project.

### `POST /api/v1/billing/checkout`

- Creates a Stripe checkout session when Stripe is configured.

### `POST /api/v1/billing/portal`

- Creates a Stripe billing portal session when Stripe is configured.

### `GET /api/v1/audit-events`

- Lists audit events for the active organization.

### `GET /api/v1/reports/usage-summary`

- Returns org-scoped usage counts.

### `GET /api/v1/reports/deployment-summary`

- Returns deployment success/failure metrics and recent jobs.

### `POST /api/stripe/webhook`

- Syncs Stripe subscription state into the local subscription mirror.

### `POST /api/integrations/slack/commands`

- Handles simple Slack command ingress for job status, export, and deploy actions.

### `POST /api/integrations/whatsapp/webhook`

- Handles simple WhatsApp command ingress for job status, export, and deploy actions.

## Still scaffolded

These routes still exist as placeholders or are not implemented yet.

- `GET /api/v1/me`
- `PATCH /api/v1/me/profile`
- `GET /api/v1/organizations/:orgId`
- `POST /api/v1/versions/:versionId/finalize`
## Planned next routes

The following are defined in the v1 spec but not added yet:

- `GET /api/v1/me`
- `PATCH /api/v1/projects/:projectId`
- `GET /api/v1/versions/:versionId/subagents`
- `POST /api/v1/versions/:versionId/subagents`
- `GET /api/v1/versions/:versionId/skill-rules`
- `POST /api/v1/versions/:versionId/skill-rules`
- `GET /api/v1/audit-events`
- `GET /api/v1/reports/usage-summary`
- `GET /api/v1/reports/deployment-summary`
