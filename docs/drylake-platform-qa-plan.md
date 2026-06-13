# DryLake Platform QA Plan

Last updated: 2026-06-03

## Current Findings

- Extension unit tests pass: 156/156.
- Backend route/service tests pass: 30/30.
- Phase handoffs mark a phase complete after the external agent terminal or VS Code command is successfully launched. The UI now states "handoff launched and marked complete" because DryLake does not yet know whether the external agent actually finished successfully.
- Successful handoff launches auto-complete the phase checklist. Export-only actions do not change phase status.
- Autopilot starts the next selected-agent phase after the previous handoff launch completes. If the next phase has no selected agent, autopilot pauses.
- Selected skills/profiles are stored in `drylake.xu` and injected into generated handoff prompts.
- Handoff prompts are saved locally under `.drylake/handoffs`.
- Backend usage reports now count signed-in extension usage metadata, including agent selections, skill selections, handoff launches, launch failures, prompt exports, token estimates, auto-starts, and recent extension events.

## Product Observability Decision

Before adding cloud visibility into prompts and usage, decide the privacy model.

Recommended default:

- Free/local users: local-only by default. Store prompts and handoff history in `.drylake/handoffs` and `drylake.xu`.
- Signed-in users: record metadata by default, not full prompt text.
- Pro/team users: optional workspace setting to sync full handoff prompts, skill selections, token estimates, and phase outcomes.
- Admin/reporting views should show prompt content only when the organization explicitly enables prompt sync.

Implemented usage events:

- `phase_agent_selected`
- `phase_skill_selected`
- `phase_handoff_exported`
- `phase_handoff_launched`
- `phase_handoff_launch_failed`
- `phase_autopilot_started_next`
- `phase_marked_complete`
- `agent_setup_checked`

Future usage events:

- `plan_created`
- `planning_provider_selected`

Event metadata:

- user id, organization id, workspace hash, session id
- phase id/title, agent id, skill/profile logical path
- prompt token estimate, action type, launch result
- error reason code when launch fails
- no raw prompt text unless prompt sync is enabled

## Test Tracks

### 1. Install And Update

Automated:

- Verify VSIX packages with expected version, README, changelog, icon, and media files.
- Verify install scripts use Microsoft VS Code CLI path on Windows.
- Verify package metadata check passes.

Manual:

- Install from VS Code Marketplace.
- Install with explicit VS Code CLI:
  `& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" --install-extension xupracorp.drylake --force`
- Install VSIX manually.
- Confirm extension appears under DryLake activity bar.
- Confirm `DryLake: Start Build Session` is available.

### 2. Account Connection

Automated:

- Browser connect start, approve, poll, exchange.
- Expired token fallback.
- Manual token fallback.
- Sign out clears token and connection state.

Manual:

- Connect from fresh VS Code install.
- Connect with already signed-in browser.
- Connect after browser approval expires.
- Paste manual token.
- Sign out and reconnect.
- Confirm Free/Pro badge displays correctly.

### 3. Planning Providers

Automated:

- Free user Xupra nano route can generate a plan.
- Pro-only Frontier option routes to upgrade.
- Direct OpenAI/Claude key prompts store in VS Code SecretStorage.
- Bad direct key is rejected and cleared.
- Hermes provider does not ask DryLake to store Hermes key.
- Stage count passes through when user chooses 1-12 stages.

Manual:

- Free user selects `Free User - GPT-5.4 Nano`.
- Pro user selects `Xupra AI - Frontier Models`.
- OpenAI API key entry, save, clear, and failed validation.
- Claude API key entry, save, clear, and failed validation.
- Hermes CLI provider with local Hermes configured.
- Natural-language request such as "I want 3 planning stages" creates 3 stages or triggers the stage selector.

### 4. Plan Generation And Editing

Automated:

- Draft runbook generation writes local starter first.
- Generated runbook replaces starter plan.
- Chat changes create pending plan changes.
- Accept/reject pending plan changes.
- Reorder phases.
- Update phase status by drag/drop.
- Validate `drylake.xu`.

Manual:

- Start from empty repo.
- Start when existing `drylake.xu` exists: continue, archive, delete.
- Generate 1, 3, 6, and 12 stages.
- Reorder cards.
- Drag cards across pending/active/complete columns.
- Confirm no UI overlap in narrow and wide VS Code layouts.

### 5. Skills And Profiles

Automated:

- Collect Codex skills from `.codex/skills/*/SKILL.md`.
- Collect Claude skills/subagents from `.claude/skills` and `.claude/agents`.
- Collect Copilot instructions from `.github/copilot-instructions.md` and `.github/instructions`.
- Collect Blackbox skills from `.blackbox/skills`.
- Collect DryLake generic skills from `.agents/skills` and `.cursor/skills`.
- Clear incompatible selected skill when agent changes.
- Inject selected skill into handoff prompt.
- Truncate very large skill content safely.

Manual:

- Create one skill for Codex, Claude, Blackbox, and generic DryLake.
- Confirm each appears only for compatible agents.
- Select skill on every phase.
- Change agent and verify incompatible skill clears.
- Run handoff and inspect `.drylake/handoffs/*.md` for selected skill content.

### 6. Agent Setup Matrix

Automated:

- `DryLake: Check Agent Setup` reports found/not found.
- Bad configured path reports separately from missing PATH command.
- Missing CLI produces Markdown fallback and setup guidance.

