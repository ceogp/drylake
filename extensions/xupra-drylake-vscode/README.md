# DryLake Agent Portability

Move AI agent instructions between Claude Code, Cursor, Codex, and other AI coding tools without rewriting them by hand.

DryLake scans your workspace and home directory for the agent and rule files used by today's AI coding tools, validates them, and translates them to the format each tool expects. Build the prompt once, ship it everywhere.

![DryLake workflow](https://drylake.xupracorp.com/marketplace/drylake-workflow.png)

![DryLake architecture](https://drylake.xupracorp.com/marketplace/drylake-architecture.png)

## Why use it?

- One source of truth for `AGENTS.md`, `CLAUDE.md`, Cursor rules, Claude skills, and Codex configs.
- Stop hand-editing the same instructions in five different formats every time something changes.
- Catch broken or unsupported rules before they reach the agent at runtime.
- Reuse skills and agents across teammates, repos, and machines.

## 30-second start

1. Install the extension.
2. Open the Command Palette and run `Xupra DryLake: Scan Workspace` to preview what DryLake found.
3. Run `Xupra DryLake: Connect` if you want to sync to a workspace and translate to other targets.
4. Run `Xupra DryLake: Import Workspace` to upload the detected files.
5. Run `Xupra DryLake: Check Compatibility` or `Xupra DryLake: Export Preview` to see the translated output for each target.

No account is required for the local scan and preview.

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

DryLake can validate, translate, and export to:

- **Claude-style**: Claude Code, Claude Agents, Claude Skills.
- **Cursor**: Cursor rules and skills.
- **Codex**: Codex CLI agents and skills.
- **Other agentic tools**: Windsurf, Cline, Roo Code, GitHub Copilot, Gemini CLI, Junie, Warp, and a generic rules format for anything else.

Direct install from the extension is available today for Codex, Claude Code, Claude Agents, and Cursor. The other targets are exposed through Export Preview and Pull Package Files.

## Main settings

| Setting | Purpose |
| --- | --- |
| `xupra.baseUrl` | Backend URL. Defaults to `https://drylake.xupracorp.com`. |
| `xupra.includeGlobalAgentFiles` | Scan `~/.codex`, `~/.claude`, `~/.cursor` in addition to the workspace. |
| `xupra.additionalScanPatterns` | Add extra glob patterns for non-standard agent locations. |
| `xupra.scan.exclude` | Extra glob patterns to exclude. Built-in excludes for `node_modules`, `.git`, `dist`, `build`, etc. always apply. Defaults exclude `**/.env`, `**/.env.*`, and `**/secrets/**`. |
| `xupra.defaultTargetPlatform` | Default target for Compatibility and Export. |
| `xupra.confirmBeforeWriteback` | Ask before writing generated files into your workspace. |

## Privacy and file handling

- The local scan runs entirely inside VS Code. Nothing is uploaded until you run `Import Workspace` or `Export Preview`.
- DryLake reads only the file types listed under **Supported inputs** plus any patterns you add to `xupra.additionalScanPatterns`. It never scans `*.py` or other source code.
- Built-in excludes always skip `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`, `storage`, `.venv`, `__pycache__`, and other heavy or sensitive directories.
- Add your own patterns to `xupra.scan.exclude` to keep additional paths out of the scan. The defaults already exclude `.env` files and `secrets/` folders.
- When you run `Import Workspace` the matched files are sent to your configured `xupra.baseUrl` so you can compare, translate, and share them. You can review the file list in the Workspace view before importing.
- Sign out at any time with `Xupra DryLake: Sign Out`.

## Troubleshooting

- **Browser sign-in does not return to VS Code**: run `Xupra DryLake: Connect` again, or use `Xupra DryLake: Paste Extension Token` for the manual fallback.
- **A file you expected was not detected**: confirm it matches one of the patterns above, or add it to `xupra.additionalScanPatterns`.
- **A path you do not want imported keeps appearing**: add a glob to `xupra.scan.exclude`.
- **Need to start over**: run `Xupra DryLake: Sign Out`, then `Xupra DryLake: Connect`.

---

## Contributing and local extension development

Source: <https://gitlab.com/gmkdigitalmedia1/drylake>

Build locally:

```sh
cd extensions/xupra-drylake-vscode
node esbuild.mjs
npx --yes @vscode/vsce@latest package --allow-star-activation
```

Issues and feature requests: <https://gitlab.com/gmkdigitalmedia1/drylake/-/issues>
