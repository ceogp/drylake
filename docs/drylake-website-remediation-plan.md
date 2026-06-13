# DryLake Website Remediation Plan

## Product Narrative

DryLake is the platform.

1. Agent Control is the planning and orchestration surface.
2. Guard is the security surface.
3. Team Security is the shared organizational layer built on top of Guard.

## Tier Positioning

1. Free: local Guard scan, local report review, extension connection, and local-first workflow value.
2. Pro: hosted planning, saved planning workflows, and broader web-account management.
3. Security Pro: paid personal security workflow including approved upload, Fix with AI, Deep Cloud Analysis, saved reports, and local Watchdog.
4. Team Security: shared reports, Team Baseline, team policy, and Continuous Watch.
5. Enterprise: higher-touch deployment, procurement, and operational support.

## Public Website Goals

1. A new visitor can understand Guard without opening Billing.
2. Pricing and Billing tell the same story.
3. Free users can understand what stays local.
4. Paid users can understand why Security Pro exists.
5. Team buyers can understand Team Security without digging through signed-in app pages.
6. The extension-to-website flow feels intentional.
7. Auth copy matches the live production auth mode.

## Customer-Facing Page Responsibilities

### Public Marketing

1. Home: explain the two product pillars, show proof, and route visitors to Guard, pricing, and install.
2. Guard: explain local scan, approved upload, Security Pro, Team Security, and trust boundaries.
3. Pricing: provide the single public source of truth for tiers and feature boundaries.
4. About: explain why DryLake combines agent control and security.
5. Extension Install: bridge the website story to the editor workflow.
6. Sign In / Sign Up: explain what the account unlocks without surprising users.

### Signed-In Customer

1. Billing: transactional plan management only.
2. Account: summarize plan, role, entitlements, and the main destinations.
3. Extension Connect: explain the browser approval flow and the free-versus-paid Guard boundary clearly.

## This Implementation Pass

1. Rewrite `pricing` with all real tiers and Guard features.
2. Add a public `guard` page.
3. Update `home` so Guard and Team Security are first-class.
4. Simplify `billing` to current plan, upgrade actions, and entitlements.
5. Reframe `about`, `extensions/install`, `sign-in`, `sign-up`, `extensions/connect`, and `account` to match the same story.

## Follow-Up Audit Scope

After the website pass is live, audit these flows:

1. Visitor to install.
2. Visitor to pricing to signup.
3. Signed-out user to billing redirect.
4. Extension connect to website approval.
5. Free user to local Guard scan.
6. Free user to Security Pro upsell.
7. Security Pro user to saved report and cloud analysis.
8. Team Security user to baseline, policy, and Continuous Watch.
