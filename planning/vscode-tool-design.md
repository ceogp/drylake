# Xupra DryLake VS Code Tool Design

## Product Role

The VS Code extension is the go-to-market entry point.

It should feel like:

- install extension
- connect account
- scan current repo
- import agent files
- preview portability
- export or deploy

The website remains the control plane, but the extension is the main operator surface for developers.

## Core Product Promise

`Move agents, skills, subagents, rules, and configs from one platform to another without rebuilding them by hand.`

Supported first-class platforms:

- Codex
- Claude Code
- Cursor
- Claude Agents

## Design Principles

1. Keep the extension native-first.
   - prefer sidebar trees, commands, notifications, quick picks
   - use webviews only when preview/diff is materially better

2. Make the repo the starting point.
   - users should be able to open a workspace and immediately see what Xupra found

3. Keep the canonical model visible.
   - the extension should not feel like a dumb file copier
   - it should show:
     - detected source files
     - canonical package/version
     - target export readiness

4. Let the website handle admin/commercial complexity.
   - auth
   - billing
   - credentials
   - reports
   - team management

## Main Extension Surfaces

### 1. Activity Bar

Name:

- `Xupra DryLake`

Views:

- `Workspace`
- `Jobs`

### 2. Workspace Tree

This is the main surface.

Sections:

- Current Workspace
- Detected Files
- Active Project
- Active Package
- Active Version
- Targets

Example tree:

```text
Xupra DryLake
  Current Workspace
    my-repo
  Detected Files
    AGENTS.md
    .cursor/rules/api-guidelines.mdc
    .claude/agents/reviewer.md
  Project
    Customer Support Agents
  Package
    Main Transfer Package
  Version
    v3 draft
  Targets
    Codex
    Claude Code
    Cursor
    Claude Agents
```

### 3. Jobs View

Show only recent operational work:

- import jobs
- compatibility checks
- export jobs
- deploy jobs

Each item should show:

- job type
- target platform
- status
- updated time

### 4. Status Bar

Minimal status:

- connection state
- current workspace/project/package/version

Example:

- `Xupra: Connected`
- `Xupra: v3 draft`

## Primary Commands

Keep the command list tight.

### Top-level commands

- `Xupra: Connect`
- `Xupra: Import Current Workspace`
- `Xupra: Check Compatibility`
- `Xupra: Generate Export Preview`
- `Xupra: Pull Generated Files`
- `Xupra: Deploy`
- `Xupra: Open Web Dashboard`

### Context commands

- `Xupra: Select Project`
- `Xupra: Select Package`
- `Xupra: Select Version`
- `Xupra: Refresh`

## User Flow

### First-run flow

1. install extension
2. click `Connect`
3. sign in through browser
4. return to VS Code
5. extension detects workspace
6. prompt:
   - import into existing package
   - create new package

### Daily flow

1. open repo
2. extension shows detected agent files
3. run import
4. review compatibility
5. generate export preview
6. pull files or deploy

## Source Detection

The extension should detect these first:

- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/**/SKILL.md`
- `.codex/agents/*.toml`
- `.claude/skills/**/SKILL.md`
- `.claude/agents/*.md`
- `.cursor/skills/**/SKILL.md`
- `.cursor/rules/*.mdc`
- loose `.md`
- loose `.py`

The detection UI should classify files as:

- `instruction`
- `skill`
- `subagent`
- `rule`
- `agent config`
- `unclassified source`

## Canonical Workflow In Extension

The extension should expose the 3-layer model clearly:

### Import

- scan workspace
- upload raw files
- preserve originals

### Canonicalize

- show active package version
- show counts:
  - skills
  - subagents
  - rules
  - files

### Export

- choose target platform
- generate target-native files
- show warnings when parity is incomplete

## Platform Presentation

Treat each platform as:

- source
- target
- compatibility profile

Do not make them separate product modes.

The extension should show:

- `Imported from Cursor`
- `Export ready for Codex`
- `Warnings for Claude Agents`

That is clearer than four disconnected workflows.

## What Belongs In The Extension

- repo scan
- import
- compatibility check
- export preview
- pull/writeback
- deploy trigger
- job status

## What Does Not Belong In The Extension

- billing management
- full credential management
- user profile management
- full admin reporting
- platform-wide user/org management

Those stay on the website.

## MVP Extension

The first shippable version should do only this:

1. connect account
2. detect supported files
3. create/select project, package, version
4. import workspace
5. run compatibility check
6. generate export preview
7. pull generated files
8. trigger deploy

## Launch Readiness Checklist

- install works in VS Code
- tested in Cursor
- auth round-trip works cleanly
- workspace scan is obvious
- target export flow is understandable
- failures explain what to do next
- web dashboard opens when user needs billing/settings/admin

## Success Metric

The extension is successful if a new user can:

1. install it
2. import their current repo
3. generate a valid export for another platform
4. understand what happened without reading docs
