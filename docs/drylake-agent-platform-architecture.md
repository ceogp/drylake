# DryLake Agent Platform Architecture

This document shows how the DryLake VS Code extension, website, MCP package, Agent Preflight API, authentication, billing, and discovery surfaces fit together.

Legend:

- **Live**: implemented in the current platform or current branch.
- **Release-ready**: packaged/automated but still requires registry credentials or marketplace review.
- **Next**: planned product layer after the current MCP/preflight foundation.

## 1. System Context

```mermaid
flowchart LR
  subgraph Discovery["Discovery And Distribution"]
    VSM["Visual Studio Marketplace<br/>xupracorp.drylake<br/>Live"]
    OVSX["Open VSX<br/>xupracorp.drylake<br/>Release-ready"]
    CURSOR["Cursor Marketplace Plugin<br/>manual review/submission<br/>Release-ready package"]
    NPM["npm package<br/>@xupracorp/drylake-mcp<br/>Release-ready"]
    MCPREG["MCP Registry<br/>io.github.gmkdigitalmedia/drylake-mcp<br/>Next listing"]
    A2A["A2A Agent Card<br/>/.well-known/agent-card.json<br/>Live endpoint"]
    SITE["DryLake website<br/>docs, install links, account pages<br/>Live"]
  end

  subgraph Clients["Clients And Agents"]
    VSCODE["VS Code<br/>DryLake extension"]
    CURSOREDITOR["Cursor<br/>VSIX extension + plugin/MCP"]
    CLAUDE["Claude Code<br/>MCP-capable client"]
    CODEX["Codex / agent CLI"]
    GEMINI["Gemini CLI"]
    COPILOT["Copilot / VS Code agents"]
    OTHER["Other MCP or A2A-capable agents"]
  end

  subgraph Cloud["DryLake Cloud"]
    WEB["Next.js Web App<br/>login, connect, dashboard"]
    API["API Routes<br/>extension APIs + preflight APIs"]
    PRE["Agent Preflight Service<br/>planning, token budget, handoff"]
    AI["Planning Model Layer<br/>Xupra/OpenAI-compatible generation"]
    BILL["Billing And Credits<br/>Stripe subscriptions now<br/>agent credits next"]
    ADMIN["Reports And Audit Views<br/>usage, prompts, agents, skills"]
  end

  subgraph Data["Data And Secrets"]
    PG["PostgreSQL<br/>users, orgs, extension tokens, agent tokens, usage, preflights"]
    SECRETS["Encrypted Secrets<br/>extension tokens, provider keys"]
    ARTIFACTS["Artifact Storage<br/>handoffs, exports, generated files"]
  end

  VSM --> VSCODE
  OVSX --> VSCODE
  OVSX --> CURSOREDITOR
  CURSOR --> CURSOREDITOR
  NPM --> CURSOREDITOR
  NPM --> CLAUDE
  NPM --> CODEX
  NPM --> GEMINI
  MCPREG --> OTHER
  A2A --> OTHER
  SITE --> VSCODE
  SITE --> CURSOREDITOR

  VSCODE --> API
  CURSOREDITOR --> API
  CLAUDE --> PRE
  CODEX --> PRE
  GEMINI --> PRE
  COPILOT --> API
  OTHER --> PRE

  API --> WEB
  API --> PRE
  PRE --> AI
  API --> BILL
  API --> ADMIN

  WEB --> PG
  API --> PG
  PRE --> PG
  API --> SECRETS
  API --> ARTIFACTS
```

## 2. Human User Authentication And Extension Connect

This is the normal VS Code/Cursor extension path. A human signs in to DryLake, then the editor receives an encrypted extension access token.

```mermaid
sequenceDiagram
  autonumber
  participant User as Human user
  participant Editor as VS Code or Cursor extension
  participant Web as DryLake web app
  participant API as DryLake API
  participant Auth as Clerk or dev auth
  participant DB as PostgreSQL
  participant SecretStorage as VS Code SecretStorage

  User->>Editor: Click DryLake Connect
  Editor->>API: POST /api/v1/extension/connect/start
  API->>DB: Create ExtensionAuthRequest<br/>status=pending, pollTokenHash, expiresAt
  API-->>Editor: requestId + pollToken
  Editor->>Web: Open browser connect URL
  User->>Web: Sign in or sign up
  Web->>Auth: Validate human session
  Web->>API: POST /api/v1/extension/connect/approve
  API->>DB: Attach userId + organizationId<br/>status=approved
  Editor->>API: Poll /api/v1/extension/connect/poll<br/>x-xupra-connect-poll-token
  API->>DB: Verify poll token hash and approval
  API->>API: Create encrypted extension access token<br/>30 day TTL
  API->>DB: Mark request consumed
  API-->>Editor: extension token + user/org summary
  Editor->>SecretStorage: Store token locally
  Editor->>API: Future calls with x-xupra-extension-token
```

