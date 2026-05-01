# Restart Handoff

This file is the restart point for the current `Xupra DryLake` session.

## Current State

- Branch: `development`
- Latest pushed commit: `ad4af79` (`Add VS Code workspace reset command`)
- Live app: `https://drylake.xupracorp.com`
- Live health check passed after deploy:
  - `https://drylake.xupracorp.com/api/v1/health`
- Local VS Code extension VSIX was packaged and installed:
  - `extensions/xupra-drylake-vscode/xupra-drylake-vscode-0.0.8.vsix`
- Working tree has only untracked local scratch files:
  - `.tmp-browser-import-fixture/`
  - `.tmp-cloudflared.log`

## User Goal

The user wants the first useful product action to work:

1. Authenticate.
2. Import skills, agents, rules, and instruction files.
3. See what imported.
4. Later export/check compatibility/deploy.

The user does not want instruction-heavy pages, hidden setup, separate scan/import steps, or developer-language UI.

## What Changed In This Pass

### Browser Upload And Import

Fixed the browser folder upload import bug.

Problem:
- Browser folder uploads used paths like `selected-folder/.codex/agents/foo.toml`.
- The importer expected paths like `.codex/agents/foo.toml`.
- Result: raw files could upload, but agents/skills were not extracted reliably.

Fix:
- Added shared import path normalization:
  - `lib/utils/import-paths.ts`
- Used it in:
  - `components/version-tools.tsx`
  - `app/api/v1/versions/[versionId]/files/route.ts`
  - `lib/services/import-export.ts`

The importer now strips selected-folder prefixes before known agent roots:
- `.agents/skills`
- `.codex/agents`
- `.codex/skills`
- `.claude/agents`
- `.claude/skills`
- `.cursor/rules`
- `.cursor/skills`
- `AGENTS.md`
- `CLAUDE.md`

### Website UX

The web import page now treats upload/import as one action:

- `Choose Folder And Import`
- `Choose Files And Import`

Selecting a folder or files now immediately uploads supported files and runs import.

The visible web flow no longer asks the user to:
- upload first, then import separately
- understand raw backend storage first
- read several instruction blocks before trying the main action

### Supported Skill Paths

Added support for Codex skills and nested installed-skill folders:

- `.codex/skills/<skill>/SKILL.md`
- `.codex/skills/.system/<skill>/SKILL.md`

The nested case matters because globally installed Codex skills can live under `.system`.

### VS Code Extension UX

The extension primary action is now:

- `Xupra DryLake: Import Skills And Agents`

The visible `Scan Workspace` command was removed from the user-facing command palette path.

Import still scans internally, but the user does not need to know or run a separate scan step.

The extension import scans:
- current workspace/repo
- `~/.codex/agents`
- `~/.codex/skills`
- `~/.claude/agents`
- `~/.claude/skills`
- `~/.cursor/skills`
- `~/.cursor/rules`

Config added:
- `xupra.includeGlobalAgentFiles` defaults to `true`

### VS Code Reset

Added:

- `Xupra DryLake: Reset Workspace State`

It clears:
- selected import target
- cached importable file list
- last import summary

It does not clear:
- Xupra account connection token

## Important Current UX Decisions

- Website cannot silently read `C:\Users\gp\.codex` or other local folders. Browser security blocks this.
- Website can only import a folder after the user chooses it.
- VS Code extension can scan global folders because it runs locally inside the editor.
- Therefore both surfaces now expose one user action, but their mechanics differ:
  - website: choose folder/files and import immediately
  - extension: import command finds repo/global files and imports immediately

## Recent Commits

- `ad4af79` Add VS Code workspace reset command
- `4c9bb62` Make import a single user action
- `fa807c7` Scan global agent folders
- `669f1e8` Fix staging database bootstrap
- `924c6cb` Fix browser upload import flow

## Verification Already Passed

Root app:

- `npm run typecheck`
- `npm run build`
- `npm run validate:local`
- `npm run lint`

Extension:

- `npm run typecheck`
- `npm run build`
- `npm run package:vsix`
- `npm run install:vsix`

Deploy:

- `npm run aws:deploy-staging`
- live health check returned `200`

Known lint warning:
- `scripts/aws/provision-staging.ts`
  - unused `CreateTagsCommand`
  - unrelated to this import/extension work

## What Still Needs Real User Testing

The code checks passed, but authenticated browser/editor UX still needs click-through testing by the user.

Test the live website:

1. Open `https://drylake.xupracorp.com/workspace`.
2. Open the import version.
3. Click `Choose Folder And Import`.
4. Choose a repo root, `.codex`, `.claude`, or another folder containing supported files.
5. Confirm counts update:
   - Raw Files
   - Agents
   - Skills/Rules
6. Confirm rows appear under Imported Source Files.

Test VS Code:

1. Reload VS Code.
2. Open Command Palette.
3. Run `Xupra DryLake: Reset Workspace State` if a clean local extension state is needed.
4. Run `Xupra DryLake: Import Skills And Agents`.
5. If prompted, choose the import target.
6. Confirm the result message shows imported file/skill/agent counts.
7. Open the Xupra activity view and inspect Imported Workspace.

## Current Risk Assessment

I do not think it is guaranteed that everything is perfect yet.

What is likely fixed:
- browser folder prefix import bug
- `.codex/skills` support
- nested Codex skill folder support
- one-action import on website
- one-action import in VS Code
- global folder scanning in VS Code
- reset command for local extension workspace state

What may still need adjustment:
- whether the user's installed global skills are exactly under the default scanned paths
- whether VS Code reload picks up the freshly installed VSIX immediately
- whether the user has multiple import targets and the target picker language is clear enough
- whether global scans pick up too many markdown/python repo files from broad patterns
- whether the Imported Workspace tree is still too busy

## Useful Commands

Build/check root app:

```powershell
npm run typecheck
npm run build
npm run validate:local
npm run lint
```

Build/check extension:

```powershell
npm run typecheck
npm run build
npm run package:vsix
npm run install:vsix
```

Deploy live app:

```powershell
npm run aws:deploy-staging
```

Health check:

```powershell
Invoke-WebRequest -Uri https://drylake.xupracorp.com/api/v1/health -UseBasicParsing
```

## Key Files

- `components/version-tools.tsx`
- `lib/utils/import-paths.ts`
- `lib/services/import-export.ts`
- `app/api/v1/versions/[versionId]/files/route.ts`
- `scripts/validate-local.ts`
- `extensions/xupra-drylake-vscode/src/services/workspaceScanner.ts`
- `extensions/xupra-drylake-vscode/src/commands/importWorkspace.ts`
- `extensions/xupra-drylake-vscode/src/services/stateStore.ts`
- `extensions/xupra-drylake-vscode/src/extension.ts`
- `extensions/xupra-drylake-vscode/src/views/projectTreeProvider.ts`
- `extensions/xupra-drylake-vscode/package.json`

## Note About Old RESTART.md

The previous `RESTART.md` helped by showing the intended user-first testing posture:

- avoid dev-mode assumptions
- avoid manual settings/token-first flows
- test the extension as a real user
- remove hidden/manual setup steps

It was stale on URLs, VSIX version, and latest commits, so this file replaces it with the current live-domain and import-focused state.
