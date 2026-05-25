# Secrets Handoff

DryLake can store deploy and local environment bundles in AWS Secrets Manager so a new machine can restore the working state without copying `.env` files by hand.

## What This Covers

- App and deploy environment bundles such as database URLs, Clerk keys, Stripe keys, OpenAI keys, S3 settings, and encryption keys.
- GitLab deployment jobs can read the deploy bundle from AWS Secrets Manager.
- A new laptop can pull the development bundle after AWS login.

## What This Does Not Cover

- Local OAuth/session files for Codex, Claude Code, Gemini, Hermes, GitHub CLI, or VS Code.
- SSH private keys unless you intentionally include them in a separate secret. Prefer GitLab deploy keys or AWS-managed access for deployment.
- Local generated files such as `.drylake/`, `.next/`, `node_modules/`, VSIX files, logs, and caches.

## Secret Names

The default secret names are:

```text
xupra-drylake/development/env
xupra-drylake/staging/env
xupra-drylake/production/env
```

You can override the default with `--secret-id` or set a different prefix with `AWS_SECRETS_PREFIX`.

## Local Setup On A New Laptop

Install Node, clone the repo, install dependencies, then authenticate to AWS using SSO or normal AWS credentials.

```powershell
npm ci
aws configure sso
aws sso login --profile xupra
$env:AWS_PROFILE = "xupra"
$env:AWS_REGION = "ap-northeast-1"
npm run secrets:pull -- --env development --file .env --force
npm run secrets:check -- --env development --file .env
```

Use the actual AWS profile and region for the account.

## Upload Or Update A Secret

Development:

```powershell
$env:AWS_PROFILE = "xupra"
$env:AWS_REGION = "ap-northeast-1"
npm run secrets:check -- --env development --file .env
npm run secrets:push -- --env development --file .env
```

Staging:

```powershell
$env:AWS_PROFILE = "xupra"
$env:AWS_REGION = "ap-northeast-1"
npm run secrets:check -- --env staging --file .env.staging
npm run secrets:push -- --env staging --file .env.staging
```

Production requires an explicit confirmation flag:

```powershell
$env:AWS_PROFILE = "xupra"
$env:AWS_REGION = "ap-northeast-1"
npm run secrets:check -- --env production --file .env.production
npm run secrets:push -- --env production --file .env.production --confirm production
```

The commands report the secret ID and key count only. They do not print secret values.

## GitLab Deployment

Deploy jobs now support either the existing GitLab env-file variables or AWS Secrets Manager.

Set these GitLab CI/CD variables for each environment:

```text
AWS_REGION
AWS_ROLE_ARN
DEVELOPMENT_ENV_SECRET_ID=xupra-drylake/development/env
STAGING_ENV_SECRET_ID=xupra-drylake/staging/env
PRODUCTION_ENV_SECRET_ID=xupra-drylake/production/env
```

Keep existing deploy variables such as:

```text
PRODUCTION_HOST
PRODUCTION_SSH_USER
PRODUCTION_SSH_PRIVATE_KEY
PRODUCTION_URL
```

The deploy job uses GitLab OIDC when `AWS_ROLE_ARN` is set. The AWS role should allow:

```text
secretsmanager:GetSecretValue
kms:Decrypt, if a customer-managed KMS key is used
```

Restrict the IAM resource scope to the DryLake secret names instead of granting broad account access.

## Fallback

The old GitLab `*_ENV_FILE` variables still work. If both `DEPLOY_ENV_SECRET_ID` and `DEPLOY_ENV_FILE` are present, the deploy job uses AWS Secrets Manager first.
