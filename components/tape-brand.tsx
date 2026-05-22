import type { CSSProperties, ReactNode } from "react";

export type TapeGlyphVariant = {
  width: number;
  paths: string[];
};

export const tapeColors = {
  paper: "#f7f4ea",
  ink: "#111111",
  white: "#ffffff",
  yellow: "#ffd60a",
  blue: "#005caf",
  pink: "#e6007e",
  green: "#36b979",
  red: "#e84a5f",
  orange: "#ff5a1f",
} as const;

export const tapeFontRoles = [
  {
    name: "Xupra Tape Display",
    use: "Brand marks, short campaign headers, phase labels, and visual-builder wayfinding.",
    source: "Custom SVG glyphs in the app, built from cut-tape silhouettes.",
  },
  {
    name: "Space Grotesk",
    use: "Product headlines, navigation, UI labels, and body text where a calm software voice is needed.",
    source: "Next/font Google import in the root layout.",
  },
  {
    name: "IBM Plex Mono",
    use: "IDs, code-adjacent labels, CLI/script affordances, action tags, and metadata.",
    source: "Next/font Google import in the root layout.",
  },
  {
    name: "System Sans Fallback",
    use: "Fallback when hosted fonts are unavailable in strict clients or extension views.",
    source: "CSS fallback stack.",
  },
];

