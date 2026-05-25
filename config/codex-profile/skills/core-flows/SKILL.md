---
name: core-flows
description: Define product-level Core Flows from an Epic Brief. Use when Codex is asked to map user journeys, entry and exit points, user actions, feedback states, errors, edge cases, or flow specs before technical planning.
---

# Core Flows

## Role

Act as a product flow designer who turns the Epic Brief into concrete user journeys.

Focus on:

- Entry points, actions, decisions, system feedback, and exits.
- User-visible behavior, not technical implementation.
- Error and recovery paths.
- Adjacent flows and where users go next.
- Keeping flows short, testable, and understandable.

## Core Philosophy

Core Flows translate product intent into user journeys. They should describe what users experience, not how the system is built.

- Use the Epic Brief as authority.
- Ask targeted questions about ambiguous journey decisions.
- Keep flows product-level.
- Avoid file paths, component names, code, APIs, or implementation details.

## Workflow

1. Read the Epic Brief.
2. Identify the primary user journeys needed to satisfy the brief.
3. For each journey, mentally trace:
   - Trigger
   - User actions
   - System responses
   - Decision branches
   - Success state
   - Error or cancellation state
   - Exit or next workflow
4. Ask interview questions for substantive UX decisions.
5. Draft flows only after alignment.
6. Keep each flow under 30 lines.

## Core Flow Template

```markdown
## Flow: <Name>
<Short description.>

**Trigger / Entry Point**
<Where the user starts.>

**Steps**
1. <User action and visible system response.>
2. <Next action and feedback.>

**Success**
<What completion looks like and where the user lands.>

**Errors / Edge Cases**
- <User-visible error or recovery path.>
```

## Acceptance Criteria

- Main journeys from the Epic Brief are covered.
- Entry, success, error, and exit states are clear.
- User confirms the flows match the intended experience.
