# DryLake — Visual Planning for AI Coding Agents

**Visual planning for AI coding work.** Drop in a ticket, split it into phases, choose the agent from each phase card, then choose the handoff action from Kanban or Pipeline.

![DryLake Control Room kanban](https://drylake.xupracorp.com/marketplace/extension/media/readme-kanban.png)

Each phase card has one **Agent** dropdown. Assign phases to **Claude Code · OpenAI Codex · Gemini CLI · Cursor CLI · Aider · GitHub Copilot · Augment / Auggie** from the planner, then use the direct action buttons on that card to run, export a script, copy the prompt, or open a Markdown handoff.

![DryLake pipeline view](https://drylake.xupracorp.com/marketplace/extension/media/readme-pipeline.png)

## What It Does

- **Plans your work as a kanban.** Pending → Active → Validating → Done. Drag phases to reorder them.
- **One visible agent selector per phase.** Pick Claude Code for design, Aider for patch work, Codex for docs, or another verified launcher directly on the card.
- **Direct handoff action buttons.** Use Handoff, `.sh`, `.bat`, Copy, or Markdown on the phase card. GitHub Copilot runs through the same Agent dropdown as every other target.
- **Auto-advance.** Tick all steps in a phase, DryLake completes it and activates the next one.
- **Planning chat.** Tell DryLake to add a step or change scope; the kanban updates live.

## Get Started In 30 Seconds

1. Install DryLake from the VS Code Marketplace.
2. Run `DryLake: Start Build Session`.
3. Paste a ticket, bug report, feature request, or product spec.
4. Review the kanban DryLake creates.
5. Choose the active phase handoff action and click *Handoff*.
6. Tick steps off as the agent finishes them. Next phase auto-activates.

## Works With Your Coding Agents

Pick a different agent per phase — or stick with one for the whole session. Selectable phase agents have implemented handoff paths in the extension:

1. **Claude Code** (Anthropic)
2. **OpenAI Codex**
3. **Gemini CLI**
4. **Cursor CLI**
5. **Aider**
6. **GitHub Copilot** (Copilot Chat)
7. **Augment / Auggie CLI**


Direct CLI handoff requires the matching command to already be installed and available on `PATH`. If a direct command is missing, DryLake saves the phase handoff, copies the prompt, and opens the Markdown file instead of pretending the launch worked.

## Support

- Homepage: <https://drylake.xupracorp.com/>
- Support: support@xupracorp.com

## Non-affiliation

DryLake is not affiliated with Anthropic, OpenAI, Google, GitHub, Microsoft, Cursor, Aider, Augment, or their respective owners.
