# DryLake AI for VS Code

## Free AI planning cards for Claude Code, Codex, Cursor, Gemini and coding agents.

DryLake turns tickets, bugs, and product specs into visual planning cards. Pick a planning model, generate phased implementation stages, assign each stage to your favorite coding agent, attach a skill, and run focused handoffs from VS Code.

![DryLake AI planning workflow](https://drylake.xupracorp.com/marketplace/extension/media/drylake-workflow.gif)

---

- **Free AI planning:** Start with free planning, then upgrade when you want Xupra AI Frontier Models.
- **Save tokens and time:** Visual planning cards allow you to use smaller models with better results.
- **All agents, one planning workflow:** Plan work for Claude Code, Codex, Cursor, Gemini, Hermes, Copilot, and more.
- **Phased implementation plans:** Split large tasks into safe stages with acceptance criteria and focused handoff prompts.
- **Skills for every handoff:** Attach reusable skills/profiles for architecture, implementation, review, testing, and debugging.
- **Bring your own API/model:** Use direct OpenAI, Claude/Anthropic, Databricks, or Hermes planning providers today, with broader OpenAI-compatible provider support planned.
- **Visual Kanban orchestration:** Move from ticket to plan to agent handoff without losing context.

---

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
