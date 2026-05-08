# Xupra DryLake for VS Code

Move agent files between tools without rebuilding them by hand.

![DryLake workflow](https://drylake.xupracorp.com/marketplace/drylake-workflow.png)

![DryLake architecture](https://drylake.xupracorp.com/marketplace/drylake-architecture.png)

## Quick start

1. Install the extension.
2. Open the Command Palette.
3. Click `Xupra DryLake: Connect`.
4. Sign in in your browser.
5. Come back to VS Code.
6. Click `Xupra DryLake: Scan Workspace`.
7. Click `Xupra DryLake: Import Workspace`.

That is the normal setup.

## What to click next

- Want to see if files work on a target: `Xupra DryLake: Check Compatibility`
- Want generated output files: `Xupra DryLake: Export Preview`
- Want generated files written into your repo: `Xupra DryLake: Pull Package Files`
- Want runtime files installed directly: `Xupra DryLake: Install to Runtime`
- Want to trigger a deployment job: `Xupra DryLake: Deploy`

## Supported targets

- Export and compatibility: Codex, Claude Code, Claude Agents, Cursor, Windsurf, Cline, Roo, GitHub Copilot, Gemini, Junie, Warp, and generic rules
- Direct install from the extension: Codex, Claude Code, Claude Agents, and Cursor

## What it scans automatically

Xupra looks for common files like:
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/skills/**/SKILL.md`
- `.claude/agents/**/*.md`
- `.cursor/skills/**/SKILL.md`
- `.cursor/rules/**/*.mdc`
- loose `*.md` and `*.py` files

If your repo uses custom locations, add them in `xupra.additionalScanPatterns`.


## Main setting

- Set `xupra.baseUrl` to `https://drylake.xupracorp.com`


## If Connect does not connect to the browser

- Run `Xupra DryLake: Connect` again
- Sign out of the website and then sign out of the extension, then sign in again from the browser.
- If the browser handoff still fails, use the manual token fallback
- Open `Xupra DryLake: Contact Support` if you get stuck
