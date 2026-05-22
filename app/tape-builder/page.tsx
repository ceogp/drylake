import Link from "next/link";
import type { CSSProperties } from "react";

type TapeGlyphVariant = {
  width: number;
  paths: string[];
};

const glyphs: Record<string, TapeGlyphVariant[]> = {
  A: [
    { width: 92, paths: ["M4 94 L34 10 H62 L90 94 H66 L60 76 H34 L28 94 Z M40 58 H54 L47 34 Z"] },
    { width: 92, paths: ["M2 94 L32 10 H58 L92 94 H68 L62 78 H32 L26 94 Z M39 58 H55 L48 32 Z"] },
  ],
  B: [
    { width: 92, paths: ["M8 10 H62 L82 30 L76 48 L88 66 L70 94 H8 Z M32 30 V44 H56 L62 38 L56 30 Z M32 62 V74 H58 L64 68 L58 62 Z"] },
    { width: 92, paths: ["M8 10 H60 L82 28 L74 48 L88 66 L68 94 H8 Z M32 30 V44 H54 L61 38 L54 30 Z M32 62 V74 H56 L64 68 L56 62 Z"] },
  ],
  D: [
    { width: 92, paths: ["M8 10 H58 L84 34 V70 L58 94 H8 Z M34 32 V72 H52 L62 62 V42 L52 32 Z"] },
    { width: 92, paths: ["M8 10 H60 L86 32 V68 L60 94 H8 Z M34 31 V73 H52 L64 61 V43 L52 31 Z"] },
    { width: 92, paths: ["M8 10 H62 L86 34 V66 L62 94 H8 Z M34 32 V72 H52 L64 60 V44 L52 32 Z"] },
  ],
  E: [
    { width: 82, paths: ["M8 10 H78 V30 H32 V42 H68 V62 H32 V74 H80 V94 H8 Z"] },
    { width: 82, paths: ["M8 10 H78 V30 H34 V43 H70 V62 H34 V75 H80 V94 H8 Z"] },
  ],
  I: [{ width: 54, paths: ["M6 10 H48 V28 H36 V76 H48 V94 H6 V76 H18 V28 H6 Z"] }],
  K: [
    { width: 90, paths: ["M8 10 H32 V42 L62 10 H88 L50 50 L90 94 H62 L32 60 V94 H8 Z"] },
    { width: 90, paths: ["M8 10 H32 V44 L66 10 H88 L52 48 L90 94 H62 L32 62 V94 H8 Z"] },
  ],
  L: [{ width: 76, paths: ["M8 10 H32 V74 H72 V94 H8 Z"] }],
  P: [
    { width: 86, paths: ["M8 10 H60 L82 32 V48 L60 70 H32 V94 H8 Z M32 31 V50 H52 L60 42 V38 L52 31 Z"] },
    { width: 86, paths: ["M8 10 H58 L80 30 V50 L58 70 H32 V94 H8 Z M32 31 V51 H50 L58 43 V39 L50 31 Z"] },
  ],
  R: [
    { width: 88, paths: ["M8 10 H60 L82 32 V48 L62 68 L86 94 H58 L38 70 H32 V94 H8 Z M32 31 V51 H52 L60 43 V39 L52 31 Z"] },
    { width: 88, paths: ["M8 10 H58 L80 30 V50 L60 66 L88 94 H58 L36 70 H32 V94 H8 Z M32 31 V51 H50 L58 43 V39 L50 31 Z"] },
  ],
  S: [
    { width: 84, paths: ["M76 10 V30 H30 V42 H62 L78 58 V78 L62 94 H8 V74 H56 V62 H24 L8 46 V26 L24 10 Z"] },
    { width: 84, paths: ["M78 10 V30 H32 V42 H62 L80 58 V76 L62 94 H8 V74 H54 V62 H24 L6 46 V28 L24 10 Z"] },
  ],
  U: [
    { width: 88, paths: ["M8 10 H32 V70 L42 80 H50 L60 70 V10 H84 V78 L68 94 H24 L8 78 Z"] },
    { width: 88, paths: ["M8 10 H32 V68 L44 80 H52 L60 72 V10 H84 V78 L66 94 H26 L8 76 Z"] },
  ],
  V: [
    { width: 88, paths: ["M4 10 H30 L44 68 L60 10 H86 L58 94 H30 Z"] },
    { width: 88, paths: ["M2 10 H28 L43 70 L62 10 H88 L58 94 H28 Z"] },
  ],
  X: [
    { width: 92, paths: ["M4 10 H34 L50 32 L70 10 H92 L62 50 L88 94 H58 L44 68 L24 94 H2 L34 48 Z"] },
    { width: 92, paths: ["M2 10 H30 L47 35 L66 10 H90 L60 48 L90 94 H60 L43 66 L22 94 H0 L32 50 Z"] },
    { width: 92, paths: ["M0 10 H28 L46 38 L70 10 H92 L58 52 L88 94 H58 L42 68 L20 94 H0 L32 50 Z"] },
  ],
  Y: [
    { width: 90, paths: ["M4 10 H32 L46 34 L62 10 H88 L58 56 V94 H34 V56 Z"] },
    { width: 90, paths: ["M2 10 H30 L44 35 L64 10 H90 L58 58 V94 H34 V58 Z"] },
  ],
  a: [{ width: 76, paths: ["M10 54 L28 38 H60 L74 52 V94 H54 V82 H28 L10 68 Z M34 54 V66 H54 V54 Z"] }],
  b: [
    { width: 76, paths: ["M8 14 H30 V42 H58 L72 56 V78 L56 94 H8 Z M30 58 V78 H48 L54 72 V62 L48 58 Z"] },
    { width: 76, paths: ["M8 14 H30 V40 H56 L72 54 V78 L56 94 H8 Z M30 58 V78 H48 L54 72 V62 L48 58 Z"] },
  ],
  d: [{ width: 78, paths: ["M66 14 V94 H20 L6 80 V56 L22 42 H46 V14 Z M28 58 L24 62 V72 L30 78 H46 V58 Z"] }],
  e: [{ width: 74, paths: ["M64 38 L72 50 V70 H30 V78 H68 V94 H22 L8 80 V52 L22 38 Z M30 52 V58 H52 V52 Z"] }],
  i: [{ width: 32, paths: ["M8 34 H28 V94 H8 Z"] }],
  l: [{ width: 36, paths: ["M8 14 H28 V94 H8 Z"] }],
  m: [{ width: 112, paths: ["M8 94 V38 H28 V48 L42 38 H58 L70 50 L84 38 H104 V94 H84 V60 L74 50 L62 60 V94 H42 V60 L28 50 V94 Z"] }],
  p: [{ width: 76, paths: ["M8 38 H58 L72 52 V74 L56 90 H30 V104 H8 Z M30 58 V74 H48 L54 68 V62 L48 58 Z"] }],
  r: [{ width: 68, paths: ["M8 38 H30 V50 L48 38 H64 V60 H44 L30 72 V94 H8 Z"] }],
  s: [{ width: 70, paths: ["M62 38 V54 H28 V60 H54 L66 72 V82 L54 94 H10 V78 H46 V72 H20 L8 60 V50 L20 38 Z"] }],
  u: [{ width: 76, paths: ["M8 38 H30 V72 L36 78 H48 V38 H70 V94 H8 Z"] }],
  v: [{ width: 74, paths: ["M4 38 H28 L38 72 L50 38 H72 L48 94 H28 Z"] }],
  x: [
    { width: 76, paths: ["M2 38 H26 L38 54 L52 38 H74 L50 66 L72 94 H48 L36 76 L22 94 H0 L26 64 Z"] },
    { width: 76, paths: ["M0 38 H24 L38 56 L54 38 H76 L50 64 L74 94 H50 L36 76 L20 94 H0 L26 64 Z"] },
  ],
  " ": [{ width: 34, paths: [] }],
};

