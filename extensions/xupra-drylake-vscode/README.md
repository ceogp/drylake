# DryLake: AI Coding Agent for Complex Code Changes

Turn tickets, bugs, and feature requests into clear AI coding plans inside VS Code.

DryLake helps you guide Claude Code, Codex, Cursor, GitHub Copilot, and other AI coding tools through larger repo changes without losing the plan.

- Plan the change before your AI tool starts coding.
- Break risky work into smaller, reviewable steps.
- Keep scope, files, tests, and shipping notes in one place.
- Run each step with the AI coding tool you already use.
- Finish with a clean validation and handoff summary.

```text
Ticket or bug -> Build Session -> AI coding step -> validation -> ship
```

![DryLake workflow](https://drylake.xupracorp.com/marketplace/drylake-workflow.png)

## Get Started In 30 Seconds

1. Install DryLake from the VS Code Marketplace.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the plan DryLake creates for the change.
5. Run the first coding step with Claude Code, Codex, Cursor, GitHub Copilot, or External AI Prompt mode.
6. Validate the result, then move to the next step.

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

## Works With Your AI Coding Tools

DryLake is designed to guide the tools developers already use:

- Claude Code
- Codex
- Cursor
- GitHub Copilot
- External AI tools through copied coding steps

DryLake does not try to replace every coding assistant. It helps keep the work clear enough for those assistants to be more useful on complex tasks.

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

DryLake is not affiliated with Anthropic, OpenAI, GitHub, Microsoft, Cursor, OpenClaw, Cline, Roo, Windsurf, Traycer, Blackbox, Zencoder, or their respective owners.
