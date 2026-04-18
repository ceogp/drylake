# Xupra DryLake Roadmap

## Phase 1: Local Validation

Goal:
- prove the current product works locally with repeatable validation

Work:
- run deterministic smoke tests for import -> canonical -> export
- test real sample files from Codex, Cursor, and Claude flows
- verify Clerk sign-in and app navigation
- verify OpenAI-backed normalization with the configured API key
- document manual QA steps for homepage, app, version editor, billing, credentials, and integrations

Exit criteria:
- local smoke test passes
- import/export works for all current target platforms
- no manual DB edits are needed during normal validation
- build, typecheck, and lint are green except for known accepted warnings

## Phase 2: Multi-User Hardening

Goal:
- convert product flows from dev-friendly behavior to real tenant-safe behavior

Work:
- require Clerk identity for normal product usage
- add active organization selection
- enforce organization scoping in every API route, server action, and query
- add role checks for owner/admin/member/viewer
- ensure credentials, deployments, jobs, and audit data are tenant-safe

Exit criteria:
- users can only access organizations they belong to
- role restrictions are enforced server-side
- dev-only fallbacks are limited to clearly marked local bootstrap paths

## Phase 3: AWS Readiness Refactor

Goal:
- prepare the app for AWS without changing product behavior

Work:
- finish abstraction boundaries for database, artifact storage, and secrets
- remove remaining SQLite assumptions from runtime flows
- separate request handling from background worker execution
- define production worker responsibilities for import/export/deploy/notify jobs

Exit criteria:
- app logic works against interchangeable infrastructure adapters
- migration to PostgreSQL and S3 is mostly configuration plus migration work

## Phase 4: Backup And Restore

Goal:
- be able to recover the system, not just take snapshots

Work:
- define backup coverage for database, artifacts, and deployment metadata
- document backup cadence and retention
- implement restore procedure and rehearse it in a non-production environment

Exit criteria:
- a restore drill recreates a working environment from backup

## Phase 5: AWS Staging

Goal:
- run the app in a production-like staging environment

Work:
- move database to RDS PostgreSQL
- move artifacts to S3
- move secrets to Secrets Manager and KMS
- deploy web and worker services
- run smoke tests, migration tests, and restore tests in staging

Exit criteria:
- staging is stable and matches local behavior closely

## Phase 6: Production Promotion

Goal:
- promote tested builds to production safely

Work:
- create separate production environment and credentials
- add monitoring, alerting, structured logs, and rollback procedure
- define promotion and rollback runbooks

Exit criteria:
- staging builds can be promoted to production through a repeatable process

## Phase 7: VS Code And Cursor Extension

Goal:
- deliver the editor workflow once the backend control plane is stable

Work:
- finish the VS Code extension against the stabilized API contract
- validate the same extension in Cursor
- handle publishing setup separately from product hosting

Azure note:
- Azure or Microsoft account setup can matter for VS Code extension publishing
- AWS can still remain the application hosting target

Exit criteria:
- extension can connect, import workspace files, run compatibility/export, and pull generated files back

## Do Not Build Too Early

- complex enterprise reporting polish
- production-only automation before staging is stable
- extension-first workflows before tenant-safe SaaS flows are locked
- infrastructure-specific code paths before adapter boundaries are clean
