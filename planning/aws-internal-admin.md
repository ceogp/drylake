# AWS Internal Admin Setup

## Goal

Expose admin only on a private AWS network endpoint, not on the public product host.

Public app:
- `drylake.xupracorp.com`

Internal admin:
- `http://<ADMIN_INTERNAL_HOST>/admin` (private Route53 zone + internal ALB)

## Required Environment Variables

Set these locally before provisioning:

```bash
ADMIN_INTERNAL_HOST=admin.ops.xupra.internal
ADMIN_INTERNAL_ZONE_NAME=ops.xupra.internal
ADMIN_INTERNAL_ALLOWED_CIDR=10.90.0.0/22
ADMIN_INTERNAL_ORIGIN=http://admin.ops.xupra.internal
ADMIN_INTERNAL_BASIC_AUTH_USERNAME=<strong-username>
ADMIN_INTERNAL_BASIC_AUTH_PASSWORD=<strong-password>
```

Notes:
- `ADMIN_INTERNAL_HOST` must be inside `ADMIN_INTERNAL_ZONE_NAME`.
- `ADMIN_INTERNAL_ALLOWED_CIDR` should match your Client VPN client CIDR or internal office CIDR.

## Provision Private Admin Endpoint

```bash
npm run aws:provision-admin-internal
```

This creates or updates:
- Internal ALB (`scheme=internal`)
- Internal target group and listener
- Security group ingress for your internal CIDR
- Private Route53 hosted zone association + alias record for admin host

Manifest output:
- `storage/staging/internal-admin-manifest.json`

## Deploy App With Internal Admin Settings

```bash
npm run aws:deploy-staging
```

The deploy flow pushes:
- `ADMIN_INTERNAL_HOST`
- `ADMIN_INTERNAL_ORIGIN`
- `ADMIN_INTERNAL_BASIC_AUTH_USERNAME`
- `ADMIN_INTERNAL_BASIC_AUTH_PASSWORD`

## Access Model

1. Connect to AWS Client VPN (or equivalent private network path).
2. Resolve private DNS for `ADMIN_INTERNAL_HOST`.
3. Open `http://<ADMIN_INTERNAL_HOST>/admin`.
4. Pass HTTP Basic Auth challenge.

## AWS Client VPN / SSO

Recommended controls:
- AWS IAM Identity Center (SSO) group for admin operators only.
- MFA required in SSO policy.
- Client VPN endpoint auth tied to SSO.
- Route only admin CIDR and private hosted zone DNS through VPN.

This keeps admin independent from Clerk while staying private-network only.
