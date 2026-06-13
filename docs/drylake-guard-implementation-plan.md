# DryLake Guard Full Implementation Plan

## Purpose

This document captures the implementation plan from the chat thread so another agent can review the work against a concrete artifact in the repository.

The goal is not to remove unfinished security claims. The goal is to make DryLake Guard real across the website, backend, billing, entitlements, and VS Code extension.

## Primary Instruction

Do not remove security features because they are incomplete.

Security features must be one of:

1. Fully implemented.
2. Entitlement-gated behind the correct paid tier.
3. Marked as preview/planned in private/internal UI only.

Do not silently delete the product vision.

## Product Goals

The product is fixed when:

1. Website auth works.
2. Website billing works.
3. Stripe sync works.
4. Entitlements work.
5. Extension connect works.
6. Free local security scan works.
7. Paid Fix with AI works.
8. Security Pro has real paid value.
9. Team Security has real team-only value.
10. README reflects the real implementation after behavior is live.

## Non-Negotiable Architecture Rule

The website/backend is the source of truth.

The extension must never decide paid access locally. The extension may cache entitlement state for UI responsiveness, but every paid/security action must resolve through the backend entitlement resolver.

Canonical ownership:

```txt
Auth source of truth: Cognito-backed DryLake session
Billing source of truth: Stripe Customer + Stripe Subscription
Entitlement source of truth: DryLake server entitlement resolver
Extension state: cached mirror only
```

## Canonical Plans

Use these plan names everywhere:

```txt
free
pro
security_pro
team_security
enterprise
```

Public pricing:

```txt
Free: $0
Pro: $10/month
Security Pro: $40/month per individual user
Team Security: team/seat-based paid plan
Enterprise: contact us
```

## Tier Capabilities

### Free

Free users get:

1. Local Guard scan.
2. Local detailed report.
3. MCP risk scan.
4. Agent rules / skills scan.
5. IDE extension access review.
6. Secret hygiene scan.
7. Workspace blast-radius summary.
8. Token waste / IDE bloat summary.
9. Static suspicious artifact review.
10. Open Report.
11. Copy Summary.

Free users do not get:

1. Fix with AI.
2. Deep Cloud Analysis.
3. Saved cloud reports.
4. Approved upload.
5. Team Baseline.
6. Continuous Watch.
7. Team policy.

### Pro

Pro users get:

1. Everything in Free.
2. Hosted planning.
3. Control Plane planning.
4. Saved plans.
5. Handoff flows.
6. Existing paid planning/productivity features.

Pro does not unlock paid security remediation.

### Security Pro

Security Pro users get:

1. Everything in Pro.
2. Fix with AI.
3. Approved upload.
4. Deep Cloud Analysis for personal workspace.
5. Local Watchdog while editor is open.
6. Personal saved security reports.
7. Compare current scan to prior personal scans.
8. Remediation plan generation.

Security Pro does not get:

1. Team baseline.
2. Team policy.
3. Team-wide continuous watch.
4. Shared team security state.

### Team Security

Team Security users get:

1. Everything in Security Pro.
2. Team workspaces.
3. Team members and roles.
4. Shared reports.
5. Team Baseline.
6. Baseline drift.
7. Team policy.
8. MCP allowlist / denylist.
9. Extension allowlist / denylist.
10. Team-level Continuous Watch.
11. Team billing/admin pages.

### Enterprise

Enterprise is contact-only until manually implemented.

## Minimum Data Model

### User

```txt
id
email
display_name
cognito_sub
stripe_customer_id
created_at
updated_at
```

### Subscription

```txt
id
user_id nullable
team_id nullable
stripe_customer_id
stripe_subscription_id
stripe_price_id
plan
status
current_period_start
current_period_end
cancel_at_period_end
trial_end
created_at
updated_at
```

### Entitlement

```txt
id
subject_type user/team
subject_id
plan
capability
source billing/team_override/admin_override
active
expires_at nullable
created_at
updated_at
```

### Entitlement Version

```txt
subject_type
subject_id
version
updated_at
```

This lets the extension know whether cached entitlements are stale.

### Team

```txt
id
name
billing_owner_user_id
stripe_customer_id nullable
plan
created_at
updated_at
```

### Team Member

```txt
team_id
user_id
role owner/admin/member/viewer
status active/invited/removed
created_at
updated_at
```

### Scan Report

```txt
id
user_id
team_id nullable
workspace_id nullable
source local/cloud
status
score
summary_json
findings_json
redaction_version
created_at
updated_at
```

### Team Baseline

```txt
id
team_id
workspace_id
scan_report_id
created_by_user_id
created_at
```

### Optional Cloud Analysis Job

