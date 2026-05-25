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

Install Node 22 or newer, clone the repo, then run the bootstrap script.

```powershell
git clone https://gitlab.com/gmkdigitalmedia1/drylake.git
cd drylake
.\bootstrap.ps1
```

The bootstrap script:

- runs `npm ci` if dependencies are missing.
- applies the checked-in machine profile for VS Code, Codex, and global npm CLI tools.
- pulls the development `.env` bundle from AWS Secrets Manager when `.env` is missing.
- validates `.env` when it already exists.
- starts local Postgres with Docker Compose when the database URL points at localhost and Docker is available.
- runs Prisma generate, migrations, and seed.

If the machine does not have AWS credentials yet, the script stops with the exact missing login step. The one-time AWS setup is:

```powershell
aws configure sso
aws sso login --profile xupra
$env:AWS_PROFILE = "xupra"
```

If AWS CLI is not installed or is broken, the Node AWS SDK still works with a valid `~/.aws/config` and `~/.aws/credentials`.

To force-refresh `.env` from AWS:

```powershell
.\bootstrap.ps1 --refresh-env
```

To skip VS Code/Codex/global tool setup:

```powershell
.\bootstrap.ps1 --skip-machine-profile
```

The machine profile restores:

- VS Code `settings.json`, `keybindings.json`, and extension list.
- Codex `config.toml`, `AGENTS.md`, agents, rules, and custom Traycer workflow skills.
- Global npm CLIs from `config/machine-profile/npm-global.txt`, including Codex and Claude Code.

It does not restore Codex `auth.json`, logs, history, sessions, SQLite state, or other local secrets. Run `codex login`, `claude login`, GitHub login, and other provider logins on the new laptop as needed.

To run validation during bootstrap:

```powershell
.\bootstrap.ps1 --validate
```

If the local Docker database was already created with different credentials:

```powershell
.\bootstrap.ps1 --reset-db
```

This deletes only the local Docker Postgres volume.

To start the dev server after setup:

```powershell
.\bootstrap.ps1 --start
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
