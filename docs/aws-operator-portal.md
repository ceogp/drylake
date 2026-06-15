# AWS Operator Portal

## Purpose

The Xupra operator portal is the private operational surface for:

- KYA registry company onboarding
- invoice and payment follow-through
- certificate issuance and lifecycle
- platform user and billing supervision
- internal audit and job visibility

It is not a customer-facing app route and it is not part of the public product site.

## Target Access Model

As of June 15, 2026, the intended production split is:

- public company/product host: `https://xupracorp.com`
- public product app host: `https://drylake.xupracorp.com`
- private operator portal host: `http://portal.ops.xupracorp.internal`

The operator portal host should resolve only inside the AWS VPC path that operators use through Client VPN, office network routing, or another approved private network path.

## Canonical Route Contract

The canonical internal UI route is:

- `/portal`

Supporting internal routes:

- `/portal/users`
- `/portal/billing`
- `/portal/kya-registry`
- `/portal/skills`
- `/portal/jobs`
- `/portal/audit`

Legacy `/admin` and `/api/v1/admin/*` paths remain as private aliases during cutover and should not be used in links or demos.

## Network Shape

The current AWS provisioning model uses:

- internal ALB
- private Route53 hosted zone
- security-group ingress restricted to an operator CIDR
- app host registration to the internal target group

The repo script for this is still `scripts/aws/provision-admin-internal.ts`, with a public alias:

```bash
npm run aws:provision-operator-portal
```

## Environment Variables

Preferred names:

```bash
OPERATOR_PORTAL_INTERNAL_HOST=portal.ops.xupracorp.internal
OPERATOR_PORTAL_INTERNAL_ZONE_NAME=ops.xupracorp.internal
OPERATOR_PORTAL_ALLOWED_CIDR=10.90.0.0/22
OPERATOR_PORTAL_INTERNAL_ORIGIN=http://portal.ops.xupracorp.internal
OPERATOR_PORTAL_BASIC_AUTH_USERNAME=<username>
OPERATOR_PORTAL_BASIC_AUTH_PASSWORD=<password>
```

Backward-compatible aliases still supported:

- `ADMIN_INTERNAL_HOST`
- `ADMIN_INTERNAL_ZONE_NAME`
- `ADMIN_INTERNAL_ALLOWED_CIDR`
- `ADMIN_INTERNAL_ORIGIN`
- `ADMIN_INTERNAL_BASIC_AUTH_USERNAME`
- `ADMIN_INTERNAL_BASIC_AUTH_PASSWORD`

## Recommended Hardening

The app-level Basic Auth gate is only one layer. The professional production posture should be:

1. AWS IAM Identity Center group for Xupra operators
2. MFA required for that group
3. AWS Client VPN or equivalent private access path tied to that identity layer
4. private Route53 resolution only through that path
5. portal credentials rotated and stored in Secrets Manager
6. least-privilege IAM for the EC2/runtime role
7. structured audit review of operator actions

## Demo Guidance

If investors or potential partners need to see the operator portal, give them time-bound private-network access and operator credentials. Do not expose the portal on the public company host.

If broader external review becomes common, the cleaner next step is a separate read-only review environment instead of weakening the private operator portal boundary.
