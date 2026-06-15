# Xupra Architecture Diagrams

These diagrams reflect the current deployed shape described in:

- [docs/xupracorp-cutover.md](/abs/path/C:/Users/ibm/Documents/drylake/docs/xupracorp-cutover.md)
- [docs/aws-operator-portal.md](/abs/path/C:/Users/ibm/Documents/drylake/docs/aws-operator-portal.md)
- [docs/xupracorp-product-and-kya-rollout-plan.md](/abs/path/C:/Users/ibm/Documents/drylake/docs/xupracorp-product-and-kya-rollout-plan.md)
- [KYAregistry/README.md](/abs/path/C:/Users/ibm/Documents/drylake/KYAregistry/README.md)

Files:

- [xupra-production-architecture.svg](/abs/path/C:/Users/ibm/Documents/drylake/docs/diagrams/xupra-production-architecture.svg)
- [kya-certificate-system.svg](/abs/path/C:/Users/ibm/Documents/drylake/docs/diagrams/kya-certificate-system.svg)

Notes:

1. The public entry path shown here is the current live shape: `Cloudflare -> EC2/nginx -> Next.js app`.
2. The private operator portal is shown as `Client VPN/private network -> private Route53 -> internal ALB -> /portal`.
3. KYA certificate artifacts are signed with AWS KMS and can be archived to Amazon S3, but live status remains app/database-authoritative so revocation and suspension take effect immediately.
4. These are SVG files because they are deterministic in-repo and import cleanly into Microsoft Visio if you want to edit them there.
