# DryLake Permission Model

## Principles

- Default deny when a requested external scope is missing, ambiguous, or broader than the recipe declares.
- Minimum privilege per recipe and per invocation.
- External writes always require explicit user approval.
- Internal DryLake state writes are allowed for DryLake tools, but must be auditable.
- Credentials are referenced indirectly and never returned to clients.

## Trust layers

1. MCP client trust: the client may invoke DryLake, but does not inherit blanket access to external systems.
2. Workspace trust: recipes are enabled per workspace or user scope.
3. Recipe trust: each recipe declares supported transports, auth model, read scopes, and write scopes.
4. Invocation trust: every external access request is checked against the exact tool call and the active phase.

## Scope taxonomy

### Internal scopes

- `plans.read`
- `plans.write`
- `phases.read`
- `phases.write`
- `handoffs.read`
- `handoffs.write`
- `audit.read`
- `audit.write`
- `token_budget.read`
- `token_budget.write`

### External read scopes

- `repo.metadata.read`
- `repo.files.read`
- `issues.read`
- `pull_requests.read`
- `docs.read`
- `alerts.read`
- `design.read`
- `browser.evidence.read`

### External write scopes

- `issues.write`
- `pull_requests.write`
- `comments.write`
- `repo.files.write`
- `branches.write`
- `deployments.write`
- `alerts.mute`
- `design.comments.write`

### Administrative scopes

- `recipe.configure`
- `catalog.read`
- `catalog.install`
- `credential.use`

## Approval gates

### Internal DryLake actions

DryLake tools may mutate persisted DryLake state without an extra approval prompt when all of the following are true:

- the action stays inside DryLake storage
- the action does not touch credentials
- the action does not trigger provisioning

### External reads

External reads are allowed only when:

- the recipe is enabled
- the exact read scope is declared on the recipe
- the tool call declares why the read is needed
- the workspace policy permits the scope

If any of the above is unclear, DryLake must deny the read instead of widening scope.

### External writes

Every external write requires:

- a connected recipe with the exact write scope enabled
- a human-readable approval summary
- a live approval artifact or client-side confirmation token
- an audit log entry for request, decision, and execution outcome

Write approvals do not persist as blanket consent. They apply only to the approved action summary.

### Prohibited actions without separate approval

- provisioning or infrastructure creation
- credential creation, rotation, or deletion
- billing-impacting cloud operations
- destructive filesystem actions

## MVP recipe policy

### GitHub

GitHub is the only MVP gateway recipe.

- Default state: disabled until configured by the user
- Default scopes when enabled:
  - `repo.metadata.read`
  - `repo.files.read`
  - `issues.read`
  - `pull_requests.read`
- Disabled by default:
  - all write scopes
  - branch creation
  - pull request creation
  - issue/comment mutation

### Jira plus Confluence

vNext recipe target. Read-only by default if implemented later.

### Sentry

vNext recipe target. Read-only error and trace access by default if implemented later.

### Playwright and Figma

vNext recipe targets. Treat browser actions and design comments as separate approval surfaces from ordinary reads.

## Audit requirements

Every permission decision must emit an audit event with:

- `planId`
- `phaseId`
- `toolName`
- `recipeId` when external access is involved
- `requestedScopes`
- `approvalState`
- `outcome`
- `summary`

## Safe fallback behavior

When an external read is denied or unavailable, DryLake must still continue with a local-only plan or handoff whenever possible and must state that the result was generated without recipe enrichment.
