# DryLake - Visually Orchestrate Agents and Skills

**Visual planning for AI coding work.** Drop in a ticket, split it into stages, choose the agent and skill for each phase, then run a focused handoff from a visual Kanban or Pipeline.

Backed by [99VC](https://ninetynine.vc/) and [AWS Startups](https://aws.amazon.com/startups/). DryLake infrastructure runs on [AWS Cloud](https://aws.amazon.com/) with [GitLab](https://gitlab.com/) CI/CD.
"Drylake" refers to Data Lakehouse concept, but here we are "flattening the plain" for AI agents, so that they are all available in a flat layer for you to use as you see fit. Using Drylake you can save tokens with planning, use your favorite skills, and orchestrate agents visually!

## Watch The Demo

[![Watch the DryLake demo video](https://drylake.xupracorp.com/marketplace/extension/media/readme-demo-video.jpg)](https://drylake.xupracorp.com/marketplace/extension/media/drylake-demo.mp4)

## Planning Models

![DryLake planning model dropdown](https://drylake.xupracorp.com/marketplace/extension/media/readme-planning-models.png)

Free users can generate starter plans with GPT-5.4 Nano. Pro users can select **Xupra AI - Frontier Models** from the same planning-model dropdown. Direct API users can bring their own OpenAI, Claude, Databricks, or Hermes Agent setup.

Use the stages dropdown to request up to 12 planning stages, or type naturally in chat: `I want 3 planning stages`.

## Control Room

![DryLake Control Room kanban](https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban-v2.png)

Each phase card has one **Agent** dropdown. Assign phases to Claude Code, OpenAI Codex or any agent then press **Run Handoff**. You can also just export as Markdown or copy to `.sh`, and `.bat`.

## Skills And Handoffs

![DryLake Claude Code skill selector](https://drylake.xupracorp.com/marketplace/extension/media/readme-claude-skill.png)

Choose your favorite skill before handing off to your agent.

## What It Does

- **Plan your tasks as stages, visually.** Pending to Active to Validating to Done. Drag phases to reorder them.
- **Lets you choose the number of planning stages.** Use the dropdown for 1 to 12 stages, or describe the stage count in natural language.
- **Keeps planning-model selection in one place.** Free, Pro, and bring-your-own planning providers are selected from the planning model dropdown.
- **Supports skill-aware handoffs.** Attach the selected skill or profile to the handoff prompt.
- **Shows estimated prompt tokens.** See approximate prompt tokens before handoff in the sidebar, Control Room, and Multi-Agent Runner.
- **Auto-completes phase cards.** A successful Run Handoff checks the phase steps and marks the card complete. With Autopilot enabled, DryLake starts the next selected phase automatically; otherwise you choose **Run Next Phase**.

## Get Started In 30 Seconds

1. Install DryLake from the VS Code Marketplace.
2. Click on `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the kanban DryLake creates.
5. Choose the active phase agent and click **Run Handoff**.
6. DryLake checks the phase steps and completes the card after a successful handoff. Turn on Autopilot to continue through the next selected phases automatically, or click **Run Next Phase** when you want manual pacing.

## Works With Your Coding Agents

Selectable phase agents have implemented handoff paths in the extension:

1. **Claude Code**
2. **OpenAI Codex**
3. **Gemini CLI**
4. **Hermes Agent CLI**
5. **Cursor CLI**
6. **GitHub Copilot Chat**
7. **TELL US AND WE CAN ADD IT**

Direct CLI handoff requires the matching command to already be installed and available on `PATH`: `claude`, `codex`, `gemini`, `hermes`, or `cursor-agent`. If a direct command is missing, DryLake saves the phase handoff, copies the prompt, and opens the Markdown file instead of pretending the launch worked.

## Open Source

DryLake has a public open-source mirror on GitHub:

[github.com/gmkdigitalmedia/drylake](https://github.com/gmkdigitalmedia/drylake)

## Security And Infrastructure

- **AWS Cloud infrastructure.** DryLake runs on AWS Cloud with GitLab CI/CD validation and deployment.
- **Encrypted credentials.** Credentials and extension tokens are encrypted before storage.
- **AWS-backed secrets.** Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption.
- **Workspace-scoped execution.** Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem.

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Open source: <https://github.com/gmkdigitalmedia/drylake>
- Discord: <https://discord.gg/WQdapuVn>
- Support: support@xupracorp.com

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, Google, GitHub, Microsoft, Cursor, or their respective owners.
