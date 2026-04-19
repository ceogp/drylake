# XupraCorp Domain Cutover

This is the current target shape for the live rollout.

## Target URLs

- marketing root: `https://xupracorp.com`
- product app: `https://drylake.xupracorp.com`
- extension connect: `https://drylake.xupracorp.com/extensions/connect`
- Clerk webhook: `https://drylake.xupracorp.com/api/clerk/webhook`

The app is now prepared to keep the marketing root on `xupracorp.com` while serving the real product on `drylake.xupracorp.com`.

## What Changed In The App

- the homepage is host-aware:
  - `xupracorp.com` shows a simple Xupra landing page
  - `drylake.xupracorp.com` shows the full DryLake landing page
- non-root requests on the marketing host redirect to the app host through `proxy.ts`
- the VS Code extension default base URL now points to `https://drylake.xupracorp.com`
- nginx deployment now derives `server_name` values from `APP_BASE_URL`

## Cloudflare DNS

Create these DNS records for `xupracorp.com`:

- `A` record
  - name: `@`
  - content: `52.196.86.96`
  - proxied: `on`
- `A` record
  - name: `drylake`
  - content: `52.196.86.96`
  - proxied: `on`
- optional `CNAME`
  - name: `www`
  - target: `xupracorp.com`
  - proxied: `on`

## Cloudflare SSL

Use:

- SSL/TLS mode: `Full (strict)`
- origin certificate installed on nginx for:
  - `xupracorp.com`
  - `*.xupracorp.com`

Do not use `Flexible`.

## GitLab Staging Env

`STAGING_ENV_FILE` should include the real app URL and Clerk billing values:

```env
APP_BASE_URL=https://drylake.xupracorp.com
AUTH_MODE=clerk
BILLING_PROVIDER=clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
BILLING_ENFORCEMENT_MODE=strict
```

Keep your existing database, encryption, and storage values in the same env file.

## Clerk Billing

In Clerk Dashboard:

1. Enable Billing.
2. Connect your Stripe account.
3. Create **User** plans:
   - `free`
   - `pro` at `$10/month`
4. Add webhook:
   - `https://drylake.xupracorp.com/api/clerk/webhook`
5. Subscribe billing webhook to:
   - `subscription.*`
   - `subscriptionItem.*`
   - `paymentAttempt.*`

## Deploy

1. Update GitLab `STAGING_ENV_FILE`.
2. Redeploy the `development` branch.
3. Verify:
   - `https://drylake.xupracorp.com/api/v1/health`
   - `https://drylake.xupracorp.com/extensions/connect`
   - `https://xupracorp.com`

Expected health response should report:

- `authMode: clerk`
- `billingProvider: clerk`
- `billingConfigured: true`
- `clerkConfigured: true`

## AWS Edge

If you want to move the public HTTPS endpoint off the EC2 box and onto AWS-managed edge services:

1. Run `npm run aws:provision-edge`
2. Open `storage/staging/edge-manifest.json`
3. Add the ACM validation CNAME records in Cloudflare
4. Re-run `npm run aws:provision-edge` until the certificate status is `ISSUED`
5. Change Cloudflare DNS:
   - `xupracorp.com` -> proxied `CNAME` to the ALB DNS name
   - `drylake.xupracorp.com` -> proxied `CNAME` to the same ALB DNS name
   - `www.xupracorp.com` -> proxied `CNAME` to `xupracorp.com`

This keeps the current EC2 app deployment, but moves public TLS and host routing to AWS ACM + ALB.

## App Email

Do not build new mailbox email on Amazon WorkMail. AWS has announced:

- no new WorkMail customers after `April 30, 2026`
- end of support on `March 31, 2027`

For AWS-native sending instead, run `npm run aws:setup-ses-domain` and publish the DNS records from `storage/staging/email-manifest.json`.

## Final User Test

1. Install the VSIX.
2. Click `Connect Xupra`.
3. Complete sign up or sign in in the browser.
4. Choose free or pro.
5. Return to VS Code or Cursor.
6. Run:
   - `Scan Workspace`
   - `Import Workspace`
   - `Check Compatibility`
   - `Export Preview`
