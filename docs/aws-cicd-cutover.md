# AWS CI/CD Cutover

This repo includes an AWS-native deployment path built around:

1. `CodePipeline`
2. `CodeBuild`
3. `SSH bootstrap on EC2`
4. `AWS Secrets Manager`
5. `Amazon S3` source artifacts

## Current preferred source mode

Preferred mode is `S3` source, not GitLab CodeConnections.

Reason:
1. it removes GitLab from the deploy path entirely
2. it avoids CodeConnections authorization friction
3. it keeps the release flow simple: publish a versioned source zip to S3, then start the pipeline

GitLab CodeConnections is still supported in the provisioner as an optional mode, but it is no longer the preferred cutover path.

## What is implemented

Files added for the AWS path:

1. `buildspecs/validate.yml`
2. `buildspecs/deploy.yml`
3. `buildspecs/verify.yml`
4. `scripts/aws/deploy-via-ssh.ts`
5. `scripts/aws/provision-cicd.ts`
6. `scripts/aws/publish-source.ts`

Package scripts:

1. `npm run aws:provision-cicd`
2. `npm run aws:deploy-ssh`
3. `npm run aws:publish-source`
4. `npm run aws:deploy-ssm` (compatibility alias to the SSH-based deploy)

## Provisioning inputs

Set these local environment variables before running the provisioner:

```txt
AWS_REGION=ap-northeast-1
AWS_CICD_SOURCE_PROVIDER=s3
AWS_CICD_ARTIFACT_BUCKET=<optional override>
AWS_CICD_SOURCE_BUCKET=<optional override; defaults to artifact bucket>
```

Target-specific inputs:

```txt
STAGING_HOST=<ec2 public host or DNS>
STAGING_SSH_USER=<ssh user>
STAGING_SSH_KEY_SECRET_ID=<aws secrets manager ssh key secret id>
STAGING_URL=https://staging.example.com
STAGING_ENV_SECRET_ID=<aws secrets manager env bundle id>
STAGING_SOURCE_OBJECT_KEY=sources/staging/source.zip

PRODUCTION_HOST=<ec2 public host or DNS>
PRODUCTION_SSH_USER=<ssh user>
PRODUCTION_SSH_KEY_SECRET_ID=<aws secrets manager ssh key secret id>
PRODUCTION_URL=https://drylake.xupracorp.com
PRODUCTION_ENV_SECRET_ID=<aws secrets manager env bundle id>
PRODUCTION_SOURCE_OBJECT_KEY=sources/production/source.zip
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

1. `npm run aws:publish-source` creates a zip from local `HEAD`
2. it uploads that zip to the configured S3 source object key
3. it starts the environment pipeline explicitly
4. CodePipeline runs validate -> deploy -> verify
5. deploy CodeBuild reads the deploy env bundle and SSH key from Secrets Manager
6. deploy CodeBuild copies `release.tar`, `deploy.env`, and `remote-bootstrap.sh` to the target host over SSH
7. the target host runs `scripts/deploy/remote-bootstrap.sh`

Release metadata is appended during deploy:

1. `XUPRA_RELEASE_SHA`
2. `XUPRA_RELEASE_SHORT_SHA`
3. `XUPRA_RELEASE_REF`
4. `XUPRA_RELEASE_PIPELINE_ID`
5. `XUPRA_RELEASE_DEPLOYED_AT`

Production secrets are not expanded into SSM command text in this path.

## Cognito cutover requirement

The app now requires Cognito for production.

The production env bundle must include:

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

## Current production state

Production already has these AWS secrets:

1. `xupra-drylake/production/env`
2. `xupra-drylake/production/deploy-ssh-key`

## Run

Provision or update the pipelines:

```bash
npm run aws:provision-cicd
```

Publish source and start the production pipeline:

```bash
TARGET_ENV=production npm run aws:publish-source
```

Publish source and start the staging pipeline:

```bash
TARGET_ENV=staging npm run aws:publish-source
```

Manual direct deploy without CodePipeline remains available:

```bash
TARGET_ENV=production \
DEPLOY_HOST=drylake.example.com \
DEPLOY_SSH_USER=ubuntu \
DEPLOY_SSH_KEY_SECRET_ID=xupra-drylake/production/deploy-ssh-key \
DEPLOY_ENV_SECRET_ID=xupra-drylake/production/env \
APP_BASE_URL=https://drylake.xupracorp.com \
npm run aws:deploy-ssh
```

## Success check

After a production cutover, `https://drylake.xupracorp.com/api/v1/health` should report:

1. `authMode: "cognito"`
2. `cognitoConfigured: true`
3. the expected release SHA or local release marker
