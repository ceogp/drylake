# Restart Handoff

This file is the restart point for the current `Xupra DryLake` session.

## Current State

- Branch: `development`
- Working tree: clean
- Latest pushed commit: `381dff2` (`Default VS Code extension to staging backend`)
- Previous major extension/auth commit: `0e74774` (`Add browser callback onboarding for VS Code extension`)

## What Was Just Done

- The installed VS Code extension copy was removed from:
  - `C:\Users\gp\.vscode\extensions\xupra.xupra-drylake-vscode-0.0.1`
- Reason:
  - the user wants to test the extension as a real end user, click by click
  - the current experience still feels too developer-oriented
  - the next step is a clean reinstall and user-first discovery test

## Important Product Context

- The user does **not** want dev-mode testing as the primary flow.
- The user wants to discover the extension the way a real customer would.
- The current problem is not just auth plumbing. The extension still does not feel like a polished first-run product.
- The next pass should focus on:
  - first-run discovery
  - first visible extension UI
  - click-by-click onboarding
  - eliminating hidden/manual setup steps

## Current Extension/Auth Status

Implemented and pushed:
- Browser auth round-trip:
  - click `Connect` in VS Code
  - browser opens Xupra
  - user signs up / signs in
  - browser returns to VS Code or Cursor
  - extension exchanges a one-time code for a long-lived extension token
- Manual token flow is fallback only
- Default extension backend now points to staging:
  - `http://52.196.86.96`

Key files:
- [app/extensions/connect/page.tsx](C:/Users/gp/Desktop/agenttransfer/app/extensions/connect/page.tsx)
- [app/api/v1/extension/connect/exchange/route.ts](C:/Users/gp/Desktop/agenttransfer/app/api/v1/extension/connect/exchange/route.ts)
- [components/extension-browser-return.tsx](C:/Users/gp/Desktop/agenttransfer/components/extension-browser-return.tsx)
- [lib/services/extension-auth-requests.ts](C:/Users/gp/Desktop/agenttransfer/lib/services/extension-auth-requests.ts)
- [extensions/xupra-drylake-vscode/src/services/browserConnect.ts](C:/Users/gp/Desktop/agenttransfer/extensions/xupra-drylake-vscode/src/services/browserConnect.ts)
- [extensions/xupra-drylake-vscode/src/services/session.ts](C:/Users/gp/Desktop/agenttransfer/extensions/xupra-drylake-vscode/src/services/session.ts)
- [extensions/xupra-drylake-vscode/package.json](C:/Users/gp/Desktop/agenttransfer/extensions/xupra-drylake-vscode/package.json)
- Packaged VSIX:
  - [xupra-drylake-vscode-0.0.1.vsix](C:/Users/gp/Desktop/agenttransfer/extensions/xupra-drylake-vscode/xupra-drylake-vscode-0.0.1.vsix)

## Planning Files

Core planning:
- [planning/README.md](C:/Users/gp/Desktop/agenttransfer/planning/README.md)
- [planning/architecture.md](C:/Users/gp/Desktop/agenttransfer/planning/architecture.md)
- [planning/roadmap.md](C:/Users/gp/Desktop/agenttransfer/planning/roadmap.md)
- [planning/local-validation.md](C:/Users/gp/Desktop/agenttransfer/planning/local-validation.md)
- [planning/aws-cutover.md](C:/Users/gp/Desktop/agenttransfer/planning/aws-cutover.md)

Extension planning:
- [planning/vscode-tool-design.md](C:/Users/gp/Desktop/agenttransfer/planning/vscode-tool-design.md)
- [planning/vscode-extension-roadmap.md](C:/Users/gp/Desktop/agenttransfer/planning/vscode-extension-roadmap.md)
- [planning/extension-support-pages.md](C:/Users/gp/Desktop/agenttransfer/planning/extension-support-pages.md)

Web/page planning:
- [planning/page-audit.md](C:/Users/gp/Desktop/agenttransfer/planning/page-audit.md)

## Recent Commits

- `381dff2` Default VS Code extension to staging backend
- `0e74774` Add browser callback onboarding for VS Code extension
- `0d72655` Add real website-to-extension auth flow
- `2ec2767` Build onboarding flow and extension setup path
- `3eeb9f3` Build extension MVP and extension-led web flow

## Verification Already Passed

- Root app:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run validate:local`
- Extension:
  - `npm run typecheck`
  - `npm run build`
  - `npm run package:vsix`

Known remaining lint warnings:
- [scripts/aws/deploy-staging.ts](C:/Users/gp/Desktop/agenttransfer/scripts/aws/deploy-staging.ts)
- [scripts/aws/provision-staging.ts](C:/Users/gp/Desktop/agenttransfer/scripts/aws/provision-staging.ts)

## What Needs To Happen Next

Immediate next steps:
1. Restart VS Code.
2. Confirm Xupra is actually gone after the uninstall.
3. Reinstall the VSIX fresh:
   - [xupra-drylake-vscode-0.0.1.vsix](C:/Users/gp/Desktop/agenttransfer/extensions/xupra-drylake-vscode/xupra-drylake-vscode-0.0.1.vsix)
4. Test the extension as a real user would:
   - discover extension
   - install
   - open it
   - decide whether the first-run UX is good or bad
5. Do **not** start from settings JSON, dev host, or fallback token flow.

Product work likely needed after that test:
1. Real first-run extension landing surface
2. Clear primary CTA in the extension itself
3. Better explanation of what happens when browser sign-in opens
4. Cleaner “what happens next” flow after return to VS Code
5. Possibly a new extension shell if the current one is too compromised by earlier assumptions

## Staging / URLs

- Staging app: `http://52.196.86.96`
- Health: `http://52.196.86.96/api/v1/health`

## Git / Deploy

- Remote: `origin` -> GitLab
- Branch policy for now:
  - work directly on `development`
  - do not create feature branches unless explicitly requested

