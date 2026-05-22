# Xupra DryLake Brand Guide

## Direction

The visual system is inspired by hand-cut construction wayfinding: high-contrast tape strips, hard-edged panels, visible routing, and lettering that feels fitted into a box. It should feel practical, urgent, and engineered rather than decorative.

## Color

- Ink: `#111111`
- Paper: `#f7f4ea`
- White: `#ffffff`
- Tape yellow: `#ffd60a`
- Route blue: `#005caf`
- Signal pink: `#e6007e`
- Go green: `#36b979`
- Warning red: `#e84a5f`
- Action orange: `#ff5a1f`

## Type

- Xupra Tape Display: custom SVG glyphs for short brand marks, route labels, phase labels, and hero display text.
- Space Grotesk: product headlines, navigation, UI labels, and readable body copy.
- IBM Plex Mono: code-adjacent labels, IDs, scripts, handoff action tags, and metadata.
- System sans fallback: backup for strict clients and extension surfaces where hosted fonts are unavailable.

## Current Tape Display Glyph List

- Uppercase: `ABCDEFGHIJKLMNOPQRSTUVWXYZ`
- Lowercase: `abcdefghijklmnopqrstuvwxyz`
- Numerals: `0123456789`
- Marks: `-./:+`

## Layout Rules

- Use rectangular panels with 5 px black borders and offset black shadows.
- Keep cards and controls at small radii, usually `4px` to `8px`.
- Use tape lettering only for short strings; set sentences in Space Grotesk.
- Keep the palette high contrast and multi-color. Avoid returning to soft orange gradients.
- Let phase maps, arrows, and handoff routes behave like signage instead of marketing decoration.

## Editor Usage

Yes, this can be used in VS Code extension surfaces. Webviews can render the full system with HTML, CSS, and SVG, so the DryLake control room, onboarding views, and extension walkthroughs can use the tape lettering and panels.

The limits are VS Code itself: an extension cannot restyle the main editor chrome, tabs, command center, or user editor font. A separate VS Code color theme can borrow the palette, and marketplace screenshots can use the full brand system.

Visual Studio proper would require a separate Visual Studio extension. This Next.js/VS Code webview system does not automatically port into the Visual Studio IDE.