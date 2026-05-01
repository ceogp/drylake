# Feature Audit

Last updated: 2026-04-30

This file is the non-secret working checklist for finding and removing fake, dead,
broken, or confusing product surfaces. Keep it current as features are verified,
fixed, deployed from `development`, and checked on AWS staging.

## Status Legend

- `working`: implemented and expected to work in staging.
- `manual verify`: implemented, but needs browser/account/payment/editor verification.
- `gated`: intentionally blocked by sign-in, plan, entitlement, or config.
- `ui-only`: visible UI that does not perform the named product action yet.
- `broken`: implemented path is known to fail or return the wrong result.
- `confusing`: works technically, but copy/page placement over-promises or duplicates another flow.

## Deployment Rule

- Code changes go to `development`.
- GitLab validates and deploys staging from `development`.
- Staging URL: `https://drylake.xupracorp.com`.
- Health URL only proves the app is alive. It does not prove a feature works.
- Verify customer behavior on the real page after deploy.


  ## Product Promise

  DryLake helps users collect, understand, convert, and reuse AI coding skills/agents across tools.

  Supported source systems:
  - Claude Code
  - Codex
  - Cursor
  - AGENTS.md-style repo instructions

  Supported target systems:
  - Claude Code
  - Codex
  - Cursor
  - AGENTS.md

  Core user promise:

  1. User signs in.
  2. User imports their existing skills/agents/rules/instructions.
  3. User can view and manage the raw source files for free.
  4. Paid user can use AI to canonicalize those files into portable skills/agents.
  5. Paid user can generate target-ready files for another tool.
  6. User can download/copy/install/share those generated files.

  ## Core Concepts To Verify

  ### Raw Source File

  Exact uploaded file.

  Must be preserved unchanged.

  Verify:
  - Upload file.
  - View file.
  - Copy file.
  - Download file.
  - Downloaded content equals original content.
  - Metadata shows source path, size, checksum, likely platform.

  ### Imported / Parsed Item

  Old parser output from source files.

  This is not true AI canonicalization.

  Verify:
  - Claude agent file appears as imported agent.
  - Codex `SKILL.md` appears as imported skill.
  - Cursor rule appears as imported rule.
  - UI labels these as imported/parsed, not canonical AI output.

  ### Canonical Item

  Future paid AI-understood object.

  Should be created by LLM canonicalization.

  Verify current state:
  - If backend is not implemented, UI must not pretend it works.
  - Canonicalize button should either be hidden, disabled, or clearly say coming soon.
  - No path-rule parser should create fake canonical items.

  Future expected behavior:
  - User selects one or more raw/imported items.
  - Backend sends source content to Kimi/Moonshot.
  - LLM returns structured canonical item:
    - name
    - kind
    - description
    - instructions
    - trigger hints
    - source platform
    - capabilities
    - warnings
  - User reviews before accepting.

  ### Target Artifact

  Generated files for one target system.

  Verify:
  - Target generation uses imported/canonical source.
  - User sees exact files before download/install.
  - Downloaded target bundle contains correct paths and content.

  ## Main End-To-End User Workflows

  ### Workflow 1: New User Signup

  Goal:
  A new user can create an account and reach the app.

  Steps:
  1. Open `https://drylake.xupracorp.com`.
  2. Click sign up.
  3. Complete Clerk signup.
  4. Confirm redirect lands in app/workspace.
  5. Confirm no dev-auth UI appears.

  Expected:
  - User is signed in.
  - User has an org/workspace.
  - User can start import.

  ### Workflow 2: Import Existing Skills/Agents

  Goal:
  User imports files and sees them clearly.

  Steps:
  1. Sign in.
  2. Open Skills & Agents page.
  3. Import a folder containing:
     - `.claude/agents/example.md`
     - `.codex/skills/example/SKILL.md`
     - `.cursor/rules/example.mdc`
     - `AGENTS.md`
  4. Confirm stats update.
  5. Confirm Source Files tab lists each file compactly.
  6. Confirm no giant expanded code blocks.

  Expected:
  - Raw file count matches upload.
  - Likely source is correct.
  - User can view/copy/download each raw file.

  ### Workflow 3: Free User Source Library

  Goal:
  Free user gets visibility but not AI conversion.

  Steps:
  1. Use free account.
  2. Import files.
  3. View/copy/download raw source files.
  4. Try canonicalization.
  5. Try target generation.

  Expected:
  - View/copy/download works.
  - Canonicalization is gated.
  - Target generation is gated.
  - Upgrade path is clear and clickable.

  ### Workflow 4: Upgrade To Pro

  Goal:
  User can pay and unlock paid features.

  Steps:
  1. Click Upgrade to Pro.
  2. Stripe checkout opens with DryLake $10/month.
  3. Complete test/live payment as appropriate.
  4. Stripe webhook hits `/api/stripe/webhook`.
  5. App updates entitlement.
  6. Return to app.

  Expected:
  - Organization gets Pro entitlement.
  - `manual_export` or future paid entitlement is enabled.
  - User no longer sees locked target generation state.

  ### Workflow 5: Canonicalization

  Current state:
  This is not implemented yet.

  Goal when implemented:
  Paid user converts messy source files into a canonical item.

  Steps:
  1. Paid user selects source file/imported item.
  2. Click `Canonicalize with AI`.
  3. Backend creates canonicalization event.
  4. Kimi/Moonshot receives source content.
  5. LLM returns structured canonical item.
  6. User reviews result.
  7. User accepts or edits.
  8. Canonical Library shows accepted item.

  Expected:
  - Raw file is never mutated.
  - Canonical item records source file IDs.
  - LLM model and timestamp are stored.
  - Failed canonicalization shows useful error.
  - User can retry.

  ### Workflow 6: Target Generation

  Goal:
  Paid user generates files for another tool.

  Steps:
  1. Paid user opens Targets tab.
  2. Select item.
  3. Select target:
     - Codex
     - Claude Code
     - Cursor
     - AGENTS.md
  4. Generate target files.
  5. Review target files.
  6. Download JSON or individual files.

  Expected target paths:

  Codex:
  - `.codex/skills/<name>/SKILL.md`
  - optional `.codex/agents/...`

  Claude:
  - `.claude/agents/<name>.md`
  - optional `.claude/skills/...`

  Cursor:
  - `.cursor/rules/<name>.mdc`

  AGENTS.md:
  - `AGENTS.md`

  ### Workflow 7: Cross-Platform Sharing

  Goal:
  A user can take a skill from one platform and use it in another.

  Example:
  Claude agent → Codex skill.

  Steps:
  1. Import `.claude/agents/enterprise-builder.md`.
  2. Canonicalize with AI.
  3. Choose Codex target.
  4. Generate Codex files.
  5. Download target files.
  6. Place files in scratch workspace.
  7. Confirm Codex can see/use the skill.

  Expected:
  - Output is not just a file copy.
  - Instructions are adapted to target format.
  - Any unsupported fields are listed as warnings.

  ### Workflow 8: VS Code Extension Sync

  Goal:
  Website and extension agree.

  Steps:
  1. Connect VS Code extension.
  2. Import default locations from extension.
  3. Confirm website shows same files.
  4. Confirm extension shows same imported artifacts.
  5. Generate target files on website.
  6. Confirm extension can pull/install when implemented.

  Current expected:
  - Import and visibility works.
  - Pull/install may not be implemented yet and should be labeled honestly.

  ## Platform Format Rules To Verify

  ### Claude Code Agent Input

  Expected source:
  - Markdown file
  - YAML frontmatter
  - Instructions body

  Verify parser detects:
  - name
  - description
  - model/color if present
  - instruction body

  ### Codex Skill Input

  Expected source:
  - folder with `SKILL.md`
  - frontmatter with name/description
  - optional scripts/references/assets

  Verify parser detects:
  - skill folder
  - SKILL.md
  - name
  - description
  - full content

  ### Cursor Rule Input

  Expected source:
  - `.cursor/rules/*.mdc`

  Verify parser detects:
  - rule file
  - content
  - likely target as Cursor

  ### AGENTS.md Input

  Expected source:
  - `AGENTS.md`

  Verify parser detects:
  - repo instruction file
  - kind instruction

  ## What Must Be Honest In The UI

  Do not say:
  - upload
  - share
  - install
  - canonicalize
  - sync
  - deploy

  unless that action actually happens.

  Allowed current wording:
  - Import files
  - View source
  - Copy source
  - Download source
  - Generate target files
  - Download target files
  - Upgrade to unlock AI conversion
  - Coming soon: AI canonicalization

  ## Priority Fix Order

  ### Priority 1: Make Existing Working Features Honest

  - Import
  - Source list
  - View
  - Copy
  - Download
  - Billing link
  - Target preview/download

  ### Priority 2: Remove Or Rename Fake Actions

  - Rename `Upload / Share` if it only opens Targets.
  - Rename `Prepare Upload / Share` if it only generates files.
  - Disable/hide `Canonicalize with AI` until backend exists.
  - Disable/hide `Create Skill` until backend exists.

  ### Priority 3: Implement Real Canonicalization

  - Add canonicalization API.
  - Add Kimi/Moonshot client.
  - Add schema for canonical items/events.
  - Add review UI.
  - Add paid gating.
  - Add retries/error states.

  ### Priority 4: Implement Real Install/Share

  - Download individual files.
  - Download zip.
  - Extension pull/install.
  - Share link or team library.
  - Conflict handling when installing into an existing workspace.

  The key correction: canonicalization is not currently performed if the system only shows imported Subagent and SkillRule records. That is parsing/importing, not
  canonicalization.

  Real canonicalization should be:

  raw source file
  -> LLM analysis
  -> structured canonical item
  -> user review
  -> saved canonical item
  -> target-specific generation

  So your audit should explicitly test all three layers separately:

  Raw uploaded source
  Imported/parsed item
  AI canonical item
  Target generated files

  That will stop agents from pretending parser output is the same thing as AI canonicalization.