```txt
id
user_id nullable
team_id nullable
scan_report_id nullable
status
approved_payload_json
result_json
error_message nullable
created_at
updated_at
```

## Entitlement Contract

Implement one shared server-side resolver.

Suggested file:

```txt
lib/services/entitlements.ts
```

Resolver shape:

```ts
type ResolvedEntitlements = {
  plan: "free" | "pro" | "security_pro" | "team_security" | "enterprise";
  subjectType: "user" | "team";
  subjectId: string;
  entitlementVersion: number;
  canUseHostedPlanning: boolean;
  canUseFixWithAI: boolean;
  canUseApprovedUpload: boolean;
  canUseDeepCloudAnalysis: boolean;
  canUseSuspiciousArtifactScan: boolean;
  canUseLocalWatchdog: boolean;
  canCreateTeam: boolean;
  canUseTeamBaseline: boolean;
  canUseContinuousWatch: boolean;
  canManageTeamPolicy: boolean;
  billingStatus: "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd?: string;
};
```

Capability mapping:

```txt
free:
  local scan/report only

pro:
  hosted planning only

security_pro:
  hosted planning
  Fix with AI
  approved upload
  Deep Cloud Analysis
  suspicious artifact review
  local Watchdog

team_security:
  all security_pro features
  team creation/admin
  team baseline
  continuous watch
  team policy

enterprise:
  manually managed
```

Acceptance criteria:

1. All paid UI calls use this resolver.
2. Website uses this resolver.
3. Extension uses this resolver.
4. No hardcoded extension-side plan logic unlocks paid features.
5. Entitlement version increments after subscription changes.

## Cognito Authentication

Fix auth before billing.

Files in scope:

```txt
lib/services/auth.ts
lib/services/current-user.ts
app/api/auth/cognito/callback/route.ts
app/extensions/connect/page.tsx
components/extension-connect-auth-buttons.tsx
extensions/xupra-drylake-vscode/src/services/browserConnect.ts
```

Required behavior:

1. User clicks Register / Sign in.
2. Website sends user to Cognito.
3. Cognito callback validates state and nonce.
4. App creates or updates DryLake user record.
5. App creates durable DryLake session.
6. User lands on website authenticated.
7. Extension connect page confirms authenticated user.
8. Extension receives connect code.
9. Extension exchanges connect code for extension session.
10. Extension refreshes entitlements.

Remove Clerk from production runtime:

```txt
current-user
billing
extension connect
account
entitlement resolver
paid feature checks
```

Clerk can remain only for old/dev paths. Production must be Cognito-backed.

Acceptance criteria:

1. `/account` shows Cognito-backed user.
2. `/billing` shows Cognito-backed user.
3. `/extensions/connect` works after login.
4. Extension state updates immediately after browser callback.
5. Session survives page refresh.
6. No production paid flow depends on Clerk.

## Website Billing Source of Truth

Stripe is the billing source of truth. The website is the user-facing billing surface.

Files in scope:

```txt
app/billing/page.tsx
app/account/page.tsx
app/actions.ts
app/api/v1/billing/checkout/route.ts
app/api/v1/billing/portal/route.ts
app/api/v1/billing/webhook/route.ts
app/api/v1/billing/subscription/route.ts
app/api/v1/entitlements/route.ts
```

Create missing files if needed.

## Stripe Checkout

Checkout route:

```txt
app/api/v1/billing/checkout/route.ts
```

Request body:

```ts
{
  plan: "pro" | "security_pro" | "team_security";
  billingContext: "user" | "team";
  teamId?: string;
  returnTo?: string;
  extensionReturnUri?: string;
}
```

Behavior:

1. Require authenticated Cognito-backed user.
2. Create Stripe customer if missing.
3. Map requested plan to Stripe price ID.
4. Create Stripe Checkout Session.
5. Include metadata:

```txt
drylake_user_id
drylake_team_id
plan
billing_context
return_to
extension_return_uri
```

6. Redirect user to Stripe Checkout.

Checkout success behavior:

1. Redirect user back to `/billing?checkout=success`.
2. Billing page forces subscription reconciliation.
3. Page displays updated plan/status/entitlements.
4. Page provides `Return to editor` button if extension return URI exists.
5. Do not rely only on webhook timing.

Acceptance criteria:

1. Free user can upgrade to Pro.
2. Free/Pro user can upgrade to Security Pro.
3. Team owner/admin can start Team Security checkout.
4. Stripe customer is linked to user/team.
5. Success page shows new plan quickly.

## Stripe Billing Portal

Portal route:

```txt
app/api/v1/billing/portal/route.ts
```

Behavior:

