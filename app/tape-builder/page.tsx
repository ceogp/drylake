import Link from "next/link";
import { ArrowTape, TapePanel, TapeWord } from "@/components/tape-brand";

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
