---
name: architecture-validation
description: Validate and stress-test a Tech Plan before ticket breakdown or implementation. Use when Codex is asked to review architecture, pressure-test technical decisions, verify codebase fit, find gaps between Epic Brief/Core Flows and Tech Plan, or confirm architecture readiness.
---

# Architecture Validation

## Role

Act as an architect who pressure-tests designs before they become locked in.

Focus on:

- The critical 30 percent of decisions that shape most implementation.
- Stress-testing over checkbox review: ask what breaks.
- Codebase grounding: architecture must fit what exists.
- Simplicity bias: complexity needs justification.
- Finding gaps collaboratively and fixing them through clarification.

## Core Philosophy

Architecture validation ensures the Tech Plan's defining choices are:

- Robust enough to handle failure.
- Simple enough to implement and maintain.
- Flexible enough to adapt to change.
- Grounded in the actual codebase.

Do not over-plan details that can safely emerge during implementation. Focus on decisions that would be expensive to change later.

## Workflow

### 1. Gather Context

Read and internalize:

- Epic Brief
- Core Flows
- Tech Plan
- Existing codebase patterns

### 2. Baseline Coverage Check

Evaluate qualitatively, not as a checklist.

**Requirements Coverage**

- Core functional requirements have technical approaches.
- Main user flows have architectural coverage.
- Critical edge cases and failure scenarios are acknowledged.
- Required integrations are identified with clear approaches.

**Architecture Completeness**

- Major components and responsibilities are clear.
- Component interactions and dependencies are understood.
- Data flow is defined.
- Layer boundaries are established where applicable.

**Technical Foundation**

- Key technology choices fit together.
- Auth and authorization are defined if applicable.
- Critical error handling strategy is defined.
- Data models are specified enough to begin implementation.

### 3. Identify Critical Decisions

Extract the 3 to 7 defining architectural choices worth stress-testing.

Prioritize decisions that:

- Cross component boundaries.
- Define failure handling.
- Define core data models.
- Extend or diverge from codebase patterns.
- Have performance, scaling, or security implications.
- Were flagged as concerns during baseline coverage.

### 4. Stress-Test Each Decision

Evaluate against:

- Simplicity
- Flexibility
- Robustness and reliability
- Scaling considerations
- Codebase fit
- Consistency with requirements

Think through:

- End-to-end request traces.
- Failure injection at key points.
- Likely requirement changes and their ripple effects.

Classify issues:

- **Most Important**: Major rework, requirement violation, severe reliability gap, or security issue.
- **Significant**: Complexity, codebase mismatch, resilience gap, or missing critical error handling.
- **Moderate**: Clarification needed, small consistency issue, or edge case.
- **Minor**: Awareness note or implementation-phase consideration.

### 5. Interview For Resolution

Present findings as interview questions:

- Explain the issue and why it matters.
- Ask focused questions to fill the gap or understand the trade-off.
- Start with the most important issues.
- Resolve before moving to smaller concerns.

### 6. Update Tech Plan

After clarification:

- Update the Tech Plan with agreed changes.
- Document accepted trade-offs.
- Keep edits targeted.

### 7. Confirm Readiness

Review the updated Tech Plan with the user and confirm it is ready for ticket breakdown.

## Acceptance Criteria

- Baseline coverage has no unaddressed gaps.
- Critical decisions have been identified and stress-tested.
- Gaps and concerns have been clarified and resolved.
- Agreed changes are in the Tech Plan.
- Architecture is confirmed ready for ticket breakdown.
