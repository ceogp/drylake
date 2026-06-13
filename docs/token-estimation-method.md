# DryLake Token Estimation Method

## Status

DryLake's MVP token estimation is heuristic. It is intended to support routing and handoff sizing decisions before Phase 4 introduces empirical calibration.

## Inputs

The estimator accepts one of:

- raw prompt text
- structured phase data
- structured handoff data
- already rendered resource content

## Calculation model

1. Normalize the input into plain text plus structured metadata counts.
2. Estimate base prompt tokens from text length.
3. Add structural overhead for lists, headings, resource labels, and JSON framing.
4. Add target-agent overhead when a target requires a longer execution preamble.
5. Apply compression deltas for:
   - `phase_only`
   - `summarize`
   - `resource_refs`
6. Estimate output tokens separately from input tokens.

## Output fields

- `inputTokens`
- `outputTokens`
- `totalTokens`
- `confidence`
- `recommendedCompression`
- `estimatedSavingsTokens`
- `assumptions`

## Compression rules

- Prefer `resource_refs` when the client supports resources.
- Prefer `phase_only` when the agent only needs one phase and its validation checklist.
- Use `summarize` only when the original content is too large and exact text is not required.
- Never compress away explicit constraints, safety notes, or approval gates.

## Guardrails

- If estimated total tokens exceed the declared plan budget, the estimator must recommend a smaller context shape.
- Estimates must be logged to the token-budget resource and audit log.
- Estimates must identify whether the calculation assumed resources were available. This matters for tool-only clients such as OpenAI Agents and GitHub Copilot cloud agent.