Manual agent matrix:

- Claude Code: `claude`
- OpenAI Codex: `codex`
- Gemini CLI: `gemini`
- Hermes Agent: `hermes`
- Cursor CLI: `cursor-agent`
- Blackbox CLI: `blackbox`
- Goose CLI: `goose`
- OpenCode: `opencode`
- Qwen Code: `qwen`
- Continue CLI: `cn`
- Cline CLI: `cline`
- Aider: `aider`
- Kilo Code: `kilo`
- Auggie CLI: `auggie`
- GitHub Copilot Chat extension command

For each:

- CLI installed and found.
- CLI missing fallback.
- Custom command setting.
- Windows path with spaces.
- Prompt file path with spaces.
- Terminal opens in workspace root.
- Prompt file is saved before launch.

### 7. Phase Handoff Behavior

Automated:

- Run handoff writes prompt file and launches selected agent.
- Successful launch auto-completes all steps and phase.
- Missing agent does not mark phase complete.
- Export markdown/copy/script actions do not change phase status.
- Later phase cannot run before earlier active phase completes.
- Autopilot launches next selected phase.
- Autopilot pauses when next phase has no agent.

Manual:

- Non-autopilot: click Run Handoff on phase 1. Confirm phase 1 completes and phase 2 stays pending.
- Non-autopilot: click Run Next Phase. Confirm phase 2 launches.
- Autopilot: preselect agents for all phases. Confirm terminals open phase by phase.
- Autopilot: leave phase 3 without an agent. Confirm autopilot pauses there.
- Missing CLI: select an uninstalled agent. Confirm prompt opens and phase remains incomplete.

Important product gap:

- Current completion means "handoff launched", not "agent finished". To claim true completion, DryLake needs a completion protocol: terminal exit tracking, agent output marker, generated result file, or manual "agent finished" confirmation.

### 8. Prompt And Token Visibility

Automated:

- Token estimate utility handles short, long, and non-ASCII prompts.
- Rendered phase prompt includes purpose, architecture, phase steps, acceptance criteria, selected agent, and selected skill.
- Prompt export writes expected Markdown.

Manual:

- Inspect prompt preview before launch.
- Inspect saved `.drylake/handoffs`.
- Confirm token estimate appears before handoff.
- Confirm large skill profile truncates with explicit note.

Cloud feature to build:

- Add `ExtensionUsageEvent` model.
- Add `/api/v1/extension/usage-events` endpoint.
- Add extension client event queue with retry.
- Add reports page cards: handoffs launched, failed launches, top agents, top skills, average prompt tokens, autopilot usage.
- Optional prompt sync with organization-level setting.

### 9. Free/Pro And Upgrade UX

Automated:

- Free users can use nano planning.
- Pro-only Frontier model path prompts upgrade.
- Upgrade command opens billing page.
- Entitlement parsing supports free/pro/enterprise.

Manual:

- Free account sees free planning option clearly.
- Frontier option says `Xupra AI - Frontier Models`.
- Orange upgrade prompt appears near Frontier option.
- Upgrade button opens website.
- Pro account does not see inappropriate locked state.

### 10. Website And Marketplace

Automated:

- Homepage uses versioned workflow GIF.
- Install page uses explicit VS Code CLI path.
- Static internal links are valid.
- `npm run lint`, `npm run typecheck`, `npm run build`.

Manual:

- Marketplace page displays current GIF, not old video.
- README top copy is readable.
- Tags and categories remain user-approved.
- Install instructions work in VS Code.
- Website account/pricing/install pages work on mobile and desktop.

### 11. Security And Secrets

Automated:

- Extension tokens are stored in VS Code SecretStorage.
- Planning provider keys are stored in VS Code SecretStorage.
- Credential vault encrypts secrets server-side.
- Credential access logs are written for create/verify/read/delete.
- API routes reject invalid extension tokens.

Manual:

- Save and clear OpenAI key.
- Save and clear Claude key.
- Confirm no key appears in `drylake.xu`, `.drylake/handoffs`, logs, or generated scripts.
- Confirm sign-out clears extension token.

### 12. Release Gates

Before every VSIX:

- `npm --prefix extensions/xupra-drylake-vscode test`
- `npm --prefix extensions/xupra-drylake-vscode run lint`
- `npm --prefix extensions/xupra-drylake-vscode run check:marketplace`
- `npm --prefix extensions/xupra-drylake-vscode run package:vsix`
- Inspect packaged README references.
- Install VSIX locally.
- Run one real handoff smoke test.

Before every website deploy:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Verify production pipeline succeeds.
- Check `/`, `/pricing`, `/account`, `/extensions/install`, `/api/v1/health`.

## Shared Manual Test Session Plan

Use a fresh small repo with one simple TypeScript app.

1. Install latest VSIX.
2. Connect account.
3. Generate a 3-stage plan as free user.
4. Generate a 6-stage plan with direct OpenAI or Claude key.
5. Create local skills for Codex, Claude, and generic DryLake.
6. Assign different agents and skills to each phase.
7. Run `DryLake: Check Agent Setup`.
8. Run non-autopilot handoff for phase 1.
9. Run next phase manually.
10. Enable autopilot and run remaining phases.
11. Inspect `.drylake/handoffs`.
12. Inspect `drylake.xu`.
13. Verify no secrets are written to disk.
14. Record any failed CLI launches with command, terminal output, and generated prompt file.
