export type InstallTargetSlug = "claude" | "codex" | "gemini" | "cursor" | "aider" | "copilot" | "augment";

export type InstallTargetInfo = {
  slug: InstallTargetSlug;
  name: string;
  color: string;
  summary: string;
  steps: string[];
  output: string;
};

export const installTargets: InstallTargetInfo[] = [
  {
    slug: "claude",
    name: "Claude Code",
    color: "#005caf",
    summary: "DryLake hands a phase to Claude Code with scoped instructions.",
    steps: ["Pick Claude Code for a phase.", "Choose direct run, script, copy, or markdown.", "Claude works from the phase plan."],
    output: "A Claude Code handoff that includes the current objective and checklist.",
  },
  {
    slug: "codex",
    name: "Codex",
    color: "#36b979",
    summary: "DryLake can run Codex CLI with the selected phase prompt.",
    steps: ["Pick Codex for a phase.", "Choose direct run or export a script.", "Codex receives only that phase of work."],
    output: "A Codex-ready prompt plus optional .sh or .bat handoff script.",
  },
  {
    slug: "gemini",
    name: "Gemini",
    color: "#e6007e",
    summary: "DryLake supports Gemini CLI phase handoff through the verified launcher.",
    steps: ["Pick Gemini CLI for a phase.", "Choose direct run or export a script.", "Gemini receives the exact phase prompt."],
    output: "A Gemini CLI command using the phase prompt.",
  },
  {
    slug: "cursor",
    name: "Cursor CLI",
    color: "#f7f4ea",
    summary: "DryLake prepares a phase prompt for Cursor CLI workflows.",
    steps: ["Pick Cursor CLI for a phase.", "Choose direct run or export a script.", "Run the phase from your repo."],
    output: "A Cursor CLI handoff scoped to one phase.",
  },
  {
    slug: "aider",
    name: "Aider",
    color: "#f7f4ea",
    summary: "DryLake can launch Aider with the current phase context.",
    steps: ["Pick Aider for a phase.", "Choose direct run or a script file.", "Run the phase against your repo."],
    output: "An Aider handoff command scoped to the current phase.",
  },
  {
    slug: "copilot",
    name: "GitHub Copilot",
    color: "#36b979",
    summary: "DryLake prepares the phase prompt for GitHub Copilot Chat in VS Code.",
    steps: ["Pick GitHub Copilot for a phase.", "Choose VS Code handoff.", "Review the prompt in Copilot Chat."],
    output: "A focused phase prompt with the plan, steps, and validation notes.",
  },
  {
    slug: "augment",
    name: "Augment",
    color: "#e6007e",
    summary: "DryLake exports phase handoffs for Augment or Auggie CLI workflows.",
    steps: ["Pick Augment for a phase.", "Copy, export markdown, or use a script handoff.", "Run the phase in the Augment workflow."],
    output: "An Augment-ready phase handoff with objective and steps.",
  },
];

export function getInstallTarget(slug: string) {
  return installTargets.find((target) => target.slug === slug) ?? null;
}