# AWS CI/CD Migration Plan

### Architectural Approach

- Goal: replace GitLab CI/CD orchestration with AWS-native delivery while keeping the current production runtime model intact.
- Keep the app hosted on the existing EC2-style target that already runs `scripts/deploy/remote-bootstrap.sh`.
- Do not combine this migration with a hosting rewrite to ECS, App Runner, or Amplify. That is a separate project.
- Use AWS CodePipeline as the orchestrator for `main`, `staging`, and release-tag flows.
- Use AWS CodeConnections with GitLab.com as the source so the repo can stay in GitLab during the first migration phase.
- Use CodeBuild for validation and packaging because it maps directly to the existing `validate`, `package`, and `verify` jobs in `.gitlab-ci.yml`.
- Use S3 as the deployment artifact store for pipeline artifacts and metadata.
- Keep the existing SSH/bootstrap deploy mechanics for the first AWS CI/CD cutover. The orchestration moves to AWS, but the host execution stays aligned with the current proven path.
- Keep AWS Secrets Manager as the source of truth for environment bundles. The repo already has `scripts/aws/env-secrets.mjs` for this pattern.
- Move continuous watch scheduling from GitLab scheduled pipelines to EventBridge Scheduler invoking either SSM Run Command or a lightweight CodeBuild job.
- Keep production verification as an explicit post-deploy step that calls `scripts/deploy/verify-deploy.sh` semantics against the live URL.
- Keep extension marketplace publishing out of the first migration scope unless release tagging is currently blocked. App deploy migration is the priority.
- Preferred rollout order:
  1. create env and SSH key secrets in AWS
  2. create and authorize GitLab CodeConnections
  3. provision staging + production AWS pipelines
  4. run a manual staging execution
  5. cut production deploy from GitLab to AWS
  6. remove GitLab deploy jobs
- Failure strategy:
  - failed validate stops before deploy
  - failed deploy does not advance the live symlink
  - failed verify marks the pipeline failed and leaves the previous release available on host
- Assumption: production auth is being cut to Cognito as part of the app release, independent of the CI/CD migration.
- Assumption: the current production host remains reachable over SSH using the existing deploy user and key material.

### Data Model

- No application database schema changes are required for this migration.
- New infrastructure state objects:

```txt
EnvironmentSecretBundle
- secretId: string
- environment: development | staging | production
- source: AWS Secrets Manager
- payload: existing `.env` bundle

DeployKeySecret
- secretId: string
- environment: staging | production
- source: AWS Secrets Manager
- payload: SSH private key for deploy user

ReleaseArtifact
- artifactLocation: string
- commitSha: string
- ref: string
- buildId: string
- createdAt: iso8601
- contents: app tarball plus pipeline metadata

DeploymentTarget
- environment: development | staging | production
- host: string
- sshUser: string
- sshKeySecretId: string
- appDir: string
- baseUrl: string
- envSecretId: string

DeploymentInvocation
- environment: string
- commitSha: string
- artifactLocation: string
- targetHost: string
- startedAt: iso8601
- finishedAt: iso8601
- status: queued | running | failed | succeeded

VerificationResult
- environment: string
- commitSha: string
- checks: health, install page, connect page, gif urls, admin auth
- status: failed | succeeded
- capturedAt: iso8601

ContinuousWatchSchedule
- environment: production
- scheduleExpression: cron/rate
- target: EventBridge Scheduler -> CodeBuild or HTTP endpoint
- secretSource: Secrets Manager
```

- Persistence boundaries:
  - application secrets stay in Secrets Manager
  - pipeline state stays in CodePipeline/CodeBuild history
  - no deploy metadata needs to be added to Prisma models

### Component Architecture

- Source:
  - GitLab repository connected to AWS through CodeConnections
  - triggers CodePipeline on `main`, `staging`, and optional release tags
  - note: AWS documents that a CLI-created GitLab connection remains `PENDING` until the console authorization handshake is completed
- Validate Build:
  - CodeBuild project runs `npm ci`, `prisma generate`, `prisma migrate deploy` against CI Postgres, `seed`, `typecheck`, `lint`, `guard:readiness`, `build`
- Deploy:
  - CodePipeline invokes a deploy CodeBuild project
  - deploy CodeBuild reads the env bundle and SSH key from Secrets Manager
  - deploy CodeBuild creates `release.tar`, copies it plus `deploy.env` and `remote-bootstrap.sh` to the target host, and runs the bootstrap over SSH
  - host keeps the existing `/srv/xupra-drylake/releases` and `current` symlink release model
- Verify:
  - post-deploy CodeBuild runs the equivalent of `scripts/deploy/verify-deploy.sh` against `APP_BASE_URL`
  - pipeline fails if live SHA, health, or required assets are wrong
- Secrets:
  - Secrets Manager stores one env bundle per environment, reusing `scripts/aws/env-secrets.mjs`
  - Secrets Manager also stores one deploy SSH private key per environment
  - the CodeBuild role reads only the environment-scoped env secret and SSH key secret
- Scheduler:
  - EventBridge Scheduler replaces the GitLab scheduled `continuous_watch_scheduler` job
- Observability:
  - CloudWatch Logs for CodeBuild
  - CloudWatch alarms for failed production deploys and failed continuous-watch runs
  - SNS notification target for production deploy failures if needed
- Security boundaries:
  - no env bundle stored in GitLab CI variables once cutover is complete
  - deploy secrets live in AWS Secrets Manager
  - deploy role limited to the pipeline artifact bucket and the specific environment-scoped secrets
- Migration interfaces implemented in this repo:
  - CodePipeline definitions for staging and production
  - CodeBuild buildspecs matching existing jobs
  - SSH-based deploy wrapper that reuses the existing bootstrap behavior under CodeBuild
- Migration interfaces still remaining operationally:
  - create a full production env secret
  - create deploy SSH key secrets
  - create and authorize the GitLab CodeConnections resource
  - optionally move continuous watch to EventBridge Scheduler after app deploy cutover
