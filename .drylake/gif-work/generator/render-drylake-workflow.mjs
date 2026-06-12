import gifenc from "gifenc";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { applyPalette, GIFEncoder, quantize } = gifenc;
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const workDir = path.resolve(repoRoot, ".drylake", "gif-work");
const mediaDir = path.resolve(repoRoot, "extensions", "xupra-drylake-vscode", "media");
const publicMediaDir = path.resolve(repoRoot, "public", "marketplace", "extension", "media");

const width = 1120;
const height = 630;
const fps = 10;
const durationSeconds = 10.8;
const totalFrames = Math.round(durationSeconds * fps);
const frameDelay = Math.round(2000 / fps);

const CONTENT_X = 64;
const CONTENT_W = width - CONTENT_X - 24;
const CARD_W = 160;
const CARD_GAP = 12;
const CARD_X = CONTENT_X;
const CARD_Y = 392;
const ASSIGN_START = 2.55;
const ASSIGN_STEP = 0.42;
const RUN_START = 5.05;
const RUN_DURATION = 3.55;

const prompt =
  "Build MCP tools for workspace search, issue triage, and test verification. Use 6 planning stages.";

const phases = [
  {
    label: "PHASE 1",
    title: "Discovery",
    body: "Map repo and MCP boundaries.",
    agent: "Claude Code",
    skill: "Architecture",
    accent: "#79daa4",
    command: "claude --add-dir .",
    logs: ["reads handoff file", "maps repo modules", "writes discovery notes"],
  },
  {
    label: "PHASE 2",
    title: "MCP Contracts",
    body: "Define tools and schemas.",
    agent: "Hermes Agent",
    skill: "MCP Spec",
    accent: "#f0a04b",
    command: "hermes chat -q",
    logs: ["drafts tool contracts", "validates schemas", "exports handoff notes"],
  },
  {
    label: "PHASE 3",
    title: "Implementation",
    body: "Build TypeScript handlers.",
    agent: "OpenAI Codex",
    skill: "TypeScript",
    accent: "#8fb8ff",
    command: "codex --yolo",
    logs: ["edits src/mcp/tools.ts", "adds route tests", "runs npm test"],
  },
  {
    label: "PHASE 4",
    title: "Browser Test",
    body: "Verify UI and flows.",
    agent: "Cline CLI",
    skill: "QA Loop",
    accent: "#d2b2ff",
    command: "cline --cwd .",
    logs: ["opens browser tool", "captures failing state", "patches selector"],
  },
  {
    label: "PHASE 5",
    title: "Review",
    body: "Review diff and docs.",
    agent: "Continue CLI",
    skill: "Code Review",
    accent: "#ffe38b",
    command: "cn -p --allow Edit",
    logs: ["reviews git diff", "checks edge cases", "summarizes risk"],
  },
  {
    label: "PHASE 6",
    title: "Security Pass",
    body: "Run final hardening.",
    agent: "Kilo Code",
    skill: "Security",
    accent: "#ff8d8d",
    command: "kilo run --auto",
    logs: ["checks secrets", "validates permissions", "marks pipeline done"],
  },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ease(t) {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

function span(start, end, t) {
  return ease((t - start) / (end - start));
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
  const filter = opts.filter ? ` filter="${opts.filter}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke}${sw}${opacity}${filter}/>`;
}

function text(value, x, y, opts = {}) {
  const size = opts.size ?? 14;
  const weight = opts.weight ?? 400;
  const fill = opts.fill ?? "#d7ded8";
  const family = opts.mono
    ? "'Cascadia Mono','SFMono-Regular','Consolas',monospace"
    : "'Helvetica Neue','Helvetica','Segoe UI',sans-serif";
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const opacity = opts.opacity == null ? "" : ` opacity="${opts.opacity}"`;
  const spacing = opts.spacing == null ? "" : ` letter-spacing="${opts.spacing}"`;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}"${anchor}${opacity}${spacing}>${esc(value)}</text>`;
}

function wrapWords(value, maxChars) {
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
  if (current) {
    lines.push(current);
  }
  return lines;
}

function multiText(value, x, y, opts = {}) {
  const lines = wrapWords(value, opts.maxChars ?? 32).slice(0, opts.maxLines ?? 3);
  return lines
    .map((lineValue, index) =>
      text(lineValue, x, y + index * (opts.lineHeight ?? 16), {
        ...opts,
        opacity: opts.opacity,
      }),
    )
    .join("");
}

function checkIcon(cx, cy, opacity = 1) {
  return [
    `<circle cx="${cx}" cy="${cy}" r="7" fill="#79daa4" opacity="${opacity}"/>`,
    `<path d="M${cx - 3.5} ${cy} L${cx - 0.5} ${cy + 3.2} L${cx + 4.5} ${cy - 4.0}" fill="none" stroke="#06130c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`,
  ].join("");
}

function chevron(x, y, color = "#8b938d") {
  return `<path d="M${x} ${y} l4 4 l4 -4" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function topChrome() {
  return [
    rect(0, 0, width, height, { fill: "#080a09" }),
    rect(0, 0, width, 30, { fill: "#1b1d1e" }),
    text("File", 54, 20, { size: 11, fill: "#aeb5af" }),
    text("Edit", 88, 20, { size: 11, fill: "#aeb5af" }),
    text("Selection", 122, 20, { size: 11, fill: "#aeb5af" }),
    text("View", 184, 20, { size: 11, fill: "#aeb5af" }),
    text("Run", 222, 20, { size: 11, fill: "#aeb5af" }),
    text("Terminal", 257, 20, { size: 11, fill: "#aeb5af" }),
    rect(377, 6, 368, 18, { fill: "#111414", stroke: "#303535", sw: 1, rx: 4 }),
    text("drylake", 544, 20, { size: 11, fill: "#a8aea9" }),
    rect(14, 7, 17, 17, { fill: "#2497ff", rx: 4 }),
    text("D", 19, 20, { size: 11, weight: 700, fill: "#f9fbff" }),
    rect(0, 30, 42, height - 30, { fill: "#111313" }),
    ...[58, 98, 138, 178, 218, 258, 298, 338].map((y, index) =>
      rect(11, y, 20, 20, {
        fill: index === 4 ? "#202727" : "none",
        stroke: index === 4 ? "#64756b" : "#414644",
        sw: 1,
        rx: 4,
        opacity: index === 4 ? 1 : 0.75,
      }),
    ),
    rect(42, 30, width - 42, height - 30, { fill: "#070909" }),
    rect(CONTENT_X, 48, CONTENT_W, 118, { fill: "#0d1110", stroke: "#25302b", sw: 1, rx: 8 }),
    text("DryLake Control Plane", CONTENT_X + 20, 75, { size: 10, weight: 750, fill: "#79daa4", spacing: 0.6 }),
    text("Agent Control", CONTENT_X + 20, 106, { size: 26, weight: 760, fill: "#f3f8f2" }),
    text("Plan cards, assign agents and skills, then run focused handoffs.", CONTENT_X + 20, 130, { size: 13, fill: "#a9b4ad" }),
    rect(CONTENT_X + 565, 66, 214, 52, { fill: "#17211d", stroke: "#2e5842", sw: 1, rx: 6 }),
    text("Agent Control", CONTENT_X + 585, 91, { size: 14, weight: 800, fill: "#dff8e5" }),
    text("planning and handoffs", CONTENT_X + 585, 108, { size: 10, fill: "#94caa4" }),
    rect(CONTENT_X + 790, 66, 214, 52, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 6 }),
    text("Security", CONTENT_X + 810, 91, { size: 14, weight: 700, fill: "#cbd5ce" }),
    text("Guard scan and posture", CONTENT_X + 810, 108, { size: 10, fill: "#7f8983" }),
    rect(CONTENT_X, 176, CONTENT_W, 42, { fill: "#0d1110", stroke: "#25302b", sw: 1, rx: 7 }),
    rect(CONTENT_X + 14, 186, 92, 22, { fill: "#76d698", rx: 4 }),
    text("Pipeline", CONTENT_X + 60, 201, { size: 10, weight: 800, fill: "#07120b", anchor: "middle" }),
    rect(CONTENT_X + 116, 186, 82, 22, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 4 }),
    text("Kanban", CONTENT_X + 157, 201, { size: 10, weight: 700, fill: "#dce5dc", anchor: "middle" }),
    rect(CONTENT_X + 208, 186, 92, 22, { fill: "#101514", stroke: "#2a302d", sw: 1, rx: 4 }),
    text("Sessions", CONTENT_X + 254, 201, { size: 10, weight: 700, fill: "#dce5dc", anchor: "middle" }),
    rect(CONTENT_X + 310, 186, 92, 22, { fill: "#f0a04b", rx: 4 }),
    text("New Plan", CONTENT_X + 356, 201, { size: 10, weight: 800, fill: "#10100a", anchor: "middle" }),
    rect(CONTENT_X + 817, 184, 196, 25, { fill: "#111a14", stroke: "#304936", sw: 1, rx: 13 }),
    text("HappyDeveloper - Free", CONTENT_X + 915, 201, { size: 10, weight: 700, fill: "#a6e8b8", anchor: "middle" }),
  ].join("");
}

function planningPanel(t) {
  const generating = t > 0.82 && t < 1.18;
  const hasPlan = t >= 1.0;
  const bannerOpacity = span(0.55, 0.9, t) * (1 - span(1.12, 1.42, t));
  const stageMenuOpacity = span(0.55, 0.8, t) * (1 - span(1.15, 1.35, t));

  const promptLines = wrapWords(prompt, 72);
  const visiblePrompt =
    promptLines
      .map((lineValue, index) =>
        text(lineValue, 276, 82 + index * 16, {
          size: 12,
          fill: "#dce5dd",
        }),
      )
      .join("");

  return [
    rect(CONTENT_X, 228, CONTENT_W, 78, { fill: "#0d1110", stroke: "#25302b", sw: 1, rx: 7 }),
    text("New Plan Prompt", CONTENT_X + 14, 249, { size: 10, weight: 700, fill: "#7ed99e", spacing: 0.8 }),
    promptLines
      .map((lineValue, index) =>
        text(lineValue, CONTENT_X + 14, 272 + index * 16, {
          size: 12,
          fill: "#dce5dd",
        }),
      )
      .join(""),
    rect(CONTENT_X + CONTENT_W - 92, 258, 72, 30, { fill: "#78d99a", rx: 4 }),
    text(generating ? "Plan..." : "Generate", CONTENT_X + CONTENT_W - 56, 278, { size: 11, weight: 700, fill: "#07130b", anchor: "middle" }),
    rect(CONTENT_X, 314, 224, 31, { fill: "#101514", stroke: "#29332e", sw: 1, rx: 5 }),
    text("Model", CONTENT_X + 13, 334, { size: 10, fill: "#8c948e" }),
    text("Free - Claude Haiku", CONTENT_X + 64, 334, { size: 11, weight: 650, fill: "#f3f7f1" }),
    chevron(CONTENT_X + 204, 326),
    rect(CONTENT_X + 238, 314, 150, 31, { fill: "#101514", stroke: "#29332e", sw: 1, rx: 5 }),
    text("Planning Steps", CONTENT_X + 250, 334, { size: 9, fill: "#8c948e" }),
    text("6", CONTENT_X + 356, 334, { size: 12, weight: 700, fill: "#f4f8f2" }),
    chevron(CONTENT_X + 371, 326),
    rect(CONTENT_X + 402, 314, 174, 31, { fill: "#101514", stroke: "#29332e", sw: 1, rx: 5 }),
    text("Mode", CONTENT_X + 417, 334, { size: 10, fill: "#8c948e" }),
    text("Auto pipeline", CONTENT_X + 477, 334, { size: 11, weight: 650, fill: "#f4f8f2" }),
    rect(CONTENT_X + 590, 314, 242, 31, { fill: "#101514", stroke: "#29332e", sw: 1, rx: 5 }),
    text("Prompt size", CONTENT_X + 605, 334, { size: 10, fill: "#8c948e" }),
    text(hasPlan ? "~5.8k -> 6 handoffs" : "~5.8k tokens", CONTENT_X + 684, 334, {
      size: 11,
      weight: 650,
      fill: hasPlan ? "#7ed99e" : "#f4f8f2",
    }),
    rect(CONTENT_X, 354, CONTENT_W, 28, {
      fill: "#21150a",
      stroke: "#805728",
      sw: 1,
      rx: 5,
      opacity: bannerOpacity,
    }),
    text("Using Claude Haiku for free planning. Upgrade to Xupra AI Frontier Models any time.", CONTENT_X + 16, 373, {
      size: 11,
      weight: 650,
      fill: "#ffbc69",
      opacity: bannerOpacity,
    }),
    rect(CONTENT_X + 238, 348, 150, 150, {
      fill: "#101514",
      stroke: "#38423d",
      sw: 1,
      rx: 5,
      opacity: stageMenuOpacity,
      filter: "url(#softShadow)",
    }),
    [3, 4, 5, 6, 8, 12]
      .map((value, index) => {
        const y = 373 + index * 20;
        return [
          value === 6
            ? rect(CONTENT_X + 247, y - 14, 130, 18, { fill: "#294431", rx: 3, opacity: stageMenuOpacity })
            : "",
          text(`${value} planning steps`, CONTENT_X + 251, y, {
            size: 10,
            fill: value === 6 ? "#b6f0c8" : "#c4ccc6",
            opacity: stageMenuOpacity,
          }),
        ].join("");
      })
      .join(""),
  ].join("");
}

function slotX(slot) {
  return CARD_X + slot * (CARD_W + CARD_GAP);
}

function phaseSlot(index, t) {
  const reorder = span(1.32, 2.18, t);
  if (index === 1) {
    return lerp(2, 1, reorder);
  }
  if (index === 2) {
    return lerp(1, 2, reorder);
  }
  return index;
}

function assignedProgress(index, t) {
  return span(ASSIGN_START + index * ASSIGN_STEP, ASSIGN_START + index * ASSIGN_STEP + 0.22, t);
}

function pipelineProgress(t) {
  return clamp((t - RUN_START) / RUN_DURATION);
}

function reorderCursor(t) {
  const opacity = span(1.08, 1.22, t) * (1 - span(2.24, 2.45, t));
  if (opacity <= 0.01) {
    return "";
  }
  return [
    rect(slotX(1), CARD_Y - 30, CARD_W * 2 + CARD_GAP, 22, {
      fill: "#111913",
      stroke: "#34503b",
      sw: 1,
      rx: 4,
      opacity,
    }),
    text("Reorder phase cards before running", slotX(1) + 12, CARD_Y - 14, {
      size: 10,
      weight: 700,
      fill: "#9be8b2",
      opacity,
    }),
    `<path d="M${slotX(2) + 28} ${CARD_Y - 19} H${slotX(1) + CARD_W - 28}" stroke="#f0a04b" stroke-width="2" stroke-linecap="round" opacity="${opacity}"/>`,
    `<path d="M${slotX(1) + CARD_W - 36} ${CARD_Y - 24} l-8 5 l8 5" fill="none" stroke="#f0a04b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`,
  ].join("");
}

