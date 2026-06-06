# DryLake Agent Preflight MCP

DryLake Agent Preflight is a planning and assurance layer for coding agents.

The MCP server exposes one required v1 tool:

- `drylake_preflight`

Use it before a coding agent edits files for a non-trivial feature, bug fix, refactor, test-generation task, GitHub issue, Jira ticket, Sentry issue, or product spec.

## Install

```bash
npx -y @xupracorp/drylake-mcp
```

## Environment

```bash
export DRYLAKE_API_BASE_URL="https://drylake.xupracorp.com"
export DRYLAKE_AGENT_TOKEN="dlk_agent_or_trial_token"
```

If `DRYLAKE_AGENT_TOKEN` is missing, the MCP server registers a 72-hour trial agent token with 3 Basic Preflight credits.

## Cursor MCP Config

```json
{
  "mcpServers": {
    "drylake": {
      "command": "npx",
      "args": ["-y", "@xupracorp/drylake-mcp"],
      "env": {
        "DRYLAKE_API_BASE_URL": "https://drylake.xupracorp.com",
        "DRYLAKE_AGENT_TOKEN": "${DRYLAKE_AGENT_TOKEN}"
      }
    }
  }
}
```

## Tool

### `drylake_preflight`

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

Output:

- phase plan
- token budget
- next-phase contract
- focused handoff
- assurance outputs for `validated` tier
- payment URL when credits are exhausted

<!-- mcp-name: io.github.gmkdigitalmedia/drylake-mcp -->