1. Require authenticated user.
2. Resolve billing context.
3. Support personal billing.
4. Support team billing if admin/owner.
5. Find Stripe customer.
6. Create Stripe Billing Portal session.
7. Return portal URL.

Billing page buttons:

```txt
Upgrade to Pro
Upgrade to Security Pro
Manage subscription
View invoices/payment method
Return to editor
Manage team billing
Upgrade team to Team Security
```

Acceptance criteria:

1. User can open Stripe portal from website.
2. User can update payment method.
3. User can cancel/manage subscription.
4. Website reflects status after returning.

## Stripe Webhook

Webhook route:

```txt
app/api/v1/billing/webhook/route.ts
```

Requirements:

1. Verify Stripe signature.
2. Handle idempotency.
3. Log event IDs.
4. Reconcile subscription state.
5. Update app subscription table.
6. Bump entitlement version.

Handle events:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

Metadata mapping:

```txt
drylake_user_id
drylake_team_id
plan
billing_context
```

Acceptance criteria:

1. Webhook rejects invalid signature.
2. Duplicate Stripe events do not corrupt state.
3. Subscription table updates correctly.
4. Entitlement version increments.
5. Extension sees entitlement update after refresh.

## Billing and Account Website Pages

Billing page:

```txt
app/billing/page.tsx
```

Must show:

```txt
Current plan
Subscription status
Renewal date
Cancel-at-period-end status
Stripe portal/manage button
Available upgrades
Entitlements summary
Invoice/payment method link through portal
Team billing section if applicable
Return to editor button if launched from extension
```

Account page:

```txt
app/account/page.tsx
```

Must show:

```txt
User email
Connected editor status if available
Current personal plan
Current team plan if applicable
Entitlements
Billing link
Team membership
```

Website nav should expose:

```txt
Account
Billing
Extensions / Connect
```

Acceptance criteria:

1. Paying user sees correct plan.
2. Canceled user sees canceled/cancel-at-period-end state.
3. Past_due user sees payment recovery path.
4. Free user sees upgrade options.
5. Team member sees inherited team entitlements.
6. Team admin sees billing controls.

## Entitlement APIs

Current entitlements endpoint:

```txt
app/api/v1/entitlements/route.ts
```

Response:

```ts
{
  userId: string;
  teamId?: string;
  plan: string;
  entitlementVersion: number;
  capabilities: {
    canUseHostedPlanning: boolean;
    canUseFixWithAI: boolean;
    canUseApprovedUpload: boolean;
    canUseDeepCloudAnalysis: boolean;
    canUseSuspiciousArtifactScan: boolean;
    canUseLocalWatchdog: boolean;
    canCreateTeam: boolean;
    canUseTeamBaseline: boolean;
    canUseContinuousWatch: boolean;
    canManageTeamPolicy: boolean;
  };
  billing: {
    status: string;
    currentPeriodEnd?: string;
  };
}
```

Extension refresh behavior:

1. After sign-in.
2. After checkout.
3. When user clicks Refresh Account.
4. Before paid actions.
5. When cached entitlement version is stale.

Acceptance criteria:

1. Website and extension show same plan.
2. Extension unlocks Security Pro without reinstall.
3. Failed/expired subscription locks paid action again.
4. Server always makes final decision.

## Extension Connect and Billing Return Flow

Main file:

```txt
extensions/xupra-drylake-vscode/src/services/browserConnect.ts
```

Required flow:

1. Extension opens browser connect URL.
2. User signs in on website.
3. Website confirms session.
4. Website shows `Return to VS Code` / `Return to Cursor`.
5. Extension receives callback/code.
6. Extension exchanges code with backend.
7. Extension stores session token securely.
8. Extension calls entitlement endpoint.
9. Extension updates UI immediately.

Paid action flow:

1. User clicks `Fix with AI` without entitlement.
2. Extension calls entitlement resolver.
3. Backend says missing `canUseFixWithAI`.
4. Extension opens:

```txt
/billing?required=security_pro&source=extension&returnTo=<extension-uri>
```

5. Billing page explains required plan.
6. User completes checkout.
7. User lands on `/billing?checkout=success`.
8. Website reconciles subscription.
9. User clicks Return to editor.
10. Extension refreshes entitlements.
11. Action works.

Acceptance criteria:

1. No extension restart needed.
2. User does not get stuck after checkout.
3. Website and extension agree on plan.
4. Free/pro users are blocked from Security Pro action.
5. Security Pro users can run paid action.

## Security Product Flow

Files:

```txt
extensions/xupra-drylake-vscode/src/providers/controlRoomProvider.ts
extensions/xupra-drylake-vscode/src/services/securityScanner.ts
```

Required UX:

1. User opens Control Plane.
2. Top nav shows Agent Control and Security.
3. User opens Security.
4. If not signed in, show Register / Sign in and still allow local scan.
5. User clicks Run Guard Scan.
6. UI shows what is being scanned.
7. UI shows progress/check states.
8. Detailed report appears.
9. Report is center of screen.
10. Actions include Open Report, Copy Summary, Fix with AI.

No fake dashboard. The report is the product.

## Local Guard Scan Engine

Main scanner file:

```txt
extensions/xupra-drylake-vscode/src/services/securityScanner.ts
```

Refactor into modules:

```txt
discovery
promptInjectionRisk
supplyChainRisk
mcpRisk
ideExtensionAccess
secretHygiene
workspaceBlastRadius
tokenWaste
suspiciousArtifactReview
redaction
score
report
```

Finding schema:

```ts
type GuardFinding = {
  findingId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category:
    | "prompt_injection"
    | "supply_chain"
    | "mcp_risk"
    | "ide_extension_access"
    | "secret_hygiene"
    | "workspace_blast_radius"
    | "token_waste"
    | "suspicious_artifact"
    | "deploy_surface";
  filePath?: string;
  lineRef?: string;
  excerpt?: string;
  reason: string;
  remediation: string;
  source: "local" | "cloud";
  timestamp: string;
};
```

### Prompt Injection Risk

Scan:

```txt
CLAUDE.md
AGENTS.md
.cursor/rules
.cursorrules
Codex rules
Gemini rules
Hermes/OpenCode/Qwen configs
project markdown instruction files
MCP prompt files
skill files
```

Detect:

```txt
ignore previous instructions
reveal/exfiltrate secrets
send files to remote endpoint
hidden unicode/control characters
remote prompt includes
tool/shell escalation instructions
safety override instructions
```

### Supply-Chain Risk

Scan:

```txt
package.json
lockfiles
preinstall/postinstall/prepare scripts
npx/uvx/curl/bash/powershell tool launches
MCP package declarations
extension manifests
```

Detect:

```txt
download pipes
unpinned tool execution
dangerous install scripts
unknown package/tool sources
overbroad extension behavior
```

### MCP Risk

Scan:

```txt
MCP config files
tool launch commands
environment variable exposure
network-capable tools
filesystem-capable tools
browser/cloud/API tools
Composio-style configs
Smithery-style configs
local MCP servers
```

Output:

```txt
tool access map
files reachable by tools
secrets exposed to MCP
blast-radius estimate
```

### IDE Extension Access Review

Use:

```ts
vscode.extensions.all
```

Review:

```txt
activation events
commands
debuggers
terminal access
filesystem access
authentication providers
language servers
remote/SSH/container behavior
workspace trust behavior
```

### Secret Hygiene

Detect and redact:

```txt
API keys
private keys
.env values
database URLs
cloud tokens
GitHub/GitLab tokens
AWS credentials
OpenAI/Anthropic/Gemini keys
Stripe keys
JWTs
high-entropy strings
```

Never persist or upload raw secrets.

### Workspace Blast Radius

Surface:

```txt
repo root
sensitive directories
CI/CD files
Docker files
Kubernetes files
Terraform/CDK
deployment scripts
cloud configs
destructive scripts
```

### Token Waste / IDE Bloat

Detect:

```txt
large files
generated folders
vendored dependencies
build outputs
logs
media
notebooks
files likely to pollute agent context
```

Recommend:

```txt
.gitignore
.agentignore
.cursorignore
claude/codex context exclusions
```

### Suspicious Artifact Review

Do not claim full antivirus.

Allowed names:

```txt
Suspicious Artifact Review
Static Suspicious Artifact Scan
Developer Workspace Artifact Risk Scan
```

Scan:

```txt
scripts
binaries
archives
obfuscated JS
base64 blobs
suspicious PowerShell
suspicious shell
unexpected executables
```

Output:

```txt
path
reason suspicious
recommended review/quarantine/delete action
```

Acceptance criteria:

1. Local scan runs for free users.
2. All modules execute without crashing.
3. No raw secrets leave local machine.
4. Report always renders after scan.
5. Repeated scans have stable ordering/deduplication.

## Detailed Security Report

Required sections:

```txt
Responsible Agent Score
Top Findings
Prompt Injection Risk
Supply-Chain Risk
MCP / Tool Access
IDE Extension Access
Secret Hygiene
Workspace Blast Radius
Token Waste / IDE Bloat
Suspicious Artifact Review
Deploy Surface
Connection Map
Recommended Next Actions
```

Actions:

```txt
Open Report
Copy Summary
Fix with AI
Refresh Entitlements
Sign In / Register
Upgrade to Security Pro
```

