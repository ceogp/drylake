# Staging Deployment

## Current staging target

The first AWS staging target is intentionally simple:

- region: `ap-northeast-1`
- instance type: `t3.large`
- one Ubuntu EC2 host
- PostgreSQL installed on the host
- nginx reverse proxy on port `80`
- Next.js app running on port `3000`

This is a staging/test path, not the final production topology.

## Local provisioning flow

1. Provision AWS resources:

```bash
npx tsx scripts/aws/provision-staging.ts
```

2. Deploy the app to the provisioned host:

```bash
npx tsx scripts/aws/deploy-staging.ts
```

Provisioning stores the staging manifest in:

- `storage/staging/staging-manifest.json`

The manifest contains:

- instance ID
- Elastic IP
- SSH key path
- generated PostgreSQL credentials
- generated app encryption key

## GitLab pipeline flow

The repo now includes `.gitlab-ci.yml` with:

- `validate`
  - `npm ci`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- `deploy_staging`
  - archives the repo
  - copies the build input to the staging host over SSH
  - runs `scripts/deploy/remote-bootstrap.sh`

## Required GitLab CI variables

Set these in GitLab CI/CD settings before enabling automatic staging deploys:

- `STAGING_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `STAGING_ENV_FILE`
- `STAGING_DB_NAME`
- `STAGING_DB_USER`
- `STAGING_DB_PASSWORD`
- `STAGING_URL`

`STAGING_ENV_FILE` should be the full multi-line env file content for the staging server.

## Important notes

- The current Prisma migration files are SQLite-shaped, so the first staging deploy uses `prisma db push` against a fresh PostgreSQL database.
- This staging host currently runs jobs inline.
- Artifacts are still local on the server in this first cut.
- The next production-oriented step is splitting `web` and `worker` and moving PostgreSQL to RDS.
