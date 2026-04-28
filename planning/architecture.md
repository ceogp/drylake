# Xupra DryLake Architecture

## Core Rule

Xupra DryLake is an `import -> canonical -> export` system.

Do not treat platform-native files as the primary database record.

Instead:

1. import source files exactly as the user provides them
2. preserve raw artifacts for audit and recovery
3. normalize them into canonical Xupra objects
4. let users edit the canonical objects
5. generate target-native exports on demand

This is the architecture that avoids portability holes.

## Why This Model Is Required

Platforms do not line up one-to-one.

Examples:

- Cursor may provide rules and skills, but not Codex custom agent TOML
- Codex may provide `AGENTS.md`, `.agents/skills`, and `.codex/agents/*.toml`
- Claude Code may provide skills, subagents, hooks, and path-scoped instruction patterns

If Xupra only copies files across platforms, every mismatch becomes a dead end.

If Xupra stores canonical objects, then:

- imports can be partial
- exports can be generated
- missing direct mappings can degrade gracefully with warnings

## System Layers

### 1. Import Layer

Responsibilities:

- accept uploaded files and folder snapshots
- infer source platform where possible
- preserve originals exactly
- parse known file types deterministically
- send ambiguous files to OpenAI-backed normalization

Import inputs include:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/*.mdc`
- `.cursor/skills/**/SKILL.md`
- `.claude/skills/**/SKILL.md`
- `.claude/agents/*.md`
- `.agents/skills/**/SKILL.md`
- `.codex/agents/*.toml`
- loose `.md` and `.py`

### 2. Canonical Layer

This is the source of truth.

Canonical objects:

- `InstructionSet`
- `SkillPackage`
- `SubagentDefinition`
- `RuleDefinition`
- `HookDefinition`
- `RawArtifact`
- `GeneratedArtifact`

Current storage mapping in v1:

- `PackageVersion.agentDefinitionJson`
- `SkillRule`
- `Subagent`
- `PackageFile`
- `TransformJob`

### 3. Export Layer

Responsibilities:

- generate platform-native files from canonical objects
- emit compatibility warnings when parity is imperfect
- keep exports reproducible and versioned

Exports include:

- Codex `AGENTS.md`
- Codex `.agents/skills/**/SKILL.md`
- Codex `.codex/agents/*.toml`
- Claude `.claude/skills/**/SKILL.md`
- Claude `.claude/agents/*.md`
- Cursor `.cursor/skills/**/SKILL.md`
- Cursor `.cursor/rules/*.mdc`
- Cursor `AGENTS.md`

## Canonical Object Definitions

### InstructionSet

Represents:

- primary package instructions
- project-wide agent guidance
- portable top-level operating context

Fields:

- title
- description
- markdown body
- target hints

### SkillPackage

Represents:

- reusable capabilities
- workflows
- task-specific expertise

Fields:

- name
- description
- markdown body
- invocation metadata
- optional scripts
- optional references
- optional assets

### SubagentDefinition

Represents:

- specialized delegated agents
- platform worker profiles

Fields:

- name
- description
- system prompt
- tools
- model hint
- permission/sandbox hints
- platform-specific metadata

### RuleDefinition

Represents:

- scoped persistent rules
- rule metadata such as globs or always-apply behavior

Fields:

- name
- description
- markdown body
- scope metadata
- platform-specific metadata

### HookDefinition

Represents:

- lifecycle automation
- policy enforcement
- deterministic side effects

Fields:

- event name
- matcher
- handler type
- command or prompt payload
- timeout
- platform

### RawArtifact

Represents:

- original uploaded files
- audit-grade preservation of source material

### GeneratedArtifact

Represents:

- exported target-native files
- previews and deployment inputs

## Import Rules

1. Always preserve the raw file.
2. Prefer deterministic parsing before using AI.
3. Use OpenAI only for ambiguous or partially structured inputs.
4. When AI produces canonical objects, record warnings and confidence.
5. Never silently pretend full parity when a platform feature has no clean mapping.

## Export Rules

1. Export from canonical objects, not from previously generated files.
2. Regenerate target files every time.
3. Carry platform warnings into job results.
4. Keep generated files versioned as artifacts.
5. Preserve enough metadata to round-trip back into Xupra later.

## OpenAI Transformation Role

OpenAI is used in the transformation layer, not as the database.

Use it for:

- ambiguous markdown imports
- loose Python or text files that imply workflows
- recovering structured skills/subagents/fragments from messy source material
- generating target-specific exports when a direct mapping does not exist

Do not use it for:

- storing the canonical package
- replacing raw artifact preservation
- hiding deterministic parsing opportunities

## Current Implementation Direction

Near-term build order:

1. Codex import
   - `AGENTS.md`
   - `.agents/skills/**/SKILL.md`
   - `.codex/agents/*.toml`
2. Codex export
   - `AGENTS.md`
   - `.agents/skills/**/SKILL.md`
   - `.codex/agents/*.toml`
3. Claude high-fidelity skill/subagent round-trip
4. Cursor high-fidelity skill/rule round-trip
5. Hook model

## Non-Goals For Canonical Storage

Do not treat these as first-class portable assets:

- live editor UI settings
- account preferences
- session IDs
- tmux/runtime team state
- machine-local installation state

## Change Policy

If platform behavior changes, update this file first, then update adapters and tests.

This file is the working architecture contract for Xupra DryLake.