Acceptance criteria:

1. Report readable in free mode.
2. Report does not require login.
3. Open Report works.
4. Copy Summary works.
5. Fix with AI is gated.
6. Paid user can proceed directly to remediation.

## Fix with AI

Files:

```txt
guard-remediation.ts
app/api/v1/guard/fix-plan/route.ts
```

Behavior:

Free or Pro:

```txt
block action
show Security Pro required
open /billing?required=security_pro
```

Security Pro or Team Security:

```txt
send redacted scan summary to backend
generate remediation plan
render result in extension
```

Allowed payload:

```txt
finding category
severity
file path
redacted excerpt
reason
local remediation hint
dependency metadata
MCP metadata
extension metadata
```

Forbidden payload:

```txt
raw secrets
private keys
full .env values
full source tree
unapproved files
```

Remediation plan schema:

```txt
executive summary
critical risks
quick fixes
files to inspect
config changes
MCP hardening
extension hardening
secret cleanup
supply-chain cleanup
prompt/rule cleanup
suggested ignore files
team-policy recommendations if team_security
```

Acceptance criteria:

1. Free/pro users route to billing.
2. Paid users get useful remediation.
3. No raw secret exfiltration.
4. Team users get team-policy recommendations.

## Approved Upload and Deep Cloud Analysis

This is opt-in only.

Security Pro upload may include:

```txt
scan manifest
redacted findings
dependency metadata
MCP metadata
extension metadata
file path inventory
selected prompt/rule files
```

Never upload:

```txt
raw secrets
.env values
private keys
full source tree
unapproved source files
```

Website integration:

```txt
cloud report history
approved uploads
report status
billing requirement
account ownership
```

Possible pages:

```txt
app/security/reports/page.tsx
app/security/reports/[id]/page.tsx
```

Cloud job flow:

```txt
submit cloud analysis job
job status
job result retrieval
cloud report rendering
```

Deep Cloud Analysis output:

```txt
richer risk correlation
cross-scan comparison
supply-chain review
prompt/rule risk review
agent/tool graph
blast-radius graph
remediation plan
```

Acceptance criteria:

1. User sees exactly what will be uploaded.
2. User can cancel before upload.
3. Raw secrets are blocked.
4. Cloud report appears in website and extension.
5. Cloud report respects entitlements.

## Team Security Website Surfaces

Do not implement team features until individual Security Pro works.

Pages:

```txt
app/team/page.tsx
app/team/billing/page.tsx
app/team/members/page.tsx
app/team/security/page.tsx
app/team/security/baseline/page.tsx
app/team/security/policy/page.tsx
```

Team admin pages must show:

```txt
team plan status
billing owner
team members
roles
team entitlements
policy gates
baseline status
continuous watch status
```

Team roles:

```txt
owner
admin
member
viewer
```

Team Baseline flow:

1. Owner/admin runs scan.
2. Owner/admin marks report as baseline.
3. Future scans compare to baseline.
4. Report shows diff.

Diff categories:

```txt
new risks
resolved risks
worsened risks
new MCP tools
new extensions
new secrets
new deployment surfaces
new suspicious artifacts
```

Acceptance criteria:

1. Security Pro individual cannot create Team Baseline.
2. Team Security owner/admin can create baseline.
3. Team member can compare scan to baseline.
4. Viewer can read if permission allows.
5. Website shows team subscription and entitlements.

## Watchdog vs Continuous Watch

Keep these separate.

### Local Watchdog

Security Pro feature. Runs while editor is open.

Watch:

```txt
MCP config files
agent rule files
CLAUDE.md
AGENTS.md
.cursor/rules
package.json
lockfiles
.env changes
CI/CD files
Docker/Terraform/Kubernetes files
deployment scripts
```

Behavior:

```txt
local alert
changed file
risk category
rerun scan button
```

### Team Continuous Watch

Team Security feature.

Behavior:

```txt
scheduled scans or recurring check-ins
baseline drift detection
team policy violations
team history
admin visibility
```

Acceptance criteria:

1. Security Pro gets local Watchdog only.
2. Team Security gets team Continuous Watch.
3. Individual users do not get team-wide monitoring.

## GIF Hosting

Use static hosting.

Path:

```txt
public/marketplace/extension/media/
```

Required GIFs:

```txt
guard-security.gif
agent-control.gif
```

Rules:

1. No dynamic route.
2. Same URL used by website and Marketplace README.
3. Verify HTTP 200 before publishing.

Acceptance criteria:

1. Guard GIF URL returns 200.
2. Coding GIF URL returns 200.
3. Marketplace renders GIFs.
4. Website renders GIFs.

## README and Marketing Copy

README rewrite comes after behavior works.

