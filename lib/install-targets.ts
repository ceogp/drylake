export type InstallTargetSlug = "claude" | "codex" | "gemini" | "cursor" | "copilot";

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
    steps: ["Pick Claude Code for a phase.", "Press Run Handoff.", "Claude works from the phase plan with `claude -p`."],
    output: "A Claude Code handoff that includes the current objective and checklist.",
  },
  {
    slug: "codex",
    name: "OpenAI Codex",
    color: "#36b979",
    summary: "DryLake can run Codex CLI with the selected phase prompt.",
    steps: ["Pick OpenAI Codex for a phase.", "Press Run Handoff.", "Codex receives only that phase of work with `codex exec`."],
    output: "A Codex-ready prompt plus optional .sh or .bat handoff script.",
  },
  {
    slug: "gemini",
    name: "Gemini CLI",
    color: "#e6007e",
    summary: "DryLake supports Gemini CLI phase handoff through the verified launcher.",
    steps: ["Pick Gemini CLI for a phase.", "Press Run Handoff.", "Gemini receives the exact phase prompt with `gemini -p`."],
    output: "A Gemini CLI command using the phase prompt.",
  },
  {
    slug: "cursor",
    name: "Cursor CLI",
    color: "#f7f4ea",
    summary: "DryLake prepares a phase prompt for Cursor CLI workflows.",
    steps: ["Pick Cursor CLI for a phase.", "Press Run Handoff.", "Run the phase from your repo with `cursor-agent -p`."],
    output: "A Cursor CLI handoff scoped to one phase.",
  },
  {
    slug: "copilot",
    name: "GitHub Copilot Chat",
    color: "#36b979",
    summary: "DryLake prepares the phase prompt for GitHub Copilot Chat in VS Code.",
    steps: ["Pick GitHub Copilot Chat for a phase.", "Press Run Handoff.", "Review the prompt in Copilot Chat."],
    output: "A focused phase prompt with the plan, steps, and validation notes.",
  },
];

export function getInstallTarget(slug: string) {
  return installTargets.find((target) => target.slug === slug) ?? null;
}
