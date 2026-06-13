# DryLake MCP Surfaces

## Status

This document is the Phase 1 source of truth for DryLake's MCP surfaces. Phase 2 implementation must conform to these contracts and must not rename tools, resources, or prompts without an explicit contract revision.

## Naming rules

- Tool names use `drylake_*` snake_case to match existing runbook and handoff naming.
- Tool input and output properties use camelCase to match the TypeScript and API conventions already used in this repository.
- Resource URIs use the `drylake://` scheme with stable nouns: `plans`, `phases`, `handoffs`, `token-budget`, `audit-log`.
- Prompt names use slash-command style with a stable namespace: `/drylake.*`.

## Surface 1: DryLake MCP server

The DryLake MCP server is the product's canonical surface.

- Required MVP tools: `drylake_create_plan`, `drylake_estimate_tokens`, `drylake_recommend_agent`, `drylake_create_handoff`
- Required MVP resources:
  - `drylake://plans/current`
  - `drylake://plans/{planId}`
  - `drylake://phases/{phaseId}`
  - `drylake://handoffs/{phaseId}/markdown`
  - `drylake://handoffs/{phaseId}/shell`
  - `drylake://handoffs/{phaseId}/json`
  - `drylake://token-budget/{planId}`
  - `drylake://audit-log/{planId}`
- Required MVP prompts:
  - `/drylake.plan_ticket`
  - `/drylake.implement_phase`
  - `/drylake.review_phase`
  - `/drylake.generate_tests`
  - `/drylake.debug_phase`
  - `/drylake.refactor_phase`
  - `/drylake.prepare_pr`
  - `/drylake.compress_handoff`

## Surface 2: DryLake MCP gateway

The gateway is a policy-enforced MCP client for user-supplied external servers.

- Integration model: recipe-driven only
- MVP recipe target: GitHub
- vNext recipes: Jira plus Confluence, Sentry, Playwright, Figma
- Default behavior: no external read unless the recipe is enabled and the requested scope is explicit
- External writes: always require a separate approval gate even when a recipe is already connected

## Surface 3: DryLake installer and registry

The installer and registry layer generates safe configuration snippets instead of hardcoding third-party integrations.

- Primary responsibility: emit client-specific MCP configuration for trusted DryLake and recipe endpoints
- Optional discovery layer: Docker MCP Catalog integration
- Security rule: generated snippets must preserve least privilege and keep write scopes disabled by default

## Prompt template variables

All published prompt templates may use the following variables. Each template uses a subset.

- `planId`: stable DryLake plan identifier
- `phaseId`: stable DryLake phase identifier
- `ticketSnippet`: concise problem statement or task excerpt
- `constraints`: list of explicit constraints to preserve
- `agentProfile`: selected agent plus skills and execution hints

## Interop rules

- Tools are the mandatory compatibility surface. Every critical workflow must be completable with tools only.
- Resources are the preferred context surface for clients that support `resources/list` and `resources/read`.
- Prompts are convenience surfaces and must never be the only way to use a DryLake workflow.
- Handoffs must stay phase-scoped. Do not require clients to re-ingest the full plan when a phase resource or handoff resource exists.

## Client compatibility checklist

| Client | Tools | Resources | Prompts | Working rule |
| --- | --- | --- | --- | --- |
| Claude Code | Yes | Yes | Yes | Treat as first-class for the full DryLake surface. |
| Cursor | Yes | Yes | Yes | Treat as first-class for the full DryLake surface. |
| Gemini CLI | Yes | Yes | Yes | Treat as first-class, but preserve explicit env allowlists for recipes. |
| VS Code Copilot Chat local agent mode | Yes | Yes | Yes | Full surface is valid in local agent/chat mode. |
| GitHub Copilot cloud agent | Yes | No | No | Use DryLake tools only; do not depend on resources or prompts. |
| OpenAI Agents | Yes | Tool-oriented only | Tool-oriented only | Treat tools as the guaranteed surface. Resource and prompt behaviors must have tool fallbacks. |

The last two rows are intentionally stricter than the protocol itself. DryLake should optimize for the lowest common denominator when a workflow must run across clients.

OpenAI Agents support is an inference from current OpenAI MCP documentation, which documents MCP as a built-in tool type and does not describe separate prompt or resource discovery surfaces.

## Deferred backlog

### Tools

- `drylake_get_plan`
- `drylake_get_next_phase`
- `drylake_update_phase_status`
- `drylake_list_recipes`
- `drylake_enable_recipe`
- `drylake_request_external_write_approval`
- `drylake_setup_check`
- `drylake_validate_handoff`
- `drylake_attach_skill`

### Resources

- `drylake://recipes`
- `drylake://recipes/{recipeId}`
- `drylake://compatibility/{clientId}`
- `drylake://handoffs/{phaseId}/diff`
- `drylake://approvals/{approvalId}`

### Prompts

- `/drylake.enable_recipe`
- `/drylake.setup_registry`
- `/drylake.approve_write`
- `/drylake.resume_next_phase`

## Source files

- Human-readable tool contract: [mvp-tools.md](mvp-tools.md)
- Human-readable resource contract: [resources-uri-contract.md](resources-uri-contract.md)
- Permission model: [permission-model.md](permission-model.md)
- Machine-readable tool schemas: [tools.json](../services/drylake-mcp/mcp-schema/tools.json)
- Machine-readable resource schemas: [resources.json](../services/drylake-mcp/mcp-schema/resources.json)
- Machine-readable prompt schemas: [prompts.json](../services/drylake-mcp/mcp-schema/prompts.json)
