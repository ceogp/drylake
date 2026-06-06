# Xupra DryLake Brand Guide

Status: Draft for review, not final.

## Brand Architecture

- `Xupra` is the company brand.
- `DryLake` is the product brand.
- Use full text wordmarks for both names. Do not rely on the standalone X mark for primary brand presentation.

## Direction

The visual system is inspired by engineered wayfinding, semiconductor tooling, and terminal workflows: high-contrast panels, hard-edged rules, visible routing, and thin premium text. It should feel practical and serious rather than decorative.

## Logo Direction

### Xupra

Use a stylized full text `Xupra` wordmark. Keep it thin, premium, and technical.

Current draft assets:

- `public/brand/xupra-wordmark.svg`
- `public/brand/xupra-wordmark-reverse.svg`

Design notes:

- Do not reuse the cracked X inside the company wordmark.
- Do not draw custom letters by hand for this draft.
- Use `Helvetica Neue` or Helvetica as the SVG font stack. Do not use Arial.
- Pair the wordmark with a small orange baseline and green alignment rule for a technical identity system.
- Keep Xupra cleaner and more corporate than DryLake.

### DryLake

Use a stylized full text `drylake` wordmark. It should be more product-focused, terminal-native, and workflow-oriented than Xupra.

Current draft assets:

- `public/brand/drylake-wordmark.svg`
- `public/brand/drylake-wordmark-reverse.svg`
- `public/brand/drylake-logo-dark.png`
- `public/brand/drylake-logo-light.png`

Design notes:

- Use the lowercase `drylake` name in thick mono as the primary product logo.
- Use `Cascadia Mono` at weight `700` first, with `IBM Plex Mono` and `Consolas` as fallbacks.
- Pair the wordmark with a straight orange underline that is the same visual length as the word.
- The primary logo lockup is only the word and orange underline. Do not add the old X icon, green rule, or tagline to the normal logo.
- Use the PNG logo assets on the website when exact rendering matters. Page typography can still use Bricolage Grotesque and the normal sans stack.
- Do not reuse the cracked X inside the DryLake wordmark.
- DryLake should be paired with screenshots, pipeline cards, and agent handoff visuals. The wordmark should not carry the entire brand alone.

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

- Xupra wordmark: use stylized SVG text.
- DryLake wordmark: lowercase thick mono `drylake` with the orange underline.
- Bricolage Grotesque: product headlines, navigation, UI labels, and readable body copy.
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
- Use wordmarks only for brand names and hero/publisher identity.
- Set sentences in Bricolage Grotesque or the approved system sans stack.
- Keep the palette high contrast and multi-color. Avoid returning to soft orange gradients.
- Let phase maps, arrows, and handoff routes behave like signage instead of marketing decoration.

## Review Checklist

Before adopting a mark:

- It must read clearly at Marketplace thumbnail size.
- It must work on `#090a0a`, white, and transparent backgrounds.
- It must still be legible when rasterized to PNG.
- It must not look like a generic AI startup font.
- It must not be confused with only the existing X icon.
- It must support both `Xupra` company identity and `DryLake` product identity without making them look like unrelated brands.

## Editor Usage

Yes, this can be used in VS Code extension surfaces. Webviews can render the full system with HTML, CSS, and SVG, so the DryLake control room, onboarding views, and extension walkthroughs can use the tape lettering and panels.

The limits are VS Code itself: an extension cannot restyle the main editor chrome, tabs, command center, or user editor font. A separate VS Code color theme can borrow the palette, and marketplace screenshots can use the full brand system.

Visual Studio proper would require a separate Visual Studio extension. This Next.js/VS Code webview system does not automatically port into the Visual Studio IDE.
