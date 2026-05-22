import type { ApplicationBuildRunbook, XuMode, XuStep } from "./types";

function toSteps(phaseId: string, items: string[]): XuStep[] {
  return items.map((text, index) => ({
    id: `${phaseId}-step-${String(index + 1).padStart(2, "0")}`,
    text,
    status: "pending",
  }));
}

function slugifyName(prompt: string) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "drylake-runbook";
}

export function createStarterXu(params: {
  prompt?: string;
  mode?: XuMode;
  name?: string;
} = {}): ApplicationBuildRunbook {
  const prompt = params.prompt?.trim() ?? "";
  const mode = params.mode ?? "build-app";

  return {
    xu: 1,
    kind: "ApplicationBuildRunbook",
    metadata: {
      name: params.name?.trim() || slugifyName(prompt) || "drylake-runbook",
      owner: "local",
      status: "draft",
      mode,
    },
    intent: {
      rawPrompt: prompt,
      purpose: "",
      users: [],
      goals: [],
      nonGoals: [],
      constraints: [],
    },
    confirmation: {
      required: true,
      status: "pending",
      userApprovedIntent: false,
      userApprovedArchitecture: false,
      userApprovedProvisioning: false,
    },
    architecture: {
      status: "proposed",
      summary: "",
      decisions: [],
      risks: [],
      assumptions: [],
    },
    provisioning: {
      status: "draft",
      commands: [],
      filesToCreate: [],
      environmentVariables: [],
      externalServices: [],
      safety: {
        requiresApprovalBeforeExecution: true,
        executeAutomatically: false,
      },
    },
    phases: [
      {
        id: "01-intake",
        title: "Confirm application purpose",
        gate: "user-confirmation",
        status: "pending",
        objective: "Confirm what the user wants built.",
        inputs: ["user prompt"],
        outputs: ["confirmed purpose", "goals", "non-goals", "constraints"],
        steps: toSteps("01-intake", [
          "Parse the user prompt.",
          "Identify the application purpose.",
          "Identify target users.",
          "Identify non-goals and constraints.",
          "Ask the user to confirm before architecture work starts.",
        ]),
        acceptance: [
          "Purpose is confirmed.",
          "Goals and non-goals are explicit.",
          "Constraints are recorded.",
        ],
      },
      {
        id: "02-architecture",
        title: "Approve architecture",
        gate: "architecture-approval",
        status: "pending",
        objective: "Agree on technical architecture before implementation.",
        inputs: [],
        outputs: [],
        steps: toSteps("02-architecture", [
          "Propose architecture.",
          "List major dependencies.",
          "List data model assumptions.",
          "List deployment assumptions.",
          "Ask the user to approve or revise.",
        ]),
        acceptance: [
          "Architecture is approved.",
          "Risks and assumptions are documented.",
        ],
      },
      {
        id: "03-provisioning",
        title: "Preview provisioning",
        gate: "provisioning-approval",
        status: "pending",
        objective: "Preview project setup, commands, files, and environment requirements.",
        inputs: [],
        outputs: [],
        steps: toSteps("03-provisioning", [
          "Generate setup commands.",
          "Generate file creation plan.",
          "Generate environment variable list.",
          "Require approval before running or handing off commands.",
        ]),
        acceptance: [
          "Provisioning plan is approved.",
          "No command executes without user confirmation.",
        ],
      },
      {
        id: "04-implementation",
        title: "Implement in vertical slices",
        gate: "phase-review",
        status: "pending",
        objective: "Build the application step by step.",
        inputs: [],
        outputs: [],
        steps: toSteps("04-implementation", [
          "Implement one thin vertical slice.",
          "Avoid unrelated refactors.",
          "Keep changes reversible.",
          "Verify each phase before continuing.",
        ]),
        acceptance: [
          "Changed files are summarized.",
          "Checks pass or failures are explained.",
        ],
      },
      {
        id: "05-verification",
        title: "Verify and hand off",
        gate: "final-review",
        status: "pending",
        objective: "Validate implementation and produce final handoff.",
        inputs: [],
        outputs: [],
        steps: toSteps("05-verification", [
          "Run build.",
          "Run tests.",
          "Run lint.",
          "Summarize changed files.",
          "Summarize remaining risks.",
        ]),
        acceptance: [
          "Verification is complete.",
          "Handoff notes are generated.",
        ],
      },
    ],
    checks: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      lint: "npm run lint",
    },
    agentTargets: {
      agentsMd: true,
      claudeMd: true,
      copilotInstructions: true,
      cursorRules: true,
      codexSkill: true,
      openclawSkill: true,
    },
    handoff: {
      defaultAgent: "claude-code",
      autopilot: false,
      instructions: [
        "Follow phases in order.",
        "Do not skip approval gates.",
        "Do not provision infrastructure without explicit confirmation.",
        "Always summarize changed files and verification results.",
      ],
    },
  };
}