function card(phase, index, t, runProgress) {
  const x = slotX(phaseSlot(index, t));
  const yBase = CARD_Y;
  const appear = span(1.0 + index * 0.05, 1.45 + index * 0.05, t);
  const assigned = assignedProgress(index, t);
  const phaseRuntime = clamp(runProgress * phases.length - index, 0, 1);
  const done = phaseRuntime >= 0.96;
  const active = phaseRuntime > 0 && phaseRuntime < 0.96;
  const y = yBase + (1 - appear) * 20;
  const opacity = appear;
  const dragging = index === 1 && t > 1.15 && t < 2.23;
  const border = done ? "#5fa878" : active ? phase.accent : "#2a332f";
  const fill = active ? "#121b18" : done ? "#0f1914" : "#0e1211";
  const pulse = active ? 0.15 + Math.sin(t * 10) * 0.05 : 0;
  const status = done ? "complete" : active ? "running" : assigned > 0.8 ? "ready" : "pending";

  return [
    rect(x, y + (dragging ? -6 : 0), CARD_W, 212, {
      fill,
      stroke: border,
      sw: active || dragging ? 2 : 1,
      rx: 7,
      opacity,
      filter: active || dragging ? "url(#cardGlow)" : "",
    }),
    rect(x + 1, y + 1 + (dragging ? -6 : 0), CARD_W - 2, 3, { fill: phase.accent, rx: 3, opacity: opacity * (0.65 + pulse) }),
    text(phase.label, x + 12, y + 22 + (dragging ? -6 : 0), {
      size: 9,
      weight: 800,
      fill: phase.accent,
      opacity,
      spacing: 1,
    }),
    multiText(phase.title, x + 12, y + 43 + (dragging ? -6 : 0), {
      size: 13,
      weight: 750,
      fill: "#f1f5f0",
      maxChars: 18,
      maxLines: 2,
      lineHeight: 15,
      opacity,
    }),
    multiText(phase.body, x + 12, y + 72 + (dragging ? -6 : 0), {
      size: 10,
      fill: "#a8b2aa",
      maxChars: 23,
      maxLines: 2,
      lineHeight: 13,
      opacity,
    }),
    rect(x + 10, y + 96 + (dragging ? -6 : 0), CARD_W - 20, 18, { fill: "#070909", stroke: "#202823", sw: 1, rx: 3, opacity }),
    text(status, x + 18, y + 109 + (dragging ? -6 : 0), {
      size: 9,
      weight: 700,
      fill: done ? "#9be3b0" : active ? phase.accent : "#b4bbb5",
      opacity,
    }),
    rect(x + 10, y + 123 + (dragging ? -6 : 0), CARD_W - 20, 27, { fill: "#090c0b", stroke: "#27302b", sw: 1, rx: 3, opacity }),
    text("AGENT", x + 13, y + 136 + (dragging ? -6 : 0), { size: 8, weight: 700, fill: "#8c948e", opacity }),
    text(assigned > 0.35 ? phase.agent : "Select agent", x + 13, y + 147 + (dragging ? -6 : 0), {
      size: phase.agent.length > 13 ? 8.6 : 9,
      weight: 700,
      fill: assigned > 0.35 ? "#f0f5ef" : "#747d76",
      opacity,
    }),
    rect(x + 10, y + 157 + (dragging ? -6 : 0), CARD_W - 20, 27, { fill: "#090c0b", stroke: "#27302b", sw: 1, rx: 3, opacity }),
    text("SKILL", x + 13, y + 170 + (dragging ? -6 : 0), { size: 8, weight: 700, fill: "#8c948e", opacity }),
    text(assigned > 0.6 ? phase.skill : "No skill", x + 13, y + 181 + (dragging ? -6 : 0), {
      size: 9,
      weight: 700,
      fill: assigned > 0.6 ? "#f0f5ef" : "#747d76",
      opacity,
    }),
    rect(x + 10, y + 191 + (dragging ? -6 : 0), CARD_W - 20, 18, {
      fill: done ? "#172f1e" : active ? phase.accent : "#101411",
      stroke: done ? "#2f6b43" : active ? phase.accent : "#252d29",
      sw: 1,
      rx: 3,
      opacity,
    }),
    text(done ? "Done" : active ? "Running" : "Run Handoff", x + CARD_W / 2, y + 204 + (dragging ? -6 : 0), {
      size: 9,
      weight: 800,
      fill: active ? "#061009" : done ? "#a8efbc" : "#d5ddd6",
      anchor: "middle",
      opacity,
    }),
    done ? checkIcon(x + CARD_W - 18, y + 20 + (dragging ? -6 : 0), opacity) : "",
  ].join("");
}

