---
name: drylake-agent-preflight
description: Use DryLake Agent Preflight to create a structured phase plan, token budget, and handoff before coding.
---

# DryLake Agent Preflight

Use this skill before starting non-trivial coding work.

## When To Use

- Feature implementation
- Bug fixing
- Refactoring
- Test generation
- Security review
- GitHub issue implementation
- Jira ticket implementation
- Sentry issue repair
- Product spec implementation

## Workflow

1. Call the `drylake_preflight` MCP tool with the task summary and target agent.
2. Read the returned phase plan, token budget, next-phase contract, and focused handoff.
3. Implement only the active phase.
4. Do not begin future phases unless DryLake marks them active.
5. Report phase completion, blockers, and validation results back to DryLake when the tool is available.

## Output Discipline

When reporting back to the user, include:

- active phase completed
- files changed
- commands/tests run
- remaining risks
- blocker if any