## Main Customer Path

| Step | Surface | Current status | Notes / next action |
| --- | --- | --- | --- |
| Sign up / sign in | Header Clerk controls, `/get-started`, `/extensions/connect` | manual verify | Clerk is configured on staging. Need browser verification for new user, returning user, and redirect behavior. |
| Workspace redirect | `/workspace`, `/app` | manual verify | Should route signed-in users to the active import workspace/version. Verify with Clerk session. |
| Upload/import files | `/versions/[versionId]` -> `Import Files`, `Choose Files` | working/manual verify | Uploads files, stores raw source, calls import parser, refreshes source list. Verify with a fresh file set. |
| View source file | `/versions/[versionId]` -> `View`, row click | working/manual verify | Source artifact persistence was fixed and deployed. Re-check live preview box for each existing row. |
| Copy source file | `/versions/[versionId]` -> `Copy` | manual verify | Fetches exact source then writes to clipboard. Needs browser clipboard verification. |
| Download source file | `/versions/[versionId]` -> `Download` | manual verify | Fetches exact source then downloads a blob. Needs browser verification. |
| Upgrade to Pro | `/billing` -> `Upgrade To Pro ($10/mo)` | manual verify | Stripe Pro price is configured. Need verify checkout opens and webhook updates entitlement after test payment. |
| Upgrade from version page | `/versions/[versionId]` -> `Upgrade to canonicalize` | broken | Button has no click handler or link. First fix candidate: link to `/billing?returnPath=/versions/[versionId]`. |
| AI canonicalization | `/versions/[versionId]` -> `Canonicalize with AI . Pro` | ui-only | Button only switches tabs and sets a message. No Kimi/Moonshot canonicalization job exists yet. Hide/rename or implement. |
| Canonical Library | `/versions/[versionId]` -> `Canonical Library` tab | confusing/gated | Shows imported parsed records for paid users, not true AI-canonical records. Free users only see upgrade card. |
| Generate target files | `/versions/[versionId]` -> `Targets` -> `Prepare Upload / Share` | gated/manual verify | Calls export-preview API for entitled users. It generates preview files only; no real upload/share/install. |
| Download target files | `/versions/[versionId]` -> `Download target files` | manual verify | Downloads generated preview files as a JSON bundle after generation. Verify file content. |
| Upload/share/install target files | `/versions/[versionId]` target copy | ui-only/confusing | UI says upload/share/install, but no real upload, share, or editor install flow is implemented. |