function cards(t) {
  const runProgress = pipelineProgress(t);
  return [
    phases.map((phase, index) => card(phase, index, t, runProgress)).join(""),
    reorderCursor(t),
  ].join("");
}

function assignmentDropdown(t) {
  const activeIndex = Math.floor((t - ASSIGN_START) / ASSIGN_STEP);
  if (activeIndex < 0 || activeIndex >= phases.length) {
    return "";
  }

  const local = (t - (ASSIGN_START + activeIndex * ASSIGN_STEP)) / ASSIGN_STEP;
  const open = span(0, 0.18, local) * (1 - span(0.88, 1, local));
  const activePhase = phases[activeIndex];
  const x = Math.min(Math.max(slotX(phaseSlot(activeIndex, t)) - 2, CONTENT_X), width - 244);
  const y = 366;
  return [
    rect(x, y, 236, 112, {
      fill: "#0b0f0e",
      stroke: "#46524c",
      sw: 1,
      rx: 5,
      opacity: open,
      filter: "url(#softShadow)",
    }),
    text(`Card ${activeIndex + 1}: choose agent and skill`, x + 12, y + 21, { size: 10, weight: 700, fill: "#8e9992", opacity: open }),
    rect(x + 10, y + 34, 216, 30, { fill: "#111614", stroke: "#28332e", sw: 1, rx: 4, opacity: open }),
    text("Agent", x + 20, y + 48, { size: 8, weight: 800, fill: "#8e9992", opacity: open }),
    text(activePhase.agent, x + 20, y + 60, { size: 10, weight: 800, fill: "#dff8e5", opacity: open }),
    rect(x + 10, y + 72, 216, 30, { fill: "#111a14", stroke: "#304936", sw: 1, rx: 4, opacity: open }),
    text("Skill", x + 20, y + 86, { size: 8, weight: 800, fill: "#8e9992", opacity: open }),
    text(activePhase.skill, x + 20, y + 98, {
      size: 10,
      weight: 700,
      fill: "#9be8b2",
      opacity: open,
    }),
  ].join("");
}

