# DryLake — Agent Orchestration for Claude Code, Codex & Cursor

DryLake turns tickets, bugs, feature requests, and product specs into phased implementation plans. Assign each phase to Claude Code, OpenAI Codex, Cursor, Gemini, Hermes, or GitHub Copilot, then run clean handoffs from a visual Kanban.

DryLake is not another coding agent. It is the planning and orchestration layer between your issue, your repo, and the agents you already use.

## Watch The Demo

<a href="https://drylake.xupracorp.com/marketplace/extension/media/drylake-demo.mp4">
  <img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-demo-video-v3.png" alt="Watch the DryLake demo video" width="420">
</a>

## What DryLake does

- Converts tickets into phased implementation plans.
- Lets you assign each phase to Claude Code, Codex, Cursor, Gemini, Hermes, or Copilot.
- Runs focused handoffs from a visual Kanban or pipeline.
- Attaches skills/profiles to phase prompts.
- Estimates prompt tokens before handoff.
- Saves handoff artifacts as Markdown, shell, or batch files.
- Falls back to copied Markdown prompts when a CLI agent is not installed.

## Best for

- Breaking large tickets into safe implementation phases.
- Planning refactors before sending work to an AI coding agent.
- Coordinating multiple AI tools without losing task context.
- Reducing wasted tokens from oversized prompts.
- Creating auditable handoff artifacts for team workflows.

## Quick start

1. Install DryLake.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the generated phases.
5. Assign a phase to Claude Code, Codex, Cursor, Gemini, Hermes, or Copilot.
6. Click `Run Handoff`.

## Supported agents

| Agent | Handoff mode |
|---|---|
| Claude Code | Direct CLI handoff when `claude` is available |
| OpenAI Codex | Direct CLI handoff when `codex` is available |
| Cursor Agent | Direct CLI handoff when `cursor-agent` is available |
| Gemini CLI | Direct CLI handoff when `gemini` is available |
| Hermes Agent CLI | Direct CLI handoff when `hermes` is available |
| GitHub Copilot Chat | Prompt handoff / workspace handoff |

If a direct CLI command is not available, DryLake saves the phase handoff, copies the prompt, and opens the Markdown artifact instead of pretending the launch worked.

## Planning Models

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-planning-models.png" alt="DryLake planning model dropdown" width="620">

Free users can generate starter plans with GPT-5.4 Nano. Pro users can select **Xupra AI - Frontier Models** from the same planning-model dropdown. Direct API users can bring their own OpenAI, Claude, Databricks, or Hermes Agent setup.

Use the stages dropdown to request up to 12 planning stages, or type naturally in chat: `I want 3 planning stages`.

## Control Room

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban-v2.png" alt="DryLake Control Room kanban" width="620">

Each phase card has one **Agent** dropdown. Assign phases to Claude Code, OpenAI Codex or any agent, then press **Run Handoff**. You can also export as Markdown or copy to `.sh` and `.bat`.

## Skills And Handoffs

<img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-claude-skill.png" alt="DryLake Claude Code skill selector" width="620">

Choose your favorite skill before handing off to your agent.

## Claude Code planning workflow

Use DryLake to split a ticket into implementation phases, attach the right skill/profile, then hand the active phase to Claude Code.

## OpenAI Codex handoff workflow

Plan the work before invoking Codex. DryLake keeps each handoff focused so Codex gets the specific phase, acceptance criteria, and files to inspect.

## Cursor Agent workflow

Use DryLake as a visual planning layer for Cursor Agent. Generate phases, review the plan, then hand off implementation work from the Kanban.

## Multi-agent Kanban for AI coding

DryLake lets you assign different stages of one feature to different agents. For example: architecture to Claude Code, implementation to Codex, local IDE execution to Cursor, and final review to Copilot.

## Token-aware planning

DryLake estimates prompt tokens before handoff and helps split oversized work into smaller phases.

## Security And Infrastructure

- **AWS Cloud infrastructure.** DryLake runs on AWS Cloud with GitLab CI/CD validation and deployment.
- **Encrypted credentials.** Credentials and extension tokens are encrypted before storage.
- **AWS-backed secrets.** Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption.
- **Workspace-scoped execution.** Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem.

DryLake is backed by [99VC](https://ninetynine.vc/) and [AWS Startups](https://aws.amazon.com/startups/).

## Open Source

DryLake has a public open-source mirror on GitHub:

[github.com/gmkdigitalmedia/drylake](https://github.com/gmkdigitalmedia/drylake)

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Open source: <https://github.com/gmkdigitalmedia/drylake>
- Discord: <https://discord.gg/WQdapuVn>
- Support: support@xupracorp.com

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, Google, GitHub, Microsoft, Cursor, or their respective owners.
