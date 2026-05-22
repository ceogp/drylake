import Link from "next/link";
import type { CSSProperties } from "react";

const glyphs: Record<string, { width: number; paths: string[] }> = {
  A: { width: 92, paths: ["M14 90 V36 L46 14 L78 36 V90", "M24 58 H68"] },
  B: { width: 92, paths: ["M18 14 V90", "M18 14 H68 L82 28 V42 L68 54 H18", "M18 54 H70 L84 68 V78 L70 90 H18"] },
  D: { width: 92, paths: ["M18 14 V90", "M18 14 H66 L82 30 V74 L66 90 H18"] },
  E: { width: 86, paths: ["M78 14 H18 V90 H80", "M18 52 H68"] },
  I: { width: 62, paths: ["M10 14 H52", "M31 14 V90", "M10 90 H52"] },
  K: { width: 90, paths: ["M18 14 V90", "M78 14 L18 58", "M42 46 L80 90"] },
  L: { width: 78, paths: ["M18 14 V90 H70"] },
  M: { width: 106, paths: ["M16 90 V14 L53 54 L90 14 V90"] },
  P: { width: 88, paths: ["M18 90 V14 H66 L80 28 V46 L66 60 H18"] },
  R: { width: 90, paths: ["M18 90 V14 H66 L80 28 V44 L66 58 H18", "M46 58 L80 90"] },
  S: { width: 86, paths: ["M76 14 H24 L12 26 V42 L24 54 H62 L76 66 V78 L64 90 H12"] },
  T: { width: 86, paths: ["M10 14 H76", "M43 14 V90"] },
  U: { width: 92, paths: ["M16 14 V72 L32 90 H60 L76 72 V14"] },
  V: { width: 92, paths: ["M14 14 L46 90 L78 14"] },
  X: { width: 92, paths: ["M16 14 L76 90", "M76 14 L16 90"] },
  Y: { width: 92, paths: ["M14 14 L46 48 L78 14", "M46 48 V90"] },
  " ": { width: 38, paths: [] },
};

type TapeWordProps = {
  text: string;
  color: string;
  cell?: number;
  gap?: number;
  label: string;
};

const phases = [
  { id: "01", title: "Prompt", body: "Paste a ticket, sketch, or repo goal.", bg: "#ffd60a", fg: "#151515" },
  { id: "02", title: "Plan", body: "DryLake splits the build into ordered phases.", bg: "#005caf", fg: "#ffffff" },
  { id: "03", title: "Assign", body: "Choose Codex, Copilot, Gemini, Cline, or Aider per phase.", bg: "#e6007e", fg: "#ffffff" },
  { id: "04", title: "Handoff", body: "Run direct, export scripts, copy, markdown, or VS Code.", bg: "#36b979", fg: "#07140d" },
];

const handoffActions = ["RUN", ".SH", ".BAT", "COPY", "MD", "VS CODE"];

function TapeGlyph({ glyph, color, cell, gap }: { glyph: { width: number; paths: string[] }; color: string; cell: number; gap: number }) {
  void gap;
  const height = (104 * cell) / 10;
  const width = (glyph.width * cell) / 10;

  return (
    <svg
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      height={height}
      viewBox={`0 0 ${glyph.width} 104`}
      width={width}
    >
      {glyph.paths.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke={color}
          strokeLinecap="butt"
          strokeLinejoin="bevel"
          strokeWidth="18"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function TapeWord({ text, color, cell = 9, gap = 3, label }: TapeWordProps) {
  return (
    <span className="flex flex-wrap items-center gap-y-2" aria-label={label} style={{ columnGap: gap * 4 }}>
      {text.toUpperCase().split("").map((letter, index) => (
        <TapeGlyph
          key={`${letter}-${index}`}
          color={color}
          cell={cell}
          gap={gap}
          glyph={glyphs[letter] ?? glyphs[" "]}
        />
      ))}
    </span>
  );
}

function ArrowTape({ color }: { color: string }) {
  return (
    <span className="flex items-center" aria-hidden="true">
      <span className="h-4 w-12 rounded-sm" style={{ background: color }} />
      <span
        className="h-0 w-0 border-y-[18px] border-l-[28px] border-y-transparent"
        style={{ borderLeftColor: color }}
      />
    </span>
  );
}

function TapePanel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`rounded-[8px] border-[5px] border-black p-5 shadow-[10px_10px_0_#111] ${className}`} style={style}>
      {children}
    </section>
  );
}

