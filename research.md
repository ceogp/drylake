# DryLake Research: Agent Preflight, Planning, And Signup Strategy

Date: 2026-06-07

## Executive Thesis

DryLake should not compete as another coding agent. The market already has many agents trying to write code. DryLake should become the **planning and assurance control plane for coding agents**.

The clearest product promise is:

> Make coding agents follow a plan before they touch code.

DryLake should sell structured preflight planning to agents and visibility to humans:

- Agents get a phase plan, token budget, next-phase contract, and focused handoff.
- Humans get owner visibility, audit history, usage tracking, reusable skills, and upgrade controls.
- Teams get safer agent execution: risk review, validation checklists, rollback instructions, and policy gates.

This has a real wedge because MCP and A2A are becoming discovery and interoperability layers for agents, but neither protocol alone solves planning quality, task scoping, cost control, or human owner visibility.

## Research Signals

### MCP Is Becoming The Agent-To-Tool Standard

The official MCP docs describe MCP servers as programs that expose capabilities to AI applications through standardized interfaces. MCP servers expose three important building blocks: tools, resources, and prompts. Tools let models perform actions, resources provide context data, and prompts provide reusable instruction templates.

Source: [MCP server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)

VS Code now supports MCP as a first-class way to extend AI agents with tools, prompts, and resources.

