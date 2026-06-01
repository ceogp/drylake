import * as vscode from "vscode";

type HelpSection = "workflow";

const sections: Record<HelpSection, { title: string; eyebrow: string; body: string; items: string[] }> = {
  workflow: {
    title: "Import, Normalize, Export",
    eyebrow: "Workflow",
    body: "Xupra DryLake turns IDE-specific agent files into a canonical package, then exports that package for another supported target.",
    items: [
      "Import supported workspace and global files from this editor.",
      "Review normalized agents, skills, rules, and raw files in the workspace.",
      "Run compatibility checks before export preview.",
      "Export generated files back into the target IDE format.",
    ],
  },
};

export class HowItWorksPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;

  static createOrShow(context: vscode.ExtensionContext, section: HelpSection = "workflow") {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (HowItWorksPanel.currentPanel) {
      HowItWorksPanel.currentPanel.reveal(column);
      HowItWorksPanel.currentPanel.webview.html = HowItWorksPanel.render(section);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "xupra.howItWorks",
      "Xupra DryLake Help",
      column,
      {
        enableScripts: false,
        localResourceRoots: [context.extensionUri],
      },
    );

    HowItWorksPanel.currentPanel = panel;
    panel.webview.html = HowItWorksPanel.render(section);
    panel.onDidDispose(() => {
      HowItWorksPanel.currentPanel = undefined;
    });
  }

  private static render(section: HelpSection) {
    const content = sections[section];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: "Helvetica Neue", Helvetica, system-ui, sans-serif;
      font-size: var(--vscode-font-size);
    }

    main {
      max-width: 760px;
      padding: 32px;
    }

    .eyebrow {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 10px 0 12px;
      font-size: 30px;
      line-height: 1.1;
    }

    p {
      max-width: 680px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.65;
    }

    ol {
      display: grid;
      gap: 10px;
      margin: 22px 0 0;
      padding: 0;
      list-style: none;
    }

    li {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px 14px;
      background: var(--vscode-sideBar-background, var(--vscode-editorWidget-background));
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">${content.eyebrow}</div>
    <h1>${content.title}</h1>
    <p>${content.body}</p>
    <ol>
      ${content.items.map((item) => `<li>${item}</li>`).join("")}
    </ol>
  </main>
</body>
</html>`;
  }
}