function terminal(t) {
  const runProgress = pipelineProgress(t);
  if (runProgress <= 0 || runProgress >= 1) {
    return "";
  }
  const activeIndex = Math.min(phases.length - 1, Math.max(0, Math.floor(runProgress * phases.length)));
  const active = phases[activeIndex];
  const localProgress = clamp(runProgress * phases.length - activeIndex);
  const open = localProgress < 0.18
    ? span(0, 0.18, localProgress)
    : localProgress > 0.86
      ? 1 - span(0.86, 0.99, localProgress)
      : 1;
  if (open <= 0.01) {
    return "";
  }

  const y = lerp(height + 12, 500, open);
  const h = height - y - 13;
  const logCount = Math.min(active.logs.length, Math.floor(localProgress * (active.logs.length + 1)));
  const terminalLines = [
    `Creating Terminal ${activeIndex + 1}: ${active.agent}`,
    `PS C:\\Users\\HappyDeveloper\\repo> ${active.command}`,
    `DryLake handoff: .drylake/handoffs/${String(activeIndex + 1).padStart(2, "0")}-${active.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
    ...active.logs.slice(0, logCount).map((entry) => `[${active.agent}] ${entry}`),
    localProgress > 0.78 ? `[DryLake] phase ${activeIndex + 1} terminal finished; status ready for review` : "",
  ].filter(Boolean);

  return [
    rect(CONTENT_X, y, CONTENT_W, h, { fill: "#111413", stroke: "#2a302d", sw: 1, opacity: open }),
    rect(CONTENT_X, y, CONTENT_W, 27, { fill: "#181b1a", opacity: open }),
    text("TERMINAL", CONTENT_X + 74, y + 18, { size: 10, weight: 700, fill: "#e7eee8", opacity: open }),
    text("PROBLEMS", CONTENT_X + 13, y + 18, { size: 10, fill: "#777f79", opacity: open }),
    text("OUTPUT", CONTENT_X + 148, y + 18, { size: 10, fill: "#777f79", opacity: open }),
    text("DEBUG CONSOLE", CONTENT_X + 204, y + 18, { size: 10, fill: "#777f79", opacity: open }),
    phases
      .map((phase, index) => {
        const tabX = CONTENT_X + 382 + index * 78;
        const isActive = index === activeIndex;
        const created = runProgress * phases.length >= index;
        return [
          created ? rect(tabX - 8, y + 5, 65, 18, {
            fill: isActive ? "#243329" : "#121817",
            stroke: isActive ? phase.accent : "#26302b",
            sw: 1,
            rx: 3,
            opacity: open,
          }) : "",
          text(phase.agent.split(" ")[0], tabX, y + 18, {
            size: 9,
            weight: isActive ? 800 : 500,
            fill: isActive ? phase.accent : created ? "#8b968f" : "#4d5550",
            opacity: created ? open : open * 0.35,
          }),
        ].join("");
      })
      .join(""),
    terminalLines
      .map((lineValue, index) =>
        text(lineValue, CONTENT_X + 18, y + 50 + index * 17, {
          size: 11,
          fill: index === 0 ? active.accent : index === 1 ? "#d8e2da" : index === terminalLines.length - 1 ? "#80dda2" : "#aab4ad",
          mono: true,
          opacity: open,
        }),
      )
      .join(""),
  ].join("");
}

function progressHeader(t) {
  const visible = span(RUN_START - 0.25, RUN_START + 0.15, t) * (1 - span(8.75, 9.05, t));
  const p = pipelineProgress(t);
  return [
    rect(CONTENT_X, 354, CONTENT_W, 28, { fill: "#0f1713", stroke: "#27412f", sw: 1, rx: 5, opacity: visible }),
    rect(CONTENT_X + 13, 364, 690, 8, { fill: "#111f17", rx: 4, opacity: visible }),
    rect(CONTENT_X + 13, 364, Math.max(10, 690 * p), 8, { fill: "#7bdd9e", rx: 4, opacity: visible }),
    text("New terminal per phase", CONTENT_X + 724, 371, {
      size: 10,
      fill: "#bceecb",
      opacity: visible,
    }),
  ].join("");
}

function finalOverlay(t) {
  const opacity = span(8.65, 9.05, t);
  if (opacity <= 0.01) {
    return "";
  }

  return [
    rect(CONTENT_X, 228, CONTENT_W, 78, { fill: "#09100d", stroke: "#34553e", sw: 1, rx: 8, opacity }),
    text("Six phase handoffs ran through agent terminals.", CONTENT_X + 20, 261, {
      size: 18,
      weight: 760,
      fill: "#f3f8f2",
      opacity,
    }),
    text("Claude Code -> Hermes -> Codex -> Cline -> Continue -> Kilo", CONTENT_X + 20, 288, {
      size: 13,
      weight: 650,
      fill: "#98e4b0",
      opacity,
    }),
    rect(CONTENT_X + CONTENT_W - 374, 244, 154, 38, { fill: "#121a15", stroke: "#2d533b", sw: 1, rx: 5, opacity }),
    text("6/6 completed", CONTENT_X + CONTENT_W - 297, 268, { size: 13, weight: 800, fill: "#91e8ab", anchor: "middle", opacity }),
    rect(CONTENT_X + CONTENT_W - 204, 244, 174, 38, { fill: "#76d698", rx: 5, opacity }),
    text("Install DryLake", CONTENT_X + CONTENT_W - 117, 268, { size: 14, weight: 800, fill: "#06120a", anchor: "middle", opacity }),
    text("~18.4k tokens used | ~68% smaller handoffs", CONTENT_X + 20, 304, { size: 12, weight: 750, fill: "#ffbd73", opacity }),
  ].join("");
}

function introOverlay(t) {
  const opacity = 1 - span(0.28, 0.72, t);
  if (opacity <= 0.01) {
    return "";
  }
  return [
    rect(42, 30, width - 42, height - 30, { fill: "#070909", opacity }),
    rect(CONTENT_X + 228, 154, 542, 166, { fill: "#0d1410", stroke: "#2d4234", sw: 1, rx: 12, opacity }),
    text("DryLake", CONTENT_X + 262, 205, { size: 40, weight: 800, fill: "#f6faf4", opacity }),
    text("Agent control for coding agents and skills", CONTENT_X + 265, 239, {
      size: 18,
      weight: 520,
      fill: "#aadfba",
      opacity,
    }),
    text("Backed by 99VC and AWS Startups", CONTENT_X + 265, 271, { size: 13, fill: "#ffbf77", opacity }),
    rect(CONTENT_X + 265, 290, 146, 30, { fill: "#76d698", rx: 5, opacity }),
    text("Watch workflow", CONTENT_X + 338, 310, { size: 12, weight: 800, fill: "#07120b", anchor: "middle", opacity }),
  ].join("");
}

function svgFrame(t) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="softShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.42"/>
    </filter>
    <filter id="cardGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#76d698" flood-opacity="0.24"/>
    </filter>
  </defs>
  ${topChrome()}
  ${planningPanel(t)}
  ${cards(t)}
  ${assignmentDropdown(t)}
  ${progressHeader(t)}
  ${terminal(t)}
  ${finalOverlay(t)}
  ${introOverlay(t)}
</svg>`;
}

async function renderRgba(svg) {
  return sharp(Buffer.from(svg)).raw().ensureAlpha().toBuffer();
}

async function renderPng(svg, outputPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
}

async function main() {
  await mkdir(workDir, { recursive: true });
  await mkdir(mediaDir, { recursive: true });
  await mkdir(publicMediaDir, { recursive: true });

  const gif = GIFEncoder({ initialCapacity: 1024 * 1024 * 12 });
  const keyTimes = [1.9, 3.6, 5.6, 7.25, 9.0, 11.3];

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = frame / fps;
    const rgba = await renderRgba(svgFrame(t));
    const palette = quantize(rgba, 80, { format: "rgb565" });
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, width, height, {
      palette,
      delay: frameDelay,
      repeat: 0,
    });

    if (frame % fps === 0) {
      process.stdout.write(`rendered ${Math.round(t)}s/${durationSeconds}s\n`);
    }

    if (keyTimes.some((keyTime) => Math.abs(keyTime - t) < 1 / fps / 2)) {
      await renderPng(svgFrame(t), path.join(workDir, `drylake-workflow-hifi-${String(Math.round(t * 10)).padStart(3, "0")}.png`));
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  const workGif = path.join(workDir, "drylake-workflow-hifi.gif");
  const mediaGif = path.join(mediaDir, "drylake-workflow.gif");
  const mediaSixPhaseGif = path.join(mediaDir, "drylake-workflow-6phase-handoffs.gif");
  const publicGif = path.join(publicMediaDir, "drylake-workflow.gif");
  const publicSixPhaseGif = path.join(publicMediaDir, "drylake-workflow-6phase-handoffs.gif");
  await writeFile(workGif, bytes);
  await writeFile(mediaGif, bytes);
  await writeFile(mediaSixPhaseGif, bytes);
  await writeFile(publicGif, bytes);
  await writeFile(publicSixPhaseGif, bytes);
  await renderPng(svgFrame(11.35), path.join(workDir, "drylake-workflow-hifi-preview.png"));

  process.stdout.write(`wrote ${workGif} (${bytes.length} bytes)\n`);
  process.stdout.write(`updated ${mediaGif}\n`);
  process.stdout.write(`updated ${mediaSixPhaseGif}\n`);
  process.stdout.write(`updated ${publicGif}\n`);
  process.stdout.write(`updated ${publicSixPhaseGif}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
