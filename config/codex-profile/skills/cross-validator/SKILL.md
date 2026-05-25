---
name: cross-validator
description: Validate consistency across artifact boundaries before implementation. Use when Codex is asked to check whether an Epic Brief, Core Flows, Tech Plan, and tickets tell one coherent story; detect drift between specs and tickets; reconcile artifacts before execution; or decide whether specs are ready for ticket breakdown or implementation.
---

# Cross Validator

## Role

Act as a reviewer who validates consistency across artifact boundaries: the places where specs connect to each other and where tickets derive from specs.

Focus on:

- Cross-cutting analysis: how artifacts relate to each other, not internal polish of one artifact.
- The joints between specs, not re-reviewing internals already covered by PRD or architecture validation.
- Grounding findings in specific references: cite which artifact says what.
- Calibrating interaction depth to finding significance.
- Answering: are these artifacts in a state we can confidently act on?

## Core Philosophy

Treat specs as the source of truth and tickets as derivatives.

- Ground the Epic Brief, Core Flows, and Tech Plan first.
- Use tickets as downstream signals of drift or missing coverage.
- Front-load effort in analysis, not conversation.
- Read deeply, cross-reference thoroughly, form conclusions, then present.
- Ask the user only where judgment is required to resolve a meaningful inconsistency.

## Workflow

### 1. Internalize All Artifacts

Read and internalize available artifacts:

- Epic Brief
- Core Flows
- Tech Plan
- Existing tickets, if any

Build a mental model of how concepts flow across artifact boundaries:

- Which concepts appear in multiple specs.
- Where one artifact depends on or constrains another.
- Where terms, entities, user roles, states, and flows should align.
- Where tickets reference concepts that are absent, renamed, descoped, or contradicted by the specs.

### 2. Cross-Referential Analysis

Analyze boundaries between artifacts across these dimensions:

**Conceptual Consistency**

- Check whether the same concepts, entities, roles, states, and terms are described compatibly.
- Watch for terminology drift and contradictory characterizations.

**Coverage Traceability**

- Trace from Brief requirements to Core Flows and technical support.
- Trace from Tech Plan decisions back to product requirements.
- Identify orphan requirements, orphan flows, and orphan technical decisions.

**Interface Alignment**

- Check whether data referenced in flows exists in the data model.
- Check whether interactions in flows have architectural support.
- Check whether state transitions implied by flows are technically represented.
- Check whether tickets implement interfaces and contracts described by specs.

**Specificity**

- Identify where a downstream implementation agent would be forced to make a design decision.
- Flag hand-waved behavior, unresolved choices, placeholder wording, and vague contracts.

**Assumption Coherence**

- Check whether constraints or assumptions in one artifact contradict decisions in another.
- Flag mismatches such as real-time product expectations paired with batch-only architecture.

### 3. Categorize Findings

Use judgment to classify findings by significance:

- **Blocking**: Would cause wrong implementation, major rework, or contradiction in core scope.
- **Significant**: Would create meaningful ambiguity, missing dependency, or cross-artifact drift.
- **Moderate**: Needs clarification but is unlikely to derail implementation.
- **Minor**: Naming, wording, or small traceability cleanup.

Consolidate related findings. If multiple symptoms share one root cause, present one finding.

### 4. Present Findings

Lead with the overall assessment:

- State whether the artifacts tell one coherent story.
- Explain the main reason in plain terms.

Then present findings in priority order. For each non-minor finding:

- State the inconsistency or gap.
- Cite the specific artifacts involved.
- Explain why it matters for downstream work.
- Ask focused interview questions only when user judgment is needed.

For minor fixes:

- Group them together.
- Propose corrections as a batch.
- Ask for approval before applying them.

### 5. Update Specs

After user resolves findings:

- Make targeted updates to affected specs.
- Keep changes surgical.
- Verify each update against the other artifacts before moving on.
- Do not rewrite sections that are already coherent.

### 6. Ticket Reconciliation

If no tickets exist, skip this step.

After specs are grounded, compare every ticket against the updated specs. Look for:

- Tickets referencing outdated decisions, stale terminology, or superseded architecture.
- Tickets for descoped work.
- Missing tickets for newly confirmed scope.
- Dependency changes caused by spec updates.
- Tickets that should be split because they span separate concerns.
- Tickets that should be merged because they describe one cohesive unit of work.

Apply best judgment to update, create, or obsolete tickets when appropriate. Then report:

- What changed.
- Why it changed.
- Whether any in-progress or completed ticket was modified.

If drift is too extensive to patch incrementally, recommend re-running ticket breakdown instead of forcing reconciliation.

### 7. Suggest Next Steps

- If tickets were reconciled, state that specs and tickets are aligned and suggest execution.
- If no tickets exist, suggest ticket breakdown.
- If ticket drift is extensive, suggest re-running ticket breakdown.

## Relationship To Other Skills

- Use product/PRD validation to validate product requirements internally.
- Use architecture validation to stress-test the Tech Plan internally.
- Use tech planning to create the initial Tech Plan through collaboration.
- Use ticket breakdown to create tickets from grounded specs.
- Use execution orchestration only after cross-validation confirms artifacts are coherent enough to act on.

This skill validates across those artifacts; it does not replace their internal review workflows.

## Acceptance Criteria

The cross-validation is complete only when:

- Cross-spec consistency has been evaluated across all analysis dimensions.
- Findings requiring user judgment have been resolved through clarification.
- Approved minor fixes have been applied.
- Affected specs have been updated with targeted, consistent changes.
- Specs tell one coherent story.
- If tickets exist, they have been reconciled against the grounded specs.
- The user can confidently act on the current artifact state.
