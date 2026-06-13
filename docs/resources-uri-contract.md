# DryLake Resource URI Contract

## General rules

- Resource URIs are workspace-scoped and must never cross tenant boundaries.
- JSON resources return canonical JSON envelopes.
- Text resources return canonical text plus metadata in the MCP read wrapper.
- Resource reads are side-effect free except for audit logging.

## `drylake://plans/current`

Returns the current active plan for the workspace or session.

- Content type: `application/json`
- Cache rule: no long-lived caching
- Not found behavior: `not_found`

### Canonical payload

- `kind`: `plan`
- `planId`
- `title`
- `status`
- `summary`
- `constraints`
- `phases`
- `currentPhaseId`
- `resourceUris`
- `updatedAt`

## `drylake://plans/{planId}`

Returns the full persisted plan snapshot.

- Content type: `application/json`
- Cache rule: cacheable by revision if the response includes `revision`
- Not found behavior: `not_found`

### Canonical payload

- `kind`: `plan`
- `planId`
- `revision`
- `title`
- `status`
- `purpose`
- `constraints`
- `phases`
- `tokenBudget`
- `resourceUris`
- `createdAt`
- `updatedAt`

## `drylake://phases/{phaseId}`

Returns one phase without re-sending unrelated plan context.

- Content type: `application/json`
- Cache rule: cacheable by revision
- Not found behavior: `not_found`

### Canonical payload

- `kind`: `phase`
- `phaseId`
- `planId`
- `revision`
- `title`
- `status`
- `objective`
- `inputs`
- `outputs`
- `steps`
- `acceptance`
- `recommendedAgent`
- `dependencies`
- `handoffUris`
- `updatedAt`

## `drylake://handoffs/{phaseId}/markdown`

Returns the latest handoff Markdown for the phase.

- Content type: `text/markdown`
- Cache rule: immutable by `handoffId` or `revision`
- Not found behavior: `not_found`

### Canonical text sections

- Title line with plan and phase identity
- Objective
- Constraints
- Required context references
- Execution instructions
- Validation checklist
- Next calls

## `drylake://handoffs/{phaseId}/shell`

Returns the latest shell handoff for the phase.

- Content type: `text/x-shellscript`
- Cache rule: immutable by `handoffId` or `revision`
- Not found behavior: `not_found`

### Canonical text sections

- Safety preamble
- Working directory assumptions
- Ordered commands
- Validation commands
- Stop conditions

## `drylake://handoffs/{phaseId}/json`

Returns the structured handoff object for automation-safe clients.

- Content type: `application/json`
- Cache rule: immutable by `handoffId` or `revision`
- Not found behavior: `not_found`

### Canonical payload

- `kind`: `handoff`
- `handoffId`
- `planId`
- `phaseId`
- `targetAgent`
- `summary`
- `instructions`
- `constraints`
- `resourceUris`
- `nextCalls`
- `tokenEstimate`
- `createdAt`

## `drylake://token-budget/{planId}`

Returns the current token budget and recent estimates for a plan.

- Content type: `application/json`
- Cache rule: short-lived cache only
- Not found behavior: `not_found`

### Canonical payload

- `kind`: `token_budget`
- `planId`
- `budget`
- `latestEstimate`
- `phaseEstimates`
- `compressionPolicy`
- `updatedAt`

## `drylake://audit-log/{planId}`

Returns paginated audit history for the plan.

- Content type: `application/json`
- Cache rule: never treat as immutable
- Not found behavior: `not_found`
- Query parameters:
  - `limit`: optional integer, default 50, max 200
  - `cursor`: optional opaque pagination token

### Canonical payload

- `kind`: `audit_log`
- `planId`
- `entries`
- `nextCursor`
- `updatedAt`

## Read errors

All resource reads use these stable error codes:

- `not_found`
- `permission_denied`
- `invalid_uri`
- `unsupported_format`
- `internal_error`

## Deferred resource backlog

- `drylake://recipes`
- `drylake://recipes/{recipeId}`
- `drylake://compatibility/{clientId}`
- `drylake://handoffs/{phaseId}/diff`
- `drylake://approvals/{approvalId}`
