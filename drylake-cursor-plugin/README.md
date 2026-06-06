# DryLake Agent Preflight For Cursor

DryLake Agent Preflight makes Cursor ask DryLake for a structured plan before coding.

The plugin includes:

- Cursor rule: use DryLake before non-trivial coding work.
- Cursor skill: agent preflight workflow.
- MCP config: planned `@xupracorp/drylake-mcp` server.

## MCP Setup

Add a DryLake agent token:

```bash
export DRYLAKE_AGENT_TOKEN="dlk_agent_xxx"
```

The plugin MCP config runs:

```bash
npx -y @xupracorp/drylake-mcp
```

## Current Status

This scaffold is prepared for the Agent Preflight MCP service. Until the MCP package is published, install the current DryLake VSIX in Cursor for the visual planning extension.

