# AWS Cutover Prep

## Goal

Prepare Xupra DryLake for:

1. local validation
2. staging deployment on AWS
3. promotion to production

without rewriting core business logic.

## Runtime Boundaries

Phase 4 prep locks these boundaries:

- `DATABASE_URL`
  - PostgreSQL locally
  - PostgreSQL on AWS RDS
- `ARTIFACT_STORAGE_DRIVER`
  - `local` locally
  - `s3` on AWS
- `SECRETS_PROVIDER`
  - `env` locally
  - `aws_secrets_manager` for staging/production
- `JOB_EXECUTION_MODE`
  - `inline` locally
  - `worker` when web and worker are split

## Database Path

Local:

- `DATABASE_URL=postgresql://...`

AWS target:

- `DATABASE_URL=postgresql://...`

Requirement:

- Prisma schema is PostgreSQL-only
- local development must use a disposable PostgreSQL database copy

## Artifact Path

Local:

- filesystem-backed `storage/`

AWS target:

- `ARTIFACT_STORAGE_DRIVER=s3`
- `AWS_S3_BUCKET`
- optional `AWS_KMS_KEY_ID` for SSE-KMS

Requirement:

- code reads and writes through artifact helpers only
- business logic never writes directly to local disk except deployment mirror targets

## Secrets Path

Local:

- `.env`

AWS target:

- `SECRETS_PROVIDER=aws_secrets_manager`
- `AWS_SECRETS_PREFIX`
- application encryption key stored as:
  - `${AWS_SECRETS_PREFIX}/app-encryption-key`

Requirement:

- runtime secret reads go through the secret provider
- credential encryption must not assume env-only key storage

## Worker Path

Local:

- `JOB_EXECUTION_MODE=inline`

AWS target:

- `JOB_EXECUTION_MODE=worker`
- web creates queued jobs
- worker processes queued jobs

Current prep status:

- deployment jobs now support queue-first execution
- worker can process queued deployment jobs through `npm run worker:once`

Next worker expansion:

1. move import jobs to queue mode
2. move export jobs to queue mode
3. move compatibility checks to queue mode
4. add retry policy and dead-letter handling

## Staging Promotion Flow

1. validate locally
2. deploy web + worker to AWS staging
3. run staging smoke tests
4. restore from backup into a disposable environment
5. promote the tested build to production

## Backup Scope

Back up:

- PostgreSQL database
- S3 artifacts
- deployment manifests
- generated exports

Do not rely on backups you have never restored.

Restore drill requirement:

- restore staging from a real backup before production cutover
