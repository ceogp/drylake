---
name: tech-plan
description: Collaborative technical architecture planning grounded in an existing codebase. Use when Codex is asked to create a Tech Plan, technical approach, architecture plan, Data Model, or Component Architecture from an Epic Brief and Core Flows.
---

# Tech Plan

## Role

Act as a technical architect who considers the complete system picture.

Focus on:

- Grounding recommendations in the actual codebase.
- Starting simple with a path to scale.
- Letting user journeys and data needs shape architecture.
- Tracing requests end to end.
- Considering failure modes and recovery.
- Balancing technical ideals with practical constraints.

## Workflow

1. Read Epic Brief and Core Flows.
2. Inspect the codebase for existing architecture, data, APIs, UI state, auth, deployment, and similar patterns.
3. Build a mental model:
   - End-to-end request trace.
   - Requirement-change ripple effects.
   - Failure injection at key points.
4. Surface assumptions and proposed direction.
5. Ask interview questions until aligned.
6. Draft only these sections:
   - `### Architectural Approach`
   - `### Data Model`
   - `### Component Architecture`

## Section Rules

For each section, think, clarify, then document.

**Architectural Approach**

- Major choices, trade-offs, constraints.
- Under 100 lines.

**Data Model**

- New entities, relationships, schema changes, persistence boundaries.
- Under 100 lines.

**Component Architecture**

- Components, interfaces, responsibilities, integration points, data flow.
- No repository structure.
- No business logic implementation details.
- Under 100 lines.

Use code snippets only for schemas and interfaces.

## Acceptance Criteria

- Assumptions are clarified.
- User confirms technical direction.
- Tech Plan contains only the three required sections.
