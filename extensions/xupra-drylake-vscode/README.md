# DryLake Agent Config Sync

Sync, validate, and translate agent configs for Claude, Codex, Cursor, and VS Code.

DryLake scans your workspace and home directory for `AGENTS.md`, `CLAUDE.md`, Cursor rules, Claude skills, Codex configs, and related AI coding tool files. It turns scattered agent setup into a portable profile you can validate, translate, preview, and restore across machines, repos, and teams.

Move your AI-agent setup to another machine or workspace without rewriting it by hand.

![DryLake workflow](https://drylake.xupracorp.com/marketplace/drylake-workflow.png)

![DryLake architecture](https://drylake.xupracorp.com/marketplace/drylake-architecture.png)

## Why

AI-agent setups drift across laptops, devcontainers, repos, and teams. DryLake makes your prompts, rules, skills, and workspace instructions reproducible.

## Quick Start

1. Install DryLake Agent Config Sync.
2. Open the Command Palette and run `DryLake: Scan Agent Configs`.
3. Run `DryLake: Connect` if you want to sync with a DryLake workspace.
4. Run `DryLake: Import Agent Configs` to save the detected files.
5. Run `DryLake: Validate Agent Configs` or `DryLake: Preview Agent Config Changes` before writing generated files.

No account is required for the local scan. Connect when you want workspace sync, translation, export preview, or install flows.

## Core Features

- Sync agent configs across Claude, Codex, Cursor, and VS Code workflows.
- Import and validate `AGENTS.md`, `CLAUDE.md`, Cursor rules, Claude skills, and Codex configs.
- Preview generated agent config changes before writing files.
- Restore generated files into Claude, Codex, Cursor, or a custom workspace path.
- Keep repo and home-directory agent setup visible from one VS Code panel.
- Use Git-friendly source files that teams can review and version.

## Supported inputs

DryLake automatically detects:

- `AGENTS.md` and `CLAUDE.md` at the repo root and at the home-directory level (`~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`).
- Claude skills: `.claude/skills/**/SKILL.md` and `~/.claude/skills/**/SKILL.md`.
- Claude sub-agents: `.claude/agents/**/*.md` and `~/.claude/agents/**/*.md`.
- Cursor rules: `.cursor/rules/**/*.mdc` and `~/.cursor/rules/**/*.mdc`.
- Cursor skills: `.cursor/skills/**/SKILL.md` and `~/.cursor/skills/**/SKILL.md`.
- Codex agents: `.codex/agents/**/*.toml` and `~/.codex/agents/**/*.toml`.
- Codex skills: `.codex/skills/**/SKILL.md` and `~/.codex/skills/**/SKILL.md`.
- Generic skills under `.agents/skills/**/SKILL.md`.

You can add custom patterns with `xupra.additionalScanPatterns`.

## Supported targets

DryLake currently scans, validates, previews, and writes files for Codex, Claude Code,
Claude Agents, Cursor, Windsurf, Cline, Roo Code, GitHub Copilot, Gemini CLI,
JetBrains Junie, Warp, and generic `.rules` files.

## Privacy and Security

- The local scan runs inside VS Code. Nothing is uploaded until you run `DryLake: Import Agent Configs` or an export workflow.
- DryLake reads only the file types listed under **Supported inputs** plus any patterns you add to `xupra.additionalScanPatterns`. It does not scan `*.py` or other source code by default.
- Built-in excludes always skip `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`, `storage`, `.venv`, `__pycache__`, and other heavy or sensitive directories.
- Add your own patterns to `xupra.scan.exclude` to keep additional paths out of the scan. The defaults already exclude `.env` files and `secrets/` folders.
- Before generated files are written back, DryLake asks for confirmation by default through `xupra.confirmBeforeWriteback`.
- Extension tokens are stored in VS Code SecretStorage.
- When you run `DryLake: Import Agent Configs`, the matched files are sent to your configured `xupra.baseUrl` so you can compare, translate, and share them. Review the file list in the Workspace view before importing.
- Sign out at any time with `DryLake: Sign Out`.

## Troubleshooting

- **Browser sign-in does not return to VS Code**: run `DryLake: Connect` again, or use `DryLake: Paste Extension Token` for the manual fallback.
- **A file you expected was not detected**: confirm it matches one of the patterns above, or add it to `xupra.additionalScanPatterns`.
- **A path you do not want imported keeps appearing**: add a glob to `xupra.scan.exclude`.
- **Need to start over**: run `DryLake: Sign Out`, then `DryLake: Connect`.

## Trust and Support

- Repository: <https://github.com/xupracorp/drylake>
- Issues: <https://github.com/xupracorp/drylake/issues>
- Homepage: <https://xupracorp.com/drylake>
- License: see `LICENSE.txt`

---

## Contributing and local extension development

Source: <https://github.com/xupracorp/drylake>

Build locally:

```sh
cd extensions/xupra-drylake-vscode
node esbuild.mjs
npx --yes @vscode/vsce@latest package --allow-star-activation
```

Issues and feature requests: <https://github.com/xupracorp/drylake/issues>
