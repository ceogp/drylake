# DryLake Project Map

This file is the non-secret source of truth for where the project lives, how code moves, and what URLs matter.

## Code

- Local repo: `C:\Users\gp\Desktop\agenttransfer`
- GitLab project: `https://gitlab.com/gmkdigitalmedia1/drylake`
- Git remote: `https://gitlab.com/gmkdigitalmedia1/drylake.git`
- GitLab project ID: `81471775`
- GitLab pipelines: `https://gitlab.com/gmkdigitalmedia1/drylake/-/pipelines`
- GitLab merge requests: `https://gitlab.com/gmkdigitalmedia1/drylake/-/merge_requests`
- GitLab branches: `https://gitlab.com/gmkdigitalmedia1/drylake/-/branches`
- GitLab jobs: `https://gitlab.com/gmkdigitalmedia1/drylake/-/jobs`

There is no GitHub remote configured for this repo.

## Branches

- `development`: active working branch and staging deploy branch.
- `main`: stable promotion branch. It exposes a manual production deploy job in `.gitlab-ci.yml`.

Current branch relationship at the time this file was written:

- `development` / `origin/development`: `754a3c8 Use libpq compatible SSL for staging RDS`
- `main` / `origin/main`: `94ad240 Promote working app state to main`

## Deployment URLs

- Live app / current staging URL: `https://drylake.xupracorp.com`
- Health check: `https://drylake.xupracorp.com/api/v1/health`
- Known version page for verification: `https://drylake.xupracorp.com/versions/cmo4fx5z70007wcpatx9or6tk`
- Clerk webhook endpoint: `https://drylake.xupracorp.com/api/clerk/webhook`
- Stripe webhook endpoint: `https://drylake.xupracorp.com/api/stripe/webhook`

The AWS edge manifest also references:

- App host: `drylake.xupracorp.com`
- Marketing host: `xupracorp.com`

## CI/CD

CI config lives at:

- `.gitlab-ci.yml`

Pipeline stages:

- `validate`
- `deploy`

`validate` runs on every branch and performs:

- `npm ci --include=dev`
- Prisma runtime schema generation
- Prisma generate/db push/seed
- `npm run typecheck`
- `npm run lint`
- `npm run build`

`deploy_staging` deploys only from the `development` branch.

`deploy_production` is a manual promotion job from the `main` branch.

Temporary production model:

- `drylake.xupracorp.com` is public/live.
- CI still treats the current host as staging unless production variables point to the same host.
- Until separate infrastructure exists, `PRODUCTION_*` variables may point to the same host/env/domain as staging.
- Later split staging and production into separate hosts/DBs/domains, for example:
  - `drylake-staging.xupracorp.com` or `staging.drylake.xupracorp.com` for staging
  - `drylake.xupracorp.com` for production

`deploy_staging` appears/runs when these GitLab CI variables exist:

- `STAGING_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `STAGING_ENV_FILE`

Recommended:

- `STAGING_URL=https://drylake.xupracorp.com`

Optional:

- `AUTO_DEPLOY_STAGING=true`

If `AUTO_DEPLOY_STAGING=true`, pushes to `development` auto-deploy after validation. Otherwise `deploy_staging` appears as a manual job.

`deploy_production` appears as a manual job on `main` when these GitLab CI variables exist:

- `PRODUCTION_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_ENV_FILE`
- `PRODUCTION_URL`

For the temporary single-host promotion model, these can intentionally match the current staging values.

## Local Staging Files

Do not commit secrets from these files.

- Staging manifest: `storage/staging/staging-manifest.json`
- Generated deploy env: `storage/staging/deploy/staging.env`
- Local app env: `.env`
- SSH key path from manifest: `C:\Users\gp\.ssh\id_ed25519`
- Staging handoff notes: `STAGING_HANDOFF.md`

`storage/staging/staging-manifest.json` contains the staging host/user, database password, and app encryption key.

`storage/staging/deploy/staging.env` is the source for the GitLab `STAGING_ENV_FILE` variable.

## AWS/Staging

Known non-secret staging details:

- AWS region: `ap-northeast-1`
- SSH user: `ubuntu`
- App directory on server: `/srv/xupra-drylake`
- App service: `xupra-drylake`
- Reverse proxy: `nginx`
- Database: private AWS RDS PostgreSQL
- RDS endpoint: `xupra-drylake-staging-postgres.c3ems2eccwjd.ap-northeast-1.rds.amazonaws.com`
- Database name: `xupra_drylake`
- Database user: `xupraapp`

Local deploy command:

```powershell
$env:APP_BASE_URL='https://drylake.xupracorp.com'
npm run aws:deploy-staging
```

Normal deploy path should be GitLab `deploy_staging`, not local deploy.

## Current Verified Deployment State

GitLab pipeline `#26` passed with:

- `validate`: success
- `deploy_staging`: success
- Deployed commit: `754a3c8fd599eb95f0883f0e2167c643b9ba4094`

GitLab API pipeline ID for that successful deployment:

- `2492759148`

Jobs for successful deployment pipeline:

- `validate`: `14171788408`
- `deploy_staging`: `14171903529`

The local artifact storage root for staging is:

- `/srv/xupra-drylake/shared/storage`

This keeps uploaded source files outside rotating release directories.

Live health reported:

- `authMode: clerk`
- `authConfigured: true`
- `billingProvider: stripe`
- `billingConfigured: true`
- `clerkConfigured: true`
- `stripeConfigured: true`

Authenticated browser verification is still the important final check for private version pages.

## Current Product/UI Check

Expected `Skills & Agents` version page after sign-in:

- `Source Files`
- `Canonical Library`
- `Targets`
- `History`

These old labels should not appear in the normal page:

- `Check Compatibility`
- `Export Preview`
- `Advanced Package Editing`
- `storageKey`

## Secret Handling

Never commit:

- `.env`
- `storage/staging/deploy/staging.env`
- private keys
- GitLab CI variable values

Never print:

- SSH private keys
- database password
- app encryption key
- Clerk secret key
- Clerk webhook secret
- Stripe secret key
- Stripe webhook secret
- Kimi API key