export const metadata = {
  title: "Tape Builder Trial | Xupra DryLake",
  description: "Local visual design trial for a packing-tape inspired DryLake visual builder homepage.",
};

export default function TapeBuilderTrialPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ea] text-[#111111]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 lg:py-9">
        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <TapePanel className="bg-white">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="bg-[#e84a5f] px-4 py-2">
                  <TapeWord text="XUPRA" color="#070707" cell={7} gap={2} label="Xupra" />
                </div>
                <div className="bg-[#ff5a1f] px-4 py-2">
                  <TapeWord text="AI" color="#ffffff" cell={7} gap={2} label="AI" />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="bg-[#005caf] px-4 py-3">
                  <TapeWord text="DRYLAKE" color="#ffffff" cell={8} gap={2} label="DryLake" />
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-[#f7f4ea] px-4 py-3">
                  <TapeWord text="VISUAL" color="#36b979" cell={7} gap={2} label="Visual" />
                  <ArrowTape color="#36b979" />
                </div>
                <div className="px-4 py-2">
                  <TapeWord text="BUILDER" color="#111111" cell={7} gap={2} label="Builder" />
                </div>
              </div>

              <div className="max-w-2xl text-base font-medium leading-7 text-stone-800 md:text-lg">
                Plan the work as a build map, pick the agent for each phase, then hand off through the path that fits the tool.
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded-[4px] border-[4px] border-black bg-[#ffd60a] px-5 py-3 text-sm font-black uppercase text-black shadow-[5px_5px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111]"
                  href="/upload"
                >
                  Start build
                </Link>
                <Link
                  className="rounded-[4px] border-[4px] border-black bg-white px-5 py-3 text-sm font-black uppercase text-black shadow-[5px_5px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111]"
                  href="/install"
                >
                  Open installer
                </Link>
              </div>
            </div>
          </TapePanel>

          <TapePanel className="bg-[#111111] text-white">
            <div className="grid h-full gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ffd60a]">Visual builder board</p>
              <div className="grid grid-cols-2 gap-3">
                {phases.map((phase) => (
                  <article key={phase.id} className="min-h-34 rounded-[6px] border-[4px] border-white p-4" style={{ background: phase.bg, color: phase.fg }}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-3xl font-black">{phase.id}</span>
                      <ArrowTape color={phase.fg} />
                    </div>
                    <h2 className="mt-3 text-xl font-black uppercase leading-none">{phase.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-5 opacity-85">{phase.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </TapePanel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <TapePanel className="bg-[#005caf] text-white">
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-3xl font-black uppercase leading-none">Agent Handoff</h2>
                <ArrowTape color="#ffd60a" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {handoffActions.map((action) => (
                  <div key={action} className="rounded-[4px] border-[3px] border-white bg-[#ffd60a] px-3 py-3 text-center font-mono text-sm font-black text-black">
                    {action}
                  </div>
                ))}
              </div>
            </div>
          </TapePanel>

          <TapePanel className="bg-white">
            <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[6px] bg-[#e6007e] p-5 text-white">
                <TapeWord text="MAP" color="#ffffff" cell={9} gap={3} label="Map" />
                <p className="mt-5 text-sm font-semibold leading-6">A denser, transit-sign homepage rhythm: fewer soft cards, more decisive zones.</p>
              </div>
              <div className="grid gap-3">
                {[
                  ["01", "Ticket becomes phases"],
                  ["02", "Phases become agent jobs"],
                  ["03", "Jobs become handoffs"],
                ].map(([number, text]) => (
                  <div key={number} className="flex items-center gap-4 rounded-[6px] border-[4px] border-black bg-[#f7f4ea] p-3">
                    <span className="grid h-14 w-14 place-items-center bg-black font-mono text-xl font-black text-white">{number}</span>
                    <span className="text-lg font-black uppercase leading-tight">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </TapePanel>
        </div>
      </section>
    </main>
  );
}
