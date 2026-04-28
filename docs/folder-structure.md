# Xupra DryLake Folder Structure

## Current layout

```text
app/
  app/
  billing/
  credentials/
  integrations/
  reports/
  settings/
  api/
    integrations/
    stripe/
    v1/
      auth/
      audit-events/
      billing/
      credentials/
      deployment-jobs/
      dev/session/
      extension/
      health/
      integrations/
      projects/
      packages/
      reports/
      versions/
  projects/
  packages/
  versions/
components/
  app-home.tsx
  version-tools.tsx
lib/
  api/
  security/
  prisma.ts
  services/
  utils/
  storage/
prisma/
  schema.prisma
  seed.ts
docs/
  xupra-drylake-plan.md
  xupra-drylake-v1-spec.md
  xupra-drylake-extension-plan.md
  api-route-map.md
  folder-structure.md
  provider-checklist.md
extensions/
  xupra-drylake-vscode/
    package.json
    scripts/
    src/
    media/
```

## Purpose by area

### `app/`

- App Router entrypoint.
- Route handlers live under `app/api/v1`.
- UI routes stay separate from API routes to avoid segment conflicts.

### `lib/`

- Shared server-side code used by route handlers and future worker processes.
- `lib/api/` contains HTTP helpers.
- `lib/security/` contains encryption helpers for the credential vault.
- `lib/services/` holds business logic that should not stay embedded in route files.
- `lib/storage/` contains artifact persistence for uploads, exports, and deployment manifests.
- `lib/utils/` holds stable utility functions like slug generation.

### `prisma/`

- Database schema, migrations, and seed flow.
- `schema.prisma` stays portable between SQLite now and PostgreSQL later.

### `docs/`

- Product plan
- v1 technical spec
- extension build plan
- provider checklist
- route map
- folder structure reference

### `extensions/`

- Editor clients that sit on top of the shared backend.
- `xupra-drylake-vscode/` is the VS Code-first extension scaffold intended to be tested in Cursor too.
- `scripts/check-cursor-compatibility.mjs` keeps the extension on a standard VS Code API profile for Cursor compatibility.

## Next folders to add

These are not necessary yet, but they are the intended next additions:

```text
lib/jobs/
workers/
tests/
```

## Design rules

- Keep route handlers thin.
- Put reusable business logic in `lib/services`.
- Keep persistence logic Prisma-based and centralized.
- Avoid mixing UI-only code with backend helpers.
- Keep target-platform conversion logic isolated so adapters remain testable.
