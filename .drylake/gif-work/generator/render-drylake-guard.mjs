import gifenc from "gifenc";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { GIFEncoder, quantize, applyPalette } = gifenc;
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const workDir = path.resolve(repoRoot, ".drylake", "gif-work");
const mediaDir = path.resolve(repoRoot, "extensions", "xupra-drylake-vscode", "media");
const publicMediaDir = path.resolve(repoRoot, "public", "marketplace", "extension", "media");

const width = 1120;
const height = 630;
const fps = 10;
const durationSeconds = 18;
const totalFrames = Math.round(durationSeconds * fps);
const frameDelay = Math.round(1000 / fps);

const CONTENT_X = 64;
const CONTENT_W = width - CONTENT_X - 24;
const REPORT_Y = 226;
const REPORT_H = 376;
const REPORT_PAD = 22;
const REPORT_X = CONTENT_X;
const REPORT_W = CONTENT_W;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function span(start, end, t) {
  return ease((t - start) / (end - start));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rect(x, y, w, h, opts = {}) {
  const fill = opts.fill ?? "none";
  const stroke = opts.stroke ? ` stroke="${opts.stroke}"` : "";
  const sw = opts.sw ? ` stroke-width="${opts.sw}"` : "";
  const rx = opts.rx ?? 0;
  const opacity = opts.opacity == null ? "" : ` opacity="${opts.opacity}"`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke}${sw}${opacity}/>`;
}

function text(value, x, y, opts = {}) {
  const size = opts.size ?? 14;
  const weight = opts.weight ?? 400;
  const fill = opts.fill ?? "#d8ded8";
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const opacity = opts.opacity == null ? "" : ` opacity="${opts.opacity}"`;
  const family = opts.mono
    ? "'Cascadia Mono','SFMono-Regular','Consolas',monospace"
    : "'Helvetica Neue','Helvetica','Segoe UI',sans-serif";
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}"${anchor}${opacity}>${esc(value)}</text>`;
}

function wrap(value, maxChars) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function multiText(value, x, y, opts = {}) {
  return wrap(value, opts.maxChars ?? 60)
    .slice(0, opts.maxLines ?? 3)
    .map((line, index) => text(line, x, y + index * (opts.lineHeight ?? 16), opts))
    .join("");
}

function pill(value, x, y, opts = {}) {
  const w = opts.w ?? Math.max(42, value.length * (opts.size ?? 10) * 0.62 + 18);
  return [
    rect(x, y, w, opts.h ?? 20, {
      fill: opts.fill ?? "#2b2114",
      stroke: opts.stroke ?? "#755526",
      sw: 1,
      rx: opts.rx ?? 10,
      opacity: opts.opacity,
    }),
    text(value, x + w / 2, y + (opts.textY ?? 14), {
      size: opts.size ?? 9,
      weight: opts.weight ?? 800,
      fill: opts.textFill ?? "#ffd18a",
      anchor: "middle",
      opacity: opts.opacity,
    }),
  ].join("");
}

function chrome() {
  return [
    rect(0, 0, width, height, { fill: "#070908" }),
    rect(0, 0, width, 30, { fill: "#1b1d1e" }),
    text("File", 54, 20, { size: 11, fill: "#aeb6af" }),
    text("Edit", 88, 20, { size: 11, fill: "#aeb6af" }),
    text("Selection", 122, 20, { size: 11, fill: "#aeb6af" }),
    text("View", 184, 20, { size: 11, fill: "#aeb6af" }),
    text("Run", 222, 20, { size: 11, fill: "#aeb6af" }),
    text("Terminal", 257, 20, { size: 11, fill: "#aeb6af" }),
    rect(377, 6, 368, 18, { fill: "#111414", stroke: "#303535", sw: 1, rx: 4 }),
    text("drylake guard report", 510, 20, { size: 11, fill: "#a8aea9" }),
    rect(14, 7, 17, 17, { fill: "#f0a04b", rx: 4 }),
    text("d", 20, 20, { size: 12, weight: 800, fill: "#07100b", mono: true }),
    rect(0, 30, 42, height - 30, { fill: "#111313" }),
    ...[58, 98, 138, 178, 218, 258, 298, 338].map((y, index) =>
      rect(11, y, 20, 20, {
        fill: index === 4 ? "#202727" : "none",
        stroke: index === 4 ? "#69786f" : "#414644",
        sw: 1,
        rx: 4,
        opacity: index === 4 ? 1 : 0.75,
      }),
    ),
    rect(42, 30, width - 42, height - 30, { fill: "#080b0a" }),
  ].join("");
}

