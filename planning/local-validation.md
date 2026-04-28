# Local Validation

## Automated

Run:

```powershell
npm run validate:local
```

This creates a fresh package version from seeded data, uploads mixed source artifacts, runs canonical import, and generates export previews for:

- Codex
- Claude Code
- Claude Agents
- Cursor

## Manual

1. Start the app locally.
2. Sign in with Clerk.
3. Open the homepage and app shell.
4. Open a project, package, and version.
5. Upload files and run import.
6. Check generated exports for each target.
7. Check credentials, integrations, billing, and settings pages load.
8. Confirm the version page shows jobs, files, subagents, skills, and rules.

## Release Gate

Before moving past local validation:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run validate:local`

Known accepted warning today:

- Next.js image lint warnings for existing `<img>` usage in the header/homepage
