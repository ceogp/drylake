# Xupra DryLake Agent Portability Consolidation Plan

## Goal

Define one canonical model that can store and move reusable agent assets across:

- Codex
- Cursor
- Claude Code

This pass is intentionally Codex-first, but it also captures the Claude and Cursor primitives that overlap with Codex so we do not build the wrong canonical shape.

## What The Docs Confirm

### 1. Skills are the cleanest common denominator

Across Codex, Cursor, and Claude Code, `skills` are the most portable artifact:

- a directory per skill
- `SKILL.md` as the entrypoint
- YAML frontmatter with at least `name` and `description`
- optional `scripts/`
- optional `references/`
- optional `assets/`

This means `skill packages` should be a first-class canonical object in Xupra DryLake.

### 2. Codex is different for subagents

Codex custom agents are not markdown skill folders. They are standalone TOML agent definitions under:

- `~/.codex/agents/`
- `.codex/agents/`

The Codex docs say each custom agent file must define:

- `name`
- `description`
- `developer_instructions`

Optional settings inherit from the parent session, including model, reasoning effort, sandbox mode, MCP servers, and skill config.

Implication:
- Codex `skills` and Codex `custom agents` must be stored as separate canonical objects.

### 3. Claude Code is the richest file model

Claude Code supports:

- skills in `.claude/skills/<skill-name>/SKILL.md`
- subagents in `.claude/agents/*.md`
- hooks in skills and agents frontmatter
- plugin-bundled skills/hooks/subagents
- agent teams as runtime orchestration

Important nuance:
- agent teams are runtime state and coordination, not a portable authoring format
- subagent definitions are portable authoring assets
- team configs should not be treated as canonical source artifacts

### 4. Cursor shares the skills standard, but rules still matter

Cursor supports:

- skills in `.cursor/skills/`
- skills in `.agents/skills/`
- compatibility loading from `.claude/skills/` and `.codex/skills/`
- rules in `.cursor/rules/*.mdc`
- root `AGENTS.md` for simpler project instructions

Implication:
- for Cursor, Xupra needs both `skill` and `rule` exports
- `rules` are not the same thing as `skills`, so they should stay separate in the canonical model

### 5. Hooks exist, but not equally

#### Codex

Codex has hooks, but the docs mark them as experimental. They require a feature flag in `config.toml`, and the docs explicitly say hooks are currently disabled on Windows.

Implication:
- store Codex hook definitions canonically
- do not promise Windows Codex hook execution
- treat Codex hooks as optional/experimental in v1

#### Claude Code

Claude Code has the strongest documented hook system in this comparison:

- settings-based hooks
- plugin hooks
- skill-scoped hooks
- subagent-scoped hooks
- prompt hooks
- agent hooks
- team lifecycle hooks like `TeammateIdle`, `TaskCreated`, and `TaskCompleted`

Implication:
- Xupra should preserve Claude hook definitions with high fidelity

#### Cursor

Cursor clearly has hooks, but the most accessible official sources in this pass are changelog/blog/marketplace pages rather than one strong consolidated reference page. The official examples show JSON-configured hook handlers such as `beforeSubmitPrompt` and `beforeShellCommand`.

Implication:
- support Cursor hooks in the canonical model
- mark the adapter as lower-confidence than Claude until we verify the full current docs surface

## Canonical Model To Build

Do not make any platform file the source of truth.

Store these canonical objects instead:

### 1. `InstructionSet`

Purpose:
- project-wide agent instructions
- root operating guidance

Canonical fields:
- `title`
- `body_markdown`
- `scope`
- `path_scopes`
- `target_platform_hints`

Exports to:
- Codex `AGENTS.md`
- Cursor `AGENTS.md`
- Claude `CLAUDE.md` only when used as top-level memory, not as a skill

### 2. `SkillPackage`

Purpose:
- reusable workflow/unit of expertise

Canonical fields:
- `name`
- `description`
- `body_markdown`
- `invocation_mode`
- `supporting_scripts`
- `supporting_references`
- `supporting_assets`
- `ui_metadata`
- `platform_overrides`

Exports to:
- Codex skill folder
- Cursor skill folder
- Claude skill folder

### 3. `SubagentDefinition`

Purpose:
- specialized delegated worker definition

Canonical fields:
- `name`
- `description`
- `system_prompt`
- `allowed_tools`
- `disallowed_tools`
- `model_hint`
- `reasoning_effort`
- `permission_mode`
- `mcp_servers`
- `hook_bindings`
- `skill_bindings`
- `memory_bindings`
- `background_mode`

Exports to:
- Codex `.codex/agents/*.toml`
- Claude `.claude/agents/*.md`

Notes:
- Cursor subagent authoring format is not locked from primary docs in this pass, so do not hardcode a Cursor-specific subagent file format yet

### 4. `RuleDefinition`

Purpose:
- scoped, persistent project rules

Canonical fields:
- `name`
- `description`
- `body_markdown`
- `globs`
- `always_apply`
- `manual_only`
- `platform_overrides`

Exports to:
- Cursor `.cursor/rules/*.mdc`
- Claude path-specific or scoped instruction exports where needed
- Codex can receive rule content via `AGENTS.md` sections or skills, depending on the use case

### 5. `HookDefinition`