function appHeader(t) {
  const reportMode = t > 2.4;
  return [
    rect(CONTENT_X, 48, CONTENT_W, 118, { fill: "#0d1110", stroke: "#25302b", sw: 1, rx: 8 }),
    text("DryLake Control Plane", CONTENT_X + 20, 75, { size: 10, weight: 750, fill: "#79daa4" }),
    text("Security", CONTENT_X + 20, 106, { size: 26, weight: 760, fill: "#f3f8f2" }),
    text(reportMode ? "Detailed agentic security posture report" : "Guard scan, MCP risk, extension access, secrets, token waste, and blast radius.", CONTENT_X + 20, 130, { size: 13, fill: "#a9b4ad" }),
    rect(CONTENT_X + 565, 66, 214, 52, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 6 }),
    text("Agent Control", CONTENT_X + 585, 91, { size: 14, weight: 700, fill: "#cbd5ce" }),
    text("planning and handoffs", CONTENT_X + 585, 108, { size: 10, fill: "#7f8983" }),
    rect(CONTENT_X + 790, 66, 214, 52, { fill: "#17211d", stroke: "#2e5842", sw: 1, rx: 6 }),
    text("Security", CONTENT_X + 810, 91, { size: 14, weight: 800, fill: "#dff8e5" }),
    text("Guard posture", CONTENT_X + 810, 108, { size: 10, fill: "#94caa4" }),
    rect(CONTENT_X, 176, CONTENT_W, 42, { fill: "#0d1110", stroke: "#25302b", sw: 1, rx: 7 }),
    rect(CONTENT_X + 14, 186, 104, 22, { fill: "#76d698", rx: 4 }),
    text("Guard Scan", CONTENT_X + 66, 201, { size: 10, weight: 800, fill: "#07120b", anchor: "middle" }),
    rect(CONTENT_X + 128, 186, 104, 22, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 4 }),
    text("Active Guard", CONTENT_X + 180, 201, { size: 10, weight: 700, fill: "#dce5dc", anchor: "middle" }),
    rect(CONTENT_X + 242, 186, 82, 22, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 4 }),
    text("Reports", CONTENT_X + 283, 201, { size: 10, weight: 700, fill: "#dce5dc", anchor: "middle" }),
    rect(CONTENT_X + 807, 184, 206, 25, { fill: "#111a14", stroke: "#304936", sw: 1, rx: 13 }),
    text("HappyDeveloper - Free", CONTENT_X + 910, 201, { size: 10, weight: 700, fill: "#a6e8b8", anchor: "middle" }),
  ].join("");
}

function introOverlay(t) {
  const opacity = (1 - span(0.7, 1.2, t)) * (t < 1.25 ? 1 : 0);
  if (opacity <= 0.01) return "";
  return [
    rect(CONTENT_X + 230, 238, 560, 166, { fill: "#0d1410", stroke: "#2d4234", sw: 1, rx: 10, opacity }),
    text("Register Free", CONTENT_X + 262, 286, { size: 27, weight: 850, fill: "#f6faf4", opacity }),
    multiText("The free Guard scan requires a DryLake account. After registration, scan the workspace and review exact evidence before any fix workflow.", CONTENT_X + 262, 318, {
      size: 13,
      fill: "#b8c3bb",
      maxChars: 68,
      maxLines: 2,
      lineHeight: 18,
      opacity,
    }),
    rect(CONTENT_X + 262, 365, 118, 28, { fill: "#76d698", rx: 5, opacity }),
    text("Continue", CONTENT_X + 321, 383, { size: 12, weight: 800, fill: "#07120b", anchor: "middle", opacity }),
  ].join("");
}