type TapeWordProps = {
  text: string;
  color: string;
  cell?: number;
  gap?: number;
  label: string;
  variantSet?: number;
};

const phases = [
  { id: "01", title: "Prompt", body: "Paste a ticket, sketch, or repo goal.", bg: "#ffd60a", fg: "#151515" },
  { id: "02", title: "Plan", body: "DryLake splits the build into ordered phases.", bg: "#005caf", fg: "#ffffff" },
  { id: "03", title: "Assign", body: "Choose Codex, Copilot, Gemini, Cline, or Aider per phase.", bg: "#e6007e", fg: "#ffffff" },
  { id: "04", title: "Handoff", body: "Run direct, export scripts, copy, markdown, or VS Code.", bg: "#36b979", fg: "#07140d" },
];

const handoffActions = ["RUN", ".SH", ".BAT", "COPY", "MD", "VS CODE"];

const glyphStudies = [
  { label: "D cut 01", text: "D", variantSet: 0, color: "#005caf", background: "#ffffff" },
  { label: "D cut 02", text: "D", variantSet: 2, color: "#005caf", background: "#ffffff" },
  { label: "B cut 01", text: "B", variantSet: 0, color: "#111111", background: "#ffffff" },
  { label: "B cut 02", text: "B", variantSet: 1, color: "#111111", background: "#ffffff" },
  { label: "X center low", text: "X", variantSet: 0, color: "#e6007e", background: "#fff7ed" },
  { label: "X center high", text: "X", variantSet: 2, color: "#e6007e", background: "#fff7ed" },
  { label: "lowercase word", text: "xupra", variantSet: 1, color: "#36b979", background: "#101010" },
  { label: "lowercase route", text: "visual", variantSet: 1, color: "#111111", background: "#ffd60a" },
];

