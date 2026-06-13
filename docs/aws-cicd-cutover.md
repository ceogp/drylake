# AWS CI/CD Cutover

This repo now includes an AWS-native deployment path that replaces GitLab CI/CD orchestration with:

1. `CodePipeline`
2. `CodeBuild`
3. `SSH bootstrap on EC2`
4. `AWS Secrets Manager`

## What is implemented

Files added for the AWS path:

1. `buildspecs/validate.yml`
2. `buildspecs/deploy.yml`
3. `buildspecs/verify.yml`
4. `scripts/aws/deploy-via-ssh.ts`
5. `scripts/aws/provision-cicd.ts`

Package scripts:

1. `npm run aws:provision-cicd`
2. `npm run aws:deploy-ssh`
3. `npm run aws:deploy-ssm` (compatibility alias to the SSH-based deploy)

## Provisioning inputs

Set these local environment variables before running the provisioner:

```txt
AWS_REGION=ap-northeast-1
AWS_CODECONNECTIONS_ARN=<existing available GitLab CodeConnections ARN>
AWS_CODECONNECTIONS_FULL_REPOSITORY_ID=gmkdigitalmedia1/drylake
AWS_CICD_ARTIFACT_BUCKET=<optional override>
```

Target-specific inputs:

```txt
STAGING_HOST=<ec2 public host or DNS>
STAGING_SSH_USER=<ssh user>
STAGING_SSH_KEY_SECRET_ID=<aws secrets manager ssh key secret id>
STAGING_URL=https://staging.example.com
STAGING_ENV_SECRET_ID=<aws secrets manager env bundle id>

PRODUCTION_HOST=<ec2 public host or DNS>
PRODUCTION_SSH_USER=<ssh user>
PRODUCTION_SSH_KEY_SECRET_ID=<aws secrets manager ssh key secret id>
PRODUCTION_URL=https://drylake.xupracorp.com
PRODUCTION_ENV_SECRET_ID=<aws secrets manager env bundle id>
```

If a target block is incomplete, the provisioner skips that environment.

## What the provisioner creates

1. Versioned/encrypted S3 artifact bucket for CodePipeline artifacts
2. CodeBuild role
3. CodePipeline role
4. Shared validation CodeBuild project
5. Per-environment deploy CodeBuild project
6. Per-environment verify CodeBuild project
7. Per-environment CodePipeline pipeline

The provisioner does not replace or mutate the target EC2 instance profile.

## Deploy mechanics

The AWS deploy path keeps the current working EC2 bootstrap model.

1. CodeBuild packages the repo into `release.tar`
2. CodeBuild reads the deploy env bundle and SSH key from Secrets Manager
3. CodeBuild copies `release.tar`, `deploy.env`, and `remote-bootstrap.sh` to the target host over SSH
4. The target host runs `scripts/deploy/remote-bootstrap.sh`
5. CodeBuild runs `scripts/deploy/verify-deploy.sh`

Release metadata is appended during deploy:

1. `XUPRA_RELEASE_SHA`
2. `XUPRA_RELEASE_SHORT_SHA`
3. `XUPRA_RELEASE_REF`
4. `XUPRA_RELEASE_PIPELINE_ID`
5. `XUPRA_RELEASE_DEPLOYED_AT`

Production secrets are not expanded into SSM command text in this path.

## Cognito cutover requirement

The new app code requires Cognito for production.

Before using the AWS production pipeline, the production env bundle must include:

```txt
AUTH_MODE=cognito
AWS_COGNITO_REGION=...
AWS_COGNITO_USER_POOL_ID=...
AWS_COGNITO_CLIENT_ID=...
AWS_COGNITO_CLIENT_SECRET=...
AWS_COGNITO_DOMAIN=...
AWS_COGNITO_ISSUER=...
AWS_COGNITO_CALLBACK_URL=https://drylake.xupracorp.com/api/auth/cognito/callback
AWS_COGNITO_LOGOUT_REDIRECT_URL=https://drylake.xupracorp.com/
```

## Current blockers for production cutover

In the current AWS account/region context:

1. `xupra-drylake/production/cognito-auth` exists
2. a full production env bundle secret was not visible under `xupra-drylake/production/env`
3. no GitLab CodeConnections resource exists yet

So the repo is ready for AWS-native CI/CD assets, but the final production cutover still requires:

1. a full production env bundle secret id
2. an SSH key secret id for each target host
3. a CodeConnections ARN that is already `AVAILABLE`

## Run

Provision:

```bash
npm run aws:provision-cicd
```

Manual deploy through the same AWS CodeBuild-compatible path:

```bash
TARGET_ENV=staging \
DEPLOY_HOST=staging.example.com \
DEPLOY_SSH_USER=ubuntu \
DEPLOY_SSH_KEY_SECRET_ID=xupra-drylake/staging/ssh-key \
DEPLOY_ENV_SECRET_ID=xupra-drylake/staging/env \
APP_BASE_URL=https://staging.example.com \
npm run aws:deploy-ssh
```

## GitLab source connection note

AWS documents that a GitLab connection created by CLI or CloudFormation stays `PENDING` until it is completed in the AWS console. Create the connection first, then finish the authorization handshake in the console before expecting automatic branch-triggered pipelines.

## Success check

After a production cutover, `https://drylake.xupracorp.com/api/v1/health` should report:

1. `authMode: "cognito"`
2. `cognitoConfigured: true`
3. the expected release SHA