Key properties:

- The browser connect request expires after a short TTL.
- The extension poll token is hashed in the database.
- The extension access token is encrypted and expires after 30 days.
- Future planning, usage, reporting, and handoff APIs require the extension token.
- Signed-out users should be blocked in the editor before planning or handoff work starts.

## 3. Agent Preflight MCP Authentication And Credit Flow

This is the new agent-facing path. Coding agents call DryLake before coding. DryLake returns a structured plan, token budget, next-phase contract, and handoff.

```mermaid
sequenceDiagram
  autonumber
  participant Agent as Cursor / Claude Code / Codex / MCP agent
  participant MCP as @xupracorp/drylake-mcp
  participant API as DryLake Agent API
  participant DB as PostgreSQL
  participant AI as Planning model layer
  participant Billing as Billing / credits
  participant Owner as Human owner dashboard

  Agent->>MCP: Call drylake_preflight(task, tier, target_agent)

  alt DRYLAKE_AGENT_TOKEN is missing
    MCP->>API: POST /api/agents/register
    API->>DB: Create AgentToken<br/>status=trial, balanceCredits=3,<br/>expiresAt=72h, tokenHash only
    API-->>MCP: raw dlk_trial token returned once
  end

  MCP->>API: POST /api/preflight<br/>Authorization: Bearer dlk_trial_or_agent_token
  API->>DB: Verify token hash, status, expiry, scope

  alt token invalid or expired
    API-->>MCP: 401 agent_token_invalid or agent_token_expired
    MCP-->>Agent: Ask user to register/connect DryLake
  else insufficient credits
    API-->>MCP: 402 payment_required<br/>buy_credits_url + credit packs
    MCP-->>Agent: Show payment required response
  else credits available
    API->>DB: Atomically debit credits<br/>Basic=1, Validated=3
    API->>AI: Generate preflight output
    AI-->>API: phase plan + token budget + handoff
    API->>DB: Save AgentPreflightRun<br/>task preview + task hash, not raw codebase
    API-->>MCP: preflight_id, plan, active phase,<br/>handoff, audit_url, remaining credits
    MCP-->>Agent: Return structured preflight result
    Owner->>API: View usage/audit history
  end
```

Key properties:

- Trial agent tokens are anonymous, short-lived, and limited.
- Raw agent tokens are returned once; only token hashes are stored.
- Trial agents do not get external integrations.
- DryLake stores a task preview and task hash, not full source code by default.
- Basic Preflight is 1 credit; Validated Preflight is 3 credits.
- Owner/team attachment, credit checkout, and richer audit dashboards are the next paid layer.

## 4. Discovery Surfaces

Other systems can discover DryLake through five paths:

```mermaid
flowchart TB
  subgraph Registries["Registry Discovery"]
    VSM["VS Marketplace<br/>Install VS Code extension"]
    OVSX["Open VSX<br/>Install in compatible editors"]
    NPM["npm<br/>npx -y @xupracorp/drylake-mcp"]
    MCPREG["MCP Registry<br/>server metadata + npm package"]
    CURSOR["Cursor Marketplace<br/>plugin repo submission/review"]
  end

  subgraph WebDiscovery["Web Discovery"]
    SITE["drylake.xupracorp.com"]
    DOCS["/docs, /cursor, /mcp, install pages"]
    A2A["/.well-known/agent-card.json"]
    DEEPLINK["Cursor MCP deeplink<br/>Next"]
  end

  subgraph Consumers["Consumers"]
    HUMAN["Human developers"]
    EDITOR["VS Code / Cursor"]
    AGENT["Coding agents"]
    ORCH["External agent orchestrators"]
  end

  VSM --> HUMAN
  OVSX --> HUMAN
  CURSOR --> HUMAN
  NPM --> AGENT
  MCPREG --> AGENT
  MCPREG --> ORCH
  A2A --> ORCH
  SITE --> HUMAN
  DOCS --> HUMAN
  DEEPLINK --> EDITOR

  HUMAN --> EDITOR
  EDITOR --> AGENT
  AGENT --> ORCH
```

Discovery details:

| Surface | What discovers DryLake | Current state | Purpose |
|---|---|---:|---|
| Visual Studio Marketplace | VS Code users | Live | Primary extension distribution |
| Open VSX | Cursor/VSCodium/Kiro/compatible editors | Release-ready | Same VSIX outside Microsoft Marketplace |
| Cursor Marketplace | Cursor users and Cursor agents | Package ready, manual review needed | Plugin with MCP config, rule, and skill |
| npm | MCP-capable agents | Package ready | `npx -y @xupracorp/drylake-mcp` |
| MCP Registry | MCP clients and directories | Next listing | Standard MCP server discovery |
| A2A Agent Card | Agent-to-agent discovery systems | Live endpoint | Advertise planning/preflight skills |
| DryLake website | Humans, search, docs, install pages | Live | Conversion, account, install, billing |