function TapeGlyph({ glyph, color, cell, gap }: { glyph: TapeGlyphVariant; color: string; cell: number; gap: number }) {
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
          fill={color}
          fillRule="evenodd"
        />
      ))}
    </svg>
  );
}

function pickGlyph(character: string, index: number, variantSet: number) {
  const variants = glyphs[character] ?? glyphs[character.toUpperCase()] ?? glyphs[" "];
  return variants[(index + variantSet) % variants.length];
}

function TapeWord({ text, color, cell = 9, gap = 3, label, variantSet = 0 }: TapeWordProps) {
  return (
    <span className="flex flex-wrap items-center gap-y-2" aria-label={label} style={{ columnGap: gap * 4 }}>
      {text.split("").map((letter, index) => (
        <TapeGlyph
          key={`${letter}-${index}`}
          color={color}
          cell={cell}
          gap={gap}
          glyph={pickGlyph(letter, index, variantSet)}
        />
      ))}
    </span>
  );
}

function ArrowTape({ color }: { color: string }) {
  return (
    <svg aria-hidden="true" className="h-10 w-24 shrink-0" viewBox="0 0 96 40">
      <path d="M4 13 H58 V4 L92 20 L58 36 V27 H4 Z" fill={color} />
    </svg>
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
                  <TapeWord text="XUPRA" color="#070707" cell={7} gap={2} label="Xupra" variantSet={1} />
                </div>
                <div className="bg-[#ff5a1f] px-4 py-2">
                  <TapeWord text="AI" color="#ffffff" cell={7} gap={2} label="AI" />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="bg-[#005caf] px-4 py-3">
                  <TapeWord text="DRYLAKE" color="#ffffff" cell={8} gap={2} label="DryLake" variantSet={1} />
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-[#f7f4ea] px-4 py-3">
                  <TapeWord text="visual" color="#36b979" cell={7} gap={2} label="Visual" variantSet={1} />
                  <ArrowTape color="#36b979" />
                </div>
                <div className="px-4 py-2">
                  <TapeWord text="builder" color="#111111" cell={7} gap={2} label="Builder" variantSet={1} />
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
                <TapeWord text="map" color="#ffffff" cell={8} gap={2} label="Map" />
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

        <TapePanel className="bg-[#ffd60a]">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-black/70">Font cut study</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-none">Tape should fill the box, not show the roll.</h2>
              </div>
              <ArrowTape color="#111111" />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {glyphStudies.map((study) => (
                <article key={study.label} className="rounded-[6px] border-[4px] border-black p-4" style={{ background: study.background }}>
                  <div className="flex min-h-28 items-center justify-center overflow-hidden">
                    <TapeWord text={study.text} color={study.color} cell={study.text.length === 1 ? 12 : 4.5} gap={1} label={study.text} variantSet={study.variantSet} />
                  </div>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-black/70">{study.label}</p>
                </article>
              ))}
            </div>
          </div>
        </TapePanel>
      </section>
    </main>
  );
}