Public copy must not claim unavailable features as live.

Feature language rule:

```txt
live = describe normally
implemented but gated = describe plan requirement
not implemented = preview/planned only
```

Do not remove strategic security positioning.

Keep DryLake Guard as:

```txt
Agentic security preflight for AI coding agents.
```

Final README must include:

```txt
Free capabilities
Pro capabilities
Security Pro capabilities
Team Security capabilities
local vs cloud behavior
approved upload rules
team-only features
billing link
extension connect flow
security report example
```

## Execution Order

Do not start with README.

Do not start with team features.

Do not start with architecture documents.

Build the paid conversion path first.

### Sprint 1: Auth

1. Cognito session.
2. Current-user cleanup.
3. Extension connect.
4. Remove Clerk from production runtime path.

### Sprint 2: Billing

1. Stripe checkout.
2. Stripe portal.
3. Stripe webhook.
4. Subscription sync.
5. Billing/account website pages.

### Sprint 3: Entitlements

1. Entitlement resolver.
2. Entitlement API.
3. Entitlement version.
4. Website entitlement display.
5. Extension entitlement refresh.

### Sprint 4: Local Security Product

1. Local Guard scan modules.
2. Detailed report.
3. Open Report.
4. Copy Summary.
5. Report-first Security UI.

### Sprint 5: Paid Security Conversion

1. Fix with AI gate.
2. Billing deep link.
3. Checkout success reconciliation.
4. Return to editor.
5. Paid remediation plan.

### Sprint 6: Approved Upload / Cloud Analysis

1. Upload approval UI.
2. Redacted payload.
3. Cloud job.
4. Cloud report retrieval.
5. Website report history.

### Sprint 7: Team Foundation

1. Team model.
2. Members/roles.
3. Team billing.
4. Inherited entitlements.
5. Team website surfaces.

### Sprint 8: Team Baseline

1. Baseline creation.
2. Baseline compare.
3. Baseline report diff.
4. Team policy foundation.

### Sprint 9: Watchdog / Continuous Watch

1. Local Watchdog.
2. Team Continuous Watch.
3. Drift/policy history.

### Sprint 10: GIFs and README

1. Real GIFs from real flows.
2. Static hosting.
3. README rewrite.
4. Website copy update.
5. Marketplace update.

## Hard Acceptance Gates

### Gate A: Auth

Pass only if:

```txt
Cognito login works
extension connect works
billing page knows user
account page knows user
no production Clerk dependency
```

### Gate B: Billing

Pass only if:

```txt
checkout works
portal works
webhook works
subscription table updates
billing page shows correct plan
```

### Gate C: Entitlements

Pass only if:

```txt
server resolver returns correct capabilities
extension refreshes entitlements
paid action blocked for free user
paid action unlocked for Security Pro
team member inherits team entitlement
```

### Gate D: Local Security

Pass only if:

```txt
free user can run local scan
report renders
summary copies
all scan modules run
secrets are redacted
```

### Gate E: Paid Fix

Pass only if:

```txt
free/pro user routes to billing
Security Pro user receives fix plan
extension does not require restart
website confirms plan
payload contains no raw secrets
```

### Gate F: Team Security

Pass only if:

```txt
team billing works
team roles work
team baseline works
baseline diff renders
individual user cannot access team-only features
```

## Handoff Review Checklist

Another agent should verify:

1. The implementation follows this plan instead of deleting security features.
2. Cognito is the production runtime auth path.
3. Stripe state drives billing and entitlements.
4. The entitlement resolver is the single source of truth.
5. Extension paid actions refresh/check server entitlements before running.
6. Free users can run local Guard Scan and read reports.
7. Fix with AI is gated to Security Pro / Team Security.
8. Deep Cloud Analysis uses explicit approved upload and redaction.
9. Team Baseline and Continuous Watch are Team Security-only.
10. README and public claims are not updated beyond implemented behavior.

## Current Implementation Status From This Build Session

The following were implemented or partially implemented during this build session:

1. Canonical Guard entitlements and plan capabilities.
2. Security Pro and Team Security Stripe price support.
3. Entitlement API.
4. Auth session API.
5. Subscription sync API.
6. Canonical billing webhook path.
7. Checkout/portal support for new plans.
8. Production auth preference for Cognito when configured.
9. Extension connect responses with plan and entitlement version.
10. Extension entitlement types expanded for Guard capabilities.
11. Fix with AI access changed to `canUseFixWithAI`.
12. Security Pro billing deep link from extension Guard conversion.
13. Local scanner categories expanded for prompt injection, supply chain, deploy surface, suspicious artifacts, and IDE extension access.
14. Report sections expanded for Guard product categories.
15. Backend gating for approved upload and baseline upload.
16. Website Guard report history/detail pages.
17. Team Security website pages.
18. Local Security Pro Watchdog service in the VS Code extension.
19. Watchdog start/stop wired to entitlement state.
20. Team Baseline model/action/diff foundation.
21. Team policy model/API/action foundation.
22. Deep Cloud Analysis persisted job/result foundation from approved redacted payload.
23. Continuous Watch manual evaluation, extension check-in, and scheduler endpoint foundation.
24. Static `agent-control.gif` copied from an existing real workflow GIF.