function scanMoment(t) {
  const opacity = span(1.05, 1.35, t) * (1 - span(2.15, 2.45, t));
  if (opacity <= 0.01) return "";
  const rows = [
    ["MCP configs", ".cursor/mcp.json, .vscode/mcp.json"],
    ["Extensions", "activation events, commands, manifests"],
    ["Secrets", ".env names and secret-like references"],
    ["Deploy surface", "CI, Docker, package scripts, cloud commands"],
  ];
  return [
    rect(REPORT_X, REPORT_Y, REPORT_W, REPORT_H, { fill: "#0e1311", stroke: "#314338", sw: 1, rx: 8, opacity }),
    text("DryLake Security Scan", REPORT_X + 24, REPORT_Y + 42, { size: 22, weight: 850, fill: "#f4f7f2", opacity }),
    text("Scanning workspace evidence before any fix actions...", REPORT_X + 24, REPORT_Y + 68, { size: 13, fill: "#aeb8b0", opacity }),
    ...rows.map(([label, detail], index) => {
      const y = REPORT_Y + 110 + index * 48;
      return [
        rect(REPORT_X + 24, y - 26, 520, 34, { fill: "#111817", stroke: "#2d4234", sw: 1, rx: 6, opacity }),
        `<circle cx="${REPORT_X + 44}" cy="${y - 9}" r="8" fill="none" stroke="#76d698" stroke-width="3" opacity="${opacity}"/>`,
        text(label, REPORT_X + 64, y - 12, { size: 12, weight: 850, fill: "#f2f6f1", opacity }),
        text(detail, REPORT_X + 214, y - 12, { size: 11, fill: "#94a099", opacity }),
      ].join("");
    }),
  ].join("");
}

function metricCard(label, value, x, y, tone = "") {
  const border = tone === "bad" ? "#714238" : tone === "good" ? "#3e714a" : "#26342e";
  return [
    rect(x, y, 108, 54, { fill: "#111817", stroke: border, sw: 1, rx: 6 }),
    text(label, x + 9, y + 17, { size: 8.5, weight: 800, fill: "#9aa49d" }),
    text(value, x + 9, y + 43, { size: 22, weight: 900, fill: "#f1f5ef", mono: /^\d+$/.test(value) }),
  ].join("");
}

function categoryRow(label, value, x, y, tone) {
  const color = tone === "bad" ? "#ff9b8a" : tone === "good" ? "#8af0a7" : "#ffc774";
  return [
    text(label, x, y, { size: 10.5, fill: "#aab4ad" }),
    rect(x + 128, y - 10, 74, 8, { fill: "#232b27", rx: 4 }),
    rect(x + 128, y - 10, Math.max(4, Number(value.split("/")[0]) * 0.74), 8, { fill: color, rx: 4 }),
    text(value, x + 214, y, { size: 10.5, weight: 850, fill: color }),
  ].join("");
}

function finding({ severity, title, evidence, recommendation, path }, x, y, w) {
  const sevColor = severity === "critical" ? "#ff9b8a" : "#ffc774";
  const bodyX = x + 86;
  return [
    rect(x, y, w, 112, { fill: "#111817", stroke: severity === "critical" ? "#744033" : "#514329", sw: 1, rx: 6 }),
    pill(severity, x + 12, y + 13, { w: severity === "critical" ? 62 : 42, h: 19, textY: 13, size: 8, fill: "#3a211c", stroke: "#914439", textFill: sevColor }),
    text(title, bodyX, y + 24, { size: 12.5, weight: 850, fill: "#f1f5ef" }),
    multiText(evidence, bodyX, y + 45, { size: 10.5, fill: "#b5bdb7", maxChars: 94, maxLines: 2, lineHeight: 14 }),
    multiText(recommendation, bodyX, y + 76, { size: 10.5, fill: "#9aa49d", maxChars: 92, maxLines: 2, lineHeight: 14 }),
    path ? text(path, bodyX, y + 101, { size: 10, weight: 800, fill: "#ffcf91", mono: true }) : "",
  ].join("");
}

