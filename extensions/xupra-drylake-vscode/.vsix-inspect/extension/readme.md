# DryLake — Visual Planning for AI Coding Agents

**Visual, easy planning of your coding-agent workflow.** Drop a ticket. DryLake builds a kanban of phases. Drag them around. Pick any coding agent per phase. Hand off with one click.

![DryLake Control Room kanban](https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban.png)

Works with **Claude Code · OpenAI Codex · Cursor · Cline · Continue · Aider · Windsurf · GitHub Copilot · Roo Code · Augment Code** as native phase handoff targets — and any other agent via clipboard handoff.

![DryLake pipeline view](https://drylake.xupracorp.com/marketplace/extension/media/readme-pipeline.png)

## What It Does

- **Plans your work as a kanban.** Pending → Active → Validating → Done. Drag phases to reorder them.
- **One agent per phase.** Pick Claude Code for design, Cline for tests, Codex for docs — whatever you like.
- **One-click handoff.** Click *Handoff* on a phase and DryLake opens a focused prompt, copies it to your clipboard, and keeps that phase active.
- **Auto-advance.** Tick all steps in a phase, DryLake completes it and activates the next one.
- **Planning chat.** Tell DryLake to add a step or change scope; the kanban updates live.

## Get Started In 30 Seconds

1. Install DryLake from the VS Code Marketplace.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the kanban DryLake creates.
5. Click *Handoff* on the active phase. DryLake opens and copies the prompt for that agent.
6. Tick steps off as the agent finishes them. Next phase auto-activates.

No account is required to start a local build session or use External AI Prompt mode.

## Why Developers Use DryLake

AI coding tools are powerful, but bigger repo changes still get messy fast.

DryLake is built for the work that does not fit in one prompt:

- A feature touches multiple files and the AI starts drifting.
- A bug fix needs architecture context before code changes.
- A refactor needs a safe order of operations.
- Tests and validation get forgotten after the first AI response.
- You need to resume the job later without re-explaining everything.

DryLake gives that work a structure you can review, run, and hand off.

## Build Sessions

A Build Session is one organized coding task inside VS Code.

Start with a ticket, bug, or plain-language task. DryLake turns it into a practical plan with the purpose, affected surfaces, coding steps, validation checks, and shipping notes needed to keep the work moving.

Use Build Sessions when you want AI help without handing a messy repo change to a single disposable chat thread.

## Works With Your Coding Agents

Pick a different native handoff target per phase — or stick with one for the whole session. DryLake hands off to:

1. **Claude Code** (Anthropic)
2. **OpenAI Codex** / GPT-4o / GPT-5
3. **Cursor**
4. **Cline** (formerly Claude Dev)
5. **Continue.dev**
6. **Aider**
7. **Windsurf** (Codeium)
8. **GitHub Copilot** (incl. Copilot Chat & agent mode)
9. **Roo Code** (Roo Cline)
10. **Augment Code**

Plus **External AI Prompt** mode for ChatGPT, Gemini, DeepSeek, Tabnine, Cody, Plandex, Devin, Blackbox, Traycer, Zed, Replit, Trae, or any other tool outside the native list — DryLake copies the focused prompt for that phase and you paste it wherever you want.

DryLake does not try to replace any of these. It keeps the work clear enough for them to be more useful on complex tasks.

## Built For Real Repo Work

Use DryLake to organize and run:

- Multi-file feature work
- Bug investigations and fixes
- Refactors with clear checkpoints
- Test planning and validation passes
- PR or implementation summaries
- Agent instruction updates when the repo needs them

The main goal is simple: turn unclear coding work into a sequence your AI tool can actually follow.

## Review Before Coding

DryLake puts the plan in front of you before implementation work starts.

You can review the task purpose, architecture direction, affected files, risks, and validation steps before running the next AI coding step. That makes it easier to keep control of larger changes and avoid broad edits that do not match the repo.

## Local And Flexible

DryLake can start useful work without requiring your own AI backend.

- Use External AI Prompt mode to copy focused coding steps into your preferred tool.
- Use VS Code's available language model support when your editor provides it.
- Connect to Xupra workflows when you want account-backed import, export, or optimization features.

## Advanced Features

DryLake can also help with agent instruction files and preview workflows when you need them.

- Scan existing `AGENTS.md`, `CLAUDE.md`, Cursor rules, Codex files, and related agent instructions.
- Preview files before writing them into root or runtime locations.
- Create handoff notes, validation checklists, and AI-ready coding steps.
- Keep generated previews separate until you approve writeback.

These features support the coding workflow, but they are not the main story. The main story is helping you turn a real development task into shippable AI-assisted work.

## Privacy And Control

- DryLake does not export secrets by default.
- The local scan runs inside VS Code.
- You control when import, export, and writeback actions run.
- Preview files are kept separate until you approve them.
- Extension tokens are stored in VS Code SecretStorage.
- Heavy and sensitive folders such as `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, and `.venv` are excluded by default.

## Support

- Homepage: <https://drylake.xupracorp.com/>
- About Xupra: <https://drylake.xupracorp.com/about>
- Support: <mailto:support@xupracorp.com>
- License: see `LICENSE.txt`

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, GitHub, Microsoft, Cursor, Cline, Continue, Aider, Codeium / Windsurf, Roo, Augment, Tabnine, Sourcegraph / Cody, Plandex, Cognition / Devin, Blackbox, Traycer, Zencoder, Zed, Replit, Trae, Google, DeepSeek, or their respective owners.