Source: [VS Code MCP developer guide](https://code.visualstudio.com/docs/copilot/guides/mcp-developer-guide)

Cursor supports MCP servers for connecting agents to external tools and data sources, including local `stdio`, SSE, and Streamable HTTP transports.

Source: [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol)

Claude Code supports MCP for connecting to external tools, databases, and APIs.

Source: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

OpenAI Agents SDK supports MCP servers as tools, including hosted MCP server tools.

Source: [OpenAI Agents SDK MCP docs](https://openai.github.io/openai-agents-js/guides/mcp/)

### A2A Gives DryLake A Discovery Surface

A2A agents can publish an Agent Card at:

```text
https://{domain}/.well-known/agent-card.json
```

That card tells other agents what the service can do and how to reach it.

Source: [Microsoft A2A Agent docs](https://learn.microsoft.com/en-us/agent-framework/agents/providers/agent-to-agent)

DryLake already has the right basic discovery primitive: an Agent Card advertising planning/preflight skills. The next step is to make the card more useful with pricing, auth, example payloads, and links to the MCP package.

### Tool Explosion Creates A Planning Problem

The MCP client best practices docs warn that naive hosts break down as agents connect to many servers and hundreds or thousands of tools. They recommend progressive discovery and dynamic server management instead of dumping every tool into the model context.

Source: [MCP client best practices](https://modelcontextprotocol.io/docs/develop/clients/client-best-practices)

This supports DryLake's positioning. DryLake does not need to be the biggest tool list. It should be the tool that decides:

- what the task actually is,
- which phase should run now,
- which agent should receive the handoff,
- what context belongs in the prompt,
- what validation must happen before the next phase.

### MCP Registry Can Make DryLake Discoverable

The MCP Registry does not host the package artifact itself; it stores metadata and points to packages such as npm packages. For npm packages, the registry verifies ownership with `mcpName` in `package.json`.

Sources:

- [MCP Registry quickstart](https://modelcontextprotocol.io/registry/quickstart)
- [MCP Registry package types](https://modelcontextprotocol.io/registry/package-types)

This means DryLake should publish:

- npm package: `@xupracorp/drylake-mcp`
- MCP name: `io.github.gmkdigitalmedia/drylake-mcp`
- `server.json` metadata
- public docs page explaining install and pricing

## What The System Should Be

DryLake should be:

> A paid planning, preflight, and assurance layer that coding agents call before coding.

The system should have three surfaces.

### 1. Human Surface

This is the website and VS Code/Cursor extension.

Purpose:

- sign up,
- connect editor,
- create planning cards,
- assign agents and skills,
- track usage,
- view prompts/handoffs,
- buy credits or upgrade.

Human value:

- "I can see what my agents are doing."
- "I can stop agents from wandering."
- "I can reduce token waste."
- "I can reuse good skills and planning workflows."

### 2. Agent Surface

This is the MCP package and API.

Primary tool:

```text
drylake_preflight
```

The tool should return:

- plan title,
- phase list,
- active phase,
- next-phase contract,
- focused handoff prompt,
- token budget,
- remaining credits,
- audit URL.

For paid validated preflights, it should also return:

- risk classification,
- test checklist,
- rollback plan,
- dependency impact review,
- validation phase.

Agent value:

- "I get a scoped contract before I edit files."
- "I know the current phase and exit criteria."
- "I can avoid dumping the whole issue into every prompt."
- "I can tell the human what I am about to do."

### 3. Owner/Team Surface

This is the paid workspace layer.

Purpose:

- connected agent tokens,
- usage by agent/client,
- plan and handoff history,
- prompt hashes/previews,
- audit log,
- policy gates,
- billing and credits.

Owner value:

- "I know which agent used which plan."
- "I can prove what was handed off."
- "I can control free/pro/team usage."
- "I can see whether DryLake saves tokens and time."

## Why Agents Should Use DryLake

Agents should use DryLake because it gives them better task contracts.

### 1. Agents Are Bad At Scope Without A Contract

Coding agents can edit files and run tools, but they often overreach when the task is broad. A DryLake preflight narrows the task into a phase with allowed scope and exit criteria.

This is the core reason for DryLake:

> Turn ambiguous work into a phase contract.

### 2. Agents Waste Tokens Without Planning

If every coding run receives the full ticket, full product spec, and full repo context, the agent pays for repeated context. DryLake can split the work into smaller prompts and estimate the token budget before handoff.

The message should be:

> Save tokens by sending agents only the phase they need.

### 3. Agents Need A Standard Way To Ask For Planning

MCP gives agents a standard way to call external tools. DryLake should make planning available as a simple MCP tool. The tool should be useful even when the user has never opened the DryLake UI.

The easiest adoption path:

```bash
npx -y @xupracorp/drylake-mcp
```

Then the agent can call:

```text
drylake_preflight
```

### 4. Agents Need Human-Readable Handoffs

DryLake should always produce a handoff that a human can inspect. The handoff should be readable Markdown, not only JSON.

This matters because humans will trust DryLake faster if they can see:

- phase objective,
- files to inspect,
- allowed scope,
- forbidden scope,
- commands/tests,
- acceptance criteria,
- rollback plan.

### 5. Agents Need Better Error States

An agent should not fail silently when planning is unavailable. DryLake should return machine-readable states:

- `agent_token_missing`
- `agent_token_expired`
- `payment_required`
- `upgrade_required`
- `validation_failed`
- `planning_model_failed`

Good error states make DryLake more agent-friendly than a normal SaaS UI.

## Why People Should Sign Up

Humans should sign up because DryLake gives them something they cannot get from a single coding agent: **control and visibility across agents**.

### 1. Owner Visibility

People want to know:

- what task was planned,
- what prompt was handed to the agent,
- which agent ran it,
- which skill/profile was attached,
- how many tokens were estimated,
- whether the task completed or got blocked.

That is a strong reason to create an account.

### 2. Saved Planning History

Without an account, plans disappear or stay local. With an account, users should get:

- saved plans,
- saved handoffs,
- reusable workflows,
- agent usage history,
- audit links.

### 3. Better Free Product

The free product should not feel like a wall. It should feel useful quickly:

- sign up free,
- no credit card,
- 3 to 10 preflight credits,
- create a plan,
- assign an agent,
- run one handoff,
- see token estimate and audit record.

The signup ask becomes reasonable if the user gets value immediately after registration.

### 4. Paid Assurance

The paid reason should not be "more AI." It should be:

> Make agent work safer before it touches code.

Paid tiers should include:

- validated preflights,
- risk classification,
- test checklist,
- rollback instructions,
- dependency impact review,
- audit history,
- owner/team visibility.

Call this **DryLake Assurance**, not insurance.

## How To Get More Agents And People To Sign Up Without Many Users

The lack of users is not fatal if DryLake becomes useful from the first call. The product should not depend on social proof yet. It should depend on immediate utility.

### Strategy 1: Make The Agent The Acquisition Channel

The agent should be able to discover and try DryLake without a human filling out a form first.

Recommended flow:

1. Agent sees `drylake_preflight`.
2. Agent calls it without a token.
3. DryLake creates a short-lived trial token.
4. DryLake returns a useful preflight.
5. After free credits run out, DryLake returns `payment_required`.
6. Human sees the plan quality and buys credits or signs up.

This works because the agent becomes the salesperson:

> "DryLake planned this task. Connect your account to save the plan and continue."

### Strategy 2: Publish Everywhere Agents Look

Priority order:

1. npm package: `@xupracorp/drylake-mcp`
2. MCP Registry listing
3. VS Code Marketplace
4. Open VSX
5. Cursor plugin submission
6. GitHub Releases with VSIX
7. `/mcp`, `/cursor`, `/agents`, `/preflight` landing pages
8. A2A Agent Card at `/.well-known/agent-card.json`

The goal is not one marketplace. The goal is repeated discovery across every place agents and developers search.

### Strategy 3: Build One Excellent Demo Workflow

The demo should not say "1 prompt, 4 agents." That is abstract.

The demo should show:

1. user signs in,
2. asks for a real task,
3. DryLake creates 6 phases,
4. user selects different agents and skills,
5. agent runs phase 1,
6. terminal opens,
7. phase waits for completion/approval,
8. next phase starts,
9. final screen shows token estimate, completed phases, and audit link.

The message should be:

> Planning cards turn messy AI work into controlled agent execution.

### Strategy 4: Use Specific Landing Pages

Do not rely on one generic homepage. Make pages that match search intent:

- `/claude-code-planning`
- `/cursor-agent-preflight`
- `/codex-handoffs`
- `/mcp-agent-preflight`
- `/free-ai-planning`
- `/token-aware-agent-handoffs`
- `/drylake-assurance`

Each page should include:

- one workflow image/GIF,
- install command,
- what the agent gets,
- what the human sees,
- free signup CTA.

### Strategy 5: Make DryLake Useful Even If The User Has One Agent

Do not over-sell multi-agent orchestration yet. A lot of users only use Claude Code, Cursor, or Codex.

Position DryLake as:

> Planning for your favorite coding agent.

Then show multi-agent workflows as an advanced use case.

### Strategy 6: Publish Example Repos

Create public example repos:

- `drylake-example-claude-code`
- `drylake-example-cursor`
- `drylake-example-codex`
- `drylake-example-mcp-preflight`

Each repo should contain:

- `.drylake/plan.md`
- `.drylake/phases/*.md`
- `.cursor/rules/drylake-preflight.mdc`
- `AGENTS.md`
- README showing before/after token savings

This creates proof even before you have many users.

### Strategy 7: Turn Reports Into Product Proof

The dashboard should show:

- preflights created,
- handoffs created,
- average prompt token estimate,
- token reduction estimate,
- top agents,
- top skills,
- phase completion rate,
- blocked phases,
- validation failures.

This makes DryLake feel real. People pay when they can see the system producing operational data.

## What To Build Next

### Phase 1: Publish And Make Discovery Work

Must ship:

- npm package `@xupracorp/drylake-mcp`
- Open VSX publish
- Cursor plugin submission package
- MCP Registry listing
- public `/mcp` landing page
- public `/agents` landing page
- stronger Agent Card with pricing and auth notes

Success metric:

- agents can install/call DryLake without reading private docs.

### Phase 2: Agent Token Center

Build `/app/agents`.

Features:

- create agent token,
- revoke token,
- show scopes,
- show credits,
- show usage,
- copy Cursor MCP config,
- copy Claude Code MCP config,
- copy VS Code MCP config.

Success metric:

- human can create a token and connect an agent in under 2 minutes.

### Phase 3: Credit-Based Preflight Billing

Build:

- 3 free trial preflights,
- Basic Preflight = 1 credit,
- Validated Preflight = 3 credits,
- Stripe credit packs,
- `payment_required` MCP response.

Success metric:

- first `trial_limit_hit`,
- first `buy_credits_clicked`,
- first paid preflight.

### Phase 4: Assurance Product

Validated Preflight should include:

- risk classification,
- test checklist,
- rollback plan,
- dependency impact review,
- validation phase,
- audit record.

Do not call this insurance. Call it assurance.

Success metric:

- users select Validated over Basic when the task mentions auth, data, infra, security, payment, production, migration, or refactor.

### Phase 5: Integrations

Start with integrations that strengthen planning:

1. GitHub issues and PRs
2. Jira/Linear tickets
3. Sentry issues
4. Playwright validation
5. Figma for frontend planning

Do not build a giant connector marketplace yet. Use MCP recipes and config generation first.

## Product Positioning

### Primary Position

DryLake Agent Preflight

> Give coding agents a plan before they touch code.

### Short Description

DryLake turns tickets, specs, and bug reports into phase plans, token budgets, and focused handoffs for Claude Code, Codex, Cursor, Gemini, Copilot, and MCP-capable agents.

### Agent Tool Description

Use DryLake before coding a non-trivial feature, bug fix, refactor, test-generation task, GitHub issue, Jira ticket, Sentry issue, or product spec. DryLake creates a structured phase plan, token budget, next-phase contract, and focused handoff so coding agents do not work from oversized ambiguous prompts.

### Human CTA

Connect DryLake free. No credit card. Get planning cards, token-aware handoffs, and visibility into what your coding agents are doing.

### Paid CTA

Upgrade to DryLake Assurance for validated plans, risk review, rollback instructions, audit history, and team visibility.

## What Not To Do

Do not build another coding agent.

Do not claim every integration works before it is tested.

Do not overbuild a full MCP marketplace before the preflight loop works.

Do not make local LLM installation the first paid product. Local planning can be useful later, but the paid wedge is owner-visible preflight and assurance.

Do not hide signup behind vague marketing. Make the signup directly tied to saving a plan, creating an agent token, or continuing after free preflight credits.

## Key Metrics

Track these before vanity metrics:

- `agent_self_registered`
- `trial_preflight_created`
- `trial_limit_hit`
- `payment_required_returned`
- `buy_credits_clicked`
- `credits_purchased`
- `paid_preflight_created`
- `human_signup_after_agent_preflight`
- `extension_installed`
- `extension_connected`
- `first_plan_created`
- `first_handoff_launched`
- `second_session_created`
- `seven_day_return`

These metrics show whether DryLake is becoming a habit, not just getting installs.

## Bottom Line

DryLake should be the planning layer between humans, tickets, repos, and coding agents.

Agents should use it because it gives them a scoped phase contract before coding.

Humans should sign up because it gives them visibility, control, saved history, and safer handoffs across agents.

The growth strategy is to make DryLake discoverable by both humans and agents:

- humans through VS Marketplace, Open VSX, Cursor, docs, and demos,
- agents through MCP, npm, Agent Card discovery, Cursor rules/skills, and machine-readable payment/trial flows.

The product should prove value before asking for trust:

> Give away a few useful preflights, show the saved plan and token budget, then ask the user to connect or buy credits when the value is visible.
