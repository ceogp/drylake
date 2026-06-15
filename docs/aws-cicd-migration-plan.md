# AWS CI/CD Migration Plan

### Architectural Approach

- Goal: remove GitLab from the deployment path while keeping the current production runtime model intact.
- Keep the app hosted on the existing EC2-style target that already runs `scripts/deploy/remote-bootstrap.sh`.
- Do not combine this migration with a hosting rewrite to ECS, App Runner, or Amplify. That is a separate project.
- Use AWS CodePipeline as the orchestrator for `main`, `staging`, and explicit release runs.
- Preferred source mode is `S3`, not GitLab CodeConnections.
- Use CodeBuild for validation and packaging because it maps directly to the existing `validate`, `package`, and `verify` jobs.
- Use S3 both for pipeline artifacts and for the versioned source zip consumed by the Source stage.
- Keep the existing SSH/bootstrap deploy mechanics for the AWS CI/CD cutover. The orchestration moves to AWS, but the host execution stays aligned with the current proven path.
- Keep AWS Secrets Manager as the source of truth for environment bundles and deploy SSH keys.
- Move continuous watch scheduling from GitLab scheduled pipelines to EventBridge Scheduler after the app deploy path is stable.
- Keep production verification as an explicit post-deploy step that calls `scripts/deploy/verify-deploy.sh` semantics against the live URL.
- Preferred rollout order:
  1. provision S3-source AWS pipelines
  2. publish source zip from local `HEAD`
  3. run validate -> deploy -> verify in AWS
  4. stop using GitLab deploy jobs
- Failure strategy:
  - failed validate stops before deploy
  - failed deploy does not advance the live symlink
  - failed verify marks the pipeline failed and leaves the previous release available on host
- Assumption: source control can remain in Git locally and/or GitLab as a mirror, but GitLab is no longer part of release orchestration.

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

SourceArtifact
- bucket: string
- objectKey: string
- commitSha: string
- ref: string
- uploadedAt: iso8601
- format: zip

DeploymentTarget
- environment: development | staging | production
- host: string
- sshUser: string
- sshKeySecretId: string
- appDir: string
- baseUrl: string
- envSecretId: string
- sourceBucket: string
- sourceObjectKey: string

DeploymentInvocation
- environment: string
- commitSha: string
- sourceObjectKey: string
- targetHost: string
- pipelineExecutionId: string
- startedAt: iso8601
- finishedAt: iso8601
- status: queued | running | failed | succeeded

VerificationResult
- environment: string
- commitSha: string
- checks: health, install page, connect page, gif urls, admin auth
- status: failed | succeeded
- capturedAt: iso8601
```

### Component Architecture

- Source:
  - local repo publishes a versioned zip from `git archive HEAD`
  - uploaded to the configured S3 source object key
  - `StartPipelineExecution` launches the pipeline explicitly
- Validate Build:
  - CodeBuild runs `npm ci`, `prisma generate`, `prisma migrate deploy` against CI Postgres, `seed`, `typecheck`, `lint`, `guard:readiness`, `build`
- Deploy:
  - CodePipeline invokes a deploy CodeBuild project
  - deploy CodeBuild reads the env bundle and SSH key from Secrets Manager
  - deploy CodeBuild copies artifacts to the target host and executes `scripts/deploy/remote-bootstrap.sh` over SSH
  - host keeps the existing `/srv/xupra-drylake/releases` and `current` symlink release model
- Verify:
  - post-deploy CodeBuild runs the equivalent of `scripts/deploy/verify-deploy.sh` against `APP_BASE_URL`
  - pipeline fails if live SHA, health, or required assets are wrong
- Secrets:
  - Secrets Manager stores one env bundle per environment
  - Secrets Manager stores one deploy SSH private key per environment
  - the CodeBuild role reads only the environment-scoped env secret and SSH key secret
- Security boundaries:
  - no deploy env stored in GitLab CI variables is required for the AWS pipeline
  - no GitLab webhook or GitLab source connection is required for deployment
  - deploy secrets live in AWS Secrets Manager
  - deploy role is limited to the pipeline artifact bucket and the specific environment-scoped secrets
- Optional future path:
  - CodeCommit is available to new customers again as of November 25, 2025, so a later AWS-only source-control migration is possible
  - but it is not required to remove GitLab from deployment now
