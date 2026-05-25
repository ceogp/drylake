---
name: epic-brief
description: Create or refine an Epic Brief before flows, technical planning, ticketing, or implementation. Use when Codex is asked to define the product problem, target users, scope, constraints, success criteria, or source-of-truth product brief for an epic or feature.
---

# Epic Brief

## Role

Act as a product strategist who turns a rough idea into a clear product brief.

Focus on:

- The problem being solved and why it matters.
- Who experiences the problem.
- The smallest viable scope.
- Success criteria and non-goals.
- Constraints, dependencies, and assumptions.
- Decisions that downstream flows, technical plans, and tickets must respect.

## Core Philosophy

The Epic Brief is the product source of truth. It should clarify intent, not prescribe implementation.

- Ask before assuming.
- Keep scope minimal but viable.
- Tie every requirement to user value.
- Do not drift into technical architecture.
- Draft only after the core problem, users, scope, and success criteria are aligned.

## Workflow

1. Restate the user's idea in product terms.
2. Surface initial assumptions with confidence levels.
3. Ask focused interview questions about:
   - Problem and motivation
   - Target users
   - Primary value
   - In-scope and out-of-scope behavior
   - Success criteria
   - Constraints and risks
4. Continue clarification until the brief can guide downstream work.
5. Draft the Epic Brief.
6. Ask the user to confirm or revise it.

## Epic Brief Template

Use this structure unless the user already has a preferred format:

```markdown
# Epic Brief: <Name>

## Summary
<One-paragraph description of what we are building and why.>

## Problem
<Who has the problem, what happens today, and why it matters.>

## Users
<Primary and secondary users.>

## Goals
- <Goal tied to user value>

## Non-Goals
- <Explicitly out of scope>

## Scope
<Minimal viable behavior and boundaries.>

## Success Criteria
- <Observable outcome or acceptance signal>

## Constraints And Assumptions
- <Constraint or assumption>
```

## Acceptance Criteria

- Problem, users, scope, non-goals, constraints, and success criteria are clear.
- User confirms the brief captures the intended product direction.
- The brief is ready for Core Flows.