Known remaining items:

1. Deploy the generated static GIFs so production serves `guard-security.gif` and `agent-control.gif`.
2. Configure the production scheduler to call `/api/v1/team/security/continuous-watch/run` with `CONTINUOUS_WATCH_CRON_SECRET`.
3. Deep Cloud Analysis can be upgraded from deterministic server-side analysis to an external async AI/cloud worker if desired.
4. Final README/Marketplace copy should be published only after the deployed GIF URLs return HTTP 200.

Recommended validation:

```powershell
npm run typecheck
npm test
```

## Continuation Slice: Scheduler and Static Media Operations

The following final operations wiring was added:

1. Added `scripts/run-continuous-watch-cron.ts`.
2. Added npm script `guard:continuous-watch`.
3. Added `CONTINUOUS_WATCH_CRON_SECRET` to `.env.example`.
4. Added GitLab scheduled pipeline job `continuous_watch_scheduler` behind `RUN_CONTINUOUS_WATCH=true`.
5. Deployment verification now checks `/marketplace/extension/media/agent-control.gif`.
6. Deployment verification checks `/marketplace/extension/media/guard-security.gif` when the real asset exists or `VERIFY_GUARD_SECURITY_GIF=true`.
7. Removed broken references to missing `drylake-guard-workflow.gif` from the homepage and extension README.
8. Homepage now shows a text Guard report panel until a real Guard recording exists.
9. Added `docs/drylake-guard-operations.md` with scheduler setup and real GIF recording instructions.
10. Removed the old dynamic marketplace media route so static files under `public/marketplace/extension/media/` are the source of truth.
11. Added `npm run guard:readiness` to check Guard media readiness and scheduler environment configuration.
12. CI validation now runs `npm run guard:readiness` in non-release mode.

Final media status:

```txt
public/marketplace/extension/media/guard-security.gif exists
public/marketplace/extension/media/agent-control.gif exists
```

Final hosted URLs after deployment:

```txt
https://drylake.xupracorp.com/marketplace/extension/media/guard-security.gif
https://drylake.xupracorp.com/marketplace/extension/media/agent-control.gif
```

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 173 tests passed
```

## Continuation Slice: Guard Security GIF

The Guard security GIF was generated and wired into static hosting:

1. Added `scripts/generate-guard-security-gif.py`.
2. Generated `public/marketplace/extension/media/guard-security.gif`.
3. Homepage now references `/marketplace/extension/media/guard-security.gif`.
4. Extension README now references `https://drylake.xupracorp.com/marketplace/extension/media/guard-security.gif`.
5. `REQUIRE_GUARD_SECURITY_GIF=true npm run guard:readiness` passes locally.

Validation after this continuation:

```txt
REQUIRE_GUARD_SECURITY_GIF=true npm run guard:readiness: passed
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 175 tests passed
```

## Follow-Up Bug Fixes Applied

The following review findings were fixed after the initial implementation pass:

1. Deep Cloud Analysis supply-chain review now reads the extension payload shape: `packageManagers`, `packageScripts`, and `riskyPackageScripts`, not only `dependencyMetadata.dependencies`.
2. Guard scan uploads now persist structured inventory on `GuardScan`: extensions, MCP servers, workspace surface, package managers, and package scripts.
3. Team Continuous Watch policy enforcement now checks structured MCP/extension inventory instead of serialized report-text substring matches.
4. The Continuous Watch scheduler endpoint no longer stops after 250 organizations.
5. Added targeted backend tests for Deep Cloud Analysis dependency metadata correlation and Continuous Watch structured policy matching.

Validation after these fixes:

```txt
npm run db:generate: passed
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 50 tests passed
Extension tests: 15 files, 171 tests passed
```

## Continuation Slice: Baseline and Personal Scan Comparison

The following plan items were continued after the structured inventory fixes:

1. Team Baseline comparison now includes structured drift categories:
   - new MCP tools
   - new extensions
   - new secrets
   - new deployment surfaces
   - new suspicious artifacts
