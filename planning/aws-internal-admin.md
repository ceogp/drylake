# AWS Internal Operator Portal Setup

## Goal

Expose the operator portal only on a private AWS network endpoint, not on the public product host.

Public app:
- `drylake.xupracorp.com`

Internal operator portal:
- `http://<OPERATOR_PORTAL_INTERNAL_HOST>/portal` (private Route53 zone + internal ALB)

## Required Environment Variables

Set these locally before provisioning:

```bash
OPERATOR_PORTAL_INTERNAL_HOST=portal.ops.xupracorp.internal
OPERATOR_PORTAL_INTERNAL_ZONE_NAME=ops.xupracorp.internal
OPERATOR_PORTAL_ALLOWED_CIDR=10.90.0.0/22
OPERATOR_PORTAL_INTERNAL_ORIGIN=http://portal.ops.xupracorp.internal
OPERATOR_PORTAL_BASIC_AUTH_USERNAME=<strong-username>
OPERATOR_PORTAL_BASIC_AUTH_PASSWORD=<strong-password>
```

Notes:
- `OPERATOR_PORTAL_INTERNAL_HOST` must be inside `OPERATOR_PORTAL_INTERNAL_ZONE_NAME`.
- `OPERATOR_PORTAL_ALLOWED_CIDR` should match your Client VPN client CIDR or internal office CIDR.
- Legacy `ADMIN_INTERNAL_*` variables are still accepted during cutover.

## Provision Private Portal Endpoint

```bash
npm run aws:provision-operator-portal
```

This creates or updates:
- Internal ALB (`scheme=internal`)
- Internal target group and listener
- Security group ingress for your internal CIDR
- Private Route53 hosted zone association + alias record for admin host

Manifest output:
- `storage/staging/internal-admin-manifest.json`

## Deploy App With Internal Portal Settings

```bash
npm run aws:deploy-staging
```

The deploy flow pushes:
- `OPERATOR_PORTAL_INTERNAL_HOST`
- `OPERATOR_PORTAL_INTERNAL_ORIGIN`
- `OPERATOR_PORTAL_BASIC_AUTH_USERNAME`
- `OPERATOR_PORTAL_BASIC_AUTH_PASSWORD`

## Access Model

1. Connect to AWS Client VPN (or equivalent private network path).
2. Resolve private DNS for `OPERATOR_PORTAL_INTERNAL_HOST`.
3. Open `http://<OPERATOR_PORTAL_INTERNAL_HOST>/portal`.
4. Pass HTTP Basic Auth challenge.

## AWS Client VPN / SSO

Recommended controls:
- AWS IAM Identity Center (SSO) group for operator-portal access only.
- MFA required in SSO policy.
- Client VPN endpoint auth tied to SSO.
- Route only the operator CIDR and private hosted zone DNS through VPN.

This keeps the portal independent from Clerk while staying private-network only.
