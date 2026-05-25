---
name: revise-requirements
description: Propagate requirement changes through an established plan. Use when Codex is asked to revise requirements, update specs after scope changes, trace ripple effects across Epic Brief/Core Flows/Tech Plan/tickets, or keep downstream artifacts consistent after a product or technical change.
---

# Revise Requirements

## Role

Act as a strategic planner who traces the ripple effects of change across an established plan.

Focus on:

- Understanding the full picture before editing.
- Tracing cascading effects through interconnected specs.
- Targeted updates, not rewrites.
- Maintaining consistency across all affected artifacts.
- Surfacing non-obvious downstream effects.

## Core Philosophy

Requirements change. Propagate change deliberately and completely.

- Understand the change before impact analysis.
- Comprehensive impact analysis prevents half-updated specs.
- Preserve work that still holds.
- Each affected spec deserves alignment before editing.
- Multiple clarification rounds are normal.

## Workflow

### 1. Internalize Current State

Read:

- Epic Brief
- Core Flows
- Tech Plan
- Tickets

Build a mental model of how they connect.

### 2. Understand The Change

Use interview questions until the change is precise:

- What changed?
- Why did it change?
- What is the broader intention?
- What does the user believe is affected?

Do not proceed to impact analysis until the change is crystallized.

### 3. Impact Analysis

For each spec, assess:

- Is it affected?
- Which sections need revision?
- Severity: minor tweak or significant rework.
- Preliminary proposal.

Think through second-order effects:

- Flow changes affecting architecture.
- Data model changes affecting UI flows.
- Scope shifts making flows or tech decisions unnecessary.

### 4. Present Impact Analysis

Present a high-level map:

- Affected artifact.
- Why it is affected.
- Severity.
- Proposed direction.

Get user agreement before editing.

### 5. Update Specs In Order

Update top-down:

1. Epic Brief
2. Core Flows
3. Tech Plan

For each spec:

- Think through what changes and what stays.
- Ask interview questions for new decision points.
- Update surgically.
- Verify consistency against already-updated specs.

Use the right lens:

- **Epic Brief**: problem, users, scope, constraints, summary.
- **Core Flows**: information hierarchy, journey, placement, feedback, states.
- **Tech Plan**: architecture, data model, components, codebase fit, failure modes.

### 6. Progress Through Affected Specs

Complete one spec before moving to the next.

### 7. Wrap Up

Confirm the updated specs reflect the intended change.

Summarize:

- What changed.
- What stayed the same.
- Which downstream work should be re-planned.

Suggest ticket breakdown or validation if warranted.

## Acceptance Criteria

- Requirement change is clearly understood.
- Impact analysis identifies affected specs and sections.
- User agrees with impact before updates.
- Specs are updated surgically and consistently.
- Updated specs do not contradict each other.
- Downstream re-planning is suggested.
