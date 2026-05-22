import * as vscode from "vscode";

const SCHEME = "xupra-optimized";
const IMPORTED_SCHEME = "xupra-imported";

export class OptimizationContentProvider implements vscode.TextDocumentContentProvider {
  private readonly contentByPath = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.emitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentByPath.get(uri.toString()) ?? "";
  }

  register(originalUri: vscode.Uri, content: string): vscode.Uri {
    const optimizedUri = vscode.Uri.from({
      scheme: SCHEME,
      path: originalUri.path,
      query: `t=${Date.now()}`,
    });
    const key = optimizedUri.toString();
    this.contentByPath.set(key, content);
    this.emitter.fire(optimizedUri);
    return optimizedUri;
  }

  static get scheme() {
    return SCHEME;
  }
}

type FetchImportedContent = (versionId: string, logicalPath: string) => Promise<string>;

export class ImportedContentProvider implements vscode.TextDocumentContentProvider {
  private readonly cache = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.emitter.event;

  constructor(private readonly fetcher: FetchImportedContent) {}

  static buildUri(versionId: string, logicalPath: string): vscode.Uri {
    // Encode versionId in authority and logicalPath in path for stable parsing.
    const safePath = logicalPath.startsWith("/") ? logicalPath : "/" + logicalPath;
    return vscode.Uri.from({
      scheme: IMPORTED_SCHEME,
      authority: versionId,
      path: safePath,
    });
  }

  static get scheme() {
    return IMPORTED_SCHEME;
  }

  refresh(uri: vscode.Uri) {
    this.cache.delete(uri.toString());
    this.emitter.fire(uri);
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const key = uri.toString();
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const versionId = uri.authority;
    const logicalPath = uri.path.replace(/^\/+/, "");
    if (!versionId || !logicalPath) {
      return "// Unable to load file: missing version or path.";
    }

    try {
      const content = await this.fetcher(versionId, logicalPath);
      this.cache.set(key, content);
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `// Failed to load ${logicalPath} from server.\n// ${message}`;
    }
  }
}

const CODEX_AGENT = /(^|\/)\.codex\/agents\/.+\.toml$/i;
const CODEX_AGENTS_MD = /(^|\/)AGENTS\.md$/i;
const CODEX_SKILL = /(^|\/)\.codex\/skills\/.+/i;
const CLAUDE_AGENT = /(^|\/)\.claude\/agents\/.+\.md$/i;
const CLAUDE_MD = /(^|\/)CLAUDE\.md$/i;
const CLAUDE_SKILL = /(^|\/)\.claude\/(skills|commands)\/.+/i;
const CURSOR_RULE = /(^|\/)\.cursor\/rules\/.+\.mdc?$/i;
const CURSOR_SKILL = /(^|\/)\.cursor\/(skills|commands)\/.+/i;
const CURSOR_ANY = /(^|\/)\.cursor\//i;
const WINDSURF_RULE = /(^|\/)\.windsurf\/rules\/.+\.md$/i;
const CLINE_RULE = /(^|\/)\.clinerules(?:\/.+\.md)?$/i;
const ROO_RULE = /(^|\/)(?:\.roo\/rules\/.+\.md|\.roorules)$/i;
const COPILOT_INSTRUCTIONS = /(^|\/)\.github\/(?:copilot-instructions\.md|instructions\/.+\.instructions\.md)$/i;
const GEMINI_MD = /(^|\/)GEMINI\.md$/i;
const JUNIE_GUIDELINES = /(^|\/)\.junie\/guidelines\.md$/i;
const WARP_MD = /(^|\/)WARP\.md$/i;
const GENERIC_RULES = /(^|\/)\.rules$/i;
const AGENTS_DIR = /(^|\/)\.agents\//i;

export type InferredPlatform =
  | "codex"
  | "claude_code"
  | "claude_agents"
  | "cursor"
  | "windsurf"
  | "cline"
  | "roo"
  | "copilot"
  | "gemini"
  | "junie"
  | "warp"
  | "generic";

export function inferTargetPlatformFromUri(uri: vscode.Uri): InferredPlatform | null {
  const normalized = uri.path.replace(/\\/g, "/");

  if (CODEX_AGENT.test(normalized) || CODEX_AGENTS_MD.test(normalized) || CODEX_SKILL.test(normalized)) {
    return "codex";
  }
  if (CLAUDE_AGENT.test(normalized)) {
    return "claude_agents";
  }
  if (CLAUDE_MD.test(normalized) || CLAUDE_SKILL.test(normalized)) {
    return "claude_code";
  }
  if (CURSOR_RULE.test(normalized) || CURSOR_SKILL.test(normalized) || CURSOR_ANY.test(normalized)) {
    return "cursor";
  }
  if (WINDSURF_RULE.test(normalized)) {
    return "windsurf";
  }
  if (CLINE_RULE.test(normalized)) {
    return "cline";
  }
  if (ROO_RULE.test(normalized)) {
    return "roo";
  }
  if (COPILOT_INSTRUCTIONS.test(normalized)) {
    return "copilot";
  }
  if (GEMINI_MD.test(normalized)) {
    return "gemini";
  }
  if (JUNIE_GUIDELINES.test(normalized)) {
    return "junie";
  }
  if (WARP_MD.test(normalized)) {
    return "warp";
  }
  if (GENERIC_RULES.test(normalized)) {
    return "generic";
  }
  if (AGENTS_DIR.test(normalized)) {
    return "codex";
  }
  return null;
}

export async function pickTargetPlatform(currentBest?: InferredPlatform | null): Promise<InferredPlatform | null> {
  const items: Array<vscode.QuickPickItem & { value: InferredPlatform }> = [
    { label: "Codex", description: "AGENTS.md / .codex/agents/*.toml", value: "codex" },
    { label: "Claude Code", description: "CLAUDE.md / .claude/skills/*", value: "claude_code" },
    { label: "Claude Agents", description: ".claude/agents/*.md", value: "claude_agents" },
    { label: "Cursor", description: ".cursor/rules/*.mdc", value: "cursor" },
    { label: "GitHub Copilot", description: ".github/copilot-instructions.md", value: "copilot" },
    { label: "Gemini CLI", description: "GEMINI.md", value: "gemini" },
    { label: "JetBrains Junie", description: ".junie/guidelines.md", value: "junie" },
    { label: "Warp", description: "WARP.md", value: "warp" },
    { label: "Generic .rules", description: ".rules", value: "generic" },
  ];
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: currentBest
      ? `Pick the target platform (best guess: ${currentBest})`
      : "Pick the target platform for Xupra AI to optimize against",
    ignoreFocusOut: true,
  });
  return picked?.value ?? null;
}


export async function collectRepoContext(): Promise<string | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    return undefined;
  }

  const segments: string[] = [];

  const readSnippet = async (relative: string, label: string, maxBytes: number) => {
    try {
      const fileUri = vscode.Uri.joinPath(root, ...relative.split("/"));
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const text = new TextDecoder("utf-8").decode(bytes).slice(0, maxBytes).trim();
      if (text) {
        segments.push(`--- ${label} (${relative}) ---\n${text}`);
      }
    } catch {
      // missing files are ignored
    }
  };

  await readSnippet("package.json", "package.json", 1500);
  await readSnippet("README.md", "README.md", 2000);
  await readSnippet("pyproject.toml", "pyproject.toml", 1000);
  await readSnippet("go.mod", "go.mod", 800);
  await readSnippet("Cargo.toml", "Cargo.toml", 800);

  return segments.length > 0 ? segments.join("\n\n") : undefined;
}
