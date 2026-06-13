# DryLake Audit Log Format

## Purpose

The audit log must explain what DryLake did, why it was allowed, and what state changed. It is the authoritative trace for tool calls, resource reads, permission decisions, and handoff generation.

## Entry shape

Each audit entry uses the following canonical fields:

- `auditId`
- `timestamp`
- `actorType`
- `actorId`
- `sessionId`
- `planId`
- `phaseId`
- `toolName`
- `action`
- `targetType`
- `targetId`
- `recipeId`
- `requestedScopes`
- `approvalState`
- `outcome`
- `summary`
- `resourceUris`
- `tokenImpact`
- `metadata`

## Stable enums

### `actorType`

- `user`
- `agent`
- `system`

### `targetType`

- `plan`
- `phase`
- `handoff`
- `resource`
- `recipe`
- `external_system`
- `approval`

### `approvalState`

- `not_required`
- `pending`
- `granted`
- `denied`

### `outcome`

- `succeeded`
- `failed`
- `denied`
- `skipped`

## Recommended action names

- `plan.created`
- `plan.updated`
- `phase.read`
- `resource.read`
- `token_budget.estimated`
- `agent.recommended`
- `handoff.created`
- `handoff.read`
- `recipe.read.requested`
- `recipe.read.allowed`
- `recipe.read.denied`
- `recipe.write.requested`
- `recipe.write.approval_requested`
- `recipe.write.approval_granted`
- `recipe.write.approval_denied`
- `recipe.write.executed`

## Redaction rules

- Never store raw credentials or authorization headers.
- If a prompt or ticket contains secrets, redact them before persistence and mark `metadata.redacted = true`.
- Keep `summary` concise enough for review, but do not store unrelated full-ticket payloads when a phase URI is sufficient.

## Retention rules for MVP

- Keep full audit entries for all persisted plans and handoffs.
- Keep token estimation history because it supports later savings analysis.
- Store only references to external resources when the content itself is large or sensitive.