2. Continuous Watch baseline-drift events now include structured drift counts, not just generic finding deltas.
3. Security Pro / Team Security report detail pages now compare the current scan to the user's previous personal scan when available.
4. Report detail rendering now shows the structured Team Baseline drift categories.
5. Added targeted tests for structured baseline drift and personal previous-scan comparison.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 52 tests passed
Extension tests: 15 files, 171 tests passed
```

## Follow-Up Bug Fixes: Baseline and Shared Report Comparison

The following audit findings were fixed after the continuation slice above:

1. Team Baseline structured drift now counts new MCP tools and new extensions as entity-level additions, not as flattened field-value counts.
2. Personal previous-scan comparison now returns no comparison for shared reports owned by another team member instead of throwing on the report detail page.
3. The Deep Cloud Analysis approval modal now discloses package managers and risky package scripts in addition to package scripts so the upload summary matches the actual dependency metadata payload.

## Continuation Slice: Explicit Deep Cloud Analysis Approval

The following approved-upload requirements were continued:

1. The extension now shows an explicit modal approval step before starting Deep Cloud Analysis.
2. The approval modal lists exactly what categories will be uploaded:
   - redacted findings
   - MCP metadata
   - extension metadata
   - package scripts
   - file path inventory
3. The approval modal explicitly states that raw secrets, `.env` values, private keys, full source files, and unapproved source files are not uploaded.
4. Deep Cloud Analysis is canceled without a backend call if the user does not approve.
5. Deep Cloud Analysis jobs are linked to the saved local Guard scan ID when the extension has one.
6. Added an extension webview test for cancel/approve behavior and scan ID linkage.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 52 tests passed
Extension tests: 15 files, 172 tests passed
```

## Continuation Slice: Website Deep Cloud Analysis From Saved Reports

The following website/cloud-analysis requirements were continued:

1. Added a server action to start Deep Cloud Analysis from a saved Guard report.
2. The website action requires `canUseApprovedUpload` and `canUseDeepCloudAnalysis`.
3. The website action uses only saved Guard report metadata:
   - redacted findings
   - MCP metadata
   - extension metadata
   - package manager/script metadata
   - file path inventory
4. The website action does not upload raw secrets, source files, private keys, or `.env` values.
5. The report detail page now shows an explicit approval form for paid users.
6. Generated website cloud jobs are linked to the saved Guard scan.
7. Added an API endpoint for Guard scan comparison retrieval.
8. Added extension API client methods for cloud job retrieval and scan comparison retrieval.
9. Extension Deep Cloud Analysis completion now offers to open the website report when the job is linked to a saved scan.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 172 tests passed
```

## Continuation Slice: Extension Team Baseline Creation

The following Team Baseline requirement was continued:

1. The extension baseline upload flow now calls the Team Baseline API after saving the Guard scan.
2. The extension requires server-confirmed `canUseTeamBaseline` before attempting baseline upload.
3. Security Pro individuals are routed to the Team Security billing path instead of silently creating team state.
4. Optional artifact collection is now best-effort; if artifact collection fails, the extension still saves the redacted scan report and can mark it as baseline.
5. Added an extension test proving the flow records a baseline upload and calls `markGuardScanBaseline`.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 173 tests passed
```

## Continuation Slice: Server-Resolved Extension Paid Actions

The following entitlement source-of-truth requirement was continued:

1. Extension `Fix with AI` no longer unlocks from cached extension state alone.
2. Extension `Deep Cloud Analysis` no longer unlocks from cached extension state alone.
3. Both paid actions call the backend entitlement endpoint immediately before running.
4. If the entitlement endpoint is unavailable or the capability is missing, the action fails closed into the Security Pro billing flow.
5. Existing paid-action tests now mock the entitlement endpoint explicitly.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 172 tests passed
```

## Continuation Slice: Extension Billing Return Flow

The following paid-conversion loop requirement was continued:

1. Extension-origin billing flows now show a `Return to VS Code / Cursor` action whenever the required plan is satisfied.
2. The return action is no longer hidden just because the user already has a Stripe subscription.
3. This supports the flow where a user upgrades for `Fix with AI`, returns to the editor, refreshes entitlements, and retries the paid action.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 172 tests passed
```

## Continuation Slice: Personal vs Team Report Scope

The following saved-report tier separation was continued:

1. Security report history now respects the product tier model.
2. Individual users see only their own saved Guard reports.
3. Team Security users see shared organization reports.
4. Report detail access now follows the same boundary:
   - individual users can open their own reports
   - Team Security users can open shared team reports
5. Team report history shows the report owner email for shared-team visibility.

Validation after this continuation:

```txt
npm run typecheck: passed
npm test: passed
Backend tests: 17 files, 53 tests passed
Extension tests: 15 files, 172 tests passed
```
