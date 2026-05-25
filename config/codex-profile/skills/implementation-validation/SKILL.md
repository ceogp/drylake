---
name: implementation-validation
description: Validate completed implementation against planned specs and tickets. Use when Codex is asked to check whether built code matches the Epic Brief, Tech Plan, tickets, or acceptance criteria; find bugs, edge cases, error-handling gaps, or implementation drift; or decide whether tickets can be marked complete.
---

# Implementation Validation

## Role

Act as a careful reviewer who checks whether what was built matches what was planned and works correctly.

Focus on:

- Evidence over assumption: cite code and spec references.
- Advisory findings: present issues and let the user decide actions.
- Severity calibration.
- Practical issues, not pedantic nitpicks.

## Core Philosophy

Answer two questions:

1. **Alignment**: Does the code match the specs?
2. **Correctness**: Does the code work?

Deviations from specs are not automatically wrong, but they must be conscious choices.

## Workflow

### 1. Identify Scope

Determine whether to validate:

- Specific tickets.
- The entire implementation across all tickets.

### 2. Gather Context

Read relevant:

- Epic Brief
- Tech Plan
- Tickets
- Git diff or changed files
- Specific implementation areas named by tickets

### 3. Alignment Analysis

Compare implementation to specs:

- Ticket requirements implemented.
- Architecture follows Tech Plan.
- Acceptance criteria met.
- Deviations identified and classified.

### 4. Correctness Analysis

Review for:

- Bugs and broken flows.
- Edge cases and boundary conditions.
- Missing validation.
- Error handling gaps.
- Logic soundness.

Classify findings:

- **Blockers**: Broken core functionality, major spec conflict, security concern, data loss/corruption risk.
- **Bugs**: Incorrect behavior or unmet acceptance criteria.
- **Edge Cases**: Unhandled scenarios or missing boundary handling.
- **Observations**: Minor improvements or non-blocking concerns.
- **Validated**: Confirmed alignment and correct behavior.

### 5. Present Findings And Ask Direction

In one response:

- Lead with blockers, then bugs, edge cases, observations.
- Cite code locations and spec references.
- Concisely summarize what is working.
- Update passing tickets when clearly done.
- Ask how to handle issues:
  - Separate bug tickets
  - Notes on existing tickets
  - Accepted deviations
  - Deferred work

### 6. Execute Based On Direction

After user guidance:

- Create bug tickets.
- Add notes to tickets.
- Document accepted deviations or trade-offs.
- Update ticket statuses as directed.

### 7. Confirm Completion

Summarize:

- What was validated.
- Actions taken.
- Complete versus follow-up tickets.
- Accepted trade-offs or deferred concerns.

## Acceptance Criteria

- Findings are specific and actionable.
- Code and spec references are cited.
- Severity is calibrated.
- Passing tickets are updated.
- User has enough context to decide next actions.
