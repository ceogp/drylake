# Xupra DryLake Page Audit

## Goal

Make every current page match the actual product:

- extension-led acquisition
- web control plane
- import -> canonical -> export workflow
- user settings separate from platform admin

This audit is for the current page surface only.

## Current Page Inventory

- `/`
- `/app`
- `/settings`
- `/admin`
- `/billing`
- `/credentials`
- `/integrations`
- `/reports`
- `/projects/[projectId]`
- `/packages/[packageId]`
- `/versions/[versionId]`

## Navigation Model

The site should have 4 clear page types:

1. marketing
2. workspace
3. account/org operations
4. platform admin

Current top-level nav should be treated as:

- `App`
- `Settings`
- `Billing`
- `Admin`

Later likely additions:

- `Org`
- `Docs`

## Page Intent Map

### `/`

Audience:

- new user
- extension-discovery user
- potential customer

Goal:

- explain what Xupra does in one screen
- push user into product quickly

Primary CTA:

- `Open App`

Secondary CTA:

- `Install VS Code Extension` once published

Rules:

- short copy
- no heavy card grid
- no deep architecture explanation
- show supported platforms

### `/app`

Audience:

- signed-in customer

Goal:

- workspace home
- where the user decides what to do next

Primary jobs:

- open project
- create project
- see recent package activity
- jump to transfer work

Required content:

- current workspace/org
- recent projects
- recent jobs
- primary “start transfer” actions

Issue in current version:

- too much “control surface” language
- not enough direct task framing

Target framing:

- `Your transfer workspace`

### `/settings`

Audience:

- individual signed-in user

Goal:

- personal account settings only

Should include:

- profile
- email
- auth provider
- memberships
- personal defaults
- extension connection info

Should not include:

- platform setup status as the primary purpose
- org billing
- platform operator metrics

Current state:

- mostly correct
- still slightly mixed with setup/admin language

### `/admin`

Audience:

- you
- platform operators only

Goal:

- platform-wide backoffice

Should include:

- users
- organizations
- jobs
- deploy activity
- platform health
- billing visibility

Should not be described as customer-facing.

Future note:

- this should eventually live on a separate admin host

### `/billing`

Audience:

- org owner/admin

Goal:

- manage billing state for the current workspace

Should include:

- current plan
- upgrade/downgrade
- billing portal
- entitlement summary

Should not include:

- generic pricing philosophy copy

Current issue:

- tier copy is still partly internal/planning-oriented

### `/credentials`

Audience:

- org owner/admin

Goal:

- manage secrets required for deploys and integrations

Should include:

- stored credentials
- verification status
- where credentials are used later

Should feel operational, not experimental.

### `/integrations`

Audience:

- org owner/admin

Goal:

- configure external systems

Priority should be:

- platform targets
- Git providers
- agent runtime integrations

Slack/WhatsApp should not dominate this page right now.

Current design direction should change toward:

- `Connected systems`

### `/reports`

Audience:

- org owner/admin

Goal:

- answer “what has been imported, exported, deployed, or failed?”

Should include:

- transform usage
- deployment outcomes
- recent failures
- audit summary

### `/projects/[projectId]`

Audience:

- signed-in customer

Goal:

- project dashboard

Should include:

- packages
- deployment targets
- recent deploys
- create package

### `/packages/[packageId]`

Audience:

- signed-in customer

Goal:

- package history

Should include:

- version list
- latest active draft
- create new version

### `/versions/[versionId]`

Audience:

- signed-in customer

Goal:

- main canonical editor

This is the most important page in the product.

It should clearly show:

- source imports
- canonical package contents
- compatibility
- export preview
- deploy

Current issue:

- the page works, but reads like a raw admin form instead of the product center

This page needs the most UX attention.

## Platform Treatment On The Website

Across the product, the 4 platforms should be shown consistently as:

- source platforms
- target platforms
- compatibility targets
- deployment targets

Do not present them as separate disconnected feature silos.

Recommended shared labels:

- `Imported from`
- `Export to`
- `Compatibility for`
- `Deployment target`

## Recommended Route Structure

### Keep now

- `/`
- `/app`
- `/settings`
- `/admin`
- `/billing`
- `/credentials`
- `/integrations`
- `/reports`
- `/projects/[projectId]`
- `/packages/[packageId]`
- `/versions/[versionId]`

### Add later

- `/org`
  - current workspace settings
  - members
  - roles
  - workspace defaults

- `/extensions`
  - VS Code install and connection help

## Implementation Order

### Pass 1

- refine `/`
- refine `/app`
- refine `/versions/[versionId]`

### Pass 2

- refine `/settings`
- refine `/billing`
- refine `/credentials`

### Pass 3

- refine `/integrations`
- refine `/reports`
- refine `/projects/[projectId]`
- refine `/packages/[packageId]`

### Pass 4

- refine `/admin`
- clean top-level nav
- decide whether `/workspace` should be removed entirely

## Page QA Checklist

For every page:

1. Who is this page for?
2. What is the primary action?
3. Is the copy customer-facing?
4. Does it match current product reality?
5. Does it reinforce the canonical model clearly?
6. Does it avoid unnecessary internal/platform jargon?
7. Does it fit the extension-first, web-control-plane strategy?

## Immediate Next UX Priority

The highest-value UX work is:

1. make `/app` feel like the customer workspace home
2. make `/versions/[versionId]` feel like the true transfer center
3. tighten `/settings` into a real personal account page