function smallRow(label, detail, x, y, w, opts = {}) {
  return [
    rect(x, y, w, opts.h ?? 38, { fill: "#111817", stroke: opts.border ?? "#26342e", sw: 1, rx: 5 }),
    text(label, x + 10, y + 15, { size: 11, weight: 850, fill: "#f1f5ef" }),
    text(detail, x + 10, y + 31, { size: 9.5, fill: "#9aa49d", mono: Boolean(opts.mono) }),
  ].join("");
}

const topFindings = [
  {
    severity: "critical",
    title: "Agent blast radius: secrets plus deployment surface",
    evidence: "This workspace has secret-like references, deployment or infrastructure surfaces, and agent/tool surfaces that may execute commands or modify files.",
    recommendation: "Require approval before agent execution, isolate production credentials, and add protected paths before running autonomous coding tools.",
  },
  {
    severity: "high",
    title: "Secret-like variable exposure",
    evidence: "ADMIN_INTERNAL_BASIC_AUTH_PASSWORD is declared in .env. Value was not stored.",
    recommendation: "Move secrets to a local secret manager or provider-specific secure storage and keep values out of agent-visible files.",
    path: ".env:6",
  },
  {
    severity: "high",
    title: "Secret-like variable exposure",
    evidence: "APP_ENCRYPTION_KEY is declared in .env. Value was not stored.",
    recommendation: "Move secrets to a local secret manager or provider-specific secure storage and keep values out of agent-visible files.",
    path: ".env:7",
  },
  {
    severity: "high",
    title: "Secret-like variable exposure",
    evidence: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, and CLERK_WEBHOOK_SIGNING_SECRET are declared in .env.",
    recommendation: "Keep values out of agent-visible files and review public/private key separation.",
    path: ".env:12-14",
  },
  {
    severity: "high",
    title: "AWS credential variable exposure",
    evidence: "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SECRETS_PREFIX, and AWS_KMS_KEY_ID are declared in .env.",
    recommendation: "Use provider secure storage, scope IAM permissions, and avoid exposing production credentials to agents.",
    path: ".env:31-36",
  },
  {
    severity: "high",
    title: "Slack token variable exposure",
    evidence: "SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are declared in .env. Values were not stored.",
    recommendation: "Rotate if exposed, move to secure storage, and keep bot tokens out of agent-visible files.",
    path: ".env:48-49",
  },
];

const highImpactPaths = [
  "Container Tools: extension host code, commands, settings, local execution surface, AI/agent, webview/UI, deploy/cloud, workspace files, terminal/commands",
  "Jupyter: extension host code, commands, settings, local execution surface, AI/agent, webview/UI, workspace files, terminal/commands",
  "GitLab: extension host code, commands, settings, source control, AI/agent, webview/UI, workspace files, terminal/commands",
  "Azure Resources: extension host code, commands, settings, auth/secrets, AI/agent, webview/UI, deploy/cloud, workspace files, terminal/commands",
  "SQLTools: extension host code, commands, settings, auth/secrets, AI/agent, webview/UI, database, workspace files, terminal/commands",
];

const extensionRows = [
  ["Container Tools", "high access - ms-azuretools.vscode-containers - inactive"],
  ["Jupyter", "high access - ms-toolsai.jupyter - inactive"],
  ["GitLab", "high access - GitLab.gitlab-workflow - active"],
  ["Azure Resources", "high access - ms-azuretools.vscode-azureresourcegroups - inactive"],
  [".NET Install Tool", "high access - ms-dotnettools.vscode-dotnet-runtime - active"],
  ["SQLTools", "high access - mtxr.sqltools - active"],
  ["GitLens", "high access - eamodio.gitlens - active"],
  ["Code Runner", "high access - formulahendry.code-runner - active"],
];