Purpose:
- deterministic guardrails and lifecycle actions

Canonical fields:
- `name`
- `platform`
- `event_name`
- `matcher`
- `handler_type`
- `command`
- `url`
- `prompt`
- `timeout_seconds`
- `run_once`
- `async_mode`
- `scope`

Exports to:
- Codex hooks config
- Claude settings/plugin/skill/subagent hooks
- Cursor hook JSON

### 6. `TeamTemplate`

Purpose:
- reusable multi-agent orchestration template

Canonical fields:
- `name`
- `description`
- `lead_instructions`
- `member_roles`
- `task_patterns`
- `quality_gate_hooks`

Important:
- this is a Xupra abstraction, not a direct file mirror
- Claude agent teams are runtime orchestration, not source files
- Codex subagents can still consume the role definitions without a full “team” artifact

### 7. `RawArtifact`

Purpose:
- exact uploaded source files for audit and round-trip fallback

Canonical fields:
- `original_path`
- `platform_guess`
- `content_type`
- `checksum`
- `raw_text`
- `binary_blob_ref`

### 8. `GeneratedArtifact`

Purpose:
- exported target files

Canonical fields:
- `target_platform`
- `logical_path`
- `content`
- `generator_version`
- `warnings`

## What To Canonicalize vs What To Avoid

### Canonicalize

- skills
- subagents
- rules
- top-level instructions
- hooks
- runtime policy hints
- original uploaded artifacts

### Do not canonicalize as first-class portable assets

- session-specific team runtime state
- tmux/session IDs
- editor UI preferences
- account-level IDE settings
- machine-local hook installation state

## Codex-First Storage Decisions

If we start with Codex tonight, lock these decisions now:

1. `Skills` and `custom agents` are different entities.
2. `AGENTS.md` is not enough to represent a Codex project.
3. Hook definitions must be stored, but Codex hook execution on Windows must be treated as unavailable.
4. Raw uploaded TOML must be preserved alongside normalized fields.
5. Generated exports must be reversible enough to re-open and edit inside Xupra.

## Consolidation Strategy

### Phase 1: Stable common core

Implement import/export around:

- `SkillPackage`
- `InstructionSet`
- `RawArtifact`
- `GeneratedArtifact`

This gives the cleanest portability across all three ecosystems immediately.

### Phase 2: Specialized worker model

Implement:

- `SubagentDefinition`

Map:

- Codex TOML agents
- Claude markdown subagents

Do not force Cursor into this until its custom authoring format is verified from primary docs.

### Phase 3: Rules and hooks

Implement:

- `RuleDefinition`
- `HookDefinition`

Map:

- Cursor rules
- Claude hooks
- Codex hooks

This phase needs platform-specific compatibility warnings.

### Phase 4: Team orchestration

Implement:

- `TeamTemplate`

Map:

- Claude agent teams
- Codex multi-subagent execution plans

This should be an orchestration abstraction, not a file mirror.

## Recommended Import Priority

1. Codex
   - `AGENTS.md`
   - `.codex/agents/*.toml`
   - Codex skill folders
2. Claude Code
   - `.claude/skills/**/SKILL.md`
   - `.claude/agents/*.md`
   - hook-bearing skill and agent frontmatter
3. Cursor
   - `.cursor/skills/**/SKILL.md`
   - `.cursor/rules/*.mdc`
   - root `AGENTS.md`

## Recommended Export Priority

1. Codex skill folders and `AGENTS.md`
2. Codex custom agent TOML
3. Claude skills and subagents
4. Cursor skills and rules
5. Hook exports with platform warnings

## Product Rules For Xupra

1. Preserve originals.
   - Every import keeps the raw source file.

2. Normalize into structured objects.
   - Xupra should edit structured records, not only raw files.

3. Regenerate target files on demand.
   - Target files are outputs, not the primary database record.

4. Warn instead of pretending parity.
   - Hooks, team orchestration, and subagent permissions are not perfectly portable.

5. Separate authoring from runtime.
   - Team/session state is runtime, not canonical storage.

## Immediate Next Build Steps

1. Add canonical DB support for `SkillPackage`, `SubagentDefinition`, and `HookDefinition` if any fields are still missing.
2. Add Codex skill-folder import/export explicitly, not just `AGENTS.md`.
3. Add Codex `.codex/agents/*.toml` parser/importer.
4. Add Claude `.claude/agents/*.md` high-fidelity import/export.
5. Add Cursor `.cursor/skills/**/SKILL.md` import/export.
6. Add platform compatibility warnings for:
   - Codex hooks on Windows
   - Claude plugin-subagent hook restrictions
   - Cursor hook fidelity still under verification

## Sources

- Codex skills: https://developers.openai.com/codex/skills
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex subagents: https://developers.openai.com/codex/subagents
- Codex plugins: https://developers.openai.com/codex/plugins
- Cursor skills: https://cursor.com/docs/skills
- Cursor rules: https://cursor.com/docs/rules
- Cursor hooks changelog: https://cursor.com/changelog/1-7/
- Cursor hooks overview: https://cursor.com/blog/hooks-partners
- Claude Code skills: https://code.claude.com/docs/en/skills
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude Code agent teams: https://code.claude.com/docs/en/agent-teams
