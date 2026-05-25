---
name: traycer
description: Orchestrate the full Traycer-style workflow from product brief through implementation and final cross-validation. Use when Codex is asked to run the complete lifecycle, coordinate epic brief, core flows, PM refinement, tech plan, architecture validation, ticket breakdown, execution, implementation validation, requirements revision, and final cross-validator steps.
---

# Traycer

## Role

Act as a workflow orchestrator that runs the planning-to-execution lifecycle in order.

The goal is to move an idea through aligned specs, validated architecture, executable tickets, implementation, implementation validation, requirement revision if needed, and final cross-artifact consistency.

## Ordered Workflow

Run these phases in order:

1. `$epic-brief`
2. `$core-flows`
3. `$pm`
4. `$tech-plan`
5. `$architecture-validation`
6. `$ticket-breakdown`
7. `$execute`
8. `$implementation-validation`
9. `$revise-requirements`
10. `$cross-validator`

Cross-validator runs at the end, after requirement revision and implementation validation, so it checks the final artifact state.

## Orchestration Rules

- Do not skip phase gates.
- Stop when a phase requires user input, decision, or approval.
- Keep the user updated on important findings, blockers, and decisions.
- Tell the user when tickets need to be created, changed, split, merged, or obsoleted.
- Keep artifacts synchronized as phases progress.
- Do not implement until planning, validation, and ticket breakdown are complete.
- Do not mark work complete until implementation validation has passed or the user accepts deviations.
- If requirements change at any point, route through `$revise-requirements` before continuing.
- If artifacts drift, route through `$cross-validator` at the final reconciliation step.

## Phase Gates

### 1. Epic Brief

Use `$epic-brief` to define:

- Problem
- Users
- Goals
- Non-goals
- Scope
- Success criteria
- Constraints and assumptions

Gate: user confirms the Epic Brief.

### 2. Core Flows

Use `$core-flows` to define user journeys.

Gate: user confirms the flows.

### 3. PM Refinement

Use `$pm` to refine product decisions:

- Information hierarchy
- Placement
- Discoverability
- Feedback states
- Edge cases

Gate: user confirms the product experience.

### 4. Tech Plan

Use `$tech-plan` to create:

- Architectural Approach
- Data Model
- Component Architecture

Gate: user confirms technical direction.

### 5. Architecture Validation

Use `$architecture-validation` to stress-test the Tech Plan.

Gate: critical architecture issues are resolved.

### 6. Ticket Breakdown

Use `$ticket-breakdown` to create story-sized tickets and dependencies.

Gate: user approves ticket breakdown and dependency order.

### 7. Execute

Use `$execute` to implement tickets in dependency order.

Gate: each ticket is implemented and reviewed before dependent work proceeds.

### 8. Implementation Validation

Use `$implementation-validation` to check implementation alignment and correctness.

Gate: blockers and bugs are resolved or explicitly accepted/deferred by user.

### 9. Revise Requirements

Use `$revise-requirements` when implementation or user feedback changes requirements.

Gate: affected specs are updated and confirmed.

If no requirements changed, explicitly state that this phase is skipped.

### 10. Cross Validator

Use `$cross-validator` for final holistic consistency across specs and tickets.

Gate: artifacts tell one coherent story and the user can confidently act on them.

## Status Updates

At each phase transition, report:

- Current phase.
- What was completed.
- What decision or artifact is needed next.
- Any risks, drift, or tickets that need attention.

Keep updates concise and action-oriented.

## Completion Criteria

The Traycer workflow is complete when:

- Product brief and flows are confirmed.
- Tech Plan is validated.
- Tickets are created and reconciled.
- Implementation is executed and validated.
- Requirement changes, if any, are propagated.
- Final cross-validation passes or the user accepts remaining risks.
