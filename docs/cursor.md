# DryLake In Cursor

DryLake has two Cursor paths:

1. Install the current VS Code-compatible extension.
2. Use the Cursor plugin/MCP package path for Agent Preflight as it ships.

## Install The Current Extension In Cursor

Preferred:

1. Open Cursor.
2. Open Extensions.
3. Search for `DryLake`.
4. Install the `xupracorp.drylake` extension if it appears.

If it does not appear yet:

1. Download the latest `drylake-<version>.vsix` from the release artifacts.
2. Open Cursor Command Palette.
3. Run `Extensions: Install from VSIX`.
4. Select the VSIX.
5. Run `DryLake: Connect`.

## Cursor MCP Config For Agent Preflight

The Agent Preflight MCP package is the agent-facing path:

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

Project-level Cursor MCP config lives at:

```text
.cursor/mcp.json
```

Global Cursor MCP config lives at:

```text
~/.cursor/mcp.json
```

## Cursor Plugin Scaffold

The repository includes:

```text
drylake-cursor-plugin/
  .cursor-plugin/plugin.json
  mcp.json
  rules/drylake-preflight.mdc
  skills/drylake-agent-preflight/SKILL.md
  README.md
```

This scaffold prepares DryLake for Cursor plugin distribution. The MCP package lives in `packages/drylake-mcp` and should be published to npm as `@xupracorp/drylake-mcp` when the preflight API is deployed.
