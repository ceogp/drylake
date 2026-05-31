# Xupra DryLake Provider Checklist

This is the concrete list of provider keys, secrets, scopes, and permissions to collect before final live hookup.

## Priority order

Collect in this order:

1. Clerk
2. Stripe
3. OpenAI
4. Slack
5. Twilio WhatsApp
6. AWS

## 1. Clerk

### What to collect

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Optional but likely useful:

- Clerk sign-in URL / sign-up URL settings
- Organizations enabled in Clerk Dashboard
- Organization roles/permissions configuration
- production domain configuration

### Required dashboard setup

- create a Clerk application
- enable Organizations
- decide whether personal accounts are allowed
- decide whether org slugs are enabled

### Where Xupra uses it

- website authentication
- user identity
- active organization selection
- replacing the current dev-session bootstrap

### Notes

- `CLERK_SECRET_KEY` must stay server-side
- if you use `clerkMiddleware()` with dynamic keys, Clerk documents `CLERK_ENCRYPTION_KEY` as relevant in some middleware setups

### Sources

- Clerk environment variables: https://clerk.com/docs/deployments/clerk-environment-variables
- Clerk Next.js SDK: https://clerk.com/docs/nextjs/overview
- Clerk middleware: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Clerk organizations: https://clerk.com/docs/how-to/organizations

## 2. Stripe

### What to collect

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`

Optional later:

- Stripe publishable key if you move some checkout UX client-side

### Required dashboard setup

- create products for `pro` and `enterprise`
- create recurring prices for both
- create a webhook endpoint for:
  - `/api/stripe/webhook`

Recommended webhook events for this app:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Where Xupra uses it

- checkout session creation
- billing portal creation
- local subscription mirror sync
- future entitlement enforcement

### Notes

- webhook signing secret is not the same as an API key
- if you want tighter server permissions later, Stripe supports restricted API keys

### Sources

- Stripe API keys: https://docs.stripe.com/keys
- Stripe subscriptions: https://docs.stripe.com/payments/subscriptions
- Stripe entitlements: https://docs.stripe.com/billing/entitlements

## 3. OpenAI

### What to collect

- `OPENAI_API_KEY`

Optional:

- specific org/project routing choices inside your OpenAI account

### Where Xupra uses it

- backend assisted import normalization
- ambiguous `.md` and `.py` conversion

### Current model recommendation

- `OPENAI_MODEL=gpt-5.4`
- `OPENAI_FREE_MODEL=gpt-5.4-nano`

### Notes

- key must stay server-side
- do not expose it in extension or browser code

### Sources

- OpenAI quickstart: https://platform.openai.com/docs/quickstart/adjust-your-settings%29
- OpenAI models: https://platform.openai.com/docs/models
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/compact

## 4. Slack

### What to collect

- bot token
  - store in credential vault as provider `slack`
- signing secret
  - for validating inbound slash-command requests

If you later implement OAuth install flow:

- Slack client ID
- Slack client secret

### Required app scopes for current implementation

Minimal scopes:

- `chat:write`
- `commands`

Why:

- `chat:write` is needed for `chat.postMessage`
- `commands` is needed for slash commands

### Required dashboard setup

- create Slack app
- add bot token scopes:
  - `chat:write`
  - `commands`
- install app to workspace
- configure slash command request URL:
  - `/api/integrations/slack/commands`

### Where Xupra uses it

- outbound job notifications
- inbound slash commands for:
  - `status <jobId>`
  - `export <versionId> <targetPlatform>`
  - `deploy <versionId> <deploymentTargetId>`

### Notes

- protect signing secret like a password
- request signing verification should be added before live production use
- right now the app has the inbound route, but production-grade Slack signature verification should still be completed during live hookup

### Sources

- Slack authentication overview: https://api.slack.com/authentication
- Slack signing secrets / request verification: https://api.slack.com/authentication/verifying-requests-from-slack
- Slack `commands` scope: https://api.slack.com/scopes/commands
- Slack `chat:write` scope: https://api.slack.com/scopes/chat%3Awrite

## 5. Twilio WhatsApp

### What to collect

For the current implementation, store this as a credential bundle:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Also collect:

- WhatsApp Sandbox number for testing, or production WhatsApp sender later
- test recipient number(s)

### Required dashboard/setup

For testing:

- enable Twilio Sandbox for WhatsApp
- join the sandbox from your test phone
- set inbound webhook URL to:
  - `/api/integrations/whatsapp/webhook`

For production later:

- register a real WhatsApp sender

### Where Xupra uses it

- outbound WhatsApp notifications
- inbound WhatsApp command webhook for:
  - `status`
  - `export`
  - `deploy`

### Notes

- sandbox is for testing only, not production
- current code uses the Messages API pattern and expects a JSON credential bundle with:
  - `accountSid`
  - `authToken`

### Sources

- Twilio WhatsApp sandbox: https://www.twilio.com/docs/whatsapp/sandbox
- Twilio sandbox quick test with SID/token: https://www.twilio.com/docs/conversations/use-twilio-sandbox-for-whatsapp
- WhatsApp API overview: https://www.twilio.com/docs/sms/whatsapp/api
- WhatsApp sender registration: https://www.twilio.com/docs/whatsapp/register-senders-using-api

## 6. AWS

### What to collect

For the current code path:

- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_S3_PREFIX`

Authentication:

- either AWS access key + secret for the runtime environment
- or preferably IAM role-based access in AWS

Later production resources:

- RDS PostgreSQL database connection
- Secrets Manager secret names/prefixes
- KMS key ID

### Minimum S3 permissions for current artifact storage path

Bucket-level:

- `s3:ListBucket`

Object-level:

- `s3:GetObject`
- `s3:PutObject`

If you later add object cleanup:

- `s3:DeleteObject`

### If using SSE-KMS with S3

You will also need KMS permissions such as:

- `kms:GenerateDataKey`
- `kms:Decrypt`

Depending on key policy and path, `kms:Encrypt` / `kms:DescribeKey` can also matter.

### If using Secrets Manager for runtime/provider secrets

Minimum Secrets Manager permissions typically include:

- `secretsmanager:GetSecretValue`
- `secretsmanager:DescribeSecret`

If the app also writes/rotates secrets:

- `secretsmanager:PutSecretValue`
- `secretsmanager:UpdateSecret`
- possibly `secretsmanager:CreateSecret`

And corresponding KMS permissions used by Secrets Manager operations include:

- `kms:Decrypt`
- `kms:GenerateDataKey`
- `kms:Encrypt`
- `kms:DescribeKey`

### Where Xupra uses AWS

- S3 for artifact storage
- later RDS PostgreSQL
- later Secrets Manager and KMS
- later ECS/Fargate deployment runtime

### Sources

- S3 required policy actions: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html
- S3 IAM/access control examples: https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-policies-s3.html
- S3 + KMS permissions: https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html
- Secrets Manager encryption permissions: https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html

## Recommended live hookup order inside the app

When you return with keys, wire them in this order:

1. Clerk
2. Stripe
3. OpenAI
4. Slack
5. Twilio WhatsApp
6. AWS S3
7. AWS RDS / Secrets Manager / KMS

## Immediate action list for you

When you come back, bring:

- Clerk publishable key
- Clerk secret key
- Stripe secret key
- Stripe webhook secret
- Stripe pro price ID
- Stripe enterprise price ID
- OpenAI API key
- Slack bot token
- Slack signing secret
- Twilio account SID
- Twilio auth token
- Twilio sandbox or sender number
- AWS region
- AWS S3 bucket
- AWS runtime credentials or IAM role plan