## Page Inventory

| Route | Purpose | Primary actions | Current status | Notes / next action |
| --- | --- | --- | --- | --- |
| `/` | Marketing/home entry | Upload Skills And Agents, Get Started, Extension links | working/confusing | Links route into workspace/get-started/extensions. Copy claims target generation; ensure it does not over-promise free behavior. |
| `/get-started` | Onboarding guide | Sign up/sign in, Upload Skills And Agents, extension/billing links | manual verify/confusing | Mostly navigation. Some copy says canonical package/generate target format, which is not fully implemented yet. |
| `/workspace` | Workspace redirect | redirect only | manual verify | Verify signed-in and signed-out behavior. |
| `/app` | App dashboard | Upload Skills And Agents, Billing, Settings, Create Project, project/package links | manual verify | Project creation appears real. Verify redirect and starter workspace state. |
| `/projects/[projectId]` | Project detail | Create Package, Create Deployment Target, open package/version | manual verify/confusing | Record creation is implemented. Deployment target is only setup metadata unless paired with real deployment flow. |
| `/packages/[packageId]` | Package detail | Create Version, open version | manual verify/confusing | Create Version is implemented. Copy still mentions compatibility/exporting and should be revised. |
| `/versions/[versionId]` | Main Skills & Agents workflow | import/view/copy/download/canonicalize/generate targets/history | mixed | This is the highest-priority audit surface. See main customer path above. |
| `/billing` | Plan and entitlement management | Upgrade To Pro, Enterprise Checkout, Billing Portal | manual verify/gated | Pro likely configured. Enterprise price is intentionally blank for now. Portal requires Stripe customer. |
| `/settings` | User/workspace settings summary | App, Billing, Admin link if platform admin | working/manual verify | Mostly read-only navigation. Not a feature risk unless users expect editing. |
| `/credentials` | Credential vault summary | Verify credential, App, Billing | confusing/gated | Existing credential verification exists, but there is no visible create credential form on the page. Consider hiding from normal path until useful. |
| `/integrations` | Integration readiness/status | App, Billing | confusing | Mostly read-only. Existing create/test actions are not exposed here. Consider hiding from normal path or making it useful. |
| `/reports` | Reporting/audit summary | read-only | manual verify/confusing | Advanced reporting entitlement exists, but page is mostly informational. Verify access expectations. |
| `/extensions` | Extension overview | Upload Skills And Agents, Install Extension | confusing | Duplicates `/extensions/install` in the normal path. Keep one clear extension entry point. |
| `/extensions/install` | Extension install guide | Get Started, Upload, Connect Extension, App, Extensions | manual verify/confusing | Mostly instructions and navigation. Ensure it does not imply extension sync is complete if only token flow works. |
| `/extensions/connect` | Browser/editor connection | Sign in/up, Generate Token, Copy Token, Return To Editor | manual verify | Token generation/copy is implemented. Browser callback return needs editor/manual verification. |
| `/admin` | Platform admin | App/settings links, read-only platform stats | manual verify/gated | Operator-only surface. Keep out of customer path. |

