# Changelog

## 0.7.8

### Marketplace keywords

- Restored the broader 108-keyword Marketplace tag set from the better-performing late-May install run.

## 0.7.7

### Marketplace naming

- Updated the visible extension name to `Drylake- Agent Control - Free LLM - Free Security Scans - Opensource LLM`.

## 0.7.6

### Packaging and webview reliability

- Rebuilt the DryLake extension package for the current Xupra/DryLake site rollout.
- Fixed Control Room webview command-argument parsing so billing and report actions can pass structured arguments reliably.

## 0.6.52

### DryLake Guard

- Expanded the local security scan with workspace risk-surface detection for CI/CD workflows, IaC/deployment configs, deploy/release/migration scripts, risky package scripts, credential-like file paths, and generated output bloat.
- Added Bedrock OpenAI-compatible backend configuration support for hosted Xupra AI planning.

## 0.6.48

### Planning and connection flow

- Generate planning cards from the first prompt instead of forcing multiple clarification rounds before any cards appear.
- Refine existing cards in follow-up chat with shorter guidance about what to tighten next.
- Reworked the planning-steps help affordance into an inline explainer and tightened dark-mode styling for the planning model picker.
- Made browser handoff after approval optional so the editor poll path can complete connection without an extra redirect.

## 0.6.44

### Marketplace media

- Switched the Marketplace workflow GIF to a versioned 6-phase handoff URL so cached older demos are not reused.

## 0.6.43

### Workflow fidelity

- Added cross-agent DryLake skill/profile selection for all phase agents.
- Updated the Marketplace workflow GIF wording to match handoff-launch behavior.

## 0.6.42

### Marketplace media

- Updated the workflow GIF to show card rearranging, per-card agent and skill assignment, per-phase terminal creation, and a longer outcome screen with token usage.

## 0.6.41

### Marketplace media

- Slowed the Marketplace workflow GIF to half speed so the planning, skills, and handoff sequence is easier to follow.

## 0.6.40

### Marketplace media

- Replaced the Marketplace workflow GIF with a higher-fidelity DryLake planning, skills, and sequential agent handoff animation.

## 0.6.39

### Marketplace positioning

- Updated the Marketplace display name to `DryLake Agent AI planner for Agents Skills - Cline Codex Claude Hermes Continue Kilo`.

## 0.6.38

### Agent handoff reliability

- Added Continue CLI headless edit/write/bash allowances for generated phase handoffs.
- Switched Auggie CLI handoffs to instruction-file input so larger DryLake prompts do not rely on inline command text.

## 0.6.37

### Marketplace README

- Added a supported coding agents section for Claude Code, Codex, Gemini, Hermes, Cursor, Copilot, Blackbox, Goose, OpenCode, Qwen, Continue, Cline, Aider, Kilo, and Auggie.
- Clarified that direct handoffs require the matching local CLI and fall back to Markdown prompts when missing.

## 0.6.36

### Agent compatibility

- Added selectable phase and multi-agent handoffs for Blackbox CLI, Goose CLI, OpenCode, Qwen Code, Continue CLI, Cline CLI, Aider, Kilo Code, and Auggie CLI.
- Restored broader Marketplace categories and added the new agent names to Marketplace keywords.

## 0.6.35

### Marketplace positioning

- Restored the higher-performing Marketplace display name, description, categories, and broad keyword set from the late-May install run.

## 0.6.34

### Marketplace proof

- Moved the 99VC and AWS Startups backing statement to the top of the Marketplace README.

## 0.6.33

### Marketplace conversion

- Added an autoplaying DryLake workflow GIF showing planning cards, agent selection, skills, and sequential handoffs.
- Updated Marketplace README copy around free AI planning, token savings, skills, and bring-your-own API/model positioning.
- Expanded Marketplace keywords with free AI, free LLM, Claude Code, OpenRouter, Sonnet, Traycer, and agent orchestration terms.

## 0.6.32

### Marketplace metadata

- Updated the extension display name to `Drylake Agent -AI Coding Copilot`.
- Added a top-of-page Marketplace README feature callout block for agent planning, skills, token-aware handoffs, and visual orchestration.

## 0.6.31

### Marketplace metadata

- Updated the Marketplace description to lead with token savings, engineering time savings, phased plans, and skill-based pipelines.
- Converted the Marketplace metadata check script to ESM so repo lint passes in CI.

## 0.6.30

### Marketplace positioning

- Renamed the extension display name to `DryLake — Agent Orchestration for Claude Code, Codex & Cursor`.
- Updated the Marketplace description to clarify the ticket-to-phased-handoff workflow.
- Reduced Marketplace keywords to 30 high-intent search terms.
- Improved README positioning around agent orchestration, visual planning, token-aware handoffs, and multi-agent workflows.