## 5. Release Architecture

One source build should produce the same extension across all editor platforms.

```mermaid
flowchart LR
  DEV["Developer changes<br/>feature branch"] --> MR["Merge to main"]
  MR --> TAG["Release tag<br/>drylake-vX.Y.Z"]

  TAG --> CI["GitLab CI"]
  CI --> VALIDATE["Validate<br/>lint, typecheck, tests, build"]
  VALIDATE --> PACKAGE["Package artifacts"]

  PACKAGE --> VSIX["drylake-X.Y.Z.vsix"]
  PACKAGE --> CURTGZ["drylake-cursor-plugin-X.Y.Z.tgz"]
  PACKAGE --> MCPTGZ["@xupracorp/drylake-mcp tgz"]

  VSIX --> VSM["Publish to VS Marketplace<br/>requires VSCE_PAT or VSCE_TOKEN"]
  VSIX --> OVSX["Publish to Open VSX<br/>requires OVSX_TOKEN"]
  VSIX --> CURART["Upload Cursor-installable VSIX artifact"]
  CURTGZ --> CURSUB["Submit plugin repo/package to Cursor<br/>manual review"]
  MCPTGZ --> NPM["Publish to npm<br/>requires NPM_TOKEN"]
```

Release invariants:

- `publisher` must stay `xupracorp`.
- extension `name` must stay `drylake`.
- Marketplace ID stays `xupracorp.drylake`.
- Cursor plugin version should match the extension version.
- MCP package can version independently, but release checks must verify package name and MCP metadata.
- Tag releases should fail if required publish tokens are missing, instead of silently skipping platforms.

## 6. Data Ownership And Security Model

```mermaid
flowchart TB
  subgraph Identity["Identity"]
    CLERK["Clerk session<br/>production human auth"]
    DEV["Dev auth fallback<br/>local/dev only"]
    ORG["Organization membership"]
  end

  subgraph Tokens["Tokens"]
    EXTREQ["ExtensionAuthRequest<br/>short TTL, poll token hash"]
    EXTTOKEN["Extension access token<br/>encrypted, 30 day TTL"]
    AGENTTOKEN["AgentToken<br/>trial/paid, token hash only"]
  end

  subgraph Usage["Usage And Audit"]
    EXTUSAGE["ExtensionUsageEvent<br/>agent, skill, launch status,<br/>prompt hash/preview/full depending mode"]
    PREFLIGHT["AgentPreflightRun<br/>task preview + task hash,<br/>plan, handoff, assurance"]
    BILLING["Subscription and credit state"]
  end

  subgraph Storage["Storage"]
    PG["PostgreSQL"]
    SECRET["Encrypted secret payloads"]
    ART["Artifact storage"]
  end

  CLERK --> ORG
  DEV --> ORG
  ORG --> EXTREQ
  EXTREQ --> EXTTOKEN
  ORG --> AGENTTOKEN
  EXTTOKEN --> EXTUSAGE
  AGENTTOKEN --> PREFLIGHT
  BILLING --> AGENTTOKEN

  EXTREQ --> PG
  EXTTOKEN --> SECRET
  AGENTTOKEN --> PG
  EXTUSAGE --> PG
  PREFLIGHT --> PG
  ART --> PG
```

Security rules:

- Human/product use is organization-scoped.
- Extension calls use `x-xupra-extension-token`.
- Agent Preflight calls use `Authorization: Bearer dlk_*`.
- Secret values and extension tokens must never be logged.
- Prompt capture is controlled by `EXTENSION_PROMPT_CAPTURE_MODE`.
- Trial agent tokens are limited and should not unlock integrations or long-term audit history.
- Write-capable integrations should stay behind explicit owner approval and scoped permissions.

## 7. Target End State

DryLake becomes the planning control plane for coding agents:

1. Humans discover DryLake through VS Marketplace, Open VSX, Cursor Marketplace, website, or search.
2. Editors install the same DryLake extension artifact.
3. Agents discover DryLake through MCP Registry, npm, Cursor plugin config, or A2A Agent Card.
4. Humans authenticate through the website and connect their editor.
5. Agents authenticate with short-lived trial tokens or owner-created paid agent tokens.
6. DryLake sells planning/preflight tasks:
   - Basic Preflight: phase plan, token budget, focused handoff.
   - Validated Preflight: Basic plus risk, tests, rollback, dependency impact, validation.
   - Team workspace: saved history, owner visibility, policy, audit, billing, and assurance reporting.
