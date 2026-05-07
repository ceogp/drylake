import * as vscode from "vscode";

const SCHEME = "xupra-optimized";

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

const CODEX_AGENT = /(^|\/)\.codex\/agents\/.+\.toml$/i;
const CODEX_AGENTS_MD = /(^|\/)AGENTS\.md$/i;
const CLAUDE_AGENT = /(^|\/)\.claude\/agents\/.+\.md$/i;
const CLAUDE_MD = /(^|\/)CLAUDE\.md$/i;
const CURSOR_RULE = /(^|\/)\.cursor\/rules\/.+\.mdc$/i;
const CURSOR_SKILL = /(^|\/)\.cursor\/skills\/.+\/SKILL\.md$/i;

export function inferTargetPlatformFromUri(uri: vscode.Uri): "codex" | "claude_code" | "claude_agents" | "cursor" | null {
  const normalized = uri.path.replace(/\\/g, "/");

  if (CODEX_AGENT.test(normalized) || CODEX_AGENTS_MD.test(normalized)) {
    return "codex";
  }
  if (CLAUDE_AGENT.test(normalized)) {
    return "claude_agents";
  }
  if (CLAUDE_MD.test(normalized)) {
    return "claude_code";
  }
  if (CURSOR_RULE.test(normalized) || CURSOR_SKILL.test(normalized)) {
    return "cursor";
  }
  return null;
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
