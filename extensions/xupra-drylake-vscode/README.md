# DryLake — Visual Planning for AI Coding Agents

**Visual planning for AI coding work.** Drop in a ticket, split it into phases, choose the agent from each phase card, then run a focused handoff from Kanban or Pipeline.

Backed by [99VC](https://ninetynine.vc/) and [AWS Startups](https://aws.amazon.com/startups/). DryLake infrastructure runs on [AWS Cloud](https://aws.amazon.com/) with [GitLab](https://gitlab.com/) CI/CD.

![DryLake Control Room kanban](https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban.png)

Each phase card has one **Agent** dropdown. Assign phases to **Claude Code · OpenAI Codex · Gemini CLI · Cursor CLI · GitHub Copilot Chat** from the planner, then press **Run Handoff**. Export utilities are kept in the secondary menu for Markdown, copy, `.sh`, and `.bat`.

![DryLake pipeline view](https://drylake.xupracorp.com/marketplace/extension/media/readme-pipeline.png)

## What It Does

- **Plans your work as a kanban.** Pending → Active → Validating → Done. Drag phases to reorder them.
- **One visible agent selector per phase.** Pick Claude Code for design, Cursor CLI for repo work, Codex for docs, Gemini CLI for a second pass, or GitHub Copilot Chat for an IDE chat handoff.
- **One primary handoff action.** Use **Run Handoff** to launch the selected agent. Markdown, copy, `.sh`, and `.bat` exports are secondary utilities.
- **Auto-advance.** Tick all steps in a phase, DryLake completes it and activates the next one.
- **Planning chat.** Tell DryLake to add a step or change scope; the kanban updates live.

## Get Started In 30 Seconds

1. Install DryLake from the VS Code Marketplace.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the kanban DryLake creates.
5. Choose the active phase agent and click **Run Handoff**.
6. Tick steps off as the agent finishes them. Next phase auto-activates.

## Works With Your Coding Agents

Pick a different agent per phase — or stick with one for the whole session. Selectable phase agents have implemented handoff paths in the extension:

1. **Claude Code** (Anthropic)
2. **OpenAI Codex**
3. **Gemini CLI**
4. **Cursor CLI**
5. **GitHub Copilot Chat**


Direct CLI handoff requires the matching command to already be installed and available on `PATH`: `claude`, `codex`, `gemini`, or `cursor-agent`. If a direct command is missing, DryLake saves the phase handoff, copies the prompt, and opens the Markdown file instead of pretending the launch worked.

## Security And Infrastructure

- **AWS Cloud infrastructure.** DryLake runs on AWS Cloud with GitLab CI/CD validation and deployment.
- **Encrypted credentials.** Credentials and extension tokens are encrypted before storage.
- **AWS-backed secrets.** Runtime secrets can use AWS Secrets Manager, and S3 artifacts support AWS KMS encryption.
- **Workspace-scoped execution.** Agent handoffs run from the user workspace with workspace-scoped auth and no shared customer filesystem.

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Support: support@xupracorp.com

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, Google, GitHub, Microsoft, Cursor, or their respective owners.
