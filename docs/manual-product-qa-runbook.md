# DryLake Manual Product QA Runbook

Last updated: 2026-06-04

Use this document to test DryLake end to end before publishing a VSIX or changing Marketplace copy. The goal is to prove the product works like the demo: create a plan, arrange phases, assign agents and skills, launch handoffs, watch phase cards progress, and confirm usage/reporting data.

## Test Rules

- Test with Microsoft VS Code first. Cursor can be a secondary compatibility pass.
- Use a clean workspace that is safe for AI agents to edit.
- Record every failure with the exact phase, agent, skill, terminal output, and screenshot.
- Do not assume a handoff finished just because DryLake marked the card complete. DryLake currently confirms that the handoff launched, not that the external agent completed the coding task.
- For every release candidate, run the automated tests before manual testing:

```powershell
npm run test:backend
npm --prefix extensions\xupra-drylake-vscode test
npm run typecheck
npm --prefix extensions\xupra-drylake-vscode run typecheck
npm --prefix extensions\xupra-drylake-vscode run build
```

## Accounts And Services

Minimum required:

- Xupra/DryLake account.
- Microsoft VS Code.
- One clean Git repo or sample app workspace.

Recommended first paid/service setup:

- Claude Code installed and authenticated.
- OpenAI Codex installed and authenticated.
- Gemini CLI installed and authenticated.

Optional provider/API setup:

- OpenAI API key for DryLake planning.
- Anthropic API key for Claude API planning.
- Databricks endpoint and token.
- Hermes Agent CLI if you want local/BYO model planning.

Optional agent compatibility setup:

- Cline CLI.
- Continue CLI, command `cn`.
- Kilo Code CLI, command `kilo`.
- Auggie CLI, command `auggie`.
- Aider CLI.
- Goose CLI.
- OpenCode CLI.
- Qwen Code CLI.
- Blackbox CLI, only if the local CLI command is actually available on the machine.

Do not sign up for every service at once. Prove the workflow with two or three real agents first.

## Prepare The Test Workspace

1. Create or open a safe test project.
2. Commit or back up the starting state.
3. Add two or three simple skill files so DryLake has skills to detect:

```text
.codex/skills/token-reduction/SKILL.md
.claude/skills/repo-review/SKILL.md
.agents/skills/test-first/SKILL.md
```

Example skill body:

```markdown
# test-first

Write a small test first. Run the focused test command after implementation. Keep edits scoped to the active phase.
```

4. Confirm VS Code CLI points to Microsoft VS Code, not Cursor:

```powershell
Get-Command code
code --version
```

Expected: `Source` should reference `Microsoft VS Code\bin\code.cmd`.

If needed, use the explicit Microsoft VS Code command:

```powershell
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" --version
```

## Install Or Run The Extension

Installed VSIX path:

```powershell
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" --install-extension .\extensions\xupra-drylake-vscode\drylake-0.6.xx.vsix --force
```

Development host path:

1. Open `extensions/xupra-drylake-vscode` in VS Code.
2. Run `npm install` if dependencies are missing.
3. Run `npm run build`.
4. Press `F5` to launch the Extension Development Host.

Expected:

- DryLake activity bar icon appears.
- `DryLake: Start Build Session` exists in the Command Palette.
- `DryLake: Check Agent Setup` exists in the Command Palette.

## Test 1 - Account Registration And Connection

1. Sign out of the extension.
2. Run `DryLake: Connect`.
3. Complete browser sign-in.
4. Return to VS Code.

Expected:

- Sidebar shows the signed-in user.
- Organization tier displays correctly.
- Upgrade/account links open the DryLake website.
- If browser return fails, paste-token fallback still works.

Record:

```text
Pass/fail:
User email shown:
Organization shown:
Any redirect issue:
Screenshot path:
```

## Test 2 - Agent Setup Check

1. Run `DryLake: Check Agent Setup`.
2. Read the Markdown report.
3. Compare report with actual installed commands:

```powershell
claude --version
codex --version
gemini --version
cn --version
kilo --version
auggie --version
```

