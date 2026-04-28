# Xupra DryLake VS Code Extension Roadmap

## Product Position

The VS Code extension is the primary go-to-market surface.

The website remains necessary, but in this model:

- the extension is how developers discover and use Xupra
- the website is where they manage account, billing, credentials, team settings, and reporting

This means the extension must feel like a real product, not just a thin technical client.

## Core Product Outcome

From inside VS Code or Cursor, a user should be able to:

1. connect their Xupra account
2. detect agent files in the current repo
3. import those files into a Xupra package
4. inspect portability across supported targets
5. generate exports
6. write generated files back into the repo
7. deploy when ready

## Supported Platforms

The first 4 platforms remain the priority:

- Codex
- Claude Code
- Cursor
- Claude Agents

The extension should present them consistently as:

- source platforms
- target platforms
- compatibility targets

## Product Surfaces In The Extension

### 1. Activity Bar Container

Name:

- `Xupra`

Views:

- `Workspace`
- `Jobs`
- `Help`

### 2. Workspace View

This is the main product surface.

It should show:

- connected account status
- current local repo
- detected source files
- selected project
- selected package
- selected version
- compatibility targets

This view should answer:

- what repo am I working in?
- what did Xupra detect?
- what package am I editing?
- what can I do next?

### 3. Jobs View

This should show recent:

- imports
- compatibility checks
- export previews
- deploys

Each job should display:

- job type
- target platform
- status
- updated time

### 4. Help View

This is the extension-side product info surface.

It should include:

- what Xupra does
- supported file types
- supported target platforms
- quick workflow steps
- links to website docs and account pages

This avoids forcing the user to leave the editor just to understand the product.

## Command Set

Keep the command model simple.

### Core commands

- `Xupra: Connect`
- `Xupra: Import Workspace`
- `Xupra: Check Compatibility`
- `Xupra: Generate Export Preview`
- `Xupra: Pull Generated Files`
- `Xupra: Deploy`
- `Xupra: Open Xupra Dashboard`

### Selection commands

- `Xupra: Select Project`
- `Xupra: Select Package`
- `Xupra: Select Version`
- `Xupra: Refresh Workspace`

### Optional next commands

- `Xupra: Create Project`
- `Xupra: Create Package`
- `Xupra: Create Version`
- `Xupra: Open Package In Browser`

## First-Run Experience

The first-run flow has to be deliberate.

### First run

1. user installs the extension
2. user sees `Connect`
3. browser auth opens
4. extension returns with connected state
5. extension detects supported repo files
6. extension prompts:
   - create new package
   - use existing package
7. user runs import
8. extension shows target readiness

### Daily run

1. user opens repo
2. extension recognizes the repo
3. user sees package/version context immediately
4. user imports, previews, or deploys

## File Detection Model

The extension should classify detected files into user-facing groups:

- `Instructions`
- `Skills`
- `Subagents`
- `Rules`
- `Configs`
- `Loose Sources`

Detected paths:

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

## Canonical Workflow Presentation

The extension should reflect the Xupra architecture clearly:

### Import

- scan workspace
- upload raw files
- preserve originals

### Canonicalize

- package version becomes the source of truth
- show counts:
  - skills
  - subagents
  - rules
  - files

### Export

- pick target platform
- generate target-native files
- show warnings and compatibility issues

Do not present this as a blind file copier.

## Extension Settings

The extension needs two kinds of settings:

### A. VS Code extension settings

These live in VS Code Settings.

Required settings:

- `xupra.baseUrl`
- `xupra.autoScanOnOpen`
- `xupra.defaultTargetPlatform`
- `xupra.pullGeneratedFilesAfterExport`
- `xupra.logLevel`

Recommended additions:

- `xupra.openDashboardAfterConnect`
- `xupra.showCompatibilityWarningsInline`
- `xupra.confirmBeforeWriteback`
- `xupra.workspaceScanDepth`

### B. Xupra settings surface inside the extension

The extension should also expose a lightweight settings/help UI.

This can be:

- a `Help` tree view
- plus a simple settings webview later if needed

It should show:

- connected account
- current base URL
- current target default
- link to web settings page
- extension version
- support/docs links

The extension should not try to replace the full web settings experience.

## Website Pages Required To Support The Extension

The website must support the extension-led product.

### Public pages

- `/`
  - product homepage
- `/extensions`
  - extension landing/install page
- `/extensions/install`
  - install, connect, and first-run instructions

### Signed-in pages

- `/app`
  - workspace home
- `/settings`
  - personal settings
- `/billing`
  - subscription and upgrade
- `/credentials`
  - vault for deploy/integration credentials
- `/integrations`
  - connected systems
- `/reports`
  - org usage and deployment reporting

### Operator page

- `/admin`
  - platform operator backoffice

## Icon System

The extension needs an icon system, not one random SVG.

### 1. Activity bar icon

Requirement:

- monochrome
- theme-safe
- works in narrow UI
- should use `currentColor`

This is the icon that appears in the VS Code side bar.

### 2. Marketplace/product icon

Requirement:

- branded
- readable at small sizes
- can use the fuller Xupra look

This can be richer than the activity bar icon.

### 3. Document/help icon usage

The extension docs/help pages may use:

- monochrome icon in product UI
- full brand mark in docs/marketing

## UX Requirements

The extension should feel:

- fast
- obvious
- low-friction
- trustworthy

That means:

- no giant forms for the primary workflow
- minimal required clicks
- clear status after every action
- explicit warnings when mappings are incomplete

## MVP Build Order

### Phase 1

- solid connection flow
- workspace scan
- project/package/version selection

### Phase 2

- import workspace
- show detected file types
- show canonical package counts

### Phase 3

- compatibility checks
- export previews
- target selection

### Phase 4

- pull generated files into repo
- overwrite confirmation

### Phase 5

- deploy flow
- job polling
- better failure handling

### Phase 6

- help view
- extension settings/help surface
- install/docs pages on website

## Launch Checklist

- works in VS Code
- tested in Cursor
- activity bar icon is correct
- first-run flow is understandable
- import flow works on real repos
- export flow is obvious
- writeback is safe
- web dashboard links support account/billing/admin tasks

## Immediate Next Build Target

The first real milestone is:

`a user can install the extension, connect, import a repo, preview an export, and pull generated files back into the workspace without opening the website except for auth.`