export const tapeGlyphRows = [
  { label: "Uppercase", text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { label: "Lowercase", text: "abcdefghijklmnopqrstuvwxyz" },
  { label: "Numerals", text: "0123456789" },
  { label: "Marks", text: "-./:+" },
];

export const glyphs: Record<string, TapeGlyphVariant[]> = {
  A: [
    { width: 92, paths: ["M4 94 L34 10 H62 L90 94 H66 L60 76 H34 L28 94 Z M40 58 H54 L47 34 Z"] },
    { width: 92, paths: ["M2 94 L32 10 H58 L92 94 H68 L62 78 H32 L26 94 Z M39 58 H55 L48 32 Z"] },
  ],
  B: [
    { width: 92, paths: ["M8 10 H62 L82 30 L76 48 L88 66 L70 94 H8 Z M32 30 V44 H56 L62 38 L56 30 Z M32 62 V74 H58 L64 68 L58 62 Z"] },
    { width: 92, paths: ["M8 10 H60 L82 28 L74 48 L88 66 L68 94 H8 Z M32 30 V44 H54 L61 38 L54 30 Z M32 62 V74 H56 L64 68 L56 62 Z"] },
  ],
  C: [
    { width: 86, paths: ["M78 10 V32 H32 L24 40 V64 L34 74 H78 V94 H24 L4 74 V30 L24 10 Z"] },
    { width: 86, paths: ["M80 10 V31 H34 L24 41 V63 L36 74 H78 V94 H24 L4 74 V32 L26 10 Z"] },
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
  F: [
    { width: 78, paths: ["M8 10 H76 V30 H32 V46 H68 V66 H32 V94 H8 Z"] },
    { width: 78, paths: ["M8 10 H76 V30 H34 V45 H68 V65 H34 V94 H8 Z"] },
  ],
  G: [
    { width: 92, paths: ["M82 10 V31 H34 L24 41 V65 L34 75 H58 V62 H46 V44 H84 V78 L68 94 H24 L4 74 V32 L26 10 Z"] },
    { width: 92, paths: ["M84 10 V31 H36 L25 42 V64 L36 74 H58 V63 H46 V45 H86 V78 L68 94 H24 L4 74 V32 L26 10 Z"] },
  ],
  H: [
    { width: 90, paths: ["M8 10 H32 V42 H58 V10 H82 V94 H58 V64 H32 V94 H8 Z"] },
    { width: 90, paths: ["M8 10 H32 V43 H58 V10 H82 V94 H58 V65 H32 V94 H8 Z"] },
  ],
  I: [{ width: 54, paths: ["M6 10 H48 V28 H36 V76 H48 V94 H6 V76 H18 V28 H6 Z"] }],
  J: [
    { width: 78, paths: ["M28 10 H72 V30 H58 V76 L40 94 H12 L4 76 V58 H28 V70 L34 76 L42 68 V30 H28 Z"] },
    { width: 78, paths: ["M28 10 H72 V30 H58 V76 L40 94 H12 L4 74 V58 H28 V69 L34 76 L42 68 V30 H28 Z"] },
  ],
  K: [
    { width: 90, paths: ["M8 10 H32 V42 L62 10 H88 L50 50 L90 94 H62 L32 60 V94 H8 Z"] },
    { width: 90, paths: ["M8 10 H32 V44 L66 10 H88 L52 48 L90 94 H62 L32 62 V94 H8 Z"] },
  ],
  L: [{ width: 76, paths: ["M8 10 H32 V74 H72 V94 H8 Z"] }],
  M: [
    { width: 116, paths: ["M8 94 V10 H34 L58 48 L82 10 H108 V94 H84 V48 L66 78 H50 L32 48 V94 Z"] },
    { width: 116, paths: ["M8 94 V10 H34 L57 50 L84 10 H108 V94 H84 V50 L66 78 H50 L32 50 V94 Z"] },
  ],
  N: [
    { width: 96, paths: ["M8 94 V10 H32 L64 54 V10 H88 V94 H64 L32 50 V94 Z"] },
    { width: 96, paths: ["M8 94 V10 H32 L64 56 V10 H88 V94 H64 L32 48 V94 Z"] },
  ],
  O: [
    { width: 94, paths: ["M24 10 H66 L88 32 V72 L66 94 H24 L4 74 V30 Z M34 32 L28 38 V64 L36 72 H54 L64 62 V40 L56 32 Z"] },
    { width: 94, paths: ["M24 10 H66 L88 34 V70 L66 94 H24 L4 72 V32 Z M34 32 L28 38 V64 L36 72 H54 L64 62 V42 L54 32 Z"] },
  ],
  P: [
    { width: 86, paths: ["M8 10 H60 L82 32 V48 L60 70 H32 V94 H8 Z M32 31 V50 H52 L60 42 V38 L52 31 Z"] },
    { width: 86, paths: ["M8 10 H58 L80 30 V50 L58 70 H32 V94 H8 Z M32 31 V51 H50 L58 43 V39 L50 31 Z"] },
  ],
  Q: [
    { width: 98, paths: ["M24 10 H66 L88 32 V68 L76 82 L94 94 H64 L56 88 L24 94 L4 74 V30 Z M34 32 L28 38 V64 L36 72 H54 L64 62 V40 L56 32 Z"] },
    { width: 98, paths: ["M24 10 H66 L88 34 V68 L76 82 L94 94 H64 L55 88 L24 94 L4 72 V32 Z M34 32 L28 38 V64 L36 72 H54 L64 62 V42 L54 32 Z"] },
  ],
  R: [
    { width: 88, paths: ["M8 10 H60 L82 32 V48 L62 68 L86 94 H58 L38 70 H32 V94 H8 Z M32 31 V51 H52 L60 43 V39 L52 31 Z"] },
    { width: 88, paths: ["M8 10 H58 L80 30 V50 L60 66 L88 94 H58 L36 70 H32 V94 H8 Z M32 31 V51 H50 L58 43 V39 L50 31 Z"] },
  ],
  S: [
    { width: 84, paths: ["M76 10 V30 H30 V42 H62 L78 58 V78 L62 94 H8 V74 H56 V62 H24 L8 46 V26 L24 10 Z"] },
    { width: 84, paths: ["M78 10 V30 H32 V42 H62 L80 58 V76 L62 94 H8 V74 H54 V62 H24 L6 46 V28 L24 10 Z"] },
  ],
  T: [
    { width: 86, paths: ["M4 10 H82 V32 H52 V94 H28 V32 H4 Z"] },
    { width: 86, paths: ["M4 10 H82 V31 H52 V94 H28 V31 H4 Z"] },
  ],
  U: [
    { width: 88, paths: ["M8 10 H32 V70 L42 80 H50 L60 70 V10 H84 V78 L68 94 H24 L8 78 Z"] },
    { width: 88, paths: ["M8 10 H32 V68 L44 80 H52 L60 72 V10 H84 V78 L66 94 H26 L8 76 Z"] },
  ],
  V: [
    { width: 88, paths: ["M4 10 H30 L44 68 L60 10 H86 L58 94 H30 Z"] },
    { width: 88, paths: ["M2 10 H28 L43 70 L62 10 H88 L58 94 H28 Z"] },
  ],
  W: [
    { width: 126, paths: ["M4 10 H28 L40 62 L54 26 H72 L86 62 L98 10 H122 L98 94 H76 L62 58 L48 94 H26 Z"] },
    { width: 126, paths: ["M2 10 H28 L40 64 L54 28 H72 L86 64 L100 10 H124 L98 94 H76 L62 56 L48 94 H26 Z"] },
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
  Z: [
    { width: 86, paths: ["M6 10 H82 V28 L36 74 H82 V94 H4 V76 L50 30 H6 Z"] },
    { width: 86, paths: ["M6 10 H82 V29 L38 74 H82 V94 H4 V76 L48 30 H6 Z"] },
  ],
  a: [{ width: 76, paths: ["M10 54 L28 38 H60 L74 52 V94 H54 V82 H28 L10 68 Z M34 54 V66 H54 V54 Z"] }],
  b: [
    { width: 76, paths: ["M8 14 H30 V42 H58 L72 56 V78 L56 94 H8 Z M30 58 V78 H48 L54 72 V62 L48 58 Z"] },
    { width: 76, paths: ["M8 14 H30 V40 H56 L72 54 V78 L56 94 H8 Z M30 58 V78 H48 L54 72 V62 L48 58 Z"] },
  ],
  c: [{ width: 70, paths: ["M62 38 V56 H30 L24 62 V72 L32 78 H64 V94 H22 L8 80 V52 L22 38 Z"] }],
  d: [{ width: 78, paths: ["M66 14 V94 H20 L6 80 V56 L22 42 H46 V14 Z M28 58 L24 62 V72 L30 78 H46 V58 Z"] }],
  e: [{ width: 74, paths: ["M64 38 L72 50 V70 H30 V78 H68 V94 H22 L8 80 V52 L22 38 Z M30 52 V58 H52 V52 Z"] }],
  f: [{ width: 58, paths: ["M18 94 V58 H6 V40 H18 V30 L34 14 H56 V32 H42 L38 36 V40 H56 V58 H40 V94 Z"] }],
  g: [{ width: 76, paths: ["M10 52 L24 38 H70 V96 L54 112 H14 V94 H48 L52 90 V82 H24 L10 68 Z M32 54 L28 58 V66 L34 72 H52 V54 Z"] }],
  h: [{ width: 76, paths: ["M8 14 H30 V44 L42 38 H58 L72 52 V94 H50 V60 L44 54 L30 62 V94 H8 Z"] }],
  i: [{ width: 32, paths: ["M8 34 H28 V94 H8 Z"] }],
  j: [{ width: 42, paths: ["M16 34 H36 V94 L20 110 H2 V92 H12 L16 88 Z"] }],
  k: [{ width: 74, paths: ["M8 14 H30 V56 L50 38 H74 L48 62 L76 94 H50 L30 70 V94 H8 Z"] }],
  l: [{ width: 36, paths: ["M8 14 H28 V94 H8 Z"] }],
  m: [{ width: 112, paths: ["M8 94 V38 H28 V48 L42 38 H58 L70 50 L84 38 H104 V94 H84 V60 L74 50 L62 60 V94 H42 V60 L28 50 V94 Z"] }],
  n: [{ width: 76, paths: ["M8 94 V38 H28 V48 L42 38 H58 L72 52 V94 H50 V60 L44 54 L30 62 V94 Z"] }],
  o: [{ width: 76, paths: ["M22 38 H58 L72 52 V80 L58 94 H22 L8 80 V52 Z M32 56 L28 60 V72 L34 78 H48 L52 74 V60 L48 56 Z"] }],
  p: [{ width: 76, paths: ["M8 38 H58 L72 52 V74 L56 90 H30 V104 H8 Z M30 58 V74 H48 L54 68 V62 L48 58 Z"] }],
  q: [{ width: 78, paths: ["M20 38 H70 V104 H48 V90 H22 L8 76 V52 Z M30 56 L26 60 V70 L34 78 H48 V56 Z"] }],
  r: [{ width: 68, paths: ["M8 38 H30 V50 L48 38 H64 V60 H44 L30 72 V94 H8 Z"] }],
  s: [{ width: 70, paths: ["M62 38 V54 H28 V60 H54 L66 72 V82 L54 94 H10 V78 H46 V72 H20 L8 60 V50 L20 38 Z"] }],
  t: [{ width: 58, paths: ["M18 22 H40 V40 H56 V58 H40 V74 L46 80 H58 V94 H34 L18 78 V58 H6 V40 H18 Z"] }],
  u: [{ width: 76, paths: ["M8 38 H30 V72 L36 78 H48 V38 H70 V94 H8 Z"] }],
  v: [{ width: 74, paths: ["M4 38 H28 L38 72 L50 38 H72 L48 94 H28 Z"] }],
  w: [{ width: 104, paths: ["M4 38 H26 L34 68 L46 44 H62 L74 68 L82 38 H102 L86 94 H66 L54 68 L42 94 H22 Z"] }],
  x: [
    { width: 76, paths: ["M2 38 H26 L38 54 L52 38 H74 L50 66 L72 94 H48 L36 76 L22 94 H0 L26 64 Z"] },
    { width: 76, paths: ["M0 38 H24 L38 56 L54 38 H76 L50 64 L74 94 H50 L36 76 L20 94 H0 L26 64 Z"] },
  ],
  y: [{ width: 76, paths: ["M4 38 H28 L40 70 L52 38 H74 L48 96 L32 112 H10 V94 H24 L30 88 Z"] }],
  z: [{ width: 70, paths: ["M6 38 H66 V54 L34 78 H66 V94 H4 V78 L36 54 H6 Z"] }],
  "0": [{ width: 84, paths: ["M22 10 H62 L80 28 V76 L62 94 H22 L4 76 V28 Z M30 30 L26 34 V68 L32 74 H52 L58 68 V34 L52 30 Z"] }],
  "1": [{ width: 58, paths: ["M22 10 H42 V74 H54 V94 H8 V74 H20 V36 L8 42 V22 Z"] }],
  "2": [{ width: 78, paths: ["M8 10 H58 L74 26 V46 L34 74 H74 V94 H6 V72 L50 42 V32 L44 30 H8 Z"] }],
  "3": [{ width: 78, paths: ["M8 10 H58 L74 26 V42 L62 52 L76 66 V80 L60 94 H8 V74 H52 L56 70 L52 64 H28 V44 H50 L54 40 V34 L48 30 H8 Z"] }],
  "4": [{ width: 84, paths: ["M50 10 H76 V94 H52 V76 H4 V58 L36 10 H62 L34 56 H52 Z"] }],
  "5": [{ width: 78, paths: ["M10 10 H72 V30 H32 V42 H58 L74 58 V78 L58 94 H8 V74 H50 L54 70 V64 L48 62 H10 Z"] }],
  "6": [{ width: 82, paths: ["M72 10 V30 H34 L26 38 V48 H58 L76 66 V78 L60 94 H24 L6 76 V30 L26 10 Z M30 64 V72 L36 78 H50 L56 72 V68 L50 64 Z"] }],
  "7": [{ width: 76, paths: ["M4 10 H74 V30 L36 94 H10 L50 32 H4 Z"] }],
  "8": [{ width: 82, paths: ["M22 10 H60 L76 26 V42 L66 52 L78 64 V78 L62 94 H20 L4 78 V64 L16 52 L6 42 V26 Z M30 30 V42 H52 V30 Z M28 64 V74 H54 V64 Z"] }],
  "9": [{ width: 82, paths: ["M22 10 H58 L76 28 V74 L56 94 H10 V74 H48 L56 66 V56 H24 L6 38 V26 Z M32 28 L26 34 V38 L32 44 H54 V36 L46 28 Z"] }],
  "-": [{ width: 54, paths: ["M6 44 H48 V64 H6 Z"] }],
  ".": [{ width: 34, paths: ["M8 70 H28 V94 H8 Z"] }],
  ":": [{ width: 34, paths: ["M8 34 H28 V56 H8 Z M8 72 H28 V94 H8 Z"] }],
  "/": [{ width: 62, paths: ["M38 8 H60 L24 96 H2 Z"] }],
  "+": [{ width: 66, paths: ["M22 22 H44 V44 H62 V64 H44 V88 H22 V64 H4 V44 H22 Z"] }],
  " ": [{ width: 34, paths: [] }],
};

export type TapeWordProps = {
  text: string;
  color: string;
  cell?: number;
  gap?: number;
  label: string;
  variantSet?: number;
  className?: string;
};

export function pickGlyph(character: string, index: number, variantSet: number) {
  const variants = glyphs[character] ?? glyphs[character.toUpperCase()] ?? glyphs[" "];
  return variants[(index + variantSet) % variants.length];
}

export function TapeGlyph({ glyph, color, cell }: { glyph: TapeGlyphVariant; color: string; cell: number }) {
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
        <path key={path} d={path} fill={color} fillRule="evenodd" />
      ))}
    </svg>
  );
}

export function TapeWord({ text, color, cell = 9, gap = 3, label, variantSet = 0, className = "" }: TapeWordProps) {
  return (
    <span className={`flex flex-wrap items-center gap-y-2 ${className}`} aria-label={label} style={{ columnGap: gap * 4 }}>
      {text.split("").map((letter, index) => (
        <TapeGlyph key={`${letter}-${index}`} color={color} cell={cell} glyph={pickGlyph(letter, index, variantSet)} />
      ))}
    </span>
  );
}

export function ArrowTape({ color, className = "h-10 w-24" }: { color: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={`${className} shrink-0`} viewBox="0 0 96 40">
      <path d="M4 13 H58 V4 L92 20 L58 36 V27 H4 Z" fill={color} />
    </svg>
  );
}

export function TapePanel({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`rounded-[8px] border-[5px] border-black p-5 shadow-[10px_10px_0_#111] ${className}`} style={style}>
      {children}
    </section>
  );
}