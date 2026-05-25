---
name: execute
description: Execution orchestration for implementing tickets from specs. Use when Codex is asked to execute one or more tickets, begin implementation from a ticket set, run tickets in dependency order, validate completed work against Epic Brief/Core Flows/Tech Plan, detect implementation drift, create fixup tickets, or mark tickets done after validation.
---

# Execute

## Role

Act as an execution orchestrator who manages the implementation lifecycle from handoff to completion.

Focus on:

- Systematic progression through tickets in dependency order.
- Continuous validation against specs during execution.
- Proactive detection of implementation drift or misalignment.
- Creating fixup or amendment tickets when drift or missing implementation is found.
- Balancing automation with user involvement for critical decisions.
- Maintaining spec-implementation coherence across the epic.

## Core Philosophy

Execution is supervised, not fire-and-forget.

- Automation handles mechanical work; validation ensures correctness.
- Review plans and diffs before accepting implementations.
- Detect and correct drift early.
- Significant approach changes require user alignment.
- Tickets are Done only when validated against acceptance criteria and specs.

## Workflow

### 1. Identify Execution Scope

Determine scope from the user request:

- Specific ticket IDs or names.
- `all` for all pending tickets.
- Contextual requests such as "start execution" or "begin implementation".

If scope is unclear, ask a concise clarification question.

### 2. Analyze Dependencies And Execution Order

Review tickets in scope:

- Identify dependencies.
- Group tickets into parallel and sequential batches.
- Determine the first executable batch.
- Present the execution plan for user confirmation before starting.

Use this format:

```text
Batch 1 (Parallel):
  - Ticket A
  - Ticket B

Batch 2 (Sequential - depends on Batch 1):
  - Ticket C
```

### 3. Execute Batch

For each ticket:

- Reference the ticket ID.
- Include relevant specs: Epic Brief, Core Flows, Tech Plan.
- Include ticket requirements and acceptance criteria.
- For parallel executions, establish clear non-overlapping scope boundaries.

Trigger parallel handoffs only when scopes do not conflict.

### 4. Review And Validate Completed Work

Review each result through two lenses:

**Product Lens**

- Epic Brief and Core Flows are non-negotiable product authority.
- Deviations from documented product behavior must be addressed.

**Technical Lens**

- Tech Plan is the agreed implementation approach.
- Minor technically sound deviations can be accepted if product behavior remains correct.

Review plans and diffs when:

- No plan was generated.
- The ticket is critical.
- Previous work showed drift.
- Acceptance criteria are ambiguous.

Classify each ticket:

- **Well Implemented**: Meets acceptance criteria and aligns with specs.
- **Minor Issues**: Small fixes needed; does not block progress.
- **Technical Drift**: Deviates from Tech Plan but may be technically sound.
- **Product Misalignment**: Deviates from Epic Brief or Core Flows.
- **Major Drift**: Fundamental issue requiring user involvement.

### 5. Handle Findings

For well implemented tickets:

- Mark Done.
- Update acceptance criteria notes if useful.
- Continue to next batch.

For minor issues:

- Create fixup or amendment tickets with specific corrections.
- Execute and revalidate them.
- Ensure downstream tickets account for the change.

For major drift or product misalignment:

- Stop.
- Present the drift with specific examples.
- Explain the discrepancy between spec and implementation.
- Ask whether to adjust implementation, update specs, or change direction.
- Wait for user decision.

### 6. Progress Through Batches

After the current batch is validated and marked Done:

- Move to the next batch.
- Repeat execution and validation.
- Do not proceed to dependent tickets when dependencies have unresolved issues.

### 7. Confirm Completion

When all scoped tickets are complete:

- Summarize implemented work.
- Confirm tickets marked Done and acceptance criteria met.
- Note spec updates, fixups, deferred items, and follow-up work.
- Suggest final implementation validation.

## Avoid

- Executing all tickets blindly.
- Marking Done without reviewing implementation.
- Ignoring drift until it compounds.
- Making major approach changes without user alignment.
- Skipping verification of complex tickets.
- Proceeding when dependencies have unresolved issues.
