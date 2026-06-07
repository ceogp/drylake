# DryLake Guard Roadmap

DryLake Guard is the local-first trust and risk layer for AI coding setups.

The first implementation milestone is the local Agentic IDE Map:

- agent and skill inventory
- extension inventory with inferred access
- MCP and tool connection inventory
- private local Safe Developer Rank report

The following milestones are intentionally deferred so the product can be built and tested step by step.

## Milestone 4: Risky Workspace Surface

Status: implemented in the local scanner. Future work is tuning the rule weights and adding paid cloud enrichment.

Expand local scanning beyond agent, extension, and MCP inventory.

Scan metadata for:

- `.env` and `.env.example` variable names only
- package scripts
- lockfiles
- CI/CD workflows
- deploy scripts
- Docker, Terraform, Kubernetes, and cloud config files
- credential-like file names
- large generated folders that should be excluded from agent context

Rules:

- never upload source code
- never store secret values
- store only file path, variable name, type, severity, and recommendation

## Milestone 5: Capability Graph

Create a structured graph that explains how the local setup fits together.

Graph examples:

- IDE -> Extension -> Command/Contribution
- IDE -> Agent Config -> Skill/Rule
- IDE -> MCP Server -> Tool Capability
- MCP Server -> Env Var Name
- Workspace -> Deploy Script
- Workspace -> Secret Hint
- Agent -> Instruction File

Primary output:

- `.drylake/reports/agentic-map.json`

## Milestone 6: Safe Developer Rank Scoring

Stabilize the scoring model and tune finding weights.

Scores:

- MCP Risk Score
- Agent Reliability Score
- Secret Hygiene Score
- IDE Bloat Score
- Token Waste Score

Ranks:

- Scout: 0-49
- Builder: 50-69
- Operator: 70-84
- Guardian: 85-94
- Sentinel: 95-100

## Milestone 7: Shareable Trust Artifacts

Add explicit user-approved sharing.

Artifacts:

- redacted Safe Developer Rank summary
- README badge
- repo badge
- vendor verification request
- team comparison summary

Public reports must exclude:

- source code
- secret values
- raw `.env` contents
- private repo names unless approved
- private file contents

## Milestone 8: Team Baseline

Create team policy files and comparison flows.

Output:

- `.drylake/team-baseline.yaml`

Baseline fields:

- approved MCP server names
- approved extension IDs
- required instruction files
- minimum score thresholds
- prohibited env var patterns
- no secret values

## Milestone 9: Backend Guard Control Plane

Add cloud features only after local trust is working.

Backend responsibilities:

- device/workspace enrollment
- scan history
- before/after comparison
- team dashboard
- approved extension catalog
- approved MCP catalog
- vendor verification workflow
- risk intelligence
- billing gates

## Milestone 10: Continuous Watch

Add local event monitoring.

Watch for:

- new extension installed
- MCP config changed
- `.env` changed
- new skill/rule/instruction file added
- Safe Developer Rank changed
- risky file appeared

## Milestone 11: Policy And Enforcement

Start with recommendations, then add managed enforcement.

Modes:

- Observe
- Warn
- Managed
- Lockdown

Policy examples:

- block unknown MCP servers
- warn on unpinned `npx`
- block secrets exposed to agents
- require known extension publishers
- require approval for deploy/delete/database/payment tools
- quarantine suspicious skills
- require minimum Safe Developer Rank

## Milestone 12: Local Guard Daemon

Add only when extension-level visibility is not enough.

A daemon can monitor:

- filesystem changes
- process launches
- network destinations
- suspicious extension updates
- MCP process execution
- protected path access

This is the path toward Norton/McAfee-style endpoint enforcement for AI-enabled IDEs.