const secretRows = [
  ["Database credential variable", "DATABASE_URL - .env:1"],
  ["Secret-like variable", "ADMIN_INTERNAL_BASIC_AUTH_PASSWORD - .env:6"],
  ["Secret-like variable", "APP_ENCRYPTION_KEY - .env:7"],
  ["Secret-like variable", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY - .env:12"],
  ["Secret-like variable", "CLERK_SECRET_KEY - .env:13"],
  ["Secret-like variable", "CLERK_WEBHOOK_SIGNING_SECRET - .env:14"],
  ["Secret-like variable", "KIMI_API_KEY - .env:23"],
  ["AWS credential variable", "AWS_ACCESS_KEY_ID - .env:31"],
  ["AWS credential variable", "AWS_SECRET_ACCESS_KEY - .env:32"],
  ["AWS credential variable", "AWS_S3_BUCKET - .env:33"],
  ["AWS credential variable", "AWS_S3_PREFIX - .env:34"],
];

const deployRows = [
  ["deploy/migration", "Deployment or migration surface - scripts/deploy/verify-deploy.sh"],
  ["IaC/cloud", "Infrastructure or deployment config - docker-compose.yml"],
  ["CI/CD", "CI/CD workflow - .gitlab-ci.yml"],
  ["package script", "aws:deploy-staging: deployment - package.json"],
  ["package script", "aws:provision-admin-internal: cloud or infrastructure command - package.json"],
  ["package script", "aws:refresh-nonprod-db: cloud or infrastructure command - package.json"],
  ["package script", "db:migrate: database migration - package.json"],
  ["package script", "secrets:pull: cloud or infrastructure command - package.json"],
];

function sectionTitle(label, y) {
  return text(label, REPORT_PAD, y, { size: 18, weight: 850, fill: "#f3f8f2" });
}

function reportContent() {
  const out = [];
  let y = 26;
  out.push(text("Safe Developer Rank: Scout - 41/100", REPORT_PAD, y, { size: 23, weight: 860, fill: "#f4f7f2" }));
  out.push(text("Agent blast radius: secrets plus deployment surface", REPORT_PAD, y + 28, { size: 14, weight: 700, fill: "#ffcf91" }));
  y += 76;

  out.push(text("DryLake Security Scan", REPORT_PAD, y, { size: 20, weight: 850, fill: "#f4f7f2" }));
  out.push(rect(REPORT_W - 248, y - 20, 92, 28, { fill: "#18271d", stroke: "#3b6045", sw: 1, rx: 5 }));
  out.push(text("Open Report", REPORT_W - 202, y - 2, { size: 10.5, weight: 800, fill: "#a8eeb9", anchor: "middle" }));
  out.push(rect(REPORT_W - 144, y - 20, 104, 28, { fill: "#18271d", stroke: "#3b6045", sw: 1, rx: 5 }));
  out.push(text("Copy Summary", REPORT_W - 92, y - 2, { size: 10.5, weight: 800, fill: "#a8eeb9", anchor: "middle" }));
  out.push(text("Scanned 6/12/2026, 10:19:32 AM. Extension access is inferred from manifests/configs; runtime behavior still requires review.", REPORT_PAD, y + 24, { size: 11, fill: "#9aa49d" }));
  y += 48;

  out.push(rect(REPORT_PAD, y, 124, 124, { fill: "#0b0f0d", stroke: "#744033", sw: 2, rx: 8 }));
  out.push(text("Score", REPORT_PAD + 22, y + 27, { size: 10, weight: 800, fill: "#aab4ad" }));
  out.push(text("41", REPORT_PAD + 29, y + 79, { size: 48, weight: 900, fill: "#f7f5ee", mono: true }));
  out.push(text("Scout", REPORT_PAD + 28, y + 106, { size: 14, weight: 850, fill: "#ff9b8a" }));

  const metrics = [
    ["Agent files", "21"], ["Extensions", "81"], ["Active extensions", "21"], ["MCP servers", "1"],
    ["High-impact paths", "38"], ["Risky files", "2"], ["Workspace surface", "21"], ["Findings", "110"],
  ];
  metrics.forEach(([label, value], index) => {
    out.push(metricCard(label, value, REPORT_PAD + 148 + (index % 4) * 122, y + Math.floor(index / 4) * 64));
  });
  out.push(text("Risk Scores", REPORT_PAD + 650, y + 16, { size: 13, weight: 850, fill: "#f1f5ef" }));
  [
    ["MCP Risk", "5/100", "bad"],
    ["Agent Reliability", "88/100", "good"],
    ["Secret Hygiene", "0/100", "bad"],
    ["IDE Bloat", "0/100", "bad"],
    ["Token Waste", "95/100", "good"],
    ["Blast Radius", "82/100", "good"],
  ].forEach(([label, value, tone], index) => out.push(categoryRow(label, value, REPORT_PAD + 650, y + 42 + index * 17, tone)));
  y += 164;

  out.push(sectionTitle("Top Findings", y));
  y += 18;
  topFindings.forEach((item) => {
    out.push(finding(item, REPORT_PAD, y, REPORT_W - REPORT_PAD * 2));
    y += 122;
  });

  out.push(sectionTitle("Agentic Connection Map", y + 12));
  y += 34;
  highImpactPaths.forEach((row) => {
    out.push(smallRow("High-impact path", row, REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 44, border: "#744033" }));
    y += 50;
  });
  [
    ["installed extension", "ide:vscode -> extension:ms-azuretools.vscode-containers"],
    ["installed extension", "ide:vscode -> extension:ms-toolsai.jupyter"],
    ["active extension", "ide:vscode -> extension:GitLab.gitlab-workflow"],
    ["active extension", "ide:vscode -> extension:mtxr.sqltools"],
    ["active extension", "ide:vscode -> extension:formulahendry.code-runner"],
  ].forEach(([label, detail]) => {
    out.push(smallRow(label, detail, REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 36, mono: true }));
    y += 42;
  });

  out.push(sectionTitle("Extension Access Review", y + 14));
  y += 36;
  extensionRows.forEach(([label, detail], index) => {
    const x = REPORT_PAD + (index % 2) * 500;
    const rowY = y + Math.floor(index / 2) * 46;
    out.push(smallRow(label, detail, x, rowY, 478, { h: 40, border: "#744033" }));
  });
  y += Math.ceil(extensionRows.length / 2) * 46 + 20;

  out.push(sectionTitle("MCP And Tool Access", y));
  y += 24;
  out.push(smallRow("drylake", "npx -y @xupracorp/drylake-mcp", REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 40, mono: true, border: "#744033" }));
  y += 46;
  out.push(smallRow("unknown tools", "Unpinned npx MCP server package.", REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 38, border: "#744033" }));
  y += 44;
  out.push(smallRow("MCP server receives secret-like environment variables", "Env names: DRYLAKE_AGENT_TOKEN, DRYLAKE_API_BASE_URL", REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 40, mono: true, border: "#744033" }));
  y += 62;

  out.push(sectionTitle("Secrets And Env References", y));
  y += 24;
  secretRows.forEach(([label, detail], index) => {
    const x = REPORT_PAD + (index % 2) * 500;
    const rowY = y + Math.floor(index / 2) * 42;
    out.push(smallRow(label, detail, x, rowY, 478, { h: 36, mono: true, border: "#744033" }));
  });
  y += Math.ceil(secretRows.length / 2) * 42 + 22;

  out.push(sectionTitle("Deploy / CI / Workspace Surface", y));
  y += 24;
  deployRows.forEach(([label, detail]) => {
    out.push(smallRow(label, detail, REPORT_PAD, y, REPORT_W - REPORT_PAD * 2, { h: 38, mono: true, border: "#744033" }));
    y += 44;
  });

  out.push(rect(REPORT_PAD, y + 16, REPORT_W - REPORT_PAD * 2, 86, { fill: "#15120d", stroke: "#765628", sw: 1, rx: 7 }));
  out.push(text("After reviewing the report", REPORT_PAD + 18, y + 45, { size: 16, weight: 850, fill: "#fff0cf" }));
  out.push(text("Open the report, copy a redacted summary, fix selected findings, or opt in to Active Guard baseline upload.", REPORT_PAD + 18, y + 68, { size: 12, fill: "#d6c2a5" }));
  out.push(rect(REPORT_W - 386, y + 35, 96, 28, { fill: "#18271d", stroke: "#3b6045", sw: 1, rx: 5 }));
  out.push(text("Open Report", REPORT_W - 338, y + 53, { size: 10, weight: 800, fill: "#a8eeb9", anchor: "middle" }));
  out.push(rect(REPORT_W - 278, y + 35, 104, 28, { fill: "#18271d", stroke: "#3b6045", sw: 1, rx: 5 }));
  out.push(text("Copy Summary", REPORT_W - 226, y + 53, { size: 10, weight: 800, fill: "#a8eeb9", anchor: "middle" }));
  out.push(rect(REPORT_W - 162, y + 35, 122, 28, { fill: "#f0a04b", rx: 5 }));
  out.push(text("Fix with AI", REPORT_W - 101, y + 53, { size: 10, weight: 850, fill: "#12100a", anchor: "middle" }));
  y += 126;

  return { svg: out.join(""), height: y };
}