Expected:

- Installed agents show `found`.
- Missing agents show `not found`.
- Missing agents still have fallback prompt export.

Record:

```text
Claude Code:
Codex:
Gemini:
Continue:
Kilo:
Auggie:
Unexpected false positive/negative:
```

## Test 3 - Free Planning Flow

1. Open the Control Room.
2. Choose the free planning option.
3. Confirm the UI clearly shows free/nano planning.
4. Use this prompt:

```text
Build MCP tools for a local developer workspace. The tool should scan package scripts, expose a safe command runner, and create a README section showing available commands. I want 6 planning stages.
```

5. Generate the plan.

Expected:

- Planning model dropdown does not confuse free/pro choices.
- Free mode banner appears after selection.
- Generated plan has about 6 phases.
- A post-generation bar confirms nano/free planning.
- Cards are readable and no text overlaps.

Record:

```text
Phase count:
Model banner text:
Any confusing copy:
Screenshot path:
```

## Test 4 - Stage Count Control

Run the planning flow with these inputs:

- `I want 3 planning stages.`
- `I want 6 planning stages.`
- `I want 12 planning stages.`

Expected:

- Dropdown supports up to 12 stages.
- Natural language stage count is respected when possible.
- Cards stay readable at high phase counts.
- If the planner returns a different count, DryLake should make that clear or allow adjustment.

Record:

```text
Requested 3, got:
Requested 6, got:
Requested 12, got:
Problems:
```

## Test 5 - Reorder Cards

1. Drag a later phase before an earlier phase.
2. Drag a completed-looking phase into the middle.
3. Refresh the Control Room.

Expected:

- Card order changes immediately.
- Phase IDs, agent choices, skills, and steps remain attached to the correct card.
- The cursor/hand does not look blurry, pixelated, or broken.
- Refresh does not revert the order.

Record:

```text
Reorder persisted:
Drag cursor issue:
Screenshot path:
```

## Test 6 - Assign Different Agents And Skills

Assign different agents:

- Phase 1: Claude Code.
- Phase 2: OpenAI Codex.
- Phase 3: Gemini CLI.
- Phase 4: Cline or Continue if installed.

Assign skills:

- Claude phase: `.claude/skills/repo-review/SKILL.md`
- Codex phase: `.codex/skills/token-reduction/SKILL.md`
- Generic phase: `.agents/skills/test-first/SKILL.md`

Expected:

- Agent dropdown saves per card.
- Skill dropdown filters or resolves relevant skills.
- Changing an agent clears incompatible skills.
- Refresh preserves selections.

Record:

```text
Agent selections persisted:
Skill selections persisted:
Wrong skill shown:
Screenshot path:
```

## Test 7 - Handoff Prompt Contents

For each assigned phase:

1. Export Markdown.
2. Open the generated handoff file under `.drylake/handoffs`.
3. Confirm it includes:
   - Active phase objective.
   - Steps.
   - Acceptance criteria.
   - Selected agent preamble.
   - Selected skill/profile content.

Expected:

- Prompt is focused on only the active phase.
- Skill content is injected.
- Prompt does not contain unrelated huge context unless requested.

Record:

```text
Phase:
Agent:
Skill:
Skill text injected:
Prompt too large:
Handoff file path:
```

## Test 8 - Manual Handoff Mode

Turn autopilot off.

1. Run Phase 1 handoff.
2. Confirm a terminal opens for the selected terminal agent.
3. Confirm Phase 1 is marked complete after launch.
4. Confirm Phase 2 does not start automatically.
5. Click Run Next Phase.

Expected:

- One terminal opens for Phase 1.
- Phase 1 card checks itself after launch.
- User must click to start Phase 2.
- The notification says `handoff launched and marked complete`.

Record:

```text
Terminal opened:
Phase auto-checked:
Next phase waited for click:
Message text:
```

## Test 9 - Autopilot Handoff Mode

Turn autopilot on.

1. Make sure Phase 1, Phase 2, and Phase 3 all have selected agents.
2. Run Phase 1.
3. Watch terminals open in sequence.
4. Confirm cards check themselves as each handoff launches.

