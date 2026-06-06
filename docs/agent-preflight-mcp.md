# DryLake Agent Preflight MCP

DryLake Agent Preflight MCP is the agent-facing service layer for DryLake.

It is not a coding agent. It is the planning and assurance layer a coding agent calls before editing code.

## Product Contract

Agents call DryLake before coding and receive:

- structured phase plan
- token budget
- next-phase contract
- focused handoff
- validation, rollback, and risk outputs for the Validated tier
- owner/team audit visibility in later workspace tiers

## V1 Scope

V1 exposes one required MCP tool:

```text
drylake_preflight
```

Supporting tools such as `drylake_get_next_phase`, `drylake_create_handoff`, and `drylake_update_phase_status` come after the first paid/trial preflight loop is working.

## API Flow

Anonymous trial discovery:

```http
POST /api/agents/register
```

Returns one raw token once:

```json
{
  "status": "registered",
  "agent_id": "ag_...",
  "agent_token": "dlk_trial_...",
  "plan": "agent_trial",
  "free_credits": 3,
  "expires_in_hours": 72,
  "price_per_basic_preflight_usd": 1,
  "buy_credits_url": "https://drylake.xupracorp.com/agent-billing/ag_..."
}
```

Preflight execution:

```http
POST /api/preflight
Authorization: Bearer dlk_trial_or_agent_token
```

Input:

```json
{
  "task": "Add password reset to the login flow",
  "target_agent": "cursor",
  "source_client": "cursor",
  "tier": "basic",
  "repo_summary": "Optional bounded repo summary"
}
```

Basic Preflight costs 1 credit. Validated Preflight costs 3 credits.

When credits are exhausted, the API returns HTTP 402 with:

```json
{
  "status": "payment_required",
  "buy_credits_url": "https://drylake.xupracorp.com/agent-billing/ag_...",
  "credit_packs": [
    { "price_usd": 10, "credits": 10 },
    { "price_usd": 25, "credits": 25 },
    { "price_usd": 100, "credits": 100 }
  ]
}
```

## MCP Package

Package:

```text
@xupracorp/drylake-mcp
```

Run:

```bash
npx -y @xupracorp/drylake-mcp
```

Environment:

```bash
DRYLAKE_API_BASE_URL=https://drylake.xupracorp.com
DRYLAKE_AGENT_TOKEN=dlk_agent_or_trial_token
```

If `DRYLAKE_AGENT_TOKEN` is missing, the MCP server registers a 72-hour trial agent token.

## A2A Discovery

Agent Card:

```text
/.well-known/agent-card.json
```

The Agent Card advertises:

- `agent_preflight`
- `validated_preflight`
- `create_handoff`

V1 uses A2A for discovery, not full remote task execution. Full A2A task/session execution should wait until billing, owner visibility, and audit history are stable.

## Security Constraints

- Trial agents are anonymous and short-lived.
- Raw tokens are returned once and stored only as hashes.
- Trial agents cannot use external integrations.
- Trial preflight input is length-limited.
- DryLake stores task preview and hash, not raw source code.
- No shell execution is exposed through the MCP server.
- Credit debit is refunded if server-side generation fails.

## Registry Metadata

MCP Registry name:

```text
io.github.gmkdigitalmedia/drylake-mcp
```

The npm package includes matching `mcpName` metadata and `server.json`.