const report = reportContent();
const maxScroll = Math.max(0, report.height - REPORT_H + 8);

function scrollYFor(t) {
  if (t < 2.4) return 0;
  if (t < 3.8) return 0;
  if (t < 15.2) return lerp(0, maxScroll, span(3.8, 15.2, t));
  return maxScroll;
}

function reportViewport(t) {
  const opacity = span(2.05, 2.55, t);
  if (opacity <= 0.01) return "";
  const scrollY = scrollYFor(t);
  const knobH = Math.max(34, REPORT_H * (REPORT_H / report.height));
  const knobY = REPORT_Y + (REPORT_H - knobH) * (scrollY / maxScroll || 0);
  return [
    `<clipPath id="reportClip"><rect x="${REPORT_X}" y="${REPORT_Y}" width="${REPORT_W}" height="${REPORT_H}" rx="8"/></clipPath>`,
    rect(REPORT_X, REPORT_Y, REPORT_W, REPORT_H, { fill: "#0e1311", stroke: "#314338", sw: 1, rx: 8, opacity }),
    `<g clip-path="url(#reportClip)" opacity="${opacity}">`,
    `<g transform="translate(${REPORT_X}, ${REPORT_Y - scrollY})">${report.svg}</g>`,
    `</g>`,
    rect(REPORT_X + REPORT_W - 9, REPORT_Y + 10, 4, REPORT_H - 20, { fill: "#17201b", rx: 2, opacity }),
    rect(REPORT_X + REPORT_W - 9, knobY + 10, 4, knobH, { fill: "#76d698", rx: 2, opacity }),
  ].join("");
}

