# DryLake AI for VS Code - Agent Planning for Claude Code, Codex, Cursor & Gemini

DryLake turns tickets, bugs, feature requests, and product specs into phased implementation plans. Assign each phase to Claude Code, OpenAI Codex, Cursor, Gemini, Hermes, or Copilot, attach the right skill, then run clean handoffs from a visual Kanban.

DryLake is the planning and orchestration layer between your issue, your repo, and the AI coding agents you already use.

---

- **All agents, one planning workflow:** Plan work for Claude Code, Codex, Cursor, Gemini, Hermes, Copilot, and other coding agents from one visual pipeline.
- **Phased implementation plans:** Split large tickets into safe stages with acceptance criteria, generated tasks, and stage-specific handoff context.
- **Skill-based pipelines:** Attach reusable skills or profiles before handoff so each agent gets the right instructions for architecture, implementation, review, or testing.
- **Token-aware handoffs:** Keep prompts focused by sending one phase at a time instead of dumping the entire project context into every agent.
- **Visual Kanban orchestration:** Move from planning to execution with phase cards, agent dropdowns, skill selectors, exports, and handoff artifacts.
- **Bring your own tools:** Use local CLI agents when available, direct API providers when configured, or copied Markdown prompts as a fallback.
- **Free planning path:** Start with free planning and upgrade when you want Frontier Models and deeper Xupra AI planning support.

---

## Watch The Demo

<a href="https://drylake.xupracorp.com/marketplace/extension/media/drylake-demo.mp4">
  <img src="https://drylake.xupracorp.com/marketplace/extension/media/readme-demo-video-v3.png" alt="Watch the DryLake demo video" width="420">
</a>

## What DryLake does
- Converts tickets into phased implementation plans.
- Lets you assign each phase to Claude Code, Codex, Cursor, Gemini, etc.
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