## Known Dead Or Placeholder Actions

- `/versions/[versionId]` -> `Upgrade to canonicalize`: broken. No handler or link.
- `/versions/[versionId]` -> `Canonicalize with AI . Pro`: ui-only. No AI canonicalization backend job.
- `/versions/[versionId]` -> `Create Skill`: ui-only. It only switches tabs and shows a future-step message.
- `/versions/[versionId]` -> `Upload / Share`: confusing. It only opens the Targets tab.
- `/versions/[versionId]` -> `Prepare Upload / Share`: confusing. It generates target previews; it does not upload or share.
- `/versions/[versionId]` target empty state mentions VS Code install, but install is not implemented there.
- `/billing` -> `Enterprise Checkout`: gated/unavailable until `STRIPE_ENTERPRISE_PRICE_ID` is configured.
- `/credentials`: verification may work for existing records, but customers cannot create credentials there.
- `/integrations`: integration status is visible, but normal create/test/manage actions are not exposed.

## First Fix Batch

Goal: remove obvious dead or misleading controls from the main customer path without redesigning the app.

- [ ] Make `Upgrade to canonicalize` link to `/billing?returnPath=/versions/[versionId]`.
- [ ] Decide whether `Canonicalize with AI . Pro` should be hidden until backend exists or changed to a clearly gated "Coming soon" state.
- [ ] Decide whether `Create Skill` should be hidden until implemented or linked to a real create flow.
- [ ] Rename `Upload / Share` and `Prepare Upload / Share` to match current behavior, or implement real upload/share.
- [ ] Change target empty-state copy so it only promises generated/downloadable files until upload/share/install exists.
- [ ] Verify source view/copy/download live on AWS after artifact persistence fix.

## Second Fix Batch

Goal: make the paid path honest and testable.

- [ ] Verify `/billing` Pro checkout opens in Stripe.
- [ ] Verify Stripe webhook upgrades the organization to Pro.
- [ ] Verify Pro unlocks `manual_export`.
- [ ] Verify target generation succeeds for a Pro organization.
- [ ] Verify target JSON download contains expected generated files.
- [ ] Hide or disable Enterprise checkout until enterprise price is configured.

## Third Fix Batch

Goal: reduce confusing or redundant product surfaces.

- [ ] Review whether `/extensions` and `/extensions/install` should be merged or one should become the primary route.
- [ ] Decide whether `/credentials`, `/integrations`, and `/reports` belong in normal customer navigation before they have full workflows.
- [ ] Update stale copy on `/packages/[packageId]` that mentions compatibility/exporting.
- [ ] Update onboarding copy that implies canonicalization/target upload exists before it does.

## Manual Verification Notes

These checks require an authenticated browser or external system and should not be marked fully working from code alone:

- Clerk sign-up, sign-in, sign-out, and redirects.
- Clipboard copy.
- Browser downloads.
- Stripe checkout, webhook, and portal.
- Editor extension callback and manual token use.
- Live AWS version page behavior after each deploy.