function frameSvg(frame) {
  const t = frame / fps;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${chrome()}
    ${appHeader(t)}
    ${scanMoment(t)}
    ${reportViewport(t)}
    ${introOverlay(t)}
  </svg>`;
}

async function renderRgba(svg) {
  return sharp(Buffer.from(svg))
    .png()
    .resize(width, height, { fit: "fill" })
    .raw()
    .ensureAlpha()
    .toBuffer();
}

async function renderPng(svg, outputPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
}

async function main() {
  await mkdir(workDir, { recursive: true });
  await mkdir(mediaDir, { recursive: true });
  await mkdir(publicMediaDir, { recursive: true });

  const gif = GIFEncoder({ initialCapacity: 1024 * 1024 * 16 });
  const keyFrames = [
    [2.7, "top"],
    [5.1, "findings"],
    [8.4, "connections"],
    [11.2, "secrets"],
    [14.2, "deploy"],
    [16.2, "actions"],
  ];

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = frame / fps;
    const svg = frameSvg(frame);
    const rgba = await renderRgba(svg);
    const palette = quantize(rgba, 100, { format: "rgb565" });
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, width, height, { palette, delay: frameDelay, repeat: 0 });

    for (const [keyTime, label] of keyFrames) {
      if (Math.abs(keyTime - t) < 1 / fps / 2) {
        await renderPng(svg, path.resolve(workDir, `drylake-guard-report-${label}.png`));
      }
    }
  }

  gif.finish();
  const output = Buffer.from(gif.bytes());
  const gifPath = path.resolve(mediaDir, "drylake-guard-workflow.gif");
  const publicGifPath = path.resolve(publicMediaDir, "drylake-guard-workflow.gif");
  await writeFile(gifPath, output);
  await writeFile(publicGifPath, output);
  await renderPng(frameSvg(Math.round(16.2 * fps)), path.resolve(workDir, "drylake-guard-workflow-preview.png"));

  console.log(`Wrote ${gifPath}`);
  console.log(`Wrote ${publicGifPath}`);
  console.log(`Size: ${(output.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
