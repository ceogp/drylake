import * as vscode from "vscode";
import os from "node:os";
import path from "node:path";

import { scanWorkspaceFiles } from "./workspaceScanner";

export type GuardSeverity = "critical" | "high" | "medium" | "low" | "info";
export type SafeDeveloperRank = "Scout" | "Builder" | "Operator" | "Guardian" | "Sentinel";
export type GuardFindingCategory =
  | "prompt-injection"
  | "supply-chain"
  | "mcp-risk"
  | "agent-reliability"
  | "ide-extension-access"
  | "secret-hygiene"
  | "ide-bloat"
  | "token-waste"
  | "blast-radius"
  | "deploy-surface"
  | "suspicious-artifact";

export type GuardFinding = {
  id: string;
  category: GuardFindingCategory;
  severity: GuardSeverity;
  title: string;
  evidence: string;
  recommendation: string;
  safeToShare: boolean;
  detail: string;
  source: "agent" | "extension" | "file" | "mcp" | "workspace";
  path?: string;
  line?: number;
};

export type GuardExtensionRisk = {
  id: string;
  displayName: string;
  publisher: string;
  version: string;
  isActive: boolean;
  isBuiltin: boolean;
  accessLevel: "low" | "medium" | "high";
  activationEvents: string[];
  contributionPoints: string[];
  accessSignals: string[];
  capabilityTags: string[];
  riskFlags: string[];
  manifestEvidence: string[];
};

export type GuardSecretFinding = {
  path: string;
  line?: number;
  type: string;
  variableName?: string;
  severity: GuardSeverity;
  evidence: string;
};

export type GuardMcpServer = {
  configPath: string;
  name: string;
  command?: string;
  args: string[];
  url?: string;
  envKeys: string[];
  capabilities: string[];
  riskFlags: string[];
  severity: GuardSeverity;
  blastRadius: string;
};

export type GuardConnectionMap = {
  nodes: Array<{
    id: string;
    type: "ide" | "extension" | "agent-config" | "mcp" | "secret" | "workspace-surface";
    label: string;
    severity: GuardSeverity;
    summary: string;
    capabilities: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
    severity: GuardSeverity;
  }>;
  highRiskPaths: string[];
};

export type GuardWorkspaceSurface = {
  deploymentFiles: Array<{ path: string; type: string }>;
  iacFiles: Array<{ path: string; type: string }>;
  ciWorkflowFiles: Array<{ path: string; type: string }>;
  credentialLikeFiles: Array<{ path: string; type: string }>;
  riskyPackageScripts: Array<{ path: string; name: string; risk: string }>;
  generatedFolders: Array<{ path: string; fileCount: number }>;
};

export type GuardScanResult = {
  scannedAt: string;
  score: number;
  rank: SafeDeveloperRank;
  categoryScores: {
    mcpRisk: number;
    agentReliability: number;
    secretHygiene: number;
    ideBloat: number;
    tokenWaste: number;
    blastRadius: number;
  };
  summary: {
    agentFiles: number;
    skills: number;
    rules: number;
    extensions: number;
    activeExtensions: number;
    riskyFiles: number;
    workspaceSurface: number;
    mcpServers: number;
    highImpactConnections: number;
    findings: number;
    critical: number;
    high: number;
    medium: number;
  };
  packageManagers: string[];
  packageScripts: string[];
  agentFiles: Array<{ logicalPath: string; category: string }>;
  extensions: GuardExtensionRisk[];
  secrets: GuardSecretFinding[];
  mcpServers: GuardMcpServer[];
  workspaceSurface: GuardWorkspaceSurface;
  connectionMap: GuardConnectionMap;
  findings: GuardFinding[];
};

type ScannedAgentFile = { logicalPath: string; category: string; content?: string };
export type GuardUploadArtifact = {
  kind: "mcp-config" | "skill" | "agent-rule" | "instruction" | "guard-report";
  logicalPath: string;
  content: string;
  mimeType?: string;
};

type PackageContext = {
  packageManagers: string[];
  packageScripts: string[];
  riskyPackageScripts: GuardWorkspaceSurface["riskyPackageScripts"];
};

export const SAFE_DEVELOPER_REPORT_PATH = [".drylake", "reports", "safe-developer-report.md"] as const;
export const SAFE_DEVELOPER_SCORE_PATH = [".drylake", "reports", "safe-developer-score.json"] as const;
export const SAFE_DEVELOPER_FINDINGS_PATH = [".drylake", "reports", "findings.json"] as const;
export const AGENTIC_MAP_PATH = [".drylake", "reports", "agentic-map.json"] as const;
export const SHAREABLE_SAFE_DEVELOPER_REPORT_PATH = [".drylake", "reports", "safe-developer-shareable.md"] as const;
export const TEAM_BASELINE_PATH = [".drylake", "team-baseline.yaml"] as const;

export type GuardReportPaths = {
  report: vscode.Uri;
  score: vscode.Uri;
  findings: vscode.Uri;
  agenticMap: vscode.Uri;
};

const SECRET_FILE_PATTERNS = [
  "**/.env",
  "**/.env.*",
  "**/*.pem",
  "**/*.key",
  "**/.npmrc",
  "**/.pypirc",
  "**/*credentials*.json",
  "**/*service*account*.json",
  "**/package.json",
  "**/.vscode/tasks.json",
  "**/.github/workflows/*.yml",
  "**/.github/workflows/*.yaml",
];

const PACKAGE_CONTEXT_PATTERNS = [
  "**/package.json",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/bun.lockb",
];

const WORKSPACE_SURFACE_PATTERNS = [
  "**/.github/workflows/*.yml",
  "**/.github/workflows/*.yaml",
  "**/.gitlab-ci.yml",
  "**/bitbucket-pipelines.yml",
  "**/Dockerfile",
  "**/*.dockerfile",
  "**/docker-compose*.yml",
  "**/docker-compose*.yaml",
  "**/*.tf",
  "**/*.tfvars",
  "**/terraform*.tfvars",
  "**/k8s/**/*.yml",
  "**/k8s/**/*.yaml",
  "**/kubernetes/**/*.yml",
  "**/kubernetes/**/*.yaml",
  "**/helm/**/*.yml",
  "**/helm/**/*.yaml",
  "**/charts/**/*.yml",
  "**/charts/**/*.yaml",
  "**/serverless.yml",
  "**/serverless.yaml",
  "**/cloudformation*.yml",
  "**/cloudformation*.yaml",
  "**/cloudformation*.json",
  "**/template.yml",
  "**/template.yaml",
  "**/cdk.json",
  "**/samconfig.toml",
  "**/*deploy*.sh",
  "**/*deploy*.ps1",
  "**/*release*.sh",
  "**/*release*.ps1",
  "**/*migrate*.sh",
  "**/*migrate*.ps1",
  "**/*.pem",
  "**/*.key",
  "**/*credential*",
  "**/*secret*",
  "**/*service*account*",
];

const GENERATED_SURFACE_PATTERNS = [
  "**/generated/**",
  "**/.drylake/generated/**",
  "**/raw_source/**",
  "**/generated_export/**",
  "**/deployment_output/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
];

const MCP_CONFIG_PATTERNS = [
  "**/.vscode/mcp.json",
  "**/.cursor/mcp.json",
  "**/.mcp.json",
  "**/mcp.json",
  "**/claude_desktop_config.json",
];

const EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage,storage,.venv,__pycache__,google-cloud-sdk,generated_export,raw_source,deployment_output,worker-smoke,.system}/**";
const GENERATED_SCAN_EXCLUDE_PATTERN = "**/{node_modules,.git,.next,storage,.venv,__pycache__,google-cloud-sdk,worker-smoke,.system}/**";
const MAX_SECURITY_FILES = 220;
const MAX_FILE_BYTES = 256 * 1024;

const KNOWN_PUBLISHERS = new Set([
  "ms-vscode",
  "ms-vscode-remote",
  "ms-python",
  "github",
  "github.copilot",
  "redhat",
  "esbenp",
  "dbaeumer",
  "eamodio",
  "anthropic",
  "openai",
  "google",
  "xupracorp",
]);

const SECRET_PATTERNS: Array<{
  type: string;
  severity: GuardSeverity;
  pattern: RegExp;
}> = [
  { type: "Private key", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PRIVATE )?PRIVATE KEY-----/i },
  { type: "AWS access key", severity: "critical", pattern: /AKIA[0-9A-Z]{16}/ },
  { type: "GitHub token", severity: "high", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { type: "Anthropic API key", severity: "high", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { type: "OpenAI API key", severity: "high", pattern: /sk-[A-Za-z0-9_-]{24,}/ },
  { type: "Slack token", severity: "high", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { type: "Database URL with password", severity: "high", pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/i },
  {
    type: "Secret-like assignment",
    severity: "medium",
    pattern: /\b(?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*["']?[^"'\s#]{8,}/i,
  },
];

const PROMPT_INJECTION_PATTERNS: Array<{ label: string; pattern: RegExp; severity: GuardSeverity; recommendation: string }> = [
  {
    label: "instruction override",
    pattern: /\b(ignore|forget|bypass|override)\b.{0,80}\b(previous|prior|system|developer|safety|security)\b.{0,40}\b(instruction|rule|policy|guardrail)s?\b/i,
    severity: "high",
    recommendation: "Remove prompt text that tells agents to ignore higher-priority or security instructions.",
  },
  {
    label: "secret exfiltration request",
    pattern: /\b(reveal|print|dump|exfiltrate|upload|send|curl|post)\b.{0,100}\b(secret|token|api[_-]?key|private[_-]?key|\.env|credential)s?\b/i,
    severity: "critical",
    recommendation: "Remove instructions that request secret disclosure or file exfiltration.",
  },
  {
    label: "remote prompt include",
    pattern: /\b(fetch|load|include|download|source)\b.{0,80}\bhttps?:\/\/[^\s)]+/i,
    severity: "medium",
    recommendation: "Pin and review remote prompt material before allowing agents to consume it.",
  },
  {
    label: "tool or shell escalation",
    pattern: /\b(run|execute|spawn|invoke)\b.{0,80}\b(shell|terminal|powershell|bash|curl|wget|network|filesystem)\b/i,
    severity: "medium",
    recommendation: "Require explicit approval before prompt files grant shell, filesystem, or network access.",
  },
];

const HIDDEN_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/;
const SUSPICIOUS_ARTIFACT_PATTERN = /\.(exe|dll|scr|bat|cmd|ps1|sh|jar|wasm|zip|tar|tgz|gz|7z|rar)$/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function extensionContributionPoints(packageJson: Record<string, unknown>) {
  return Object.keys(asRecord(packageJson.contributes)).sort();
}

function normalizedPublisher(extensionId: string, packageJson: Record<string, unknown>) {
  const publisher = readString(packageJson.publisher);
  if (publisher) {
    return publisher.toLowerCase();
  }

  return extensionId.split(".")[0]?.toLowerCase() ?? "";
}

function extensionAccessSignals(packageJson: Record<string, unknown>, activationEvents: string[], contributionPoints: string[]) {
  const signals = new Set<string>();
  const extensionKind = readStringArray(packageJson.extensionKind).join(", ");
  const commandText = commandTitles(packageJson).join(" ").toLowerCase();

  signals.add("Can execute extension-host code after activation; VS Code does not expose a browser-style permission list.");

  if (activationEvents.some((event) => event === "*" || event === "onStartupFinished" || event.startsWith("workspaceContains:"))) {
    signals.add("Can activate automatically from startup or workspace conditions.");
  }

  if (extensionKind) {
    signals.add(`Runs as extensionKind: ${extensionKind}.`);
  }

  if (contributionPoints.includes("commands")) {
    signals.add("Contributes commands that users or other extension flows can invoke.");
  }

  if (contributionPoints.includes("debuggers") || contributionPoints.includes("taskDefinitions") || contributionPoints.includes("terminal")) {
    signals.add("Contributes debugger/task capabilities that may run local commands.");
  }

  if (contributionPoints.includes("authentication")) {
    signals.add("Contributes authentication providers or account/session flows.");
  }

  if (contributionPoints.includes("notebooks") || contributionPoints.includes("notebookRenderer")) {
    signals.add("Contributes notebook execution or rendering surfaces.");
  }

  if (contributionPoints.includes("scm")) {
    signals.add("Contributes source-control surfaces.");
  }

  if (contributionPoints.includes("chatParticipants") || contributionPoints.includes("languageModelTools")) {
    signals.add("Contributes AI chat or language-model tool surfaces.");
  }

  if (contributionPoints.includes("configuration")) {
    signals.add("Contributes settings that can change workspace or extension behavior.");
  }

  if (contributionPoints.some((point) => point.toLowerCase().includes("mcp"))) {
    signals.add("Contributes MCP-related configuration or providers.");
  }

  if (contributionPoints.includes("views") || contributionPoints.includes("viewsContainers")) {
    signals.add("Contributes IDE UI views/panels.");
  }

  if (/\b(shell|terminal|exec|run|install|deploy|delete|ssh|auth|login|token|secret|credential)\b/.test(commandText)) {
    signals.add("Command labels suggest shell, auth, deployment, or credential operations.");
  }

  return [...signals];
}

function extensionCapabilityTags(extensionId: string, packageJson: Record<string, unknown>, contributionPoints: string[]) {
  const tags = new Set<string>();
  const commandText = commandTitles(packageJson).join(" ").toLowerCase();
  const text = [extensionId, readString(packageJson.displayName), readString(packageJson.description), commandText].join(" ").toLowerCase();

  tags.add("extension host code");

  if (contributionPoints.includes("commands")) tags.add("commands");
  if (contributionPoints.includes("configuration")) tags.add("settings");
  if (contributionPoints.includes("debuggers") || contributionPoints.includes("taskDefinitions")) tags.add("local execution surface");
  if (contributionPoints.includes("authentication") || /\b(auth|login|token|secret|credential)\b/.test(text)) tags.add("auth/secrets");
  if (contributionPoints.includes("scm") || /\b(git|github|gitlab|bitbucket|pull request|commit)\b/.test(text)) tags.add("source control");
  if (contributionPoints.includes("chatParticipants") || contributionPoints.includes("languageModelTools") || /\b(ai|agent|copilot|claude|cursor|cline|codex|gemini|llm|chat)\b/.test(text)) tags.add("AI/agent");
  if (contributionPoints.includes("views") || contributionPoints.includes("viewsContainers") || contributionPoints.includes("webviews")) tags.add("webview/UI");
  if (/\b(deploy|release|production|kubernetes|docker|terraform|aws|azure|gcp|vercel)\b/.test(text)) tags.add("deploy/cloud");
  if (/\b(database|postgres|mysql|mongodb|redis|supabase|neon)\b/.test(text)) tags.add("database");
  if (/\b(file|workspace|folder|fs|read|write|edit)\b/.test(text)) tags.add("workspace files");
  if (/\b(shell|terminal|exec|run|script|command)\b/.test(text)) tags.add("terminal/commands");

  return [...tags];
}

function extensionManifestEvidence(packageJson: Record<string, unknown>, activationEvents: string[], contributionPoints: string[]) {
  const evidence = [
    activationEvents.length ? `activationEvents=${activationEvents.slice(0, 6).join(", ")}` : "activationEvents=not declared",
    contributionPoints.length ? `contributes=${contributionPoints.slice(0, 10).join(", ")}` : "contributes=none declared",
  ];
  const commands = commandTitles(packageJson).slice(0, 6);
  if (commands.length) {
    evidence.push(`commands=${commands.join(" | ")}`);
  }

  return evidence;
}

function extensionAccessLevel(capabilityTags: string[], riskFlags: string[]): GuardExtensionRisk["accessLevel"] {
  const text = [...capabilityTags, ...riskFlags].join(" ").toLowerCase();
  if (/\b(deploy|cloud|database|auth|secrets|terminal|commands|local execution|credential|broad activation)\b/.test(text)) {
    return "high";
  }

  if (/\b(ai|agent|source control|workspace files|webview|commands|settings)\b/.test(text)) {
    return "medium";
  }

  return "low";
}

function commandTitles(packageJson: Record<string, unknown>) {
  const contributes = asRecord(packageJson.contributes);
  const commands = Array.isArray(contributes.commands) ? contributes.commands : [];

  return commands
    .map((command) => asRecord(command))
    .map((command) => [readString(command.command), readString(command.title)].filter(Boolean).join(" "))
    .filter(Boolean);
}

function extensionRiskFlags(
  extensionId: string,
  packageJson: Record<string, unknown>,
  activationEvents: string[],
  contributionPoints: string[],
) {
  const flags: string[] = [];
  const publisher = normalizedPublisher(extensionId, packageJson);
  const isBuiltin = Boolean(packageJson.isBuiltin);

  if (!isBuiltin && publisher && !KNOWN_PUBLISHERS.has(publisher)) {
    flags.push("Unknown or not-yet-approved publisher.");
  }

  if (activationEvents.includes("*") || activationEvents.includes("onStartupFinished")) {
    flags.push("Broad activation event.");
  }

  if (contributionPoints.includes("debuggers") || contributionPoints.includes("taskDefinitions")) {
    flags.push("Can define debug/task execution surfaces.");
  }

  if (contributionPoints.includes("authentication")) {
    flags.push("Can participate in authentication/session flows.");
  }

  if (contributionPoints.includes("chatParticipants") || contributionPoints.includes("languageModelTools")) {
    flags.push("Can participate in AI chat or language-model tool flows.");
  }

  const commandText = commandTitles(packageJson).join(" ").toLowerCase();
  if (/\b(shell|terminal|exec|run|install|deploy|delete|secret|token|credential|ssh|auth|login)\b/.test(commandText)) {
    flags.push("Command names suggest shell, auth, deployment, or credential operations.");
  }

  if (extensionId.toLowerCase().includes("ai") || commandText.includes("agent") || commandText.includes("copilot")) {
    flags.push("AI/agent-related extension.");
  }

  return flags;
}

function scanInstalledExtensions(): GuardExtensionRisk[] {
  return vscode.extensions.all
    .map((extension) => {
      const packageJson = asRecord(extension.packageJSON);
      const activationEvents = readStringArray(packageJson.activationEvents);
      const contributionPoints = extensionContributionPoints(packageJson);
      const publisher = normalizedPublisher(extension.id, packageJson);
      const capabilityTags = extensionCapabilityTags(extension.id, packageJson, contributionPoints);
      const riskFlags = extensionRiskFlags(extension.id, packageJson, activationEvents, contributionPoints);

      return {
        id: extension.id,
        displayName: readString(packageJson.displayName, readString(packageJson.name, extension.id)),
        publisher,
        version: readString(packageJson.version),
        isActive: Boolean(extension.isActive),
        isBuiltin: Boolean(packageJson.isBuiltin),
        accessLevel: extensionAccessLevel(capabilityTags, riskFlags),
        activationEvents,
        contributionPoints,
        accessSignals: extensionAccessSignals(packageJson, activationEvents, contributionPoints),
        capabilityTags,
        riskFlags,
        manifestEvidence: extensionManifestEvidence(packageJson, activationEvents, contributionPoints),
      };
    })
    .sort((left, right) => Number(right.riskFlags.length) - Number(left.riskFlags.length) || left.id.localeCompare(right.id));
}

function envVariableName(line: string) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  return match?.[1];
}

function secretTypeFromVariableName(name: string) {
  if (/openai/i.test(name)) return "OpenAI API key variable";
  if (/anthropic|claude/i.test(name)) return "Anthropic API key variable";
  if (/github|gh_/i.test(name)) return "GitHub token variable";
  if (/aws/i.test(name)) return "AWS credential variable";
  if (/slack/i.test(name)) return "Slack token variable";
  if (/database|postgres|mysql|mongodb|redis/i.test(name)) return "Database credential variable";
  if (/token|secret|key|password|credential/i.test(name)) return "Secret-like variable";
  return "Environment variable";
}

function isSecretLikeVariableName(name: string) {
  return /token|secret|key|password|credential|openai|anthropic|github|aws|slack|database|postgres|mysql|mongodb|redis/i.test(name);
}

function isEnvLikePath(logicalPath: string) {
  return /(^|\/)\.env(?:\.|$)/i.test(logicalPath) || /(^|\/)\.npmrc$/i.test(logicalPath) || /(^|\/)\.pypirc$/i.test(logicalPath);
}

async function readTextFile(uri: vscode.Uri) {
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.size > MAX_FILE_BYTES) {
    return null;
  }

  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function readBlockedEvidence(logicalPath: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const protectionHint = /access|permission|denied|blocked|operation not permitted|invalid argument|eacces|eperm|einval|virus|malware|quarantine/.test(normalized)
    ? " Local OS, endpoint protection, or file permissions may have blocked the read."
    : "";

  return `${logicalPath} matched a risky-file pattern, but DryLake could not read it.${protectionHint} File contents were not stored.`;
}

async function findWorkspaceFiles(patterns: string[], limit: number) {
  const seen = new Set<string>();
  const uris: vscode.Uri[] = [];

  for (const pattern of patterns) {
    if (uris.length >= limit) {
      break;
    }

    const matches = await vscode.workspace.findFiles(pattern, EXCLUDE_PATTERN, limit);
    for (const uri of matches) {
      const logicalPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
      if (seen.has(logicalPath)) {
        continue;
      }

      seen.add(logicalPath);
      uris.push(uri);
      if (uris.length >= limit) {
        break;
      }
    }
  }

  return uris;
}

async function scanRiskyFiles(): Promise<GuardSecretFinding[]> {
  const findings: GuardSecretFinding[] = [];
  const files = await findWorkspaceFiles(SECRET_FILE_PATTERNS, MAX_SECURITY_FILES);

  for (const file of files) {
    const logicalPath = vscode.workspace.asRelativePath(file, false).replace(/\\/g, "/");
    let text: string | null;
    try {
      text = await readTextFile(file);
    } catch (error) {
      findings.push({
        path: logicalPath,
        type: "Unreadable risky file",
        severity: "medium",
        evidence: readBlockedEvidence(logicalPath, error),
      });
      continue;
    }

    if (text === null) {
      continue;
    }

    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      if (isEnvLikePath(logicalPath)) {
        const variableName = envVariableName(line);
        if (!variableName || !isSecretLikeVariableName(variableName)) {
          return;
        }

        findings.push({
          path: logicalPath,
          line: index + 1,
          type: secretTypeFromVariableName(variableName),
          variableName,
          severity: /password|private|secret|token|key/i.test(variableName) ? "high" : "medium",
          evidence: `${variableName} is declared in ${logicalPath}. Value was not stored.`,
        });
        return;
      }

      for (const secretPattern of SECRET_PATTERNS) {
        if (!secretPattern.pattern.test(line)) {
          continue;
        }

        findings.push({
          path: logicalPath,
          line: index + 1,
          type: secretPattern.type,
          severity: secretPattern.severity,
          evidence: `${secretPattern.type} pattern detected. Secret value was not stored.`,
        });
        return;
      }
    });
  }

  return findings;
}

async function findExistingGlobalFile(segments: string[]) {
  const uri = vscode.Uri.file(path.join(os.homedir(), ...segments));
  try {
    await vscode.workspace.fs.stat(uri);
    return uri;
  } catch {
    return null;
  }
}

async function findMcpConfigFiles() {
  const seen = new Set<string>();
  const files = await findWorkspaceFiles(MCP_CONFIG_PATTERNS, 80);
  const globalCandidates = await Promise.all([
    findExistingGlobalFile([".cursor", "mcp.json"]),
    findExistingGlobalFile([".claude", "mcp.json"]),
    findExistingGlobalFile([".config", "claude", "mcp.json"]),
    process.platform === "win32"
      ? findExistingGlobalFile(["AppData", "Roaming", "Claude", "claude_desktop_config.json"])
      : findExistingGlobalFile(["Library", "Application Support", "Claude", "claude_desktop_config.json"]),
  ]);

  for (const candidate of globalCandidates) {
    if (candidate) {
      files.push(candidate);
    }
  }

  return files.filter((file) => {
    const key = file.fsPath;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function logicalPathForUri(uri: vscode.Uri) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder?.(uri);
  if (workspaceFolder) {
    return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
  }

  return uri.fsPath.replace(os.homedir(), "~").replace(/\\/g, "/");
}

function guardArtifactKindForAgentFile(file: { logicalPath: string; category: string }): GuardUploadArtifact["kind"] {
  const normalized = file.logicalPath.replace(/\\/g, "/").toLowerCase();

  if (
    /(^|\/)(mcp\.json|claude_desktop_config\.json)$/i.test(normalized) ||
    /(^|\/)\.vscode\/mcp\.json$/i.test(normalized) ||
    /(^|\/)\.cursor\/mcp\.json$/i.test(normalized)
  ) {
    return "mcp-config";
  }

  if (file.category === "skill") {
    return "skill";
  }

  if (file.category === "rule" || file.category === "agent_config" || file.category === "subagent") {
    return "agent-rule";
  }

  return "instruction";
}

function mimeTypeForGuardArtifact(logicalPath: string) {
  const normalized = logicalPath.toLowerCase();
  if (normalized.endsWith(".json")) return "application/json";
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) return "application/yaml";
  if (normalized.endsWith(".toml")) return "application/toml";
  if (normalized.endsWith(".md") || normalized.endsWith(".mdc")) return "text/markdown";
  return "text/plain";
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function serverEntries(config: Record<string, unknown>) {
  const mcpServers = asRecord(config.mcpServers);
  const servers = Object.keys(mcpServers).length ? mcpServers : asRecord(config.servers);
  return Object.entries(servers).map(([name, value]) => [name, asRecord(value)] as const);
}

function envKeysFor(server: Record<string, unknown>) {
  return Object.keys(asRecord(server.env)).sort();
}

function inferMcpCapabilities(serverName: string, server: Record<string, unknown>) {
  const text = [
    serverName,
    readString(server.command),
    readString(server.url),
    ...readStringArray(server.args),
    ...envKeysFor(server),
  ].join(" ").toLowerCase();
  const capabilities = new Set<string>();

  if (/composio|rube|zapier|pipedream|nango|smithery|mcp\.run|toolhouse|arcade|superface/.test(text)) capabilities.add("connected tool gateway");
  if (/github|gitlab|bitbucket/.test(text)) capabilities.add("source control");
  if (/gmail|email|slack|discord|teams/.test(text)) capabilities.add("message send/read");
  if (/filesystem|file|fs|workspace/.test(text)) capabilities.add("filesystem");
  if (/shell|terminal|command|exec|code.?runner/.test(text)) capabilities.add("command execution");
  if (/docker|kubernetes|k8s|terraform|aws|gcp|azure|vercel|deploy/.test(text)) capabilities.add("cloud/deploy");
  if (/postgres|mysql|redis|mongodb|database|supabase|neon/.test(text)) capabilities.add("database");
  if (/stripe|payment|billing/.test(text)) capabilities.add("payment/vendor API");
  if (/browser|playwright|chrome|web/.test(text)) capabilities.add("browser automation");

  if (capabilities.size === 0) {
    capabilities.add("unknown tools");
  }

  return [...capabilities];
}

function isPinnedNpx(args: string[]) {
  const packageArg = args.find((arg) => !arg.startsWith("-") && !["-y", "--yes"].includes(arg));
  return Boolean(packageArg && /@[^/\s]+$/.test(packageArg.replace(/^@[^/]+\//, "")));
}

function severityFromFlags(flags: string[]): GuardSeverity {
  if (flags.some((flag) => /remote|token|secret|command execution|deploy|database|payment/i.test(flag))) {
    return "high";
  }

  if (flags.length > 0) {
    return "medium";
  }

  return "low";
}

function mcpRiskFlags(server: Record<string, unknown>, capabilities: string[]) {
  const flags: string[] = [];
  const command = readString(server.command).toLowerCase();
  const args = readStringArray(server.args);
  const url = readString(server.url);
  const envKeys = envKeysFor(server);

  if (url) {
    flags.push("Remote MCP endpoint; runtime behavior depends on the remote service.");
  }

  if (command === "npx" && !isPinnedNpx(args)) {
    flags.push("Unpinned npx MCP server package.");
  }

  if (envKeys.some((key) => /token|secret|key|password|credential/i.test(key))) {
    flags.push("MCP server receives secret-like environment variables.");
  }

  if (capabilities.includes("command execution")) {
    flags.push("MCP capability suggests command execution.");
  }

  if (capabilities.includes("cloud/deploy") || capabilities.includes("database") || capabilities.includes("payment/vendor API")) {
    flags.push("MCP capability suggests high-impact external changes.");
  }

  if (capabilities.includes("connected tool gateway")) {
    flags.push("Connected tool gateway detected; review enabled app/tool scopes with that provider.");
  }

  return flags;
}

function mcpBlastRadius(capabilities: string[], envKeys: string[]) {
  const lowerCapabilities = capabilities.join(" ").toLowerCase();
  const hasSecretEnv = envKeys.some((key) => /token|secret|key|password|credential/i.test(key));

  if (/cloud\/deploy|database|payment\/vendor api/.test(lowerCapabilities)) {
    return hasSecretEnv
      ? "High-impact tools with secret-bearing environment variables. Treat as production-capable until reviewed."
      : "High-impact tools detected. Review before agents can call this server.";
  }

  if (/command execution|filesystem|source control/.test(lowerCapabilities)) {
    return hasSecretEnv
      ? "Can affect local code or repository state and receives secret-like variables."
      : "Can affect local code, repository state, or command execution surfaces.";
  }

  if (/message send\/read|browser automation|connected tool gateway/.test(lowerCapabilities)) {
    return hasSecretEnv
      ? "Connected external tool gateway with secret-like variables. Review provider-side app scopes and enabled tools."
      : "Connected external tool surface. Review provider-side app scopes and enabled tools.";
  }

  return hasSecretEnv
    ? "Unknown tool capability with secret-like variables."
    : "Unknown or low-specificity tool capability.";
}

async function scanMcpServers(): Promise<GuardMcpServer[]> {
  const results: GuardMcpServer[] = [];
  const files = await findMcpConfigFiles();

  for (const file of files) {
    let text: string | null;
    try {
      text = await readTextFile(file);
    } catch {
      continue;
    }

    if (text === null) {
      continue;
    }

    const parsed = parseJsonObject(text);
    if (!parsed) {
      continue;
    }

    for (const [name, server] of serverEntries(parsed)) {
      const args = readStringArray(server.args);
      const capabilities = inferMcpCapabilities(name, server);
      const riskFlags = mcpRiskFlags(server, capabilities);
      const envKeys = envKeysFor(server);
      results.push({
        configPath: logicalPathForUri(file),
        name,
        command: readString(server.command) || undefined,
        args,
        url: readString(server.url) || undefined,
        envKeys,
        capabilities,
        riskFlags,
        severity: severityFromFlags([...riskFlags, ...capabilities]),
        blastRadius: mcpBlastRadius(capabilities, envKeys),
      });
    }
  }

  return results.sort((left, right) => right.riskFlags.length - left.riskFlags.length || left.name.localeCompare(right.name));
}

function packageManagerFromPath(logicalPath: string) {
  if (logicalPath.endsWith("package-lock.json")) return "npm";
  if (logicalPath.endsWith("pnpm-lock.yaml")) return "pnpm";
  if (logicalPath.endsWith("yarn.lock")) return "yarn";
  if (logicalPath.endsWith("bun.lockb")) return "bun";
  return undefined;
}

function classifyWorkspaceSurface(logicalPath: string) {
  const normalized = logicalPath.toLowerCase();

  if (/(^|\/)\.github\/workflows\/.+\.ya?ml$/.test(normalized) || /(^|\/)\.gitlab-ci\.ya?ml$/.test(normalized) || /bitbucket-pipelines\.ya?ml$/.test(normalized)) {
    return { bucket: "ciWorkflowFiles" as const, type: "CI/CD workflow" };
  }

  if (
    /(^|\/)dockerfile$/.test(normalized) ||
    /\.dockerfile$/.test(normalized) ||
    /docker-compose.*\.ya?ml$/.test(normalized) ||
    /\.tf$/.test(normalized) ||
    /\.tfvars$/.test(normalized) ||
    /(^|\/)(k8s|kubernetes|helm|charts)\//.test(normalized) ||
    /serverless\.ya?ml$/.test(normalized) ||
    /cloudformation.*\.(json|ya?ml)$/.test(normalized) ||
    /(^|\/)template\.ya?ml$/.test(normalized) ||
    /(^|\/)cdk\.json$/.test(normalized) ||
    /(^|\/)samconfig\.toml$/.test(normalized)
  ) {
    return { bucket: "iacFiles" as const, type: "Infrastructure or deployment config" };
  }

  if (/(deploy|release|migrate).*\.(sh|ps1|bat|cmd|ya?ml|json)$/.test(normalized)) {
    return { bucket: "deploymentFiles" as const, type: "Deployment or migration surface" };
  }

  if (/\.(pem|key|p12|pfx)$/.test(normalized) || /(credential|secret|service.?account|private.?key)/.test(normalized)) {
    return { bucket: "credentialLikeFiles" as const, type: "Credential-like file name" };
  }

  return null;
}

function packageScriptRisk(name: string, command: unknown) {
  const text = `${name} ${typeof command === "string" ? command : ""}`.toLowerCase();

  if (/\b(prod|production|deploy|release|publish)\b/.test(text)) return "deployment";
  if (/\b(delete|destroy|drop|purge|truncate|wipe|remove)\b/.test(text)) return "destructive operation";
  if (/\b(migrate|migration|prisma migrate|db:push|schema)\b/.test(text)) return "database migration";
  if (/\b(aws|gcloud|az|kubectl|terraform|docker push|serverless)\b/.test(text)) return "cloud or infrastructure command";
  if (/\b(secret|token|password|credential|env:prod)\b/.test(text)) return "secret or production credential reference";

  return null;
}

async function scanPackageContext(): Promise<PackageContext> {
  const managers = new Set<string>();
  const scripts = new Set<string>();
  const riskyPackageScripts: GuardWorkspaceSurface["riskyPackageScripts"] = [];
  const files = await findWorkspaceFiles(PACKAGE_CONTEXT_PATTERNS, 80);

  for (const file of files) {
    const logicalPath = vscode.workspace.asRelativePath(file, false).replace(/\\/g, "/");
    const manager = packageManagerFromPath(logicalPath);
    if (manager) {
      managers.add(manager);
      continue;
    }

    if (!logicalPath.endsWith("package.json")) {
      continue;
    }

    let text: string | null;
    try {
      text = await readTextFile(file);
    } catch {
      continue;
    }

    if (!text) {
      continue;
    }

    const parsed = parseJsonObject(text);
    const packageScripts = asRecord(parsed?.scripts);
    for (const [script, command] of Object.entries(packageScripts)) {
      scripts.add(script);
      const risk = packageScriptRisk(script, command);
      if (risk) {
        riskyPackageScripts.push({ path: logicalPath, name: script, risk });
      }
    }
  }

  return {
    packageManagers: [...managers].sort(),
    packageScripts: [...scripts].sort(),
    riskyPackageScripts: riskyPackageScripts.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

async function scanWorkspaceSurface(): Promise<GuardWorkspaceSurface> {
  const surface: GuardWorkspaceSurface = {
    deploymentFiles: [],
    iacFiles: [],
    ciWorkflowFiles: [],
    credentialLikeFiles: [],
    riskyPackageScripts: [],
    generatedFolders: [],
  };
  const files = await findWorkspaceFiles(WORKSPACE_SURFACE_PATTERNS, MAX_SECURITY_FILES);
  const seen = new Set<string>();

  for (const file of files) {
    const logicalPath = vscode.workspace.asRelativePath(file, false).replace(/\\/g, "/");
    if (seen.has(logicalPath)) {
      continue;
    }

    seen.add(logicalPath);
    const classified = classifyWorkspaceSurface(logicalPath);
    if (!classified) {
      continue;
    }

    surface[classified.bucket].push({
      path: logicalPath,
      type: classified.type,
    });
  }

  const generatedBuckets = new Map<string, number>();
  for (const pattern of GENERATED_SURFACE_PATTERNS) {
    const matches = await vscode.workspace.findFiles(pattern, GENERATED_SCAN_EXCLUDE_PATTERN, 140);
    for (const uri of matches) {
      const logicalPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
      const folder = logicalPath.match(/(^|\/)(\.drylake\/generated|generated|raw_source|generated_export|deployment_output|dist|build|out|coverage)(\/|$)/i)?.[2];
      if (!folder) {
        continue;
      }

      generatedBuckets.set(folder, (generatedBuckets.get(folder) ?? 0) + 1);
    }
  }

  surface.generatedFolders = [...generatedBuckets.entries()]
    .filter(([, fileCount]) => fileCount >= 25)
    .map(([path, fileCount]) => ({ path, fileCount }))
    .sort((left, right) => right.fileCount - left.fileCount);

  return surface;
}

function findingPenalty(severity: GuardSeverity) {
  if (severity === "critical") return 18;
  if (severity === "high") return 10;
  if (severity === "medium") return 5;
  if (severity === "low") return 2;
  return 0;
}

function rankForScore(score: number): SafeDeveloperRank {
  if (score < 50) return "Scout";
  if (score < 70) return "Builder";
  if (score < 85) return "Operator";
  if (score < 95) return "Guardian";
  return "Sentinel";
}

function makeFinding(params: Omit<GuardFinding, "detail">): GuardFinding {
  return {
    ...params,
    detail: `${params.evidence} ${params.recommendation}`.trim(),
  };
}

function secretTypeText(secrets: GuardSecretFinding[]) {
  return secrets.map((secret) => secret.type).join(" ").toLowerCase();
}

function hasDeploySurface(workspaceSurface: GuardWorkspaceSurface) {
  return workspaceSurface.deploymentFiles.length > 0 ||
    workspaceSurface.iacFiles.length > 0 ||
    workspaceSurface.riskyPackageScripts.some((script) => /deploy|cloud|infrastructure|destructive|migration|production/i.test(script.risk));
}

function hasCommandCapableAgentSurface(extensions: GuardExtensionRisk[], mcpServers: GuardMcpServer[]) {
  return extensions.some((extension) =>
    !extension.isBuiltin && extension.capabilityTags.some((tag) => /terminal|commands|local execution/i.test(tag))
  ) || mcpServers.some((server) =>
    server.capabilities.some((capability) => /command execution|filesystem|source control/i.test(capability))
  );
}

function buildFindings(params: {
  agentFiles: ScannedAgentFile[];
  packageManagers: string[];
  packageScripts: string[];
  extensions: GuardExtensionRisk[];
  secrets: GuardSecretFinding[];
  mcpServers: GuardMcpServer[];
  workspaceSurface: GuardWorkspaceSurface;
}) {
  const findings: GuardFinding[] = [];

  for (const secret of params.secrets) {
    findings.push(makeFinding({
      id: `secret:${secret.path}:${secret.line}:${secret.type}`,
      category: "secret-hygiene",
      severity: secret.severity,
      title: `${secret.type} exposure`,
      evidence: secret.evidence,
      recommendation: "Move secrets to a local secret manager or provider-specific secure storage and keep values out of agent-visible files.",
      safeToShare: false,
      source: "file",
      path: secret.path,
      line: secret.line,
    }));
  }

  for (const server of params.mcpServers) {
    for (const flag of server.riskFlags) {
      findings.push(makeFinding({
        id: `mcp:${server.configPath}:${server.name}:${flag}`,
        category: "mcp-risk",
        severity: server.severity,
        title: `${server.name} MCP risk`,
        evidence: flag,
        recommendation: "Review this MCP server before exposing it to agents. Pin packages, reduce scopes, and avoid passing broad credentials through env vars.",
        safeToShare: true,
        source: "mcp",
        path: server.configPath,
      }));
    }
  }

  if (params.mcpServers.length > 5) {
    findings.push(makeFinding({
      id: "mcp:too-many-servers",
      category: "token-waste",
      severity: "medium",
      title: "Large MCP surface",
      evidence: `${params.mcpServers.length} MCP servers were detected.`,
      recommendation: "Disable MCP servers that are not needed for the current workspace to reduce tool bloat and prompt/context overhead.",
      safeToShare: true,
      source: "mcp",
    }));
  }

  for (const extension of params.extensions.filter((item) => !item.isBuiltin && item.riskFlags.length > 0).slice(0, 30)) {
    findings.push(makeFinding({
      id: `extension:${extension.id}`,
      category: "ide-bloat",
      severity: extension.riskFlags.some((flag) => /task|debug|shell|deploy|credential|broad/i.test(flag)) ? "medium" : "low",
      title: `${extension.displayName} extension review`,
      evidence: extension.riskFlags.join(" "),
      recommendation: "Review whether this extension should be enabled globally. Disable or workspace-scope extensions that are not needed.",
      safeToShare: true,
      source: "extension",
      path: extension.id,
    }));
  }

  const aiExtensions = params.extensions.filter((extension) =>
    !extension.isBuiltin &&
    /\b(ai|agent|copilot|claude|cursor|cline|codex|gemini|continue|assistant|chat)\b/i.test(
      [extension.id, extension.displayName, ...extension.riskFlags].join(" "),
    )
  );
  if (aiExtensions.length > 5) {
    findings.push(makeFinding({
      id: "extension:ai-bloat",
      category: "ide-bloat",
      severity: "medium",
      title: "Many AI/agent extensions installed",
      evidence: `${aiExtensions.length} AI or agent-related extensions were detected.`,
      recommendation: "Keep only the AI extensions you actively use and disable overlapping tools per workspace.",
      safeToShare: true,
      source: "extension",
    }));
  }

  const instructionFiles = params.agentFiles.filter((file) => file.category === "instruction" || file.category === "rule").length;
  if (instructionFiles > 8) {
    findings.push(makeFinding({
      id: "agent:instruction-sprawl",
      category: "agent-reliability",
      severity: "medium",
      title: "Agent instruction sprawl",
      evidence: `${instructionFiles} instruction/rule files were detected.`,
      recommendation: "Consolidate overlapping AGENTS.md, CLAUDE.md, Cursor rules, and other agent instructions into one clear policy per workspace.",
      safeToShare: true,
      source: "agent",
    }));
  }

  for (const file of params.agentFiles.filter((item) => item.content)) {
    const content = file.content ?? "";
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (HIDDEN_CONTROL_PATTERN.test(line)) {
        findings.push(makeFinding({
          id: `prompt:hidden-control:${file.logicalPath}:${index + 1}`,
          category: "prompt-injection",
          severity: "high",
          title: "Hidden control characters in agent instructions",
          evidence: `${file.logicalPath}:${index + 1} contains hidden Unicode/control characters.`,
          recommendation: "Remove hidden characters and review the surrounding instruction text before agents use this file.",
          safeToShare: true,
          source: "agent",
          path: file.logicalPath,
          line: index + 1,
        }));
      }

      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (!pattern.pattern.test(line)) {
          continue;
        }

        findings.push(makeFinding({
          id: `prompt:${pattern.label}:${file.logicalPath}:${index + 1}`,
          category: "prompt-injection",
          severity: pattern.severity,
          title: `Prompt injection risk: ${pattern.label}`,
          evidence: `${file.logicalPath}:${index + 1} matches ${pattern.label}.`,
          recommendation: pattern.recommendation,
          safeToShare: true,
          source: "agent",
          path: file.logicalPath,
          line: index + 1,
        }));
      }
    });
  }

  const contentHashes = new Map<string, string[]>();
  for (const file of params.agentFiles.filter((item) => item.content && item.content.trim().length > 80)) {
    const normalized = file.content?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    const bucket = contentHashes.get(normalized) ?? [];
    bucket.push(file.logicalPath);
    contentHashes.set(normalized, bucket);
  }
  for (const duplicates of [...contentHashes.values()].filter((items) => items.length > 1).slice(0, 8)) {
    findings.push(makeFinding({
      id: `agent:duplicate:${duplicates.join("|")}`,
      category: "token-waste",
      severity: "medium",
      title: "Duplicate agent instructions",
      evidence: `Duplicate instruction content appears in ${duplicates.length} files.`,
      recommendation: "Remove duplicate instruction files or replace them with one canonical instruction source.",
      safeToShare: true,
      source: "agent",
      path: duplicates[0],
    }));
  }

  for (const file of params.agentFiles.filter((item) => item.content && item.content.length > 12_000).slice(0, 8)) {
    findings.push(makeFinding({
      id: `agent:long-instructions:${file.logicalPath}`,
      category: "token-waste",
      severity: "medium",
      title: "Long agent instruction file",
      evidence: `${file.logicalPath} is over 12,000 characters.`,
      recommendation: "Shorten this file or split durable rules from task-specific context to reduce token waste.",
      safeToShare: true,
      source: "agent",
      path: file.logicalPath,
    }));
  }

  if (params.packageManagers.length > 1) {
    findings.push(makeFinding({
      id: "package:manager-conflict",
      category: "supply-chain",
      severity: "medium",
      title: "Package manager conflict",
      evidence: `Multiple lockfile/package managers detected: ${params.packageManagers.join(", ")}.`,
      recommendation: "Standardize on one package manager so coding agents run the right install, build, and test commands.",
      safeToShare: true,
      source: "workspace",
    }));
  }

  if (params.packageScripts.length > 0 && !params.packageScripts.includes("test")) {
    findings.push(makeFinding({
      id: "package:missing-test",
      category: "agent-reliability",
      severity: "medium",
      title: "Missing test script",
      evidence: "package.json scripts do not include a test command.",
      recommendation: "Add a deterministic test script so agents and team members can validate changes consistently.",
      safeToShare: true,
      source: "workspace",
      path: "package.json",
    }));
  }

  if (params.packageScripts.length > 0 && !params.packageScripts.includes("build")) {
    findings.push(makeFinding({
      id: "package:missing-build",
      category: "agent-reliability",
      severity: "low",
      title: "Missing build script",
      evidence: "package.json scripts do not include a build command.",
      recommendation: "Add a build script or document why this workspace does not need one.",
      safeToShare: true,
      source: "workspace",
      path: "package.json",
    }));
  }

  for (const script of params.workspaceSurface.riskyPackageScripts.slice(0, 20)) {
    findings.push(makeFinding({
      id: `package-script:${script.path}:${script.name}`,
      category: script.risk === "deployment" || script.risk === "cloud or infrastructure command" ? "deploy-surface" : "supply-chain",
      severity: script.risk === "destructive operation" || script.risk === "secret or production credential reference" ? "high" : "medium",
      title: `Risky package script: ${script.name}`,
      evidence: `${script.path} declares a ${script.risk} script named "${script.name}".`,
      recommendation: "Require explicit human approval before agents run this script. Keep production, destructive, and migration scripts out of autonomous handoffs.",
      safeToShare: true,
      source: "workspace",
      path: script.path,
    }));
  }

  if (params.workspaceSurface.ciWorkflowFiles.length > 0) {
    findings.push(makeFinding({
      id: "workspace:ci-workflows",
      category: "deploy-surface",
      severity: "low",
      title: "CI/CD workflows detected",
      evidence: `${params.workspaceSurface.ciWorkflowFiles.length} CI/CD workflow file${params.workspaceSurface.ciWorkflowFiles.length === 1 ? "" : "s"} detected.`,
      recommendation: "Use these workflows as the source of truth for build/test commands and protect deployment jobs from direct agent execution.",
      safeToShare: true,
      source: "workspace",
      path: params.workspaceSurface.ciWorkflowFiles[0]?.path,
    }));
  }

  if (params.workspaceSurface.iacFiles.length > 0) {
    findings.push(makeFinding({
      id: "workspace:iac-surface",
      category: "deploy-surface",
      severity: "medium",
      title: "Infrastructure-as-code surface detected",
      evidence: `${params.workspaceSurface.iacFiles.length} Docker, Terraform, Kubernetes, serverless, or cloud configuration file${params.workspaceSurface.iacFiles.length === 1 ? "" : "s"} detected.`,
      recommendation: "Treat infrastructure files as high-impact agent context. Require approval for any agent-generated changes before apply/deploy commands run.",
      safeToShare: true,
      source: "workspace",
      path: params.workspaceSurface.iacFiles[0]?.path,
    }));
  }

  if (params.workspaceSurface.deploymentFiles.length > 0) {
    findings.push(makeFinding({
      id: "workspace:deployment-surface",
      category: "deploy-surface",
      severity: "high",
      title: "Deployment or migration scripts detected",
      evidence: `${params.workspaceSurface.deploymentFiles.length} deploy, release, or migration script${params.workspaceSurface.deploymentFiles.length === 1 ? "" : "s"} detected.`,
      recommendation: "Block autonomous agent execution of deployment and migration scripts unless a team policy explicitly approves the workspace.",
      safeToShare: true,
      source: "workspace",
      path: params.workspaceSurface.deploymentFiles[0]?.path,
    }));
  }

  if (params.workspaceSurface.credentialLikeFiles.length > 0) {
    findings.push(makeFinding({
      id: "workspace:credential-like-files",
      category: "secret-hygiene",
      severity: "high",
      title: "Credential-like files detected",
      evidence: `${params.workspaceSurface.credentialLikeFiles.length} credential-like file path${params.workspaceSurface.credentialLikeFiles.length === 1 ? "" : "s"} detected. File contents were not stored in the report.`,
      recommendation: "Move credentials into secure storage, verify these paths are ignored from agent context, and rotate any key material that may have been exposed.",
      safeToShare: false,
      source: "file",
      path: params.workspaceSurface.credentialLikeFiles[0]?.path,
    }));
  }

  for (const folder of params.workspaceSurface.generatedFolders.slice(0, 10)) {
    if (SUSPICIOUS_ARTIFACT_PATTERN.test(folder.path)) {
      findings.push(makeFinding({
        id: `artifact:generated-folder:${folder.path}`,
        category: "suspicious-artifact",
        severity: "medium",
        title: "Executable or archive artifact visible to agents",
        evidence: `${folder.path} appears to be an executable, script, archive, or generated artifact path.`,
        recommendation: "Review whether this artifact belongs in the workspace and quarantine or remove it if unexpected.",
        safeToShare: true,
        source: "workspace",
        path: folder.path,
      }));
    }

    findings.push(makeFinding({
      id: `workspace:generated-folder:${folder.path}`,
      category: "token-waste",
      severity: folder.fileCount >= 100 ? "medium" : "low",
      title: "Generated output folder visible to agents",
      evidence: `${folder.path} contains at least ${folder.fileCount} files in this workspace scan.`,
      recommendation: "Exclude generated output from agent context unless the active task requires it. Add agent ignore rules for build artifacts and generated exports.",
      safeToShare: true,
      source: "workspace",
      path: folder.path,
    }));
  }

  const secretText = secretTypeText(params.secrets);
  const deploySurface = hasDeploySurface(params.workspaceSurface);
  const commandCapableSurface = hasCommandCapableAgentSurface(params.extensions, params.mcpServers);

  if (deploySurface && commandCapableSurface && /openai|anthropic|claude|aws|github|gitlab|slack|token|secret|credential|database/.test(secretText)) {
    findings.push(makeFinding({
      id: "blast-radius:agent-deploy-secret-combination",
      category: "blast-radius",
      severity: "critical",
      title: "Agent blast radius: secrets plus deployment surface",
      evidence: "This workspace has secret-like references, deployment or infrastructure surfaces, and agent/tool surfaces that may execute commands or modify files.",
      recommendation: "Require approval before agent execution, isolate production credentials, and add protected paths before running autonomous coding tools in this workspace.",
      safeToShare: false,
      source: "workspace",
    }));
  } else if (deploySurface && commandCapableSurface) {
    findings.push(makeFinding({
      id: "blast-radius:agent-deploy-combination",
      category: "blast-radius",
      severity: "high",
      title: "Agent blast radius: deployment-capable workspace",
      evidence: "This workspace has deployment/infrastructure surfaces and agent/tool surfaces that may execute commands or modify files.",
      recommendation: "Keep deploy, release, migration, and infrastructure commands behind explicit human approval.",
      safeToShare: true,
      source: "workspace",
    }));
  }

  return findings.sort((left, right) => findingPenalty(right.severity) - findingPenalty(left.severity));
}

function connectionSeverityFromExtension(extension: GuardExtensionRisk): GuardSeverity {
  if (extension.accessLevel === "high") return "high";
  if (extension.accessLevel === "medium") return "medium";
  return "low";
}

function buildConnectionMap(params: {
  agentFiles: Array<{ logicalPath: string; category: string }>;
  extensions: GuardExtensionRisk[];
  secrets: GuardSecretFinding[];
  mcpServers: GuardMcpServer[];
  workspaceSurface: GuardWorkspaceSurface;
}): GuardConnectionMap {
  const nodes: GuardConnectionMap["nodes"] = [
    {
      id: "ide:vscode",
      type: "ide",
      label: "VS Code / Cursor workspace",
      severity: "info",
      summary: "DryLake infers access from local IDE manifests, workspace files, and agent/MCP config.",
      capabilities: ["extension host", "workspace context"],
    },
  ];
  const edges: GuardConnectionMap["edges"] = [];
  const highRiskPaths: string[] = [];

  for (const extension of params.extensions.filter((item) => !item.isBuiltin).slice(0, 40)) {
    const severity = connectionSeverityFromExtension(extension);
    nodes.push({
      id: `extension:${extension.id}`,
      type: "extension",
      label: extension.displayName,
      severity,
      summary: `${extension.publisher || "unknown publisher"} / ${extension.accessLevel} inferred access`,
      capabilities: extension.capabilityTags,
    });
    edges.push({
      from: "ide:vscode",
      to: `extension:${extension.id}`,
      label: extension.isActive ? "active extension" : "installed extension",
      severity,
    });

    if (severity === "high") {
      highRiskPaths.push(`${extension.displayName}: ${extension.capabilityTags.join(", ") || "extension host code"}`);
    }
  }

  for (const file of params.agentFiles.slice(0, 24)) {
    nodes.push({
      id: `agent:${file.logicalPath}`,
      type: "agent-config",
      label: file.logicalPath,
      severity: file.category === "skill" || file.category === "instruction" ? "medium" : "low",
      summary: `${file.category} visible to coding-agent workflows`,
      capabilities: [file.category],
    });
    edges.push({
      from: "ide:vscode",
      to: `agent:${file.logicalPath}`,
      label: "agent context",
      severity: "medium",
    });
  }

  for (const server of params.mcpServers) {
    nodes.push({
      id: `mcp:${server.configPath}:${server.name}`,
      type: "mcp",
      label: server.name,
      severity: server.severity,
      summary: server.blastRadius,
      capabilities: server.capabilities,
    });
    edges.push({
      from: "ide:vscode",
      to: `mcp:${server.configPath}:${server.name}`,
      label: "MCP tool connection",
      severity: server.severity,
    });

    if (server.envKeys.length > 0) {
      const secretNodeId = `secret:mcp:${server.configPath}:${server.name}`;
      nodes.push({
        id: secretNodeId,
        type: "secret",
        label: `${server.name} env vars`,
        severity: server.envKeys.some((key) => /token|secret|key|password|credential/i.test(key)) ? "high" : "medium",
        summary: `${server.envKeys.length} env var name${server.envKeys.length === 1 ? "" : "s"} passed to MCP server; values not stored.`,
        capabilities: server.envKeys,
      });
      edges.push({
        from: secretNodeId,
        to: `mcp:${server.configPath}:${server.name}`,
        label: "env names passed",
        severity: "high",
      });
    }

    if (server.severity === "high") {
      highRiskPaths.push(`${server.name}: ${server.blastRadius}`);
    }
  }

  const secretPaths = [...new Set(params.secrets.map((secret) => secret.path))].slice(0, 20);
  for (const secretPath of secretPaths) {
    const secretsForPath = params.secrets.filter((secret) => secret.path === secretPath);
    nodes.push({
      id: `secret:${secretPath}`,
      type: "secret",
      label: secretPath,
      severity: secretsForPath.some((secret) => secret.severity === "critical" || secret.severity === "high") ? "high" : "medium",
      summary: `${secretsForPath.length} secret-like reference${secretsForPath.length === 1 ? "" : "s"}; values not stored.`,
      capabilities: [...new Set(secretsForPath.map((secret) => secret.type))],
    });
    edges.push({
      from: "ide:vscode",
      to: `secret:${secretPath}`,
      label: "agent-visible file path",
      severity: "high",
    });
  }

  const workspaceSurfaceCount =
    params.workspaceSurface.deploymentFiles.length +
    params.workspaceSurface.iacFiles.length +
    params.workspaceSurface.ciWorkflowFiles.length +
    params.workspaceSurface.riskyPackageScripts.length;
  if (workspaceSurfaceCount > 0) {
    nodes.push({
      id: "workspace:surface",
      type: "workspace-surface",
      label: "Deploy / CI / infrastructure surface",
      severity: hasDeploySurface(params.workspaceSurface) ? "high" : "medium",
      summary: `${workspaceSurfaceCount} deploy, CI, IaC, or risky package-script surface${workspaceSurfaceCount === 1 ? "" : "s"} detected.`,
      capabilities: [
        params.workspaceSurface.deploymentFiles.length ? "deploy scripts" : "",
        params.workspaceSurface.iacFiles.length ? "IaC/cloud config" : "",
        params.workspaceSurface.ciWorkflowFiles.length ? "CI/CD workflows" : "",
        params.workspaceSurface.riskyPackageScripts.length ? "risky package scripts" : "",
      ].filter((value): value is string => Boolean(value)),
    });
    edges.push({
      from: "ide:vscode",
      to: "workspace:surface",
      label: "workspace files",
      severity: hasDeploySurface(params.workspaceSurface) ? "high" : "medium",
    });
  }

  return { nodes, edges, highRiskPaths };
}

function summarize(result: Omit<GuardScanResult, "summary">): GuardScanResult["summary"] {
  const countSeverity = (severity: GuardSeverity) => result.findings.filter((finding) => finding.severity === severity).length;
  return {
    agentFiles: result.agentFiles.length,
    skills: result.agentFiles.filter((file) => file.category === "skill").length,
    rules: result.agentFiles.filter((file) => file.category === "rule" || file.category === "instruction").length,
    extensions: result.extensions.filter((extension) => !extension.isBuiltin).length,
    activeExtensions: result.extensions.filter((extension) => !extension.isBuiltin && extension.isActive).length,
    riskyFiles: new Set(result.secrets.map((finding) => finding.path)).size,
    workspaceSurface:
      result.workspaceSurface.deploymentFiles.length +
      result.workspaceSurface.iacFiles.length +
      result.workspaceSurface.ciWorkflowFiles.length +
      result.workspaceSurface.credentialLikeFiles.length +
      result.workspaceSurface.riskyPackageScripts.length +
      result.workspaceSurface.generatedFolders.length,
    mcpServers: result.mcpServers.length,
    highImpactConnections: result.connectionMap.highRiskPaths.length,
    findings: result.findings.length,
    critical: countSeverity("critical"),
    high: countSeverity("high"),
    medium: countSeverity("medium"),
  };
}

function categoryScore(findings: GuardFinding[], category: GuardFindingCategory) {
  const penalty = findings
    .filter((finding) => finding.category === category)
    .reduce((total, finding) => total + findingPenalty(finding.severity), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function categoryScores(findings: GuardFinding[]): GuardScanResult["categoryScores"] {
  return {
    mcpRisk: categoryScore(findings, "mcp-risk"),
    agentReliability: categoryScore(findings, "agent-reliability"),
    secretHygiene: categoryScore(findings, "secret-hygiene"),
    ideBloat: categoryScore(findings, "ide-bloat"),
    tokenWaste: categoryScore(findings, "token-waste"),
    blastRadius: categoryScore(findings, "blast-radius"),
  };
}

function overallScore(scores: GuardScanResult["categoryScores"]) {
  return Math.round(
    (scores.mcpRisk * 0.2) +
    (scores.agentReliability * 0.16) +
    (scores.secretHygiene * 0.22) +
    (scores.ideBloat * 0.12) +
    (scores.tokenWaste * 0.12) +
    (scores.blastRadius * 0.18),
  );
}

export async function runSecurityScan(configuration?: vscode.WorkspaceConfiguration): Promise<GuardScanResult> {
  const [workspaceFiles, extensions, secrets, mcpServers, packageContext, rawWorkspaceSurface] = await Promise.all([
    scanWorkspaceFiles(configuration),
    Promise.resolve(scanInstalledExtensions()),
    scanRiskyFiles(),
    scanMcpServers(),
    scanPackageContext(),
    scanWorkspaceSurface(),
  ]);
  const workspaceSurface = {
    ...rawWorkspaceSurface,
    riskyPackageScripts: packageContext.riskyPackageScripts,
  };
  const scannedAgentFiles = workspaceFiles.map((file) => ({
    logicalPath: file.logicalPath,
    category: file.category,
    content: "content" in file && typeof file.content === "string" ? file.content : undefined,
  }));
  const agentFiles = scannedAgentFiles.map((file) => ({ logicalPath: file.logicalPath, category: file.category }));
  const findings = buildFindings({
    agentFiles: scannedAgentFiles,
    packageManagers: packageContext.packageManagers,
    packageScripts: packageContext.packageScripts,
    extensions,
    secrets,
    mcpServers,
    workspaceSurface,
  });
  const connectionMap = buildConnectionMap({
    agentFiles,
    extensions,
    secrets,
    mcpServers,
    workspaceSurface,
  });
  const scores = categoryScores(findings);
  const score = overallScore(scores);
  const partial = {
    scannedAt: new Date().toISOString(),
    score,
    rank: rankForScore(score),
    categoryScores: scores,
    packageManagers: packageContext.packageManagers,
    packageScripts: packageContext.packageScripts,
    agentFiles,
    extensions,
    secrets,
    mcpServers,
    workspaceSurface,
    connectionMap,
    findings,
  };

  return {
    ...partial,
    summary: summarize(partial),
  };
}

export async function collectGuardUploadArtifacts(
  scan: GuardScanResult,
  configuration?: vscode.WorkspaceConfiguration,
): Promise<GuardUploadArtifact[]> {
  const artifacts: GuardUploadArtifact[] = [];
  const seen = new Set<string>();

  function addArtifact(artifact: GuardUploadArtifact) {
    const key = `${artifact.kind}:${artifact.logicalPath}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    artifacts.push(artifact);
  }

  const mcpConfigFiles = await findMcpConfigFiles();
  for (const file of mcpConfigFiles) {
    try {
      const content = await readTextFile(file);
      if (!content) {
        continue;
      }

      const logicalPath = logicalPathForUri(file);
      addArtifact({
        kind: "mcp-config",
        logicalPath,
        content,
        mimeType: mimeTypeForGuardArtifact(logicalPath),
      });
    } catch {
      // Local scan artifacts are best effort; unreadable files remain represented by scan findings.
    }
  }

  const agentFiles = await scanWorkspaceFiles(configuration);
  for (const file of agentFiles) {
    if (!file.content || file.category === "source") {
      continue;
    }

    addArtifact({
      kind: guardArtifactKindForAgentFile(file),
      logicalPath: file.logicalPath,
      content: file.content,
      mimeType: mimeTypeForGuardArtifact(file.logicalPath),
    });
  }

  addArtifact({
    kind: "guard-report",
    logicalPath: ".drylake/reports/guard-scan-summary.json",
    content: JSON.stringify({
      scannedAt: scan.scannedAt,
      score: scan.score,
      rank: scan.rank,
      summary: scan.summary,
      categoryScores: scan.categoryScores,
      findings: scan.findings,
      connectionMap: scan.connectionMap,
    }, null, 2),
    mimeType: "application/json",
  });

  return artifacts;
}

function categoryLabel(category: GuardFindingCategory) {
  if (category === "prompt-injection") return "Prompt Injection Risk";
  if (category === "supply-chain") return "Supply-Chain Risk";
  if (category === "mcp-risk") return "MCP Risk";
  if (category === "agent-reliability") return "Agent Reliability";
  if (category === "ide-extension-access") return "IDE Extension Access";
  if (category === "secret-hygiene") return "Secret Hygiene";
  if (category === "ide-bloat") return "IDE Bloat";
  if (category === "blast-radius") return "Blast Radius";
  if (category === "deploy-surface") return "Deploy Surface";
  if (category === "suspicious-artifact") return "Suspicious Artifact Review";
  return "Token Waste";
}

function scoreLines(scan: GuardScanResult) {
  return [
    `- MCP Risk Score: ${scan.categoryScores.mcpRisk}/100`,
    `- Agent Reliability Score: ${scan.categoryScores.agentReliability}/100`,
    `- Secret Hygiene Score: ${scan.categoryScores.secretHygiene}/100`,
    `- IDE Bloat Score: ${scan.categoryScores.ideBloat}/100`,
    `- Token Waste Score: ${scan.categoryScores.tokenWaste}/100`,
    `- Blast Radius Score: ${scan.categoryScores.blastRadius}/100`,
  ];
}

function renderFindingsMarkdown(scan: GuardScanResult, limit?: number) {
  const findings = typeof limit === "number" ? scan.findings.slice(0, limit) : scan.findings;
  if (findings.length === 0) {
    return "No findings were detected in this local scan.";
  }

  return findings.map((finding, index) => [
    `### ${index + 1}. ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    `- Category: ${categoryLabel(finding.category)}`,
    `- Source: ${finding.source}`,
    finding.path ? `- Location: ${finding.path}${finding.line ? `:${finding.line}` : ""}` : undefined,
    `- Evidence: ${finding.evidence}`,
    `- Recommendation: ${finding.recommendation}`,
    `- Safe to share: ${finding.safeToShare ? "yes" : "no"}`,
  ].filter(Boolean).join("\n")).join("\n\n");
}

function renderCategoryFindingsMarkdown(scan: GuardScanResult, category: GuardFindingCategory) {
  const scoped = scan.findings.filter((finding) => finding.category === category);
  if (scoped.length === 0) {
    return `No ${categoryLabel(category).toLowerCase()} findings detected.`;
  }

  return renderFindingsMarkdown({ ...scan, findings: scoped });
}

export function renderSafeDeveloperSummary(scan: GuardScanResult) {
  return [
    `Safe Developer Rank: ${scan.rank} - ${scan.score}/100`,
    `MCP Risk: ${scan.categoryScores.mcpRisk}/100`,
    `Agent Reliability: ${scan.categoryScores.agentReliability}/100`,
    `Secret Hygiene: ${scan.categoryScores.secretHygiene}/100`,
    `IDE Bloat: ${scan.categoryScores.ideBloat}/100`,
    `Token Waste: ${scan.categoryScores.tokenWaste}/100`,
    `Blast Radius: ${scan.categoryScores.blastRadius}/100`,
    `High-impact connections: ${scan.summary.highImpactConnections}`,
    `Findings: ${scan.summary.findings} (${scan.summary.critical} critical, ${scan.summary.high} high, ${scan.summary.medium} medium)`,
  ].join("\n");
}

export function renderSafeDeveloperReport(scan: GuardScanResult) {
  return [
    "# DryLake Guard Safe Developer Report",
    "",
    `Generated: ${scan.scannedAt}`,
    "",
    "## Privacy",
    "",
    "- This scan ran locally in the IDE.",
    "- Source code was not uploaded by this report writer.",
    "- Secret values were not stored.",
    "- `.env`-style files record variable names only.",
    "- Reports are private local files unless the user explicitly shares them.",
    "",
    "## Safe Developer Rank",
    "",
    `**${scan.rank} - ${scan.score}/100**`,
    "",
    ...scoreLines(scan),
    "",
    "## Inventory Summary",
    "",
    `- Agent files: ${scan.summary.agentFiles}`,
    `- Skills: ${scan.summary.skills}`,
    `- Rules/instructions: ${scan.summary.rules}`,
    `- Third-party extensions: ${scan.summary.extensions}`,
    `- Active third-party extensions: ${scan.summary.activeExtensions}`,
    `- MCP servers: ${scan.summary.mcpServers}`,
    `- High-impact connection paths: ${scan.summary.highImpactConnections}`,
    `- Risky files with secret-like names/patterns: ${scan.summary.riskyFiles}`,
    `- Workspace risk surface items: ${scan.summary.workspaceSurface}`,
    `- Package managers: ${scan.packageManagers.length ? scan.packageManagers.join(", ") : "none detected"}`,
    `- Package scripts: ${scan.packageScripts.length ? scan.packageScripts.join(", ") : "none detected"}`,
    "",
    "## Top Findings",
    "",
    renderFindingsMarkdown(scan, 12),
    "",
    "## Prompt Injection Risk",
    "",
    renderCategoryFindingsMarkdown(scan, "prompt-injection"),
    "",
    "## Supply-Chain Risk",
    "",
    renderCategoryFindingsMarkdown(scan, "supply-chain"),
    "",
    "## Secret Hygiene",
    "",
    renderCategoryFindingsMarkdown(scan, "secret-hygiene"),
    "",
    "## Token Waste / IDE Bloat",
    "",
    [
      renderCategoryFindingsMarkdown(scan, "token-waste"),
      renderCategoryFindingsMarkdown(scan, "ide-bloat"),
    ].join("\n\n"),
    "",
    "## Suspicious Artifact Review",
    "",
    renderCategoryFindingsMarkdown(scan, "suspicious-artifact"),
    "",
    "## Deploy Surface",
    "",
    renderCategoryFindingsMarkdown(scan, "deploy-surface"),
    "",
    "## Extension Access Review",
    "",
    scan.extensions
      .filter((extension) => !extension.isBuiltin)
      .slice(0, 25)
      .map((extension) => [
        `### ${extension.displayName}`,
        "",
        `- ID: ${extension.id}`,
        `- Publisher: ${extension.publisher || "unknown"}`,
        `- Version: ${extension.version || "unknown"}`,
        `- State: ${extension.isActive ? "active" : "inactive"}`,
        `- Contribution points: ${extension.contributionPoints.join(", ") || "none declared"}`,
        `- Activation events: ${extension.activationEvents.join(", ") || "none declared"}`,
        `- Inferred access: ${extension.accessSignals.join(" ")}`,
        `- Risk flags: ${extension.riskFlags.join(" ") || "none"}`,
      ].join("\n"))
      .join("\n\n") || "No third-party extensions detected.",
    "",
    "## MCP And Tool Connections",
    "",
    scan.mcpServers.map((server) => [
      `### ${server.name}`,
      "",
      `- Config: ${server.configPath}`,
      `- Command: ${[server.command, ...server.args].filter(Boolean).join(" ") || server.url || "unknown"}`,
      `- Env var names: ${server.envKeys.join(", ") || "none declared"}`,
      `- Capabilities: ${server.capabilities.join(", ")}`,
      `- Blast radius: ${server.blastRadius}`,
      `- Risk flags: ${server.riskFlags.join(" ") || "none"}`,
    ].join("\n")).join("\n\n") || "No MCP server configs detected.",
    "",
    "## Agentic Connection Map",
    "",
    `- Nodes: ${scan.connectionMap.nodes.length}`,
    `- Edges: ${scan.connectionMap.edges.length}`,
    `- High-risk paths: ${scan.connectionMap.highRiskPaths.length}`,
    "",
    scan.connectionMap.highRiskPaths.length
      ? scan.connectionMap.highRiskPaths.slice(0, 20).map((item) => `- ${item}`).join("\n")
      : "No high-risk connection paths detected.",
    "",
    "## Workspace Risk Surface",
    "",
    `- CI/CD workflows: ${scan.workspaceSurface.ciWorkflowFiles.length}`,
    `- Infrastructure/deployment config files: ${scan.workspaceSurface.iacFiles.length}`,
    `- Deploy/release/migration scripts: ${scan.workspaceSurface.deploymentFiles.length}`,
    `- Credential-like file paths: ${scan.workspaceSurface.credentialLikeFiles.length}`,
    `- Risky package scripts: ${scan.workspaceSurface.riskyPackageScripts.length}`,
    `- Generated output folders: ${scan.workspaceSurface.generatedFolders.length}`,
    "",
    scan.workspaceSurface.riskyPackageScripts.length
      ? [
        "### Risky Package Scripts",
        "",
        ...scan.workspaceSurface.riskyPackageScripts.slice(0, 20).map((script) => `- ${script.path} -> ${script.name}: ${script.risk}`),
      ].join("\n")
      : "No risky package scripts detected.",
    "",
    scan.workspaceSurface.iacFiles.length || scan.workspaceSurface.deploymentFiles.length || scan.workspaceSurface.ciWorkflowFiles.length
      ? [
        "### High-Impact Files",
        "",
        ...[
          ...scan.workspaceSurface.ciWorkflowFiles,
          ...scan.workspaceSurface.iacFiles,
          ...scan.workspaceSurface.deploymentFiles,
        ].slice(0, 40).map((item) => `- ${item.path} (${item.type})`),
      ].join("\n")
      : "No CI/CD, IaC, deploy, release, or migration files detected.",
    "",
  ].join("\n");
}

function safeFinding(finding: GuardFinding) {
  return {
    id: finding.id,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    safeToShare: finding.safeToShare,
    source: finding.source,
    path: finding.safeToShare ? finding.path : undefined,
    line: finding.safeToShare ? finding.line : undefined,
  };
}

function renderAgenticMap(scan: GuardScanResult) {
  return {
    generatedAt: scan.scannedAt,
    privacy: {
      sourceCodeUploaded: false,
      secretValuesStored: false,
      envValuesStored: false,
    },
      ide: {
      extensions: scan.extensions.map((extension) => ({
        id: extension.id,
        publisher: extension.publisher,
        displayName: extension.displayName,
        version: extension.version,
        isActive: extension.isActive,
        isBuiltin: extension.isBuiltin,
        activationEvents: extension.activationEvents,
        contributionPoints: extension.contributionPoints,
        accessLevel: extension.accessLevel,
        inferredAccess: extension.accessSignals,
        capabilityTags: extension.capabilityTags,
        riskFlags: extension.riskFlags,
        manifestEvidence: extension.manifestEvidence,
      })),
    },
    agents: {
      files: scan.agentFiles,
    },
    mcp: {
      servers: scan.mcpServers.map((server) => ({
        name: server.name,
        configPath: server.configPath,
        command: server.command,
        args: server.args,
        url: server.url,
        envKeys: server.envKeys,
        capabilities: server.capabilities,
        riskFlags: server.riskFlags,
        severity: server.severity,
        blastRadius: server.blastRadius,
      })),
    },
    workspace: {
      packageManagers: scan.packageManagers,
      packageScripts: scan.packageScripts,
      surface: scan.workspaceSurface,
      secretVariableReferences: scan.secrets.map((secret) => ({
        path: secret.path,
        line: secret.line,
        type: secret.type,
        variableName: secret.variableName,
        severity: secret.severity,
      })),
    },
    connectionMap: scan.connectionMap,
  };
}

async function writeText(uri: vscode.Uri, content: string) {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

export async function writeSecurityScanReports(scan: GuardScanResult, workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri): Promise<GuardReportPaths> {
  if (!workspaceUri) {
    throw new Error("Open a workspace before running the DryLake security scan.");
  }

  const reportsDir = vscode.Uri.joinPath(workspaceUri, ".drylake", "reports");
  await vscode.workspace.fs.createDirectory(reportsDir);

  const report = vscode.Uri.joinPath(workspaceUri, ...SAFE_DEVELOPER_REPORT_PATH);
  const score = vscode.Uri.joinPath(workspaceUri, ...SAFE_DEVELOPER_SCORE_PATH);
  const findings = vscode.Uri.joinPath(workspaceUri, ...SAFE_DEVELOPER_FINDINGS_PATH);
  const agenticMap = vscode.Uri.joinPath(workspaceUri, ...AGENTIC_MAP_PATH);

  await Promise.all([
    writeText(report, renderSafeDeveloperReport(scan)),
    writeText(score, JSON.stringify({
      scannedAt: scan.scannedAt,
      score: scan.score,
      rank: scan.rank,
      categoryScores: scan.categoryScores,
      summary: scan.summary,
      workspaceSurface: scan.workspaceSurface,
      connectionMap: scan.connectionMap,
    }, null, 2)),
    writeText(findings, JSON.stringify(scan.findings.map(safeFinding), null, 2)),
    writeText(agenticMap, JSON.stringify(renderAgenticMap(scan), null, 2)),
  ]);

  return { report, score, findings, agenticMap };
}
