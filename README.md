# DryLake

DryLake is Xupra's planning and agent handoff platform for AI coding workflows.

The current product is a VS Code extension that turns tickets, bugs, feature requests, and product specs into phased implementation cards. Each phase can be assigned to a coding agent such as Claude Code, Codex, Cursor, Gemini, Hermes, Copilot, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, or Auggie, then handed off with focused prompts and saved artifacts.

DryLake's goal is to reduce wasted AI tokens and engineering time by turning large, messy work into focused, auditable agent handoffs.

## Current Product

- Visual planning cards for implementation work.
- Free starter planning and Pro planning model selection.
- Agent assignment per phase.
- Skills/profiles attached to individual handoffs.
- Markdown, shell, and batch handoff artifacts.
- Token estimates for phase prompts.
- Local CLI launch support when supported agents are installed.
- Explicit phase completion and approval/autopilot flow between cards.
- Workspace-scoped extension authentication and usage tracking.

## Where DryLake Is Going

We are moving DryLake toward a broader agent workflow control plane. The next major direction is MCP and local planning.

Planned MCP work:

- DryLake MCP server so Claude Code, Cursor, VS Code Copilot Chat, OpenAI agents, Gemini CLI, and other MCP-capable clients can ask DryLake to create plans, estimate tokens, retrieve the next phase, generate handoffs, and update phase status.
- DryLake MCP setup checks to detect MCP configuration across local coding clients.
- MCP recipes for GitHub, Jira/Confluence, Sentry, Playwright, Figma, and other engineering systems.
- MCP resources such as `drylake://plans/current`, `drylake://phases/{phaseId}`, and `drylake://handoffs/{phaseId}/markdown`.

Planned local planning work:

- DryLake Local Planner using existing local model runners such as Ollama, LM Studio, and OpenAI-compatible local endpoints.
- Local starter plans, summarization, token compression, and acceptance-criteria extraction.
- Clear hardware guidance so users understand when local models are practical.

These roadmap items are not all shipped yet. They are included here so users and contributors can see the product direction clearly.

## Repository Layout

- `app/` - DryLake web application and marketing pages.
- `extensions/xupra-drylake-vscode/` - VS Code extension source and Marketplace README.
- `docs/` - architecture, testing, MCP, security, and operations notes.
- `planning/` - planning artifacts and product direction notes.
- `public/` - public web and Marketplace media assets.

## Development

On a new machine:

```powershell
.\bootstrap.ps1
```

This restores the development environment bundle, VS Code profile, Codex profile, global CLI tools, local Postgres, and Prisma setup. See [docs/secrets-handoff.md](docs/secrets-handoff.md) for details.

Run the web app:

```bash
npm run dev
```

Run the VS Code extension checks:

```powershell
cd extensions\xupra-drylake-vscode
npm run typecheck
npm test
npm run compile
```

Package the extension:

```powershell
npx @vscode/vsce package
```

## Open Source

Public mirror:

<https://github.com/gmkdigitalmedia/drylake>

Primary development currently pushes to GitLab.

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Support: support@xupracorp.com
- Discord: <https://discord.gg/WQdapuVn>
