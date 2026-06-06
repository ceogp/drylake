# DryLake Agent AI planner for Agents Skills - Cline Codex Claude Hermes Continue Kilo

## Free AI planning cards for Claude Code, Codex, Cursor, Cline, Blackbox, Goose, OpenCode, Qwen and coding agents.

DryLake is backed by [99VC](https://ninetynine.vc/) and [AWS Startups](https://aws.amazon.com/startups/).

**Free. No credit card. Connect your DryLake account and start coding in under 30 seconds.**

DryLake turns tickets, bugs, and product specs into visual planning cards. Pick a planning model, generate phased implementation stages, assign each stage to your favorite coding agent, attach a skill, and run focused handoffs from VS Code.

![DryLake AI planning workflow](https://drylake.xupracorp.com/marketplace/extension/media/drylake-workflow-6phase-handoffs.gif)

---

- **Free AI planning:** Start with free planning, then upgrade when you want Xupra AI Frontier Models.
- **Save tokens and time:** Visual planning cards allow you to use smaller models with better results.
- **All agents, one planning workflow:** Plan work for Claude Code, Codex, Cursor, Gemini, Hermes, Copilot, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, Auggie, and more.
- **Phased implementation plans:** Split large tasks into safe stages with acceptance criteria and focused handoff prompts.
- **Skills for every handoff:** Attach reusable skills/profiles for architecture, implementation, review, testing, and debugging.
- **Bring your own API/model:** Use direct OpenAI, Claude/Anthropic, Databricks, or Hermes planning providers today, with broader OpenAI-compatible provider support planned.
- **Visual Kanban orchestration:** Move from ticket to plan to agent handoff without losing context.

---

## What DryLake does
- Converts tickets into phased implementation plans.
- Lets you assign each phase to Claude Code, Codex, Cursor, Gemini, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, Auggie, etc.
- Runs focused handoffs from a visual Kanban or pipeline.
- Launches supported local CLIs when they are installed and configured.
- Attaches skills/profiles to phase prompts.
- Estimates prompt tokens before handoff.
- Saves handoff artifacts as Markdown, shell, or batch files.
- Falls back to copied Markdown prompts when a CLI agent is not installed.

## Supported Coding Agents

DryLake is an orchestration layer for the coding agents you already use. Each phase can be assigned to a different agent from the same **Agent** dropdown.

| Agent | Handoff mode |
|---|---|
| Claude Code | Direct CLI handoff when `claude` is available |
| OpenAI Codex | Direct CLI handoff when `codex` is available |
| Gemini CLI | Direct CLI handoff when `gemini` is available |
| Hermes Agent | Direct CLI handoff when `hermes` is available |
| Cursor CLI | Direct CLI handoff when `cursor-agent` is available |
| GitHub Copilot Chat | VS Code chat handoff when Copilot Chat is installed |
| Blackbox CLI | Direct CLI handoff when `blackbox` is available |
| Goose CLI | Direct CLI handoff when `goose` is available |
| OpenCode | Direct CLI handoff when `opencode` is available |
| Qwen Code | Direct CLI handoff when `qwen` is available |
| Continue CLI | Direct CLI handoff when `cn` is available |
| Cline CLI | Direct CLI handoff when `cline` is available |
| Aider | Direct CLI handoff when `aider` is available |
| Kilo Code | Direct CLI handoff when `kilo` is available |
| Auggie CLI | Direct CLI handoff when `auggie` is available |

Run `DryLake: Check Agent Setup` to see which agents are available on your machine. Missing CLIs still get a saved Markdown handoff, copyable prompt, and export scripts.

## Best for

- Breaking large tickets into safe implementation phases.
- Planning refactors before sending work to an AI coding agent.
- Coordinating multiple AI tools without losing task context.
- Reducing wasted tokens from oversized prompts.
- Creating auditable handoff artifacts for team workflows.

## Roadmap: MCP And Local Planning

DryLake is becoming a control plane for agent workflows, not only a VS Code planning UI. The current extension already creates phase cards, estimates handoff tokens, assigns agents, attaches skills, launches supported local CLIs, and saves auditable handoff artifacts.

Next, we are working toward:

- **DryLake MCP server:** Let MCP-capable clients ask DryLake to create plans, estimate tokens, retrieve the next phase, create handoffs, and update phase status.
- **MCP setup checks:** Detect MCP configuration across VS Code, Claude Code, Cursor, Gemini CLI, and other local agent clients.
- **Engineering MCP recipes:** Start with GitHub issues/PRs, Jira/Confluence tickets/specs, Sentry bugs, and Playwright validation workflows.
- **DryLake Local Planner:** Use existing local model runners such as Ollama, LM Studio, or OpenAI-compatible local endpoints for starter plans, summarization, token compression, and acceptance-criteria extraction.

These roadmap items are not all shipped yet. We are listing them here so users can see the direction clearly as DryLake evolves.

## Quick start

1. Install DryLake.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the generated phases.
5. Assign a phase to Claude Code, Codex, Cursor, Gemini, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, Auggie, Hermes, or Copilot.
6. Click `Run Handoff`.

## Install In Cursor And Open VSX

DryLake uses the same extension build for VS Code, Open VSX-compatible editors, and Cursor.

- VS Code Marketplace: `xupracorp.drylake`
- Open VSX: `xupracorp.drylake`
- Cursor: install from extension search when visible, or install the latest `drylake-<version>.vsix` with `Extensions: Install from VSIX`.

The Cursor plugin/MCP scaffold is being prepared for DryLake Agent Preflight, the paid planning layer for coding agents.


## Planning Models

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-planning-models.png" alt="DryLake planning model dropdown" width="620">

Free users can generate starter plans with GPT-5.4 Nano. Pro users can select **Xupra AI - Frontier Models** from the same planning-model dropdown. Direct API users can bring their own OpenAI, Claude, Databricks, or Hermes Agent setup.

Use the stages dropdown to request up to 12 planning stages, or type naturally in chat: `I want 3 planning stages`.

## Control Room

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban-v2.png" alt="DryLake Control Room kanban" width="620">

Each phase card has one **Agent** dropdown. Assign phases to Claude Code, OpenAI Codex, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, Auggie, or any supported agent, then press **Run Handoff**. You can also export as Markdown or copy to `.sh` and `.bat`.

## Skills And Handoffs

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-claude-skill.png" alt="DryLake Claude Code skill selector" width="620">

Choose your favorite skill before handing off to your agent.


## Security And Infrastructure

- **AWS Cloud infrastructure.** DryLake runs on AWS Cloud with GitLab CI/CD validation and deployment.
- **Encrypted credentials.** Credentials and extension tokens are encrypted before storage.
- **AWS-backed secrets.** Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption.
- **Workspace-scoped execution.** Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem.

## Open Source

DryLake has a public open-source mirror on GitHub:

[github.com/gmkdigitalmedia/drylake](https://github.com/gmkdigitalmedia/drylake)

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Open source: <https://github.com/gmkdigitalmedia/drylake>
- Discord: <https://discord.gg/WQdapuVn>
- Support: support@xupracorp.com

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, Google, GitHub, Microsoft, Cursor, Blackbox, Block, Alibaba Cloud, Continue, Cline, Aider, Kilo Code, Augment, or their respective owners.
