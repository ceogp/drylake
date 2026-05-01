# Staging Handoff

## Current Goal

Make GitLab `deploy_staging` work using the same configuration that was used for the successful local AWS staging deploy.

## Repo And Branch

- Repo: `https://gitlab.com/gmkdigitalmedia1/drylake.git`
- Branch: `development`
- Live URL: `https://drylake.xupracorp.com`
- Verified live version page: `https://drylake.xupracorp.com/versions/cmo4fx5z70007wcpatx9or6tk`

## Recent Commits

- `8e1c4de` - Refactor skills and agents page
- `68aa141` - Allow staging without Clerk proxy

## Env Files Updated Locally

Secrets and staging values are saved locally in:

- `C:\Users\gp\Desktop\agenttransfer\.env`
- `C:\Users\gp\Desktop\agenttransfer\storage\staging\deploy\staging.env`

Use `storage/staging/deploy/staging.env` as the source for the GitLab `STAGING_ENV_FILE` variable.

## Values Present In Env

These are present in both `.env` and `storage/staging/deploy/staging.env`:

- `AUTH_MODE=clerk`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRODUCT_ID`
- `STRIPE_PRO_PRICE_ID`
- `AI_PROVIDER=kimi`
- `KIMI_API_KEY`
- `KIMI_BASE_URL`
- `KIMI_MODEL`

## Still Missing

Missing:

- `STRIPE_ENTERPRISE_PRICE_ID`

Known current Stripe product:

- DryLake $10/month product is saved as `STRIPE_PRO_PRODUCT_ID`.
- DryLake $10/month recurring price is saved as `STRIPE_PRO_PRICE_ID`.

## GitLab CI Variables Needed

Add these in GitLab project settings:

- `STAGING_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `STAGING_ENV_FILE`
- `STAGING_URL`

Optional:

- `AUTO_DEPLOY_STAGING=true`

## Local Sources For GitLab Variables

- `STAGING_HOST`: from `storage/staging/staging-manifest.json` -> `publicIp`
- `STAGING_SSH_USER`: from `storage/staging/staging-manifest.json` -> `sshUser`
- `STAGING_SSH_PRIVATE_KEY`: contents of the file at `sshKeyPath` in `storage/staging/staging-manifest.json`
- `STAGING_ENV_FILE`: full contents of `storage/staging/deploy/staging.env`
- `STAGING_URL`: `https://drylake.xupracorp.com`

Do not print these values in logs.

## Deployment Verification

After GitLab `deploy_staging` passes, verify:

- `https://drylake.xupracorp.com/api/v1/health`
- `https://drylake.xupracorp.com/versions/cmo4fx5z70007wcpatx9or6tk`

Expected page:

- `Skills & Agents`
- `Source Files`
- `Canonical Library`
- `Targets`
- `History`

Must not show:

- `Check Compatibility`
- `Export Preview`
- `Advanced Package Editing`
- `storageKey`

## Security Notes

- Do not commit `.env`.
- Do not commit `storage/staging/deploy/staging.env`.
- Do not print private keys, webhook secrets, Stripe secrets, Clerk secrets, database password, or app encryption key.