Expected:

- Phase 1 terminal opens.
- Phase 1 card completes.
- Phase 2 starts automatically.
- Phase 2 card completes after its handoff launches.
- Phase 3 starts automatically.
- If a next phase has no agent, autopilot pauses and tells you to select one.

Record:

```text
Phase 1 terminal:
Phase 2 terminal:
Phase 3 terminal:
Autopilot paused correctly:
Any duplicate terminals:
```

## Test 10 - Missing Agent Fallback

Pick an agent that is not installed.

1. Run the phase.
2. Confirm DryLake does not mark the phase complete.
3. Confirm prompt is copied or Markdown opens.
4. Confirm error text explains what command is missing.

Expected:

- No fake success.
- No card auto-completion.
- User gets a usable fallback prompt.

Record:

```text
Missing agent:
Phase stayed incomplete:
Fallback prompt opened/copied:
Error message:
```

## Test 11 - Direct API Planning Keys

Test only one provider first.

1. Choose OpenAI API or Claude API in the planning model dropdown.
2. Confirm a key input appears immediately.
3. Enter the key.
4. Generate a small plan.
5. Restart VS Code.
6. Generate another small plan.

Expected:

- Key is stored in VS Code SecretStorage.
- Key is not written to `drylake.xu`.
- Key is not written to handoff Markdown.
- After restart, provider still works without re-entering the key.

Record:

```text
Provider:
Key prompt appeared:
Plan generated:
Restart retained key:
Any key leaked to files:
```

## Test 12 - Reports And Usage

This requires the usage-event build to be running and the user signed in.

1. Select an agent.
2. Select a skill.
3. Export a prompt.
4. Launch a handoff.
5. Trigger one missing-agent failure.
6. Open `/reports` in the DryLake web app.

Expected:

- Usage Events count increases.
- Handoffs count increases.
- Launch Failures count increases for missing agent.
- Prompt Exports count increases.
- Top Agents shows the agents used.
- Top Skills shows selected skill paths.
- Avg Prompt Tokens is non-zero.
- Recent Extension Activity shows event rows.
- No raw prompt text is shown.

Record:

```text
Usage event count:
Handoff count:
Failure count:
Prompt export count:
Top agent:
Top skill:
Screenshot path:
```

## Test 13 - Paid Upgrade Path

1. Select `Xupra AI - Frontier Models`.
2. Click the upgrade action.
3. Open Billing from the sidebar.
4. Open Account Settings.

Expected:

- Pro-only option does not advertise external model names.
- User sees clear `Upgrade to Frontier Models` messaging.
- Links open the correct DryLake web pages.
- Free user is not blocked from local/BYO workflows.

Record:

```text
Upgrade link:
Billing link:
Account settings link:
Any confusing copy:
```

## Test 14 - Marketplace Install Smoke Test

After publishing, test from a clean VS Code profile.

```powershell
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" --install-extension xupracorp.drylake --force
```

Expected:

- Marketplace install works.
- Extension id resolves.
- Activity bar icon appears.
- README media loads.
- GIF is the latest 6-phase workflow GIF.

Record:

```text
Install command result:
Installed version:
README GIF correct:
Screenshot path:
```

## Release Pass Criteria

Do not publish a new release if any of these fail:

- VS Code install fails.
- Browser connect fails with no fallback.
- Plan generation fails for free mode.
- Handoff launch marks missing agents complete.
- Agent/skill selections do not persist.
- Autopilot opens duplicate or wrong terminals.
- Direct API key is written to a workspace file.
- Reports show raw prompt text by default.

Acceptable known limitation:

- DryLake marks a phase complete after the handoff launches. It does not yet verify the external agent completed the actual coding task.

## Priority Bugs To Fix First

1. Install/connect failures.
2. Planning flow confusion.
3. Agent/skill dropdown persistence failures.
4. Handoff launch failures for installed agents.
5. Autopilot sequencing bugs.
6. Reports/usage not recording for signed-in users.
7. Visual issues that make the product look broken.

