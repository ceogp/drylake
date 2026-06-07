import * as vscode from "vscode";
import os from "node:os";
import path from "node:path";

import { scanWorkspaceFiles } from "./workspaceScanner";

export type GuardSeverity = "critical" | "high" | "medium" | "low" | "info";
export type SafeDeveloperRank = "Scout" | "Builder" | "Operator" | "Guardian" | "Sentinel";
export type GuardFindingCategory =
  | "mcp-risk"
  | "agent-reliability"
  | "secret-hygiene"
  | "ide-bloat"
  | "token-waste";

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
  activationEvents: string[];
  contributionPoints: string[];
  accessSignals: string[];
  riskFlags: string[];
};

export type GuardSecretFinding = {
  path: string;
  line: number;
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
  };
  summary: {
    agentFiles: number;
    skills: number;
    rules: number;
    extensions: number;
    activeExtensions: number;
    riskyFiles: number;
    mcpServers: number;
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
  findings: GuardFinding[];
};

type ScannedAgentFile = { logicalPath: string; category: string; content?: string };

type PackageContext = {
  packageManagers: string[];
  packageScripts: string[];
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

const MCP_CONFIG_PATTERNS = [
  "**/.vscode/mcp.json",
  "**/.cursor/mcp.json",
  "**/.mcp.json",
  "**/mcp.json",
  "**/claude_desktop_config.json",
];

const EXCLUDE_PATTERN = "**/{node_modules,.git,.next,dist,build,out,coverage,storage,.venv,__pycache__,google-cloud-sdk,generated_export,raw_source,deployment_output,worker-smoke,.system}/**";
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

  if (contributionPoints.includes("debuggers") || contributionPoints.includes("taskDefinitions")) {
    signals.add("Contributes debugger/task capabilities that may run local commands.");
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

  return [...signals];
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

      return {
        id: extension.id,
        displayName: readString(packageJson.displayName, readString(packageJson.name, extension.id)),
        publisher,
        version: readString(packageJson.version),
        isActive: Boolean(extension.isActive),
        isBuiltin: Boolean(packageJson.isBuiltin),
        activationEvents,
        contributionPoints,
        accessSignals: extensionAccessSignals(packageJson, activationEvents, contributionPoints),
        riskFlags: extensionRiskFlags(extension.id, packageJson, activationEvents, contributionPoints),
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
    } catch {
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
      results.push({
        configPath: logicalPathForUri(file),
        name,
        command: readString(server.command) || undefined,
        args,
        url: readString(server.url) || undefined,
        envKeys: envKeysFor(server),
        capabilities,
        riskFlags,
        severity: severityFromFlags([...riskFlags, ...capabilities]),
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

async function scanPackageContext(): Promise<PackageContext> {
  const managers = new Set<string>();
  const scripts = new Set<string>();
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
    for (const script of Object.keys(packageScripts)) {
      scripts.add(script);
    }
  }

  return {
    packageManagers: [...managers].sort(),
    packageScripts: [...scripts].sort(),
  };
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

function buildFindings(params: {
  agentFiles: ScannedAgentFile[];
  packageManagers: string[];
  packageScripts: string[];
  extensions: GuardExtensionRisk[];
  secrets: GuardSecretFinding[];
  mcpServers: GuardMcpServer[];
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
      category: "agent-reliability",
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

  return findings.sort((left, right) => findingPenalty(right.severity) - findingPenalty(left.severity));
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
    mcpServers: result.mcpServers.length,
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
  };
}

function overallScore(scores: GuardScanResult["categoryScores"]) {
  return Math.round(
    (scores.mcpRisk * 0.24) +
    (scores.agentReliability * 0.2) +
    (scores.secretHygiene * 0.24) +
    (scores.ideBloat * 0.16) +
    (scores.tokenWaste * 0.16),
  );
}

export async function runSecurityScan(configuration?: vscode.WorkspaceConfiguration): Promise<GuardScanResult> {
  const [workspaceFiles, extensions, secrets, mcpServers, packageContext] = await Promise.all([
    scanWorkspaceFiles(configuration),
    Promise.resolve(scanInstalledExtensions()),
    scanRiskyFiles(),
    scanMcpServers(),
    scanPackageContext(),
  ]);
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
    findings,
  };

  return {
    ...partial,
    summary: summarize(partial),
  };
}

function categoryLabel(category: GuardFindingCategory) {
  if (category === "mcp-risk") return "MCP Risk";
  if (category === "agent-reliability") return "Agent Reliability";
  if (category === "secret-hygiene") return "Secret Hygiene";
  if (category === "ide-bloat") return "IDE Bloat";
  return "Token Waste";
}

function scoreLines(scan: GuardScanResult) {
  return [
    `- MCP Risk Score: ${scan.categoryScores.mcpRisk}/100`,
    `- Agent Reliability Score: ${scan.categoryScores.agentReliability}/100`,
    `- Secret Hygiene Score: ${scan.categoryScores.secretHygiene}/100`,
    `- IDE Bloat Score: ${scan.categoryScores.ideBloat}/100`,
    `- Token Waste Score: ${scan.categoryScores.tokenWaste}/100`,
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

export function renderSafeDeveloperSummary(scan: GuardScanResult) {
  return [
    `Safe Developer Rank: ${scan.rank} - ${scan.score}/100`,
    `MCP Risk: ${scan.categoryScores.mcpRisk}/100`,
    `Agent Reliability: ${scan.categoryScores.agentReliability}/100`,
    `Secret Hygiene: ${scan.categoryScores.secretHygiene}/100`,
    `IDE Bloat: ${scan.categoryScores.ideBloat}/100`,
    `Token Waste: ${scan.categoryScores.tokenWaste}/100`,
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
    `- Risky files with secret-like names/patterns: ${scan.summary.riskyFiles}`,
    `- Package managers: ${scan.packageManagers.length ? scan.packageManagers.join(", ") : "none detected"}`,
    `- Package scripts: ${scan.packageScripts.length ? scan.packageScripts.join(", ") : "none detected"}`,
    "",
    "## Top Findings",
    "",
    renderFindingsMarkdown(scan, 12),
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
      `- Risk flags: ${server.riskFlags.join(" ") || "none"}`,
    ].join("\n")).join("\n\n") || "No MCP server configs detected.",
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
        inferredAccess: extension.accessSignals,
        riskFlags: extension.riskFlags,
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
      })),
    },
    workspace: {
      packageManagers: scan.packageManagers,
      packageScripts: scan.packageScripts,
      secretVariableReferences: scan.secrets.map((secret) => ({
        path: secret.path,
        line: secret.line,
        type: secret.type,
        variableName: secret.variableName,
        severity: secret.severity,
      })),
    },
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
    }, null, 2)),
    writeText(findings, JSON.stringify(scan.findings.map(safeFinding), null, 2)),
    writeText(agenticMap, JSON.stringify(renderAgenticMap(scan), null, 2)),
  ]);

  return { report, score, findings, agenticMap };
}
