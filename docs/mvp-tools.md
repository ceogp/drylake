# DryLake MVP Tools

## Scope

These are the only DryLake MCP tools that Phase 2 may implement without a contract change:

- `drylake_create_plan`
- `drylake_estimate_tokens`
- `drylake_recommend_agent`
- `drylake_create_handoff`

All four tools may write DryLake's own persisted state. None may perform external writes in MVP.

## `drylake_create_plan`

Creates or refreshes a plan from a user objective plus optional external context references.

- Primary use: turn a ticket, epic, or workflow request into a persisted plan with ordered phases
- Internal state mutation: yes
- External reads: optional, recipe-scoped, read-only
- External writes: forbidden

### Inputs

- `objective`: string, required
- `sourceText`: string, optional
- `requestedPhaseCount`: integer from 1 to 12, optional
- `constraints`: string array, optional
- `externalContextRefs`: array of recipe or resource references, optional
- `agentPreferences`: string array, optional
- `tokenBudget`: optional object with `maxInputTokens` and `maxOutputTokens`

### Outputs

- `planId`
- `title`
- `status`
- `summary`
- `phases`
- `resourceUris`
- `auditEventIds`
- `warnings`

### Error modes

- `invalid_input`
- `permission_denied`
- `external_context_not_allowed`
- `external_context_unavailable`
- `token_budget_invalid`
- `internal_error`

## `drylake_estimate_tokens`

Produces a heuristic token estimate for a prompt, resource, or handoff and recommends a safer compression strategy when needed.

- Primary use: budget planning before generating or sending a phase handoff
- Internal state mutation: optional token-budget snapshot update
- External reads: no
- External writes: forbidden

### Inputs

- `content`: string or structured object, required
- `contentType`: `prompt | resource | handoff | phase`
- `planId`: string, optional
- `phaseId`: string, optional
- `targetAgent`: string, optional
- `targetModel`: string, optional
- `compressionMode`: `none | phase_only | summarize | resource_refs`

### Outputs

- `estimateId`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `confidence`
- `recommendedCompression`
- `estimatedSavingsTokens`
- `assumptions`
- `resourceUri`

### Error modes

- `invalid_input`
- `unsupported_target`
- `estimation_unavailable`
- `internal_error`

## `drylake_recommend_agent`

Chooses the best agent profile for a phase and explains the decision.

- Primary use: select the execution target before generating a handoff
- Internal state mutation: optional phase recommendation snapshot update
- External reads: no
- External writes: forbidden

### Inputs

- `planId`: string, optional
- `phaseId`: string, optional
- `objective`: string, required when `phaseId` is omitted
- `constraints`: string array, optional
- `availableAgents`: string array, optional
- `availableSkills`: string array, optional
- `workspaceSignals`: optional object containing language, framework, and repo cues

### Outputs

- `recommendedAgent`
- `confidence`
- `rationale`
- `suggestedSkills`
- `fallbackAgents`
- `warnings`

### Error modes

- `invalid_input`
- `plan_not_found`
- `phase_not_found`
- `no_eligible_agent`
- `internal_error`

## `drylake_create_handoff`

Generates phase-scoped handoff artifacts for a target agent and stores them as retrievable resources.

- Primary use: create the actual execution package for a single phase
- Internal state mutation: yes
- External reads: no in MVP
- External writes: forbidden

### Inputs

- `planId`: string, required
- `phaseId`: string, required
- `targetAgent`: string, required
- `agentProfile`: string, optional
- `ticketSnippet`: string, optional
- `constraints`: string array, optional
- `compressionMode`: `none | phase_only | summarize | resource_refs`
- `formats`: array containing one or more of `markdown`, `shell`, `json`

### Outputs

- `handoffId`
- `phaseId`
- `targetAgent`
- `summary`
- `artifacts`
- `resourceUris`
- `tokenEstimate`
- `nextCalls`
- `auditEventIds`
- `warnings`

### Error modes

- `invalid_input`
- `plan_not_found`
- `phase_not_found`
- `unsupported_format`
- `handoff_generation_failed`
- `internal_error`

## Non-MVP backlog

These are intentionally deferred and should not be implemented during the MVP server phase without a new approval pass.

- `drylake_get_plan`
- `drylake_get_next_phase`
- `drylake_update_phase_status`
- `drylake_list_recipes`
- `drylake_enable_recipe`
- `drylake_request_external_write_approval`
- `drylake_setup_check`
- `drylake_validate_handoff`
- `drylake_attach_skill`
- `drylake_sync_audit_export`
