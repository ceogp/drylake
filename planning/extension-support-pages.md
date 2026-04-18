# Xupra Extension Support Pages

## Purpose

If the extension is the acquisition surface, the website still needs a clear page structure around it.

These pages support:

- install
- trust
- onboarding
- account management
- operational control

## Public Pages

### `/`

Use:

- concise homepage
- explain Xupra in one pass
- point users to the extension and app

Primary CTA:

- `Install VS Code Extension`

Secondary CTA:

- `Open App`

### `/extensions`

This should become the extension product page.

It should explain:

- what the extension does
- supported platforms
- supported file types
- how the import/export flow works
- how the website fits in

Primary CTA:

- install extension

### `/extensions/install`

This should be the install + first-run page.

It should cover:

1. install from marketplace
2. connect account
3. open a repo
4. import supported files
5. preview exports
6. write files back or deploy

### `/extensions/docs`

This can be a later page for:

- detailed setup
- troubleshooting
- compatibility notes
- supported file conventions

## Signed-In Control-Plane Pages

### `/app`

Use:

- workspace home
- recent projects
- recent jobs
- quick links to the transfer center

### `/settings`

Use:

- personal account settings
- memberships
- personal defaults
- extension/account connection state

### `/billing`

Use:

- plan management
- checkout
- billing portal

### `/credentials`

Use:

- credential vault
- verification state
- provider-specific secrets

### `/integrations`

Use:

- connected systems
- Git providers
- deployment or notification integrations later

### `/reports`

Use:

- usage
- exports
- deployments
- failures

## Admin Page

### `/admin`

Use:

- platform-wide backoffice
- users
- orgs
- jobs
- health
- system visibility

This is not a customer-facing page.

## Extension-Web Relationship

The split should be:

### Extension

- discovery
- repo scanning
- import
- export
- deploy trigger

### Website

- auth
- billing
- credentials
- reporting
- team/admin

Users should understand that both are parts of one product, not two unrelated products.

## Immediate Page Work Needed

### Must-have now

- make homepage extension-aware
- add `/extensions`
- add `/extensions/install`
- tighten `/app`
- tighten `/settings`

### Next after that

- refine `/billing`
- refine `/credentials`
- refine `/integrations`
- refine `/reports`

## Page Copy Rules

1. customer-facing tone
2. short copy
3. no internal planning language
4. explain the product as:
   - import
   - canonicalize
   - export
5. reinforce the extension-first workflow without making the site feel secondary
