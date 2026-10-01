# FieldRadar redesign v2 — direction and verification

Powered by JTF Software Solutions

**Why v2.** The first pass (`before/` → `after/`) recolored the same "terminal":
a faux-terminal subtitle, all-caps monospace on every control, twelve outlined
chips, a neon score rail and a different color on every KPI. v2 replaces the
aesthetic, not just the palette. `after-v2/` holds the result.

## Premise
A field opportunity desk: a calm, warm-neutral working surface with near-black
ink, where the list of events is the product and everything else supports a
decision (work this event / don't).

## System
| Role | Choice |
|---|---|
| Surface | Light. Warm paper `#F3F2EE` page, white panels, 1px warm-grey rules. No glass, glow, gradient or blur. |
| Type | IBM Plex Sans for all UI, sentence case. Tabular figures on every number. Mono is kept only for text the user types or reads literally (API keys, model slugs). |
| Action accent | One: blue `#1D4FD7` (primary buttons, links, focus ring). |
| Score | Number + tier word + one dot. Single scale: green intensity (pass → watchlist → prime). No continuous neon ramp. |
| Other color | Amber = caution (sample data, template, waitlist, not connected). Red = error only. Green check = "meets target", always paired with a visible mark and screen-reader text. |
| Layout | Desktop: 320px "Find events" panel beside the queue. Tablet/phone: stacked. 1180px max width. |

## What changed in the product surface
- **Event types** are a collapsed multi-select with a count ("All 12", "7 of 12"), real checkboxes, Select all / Clear. "None" still searches all types, as before.
- **KPI strip** is one bordered strip: facts (Signals, Prime) and a labeled **Model projection** group (Proj. leads, Est. spend, Proj. revenue). The truthfulness note sits directly under it, with its original wording. Large revenue now reads `$30.7M`, not `$30,708.9K`.
- **Opportunity card**: strong title, one meta row (dates · type · distance), venue line, one status line, a five-figure stats row, then grouped actions: primary Game plan, a Target/Booked/Skip segmented group, and Adjust. Eight badge types collapsed to: tier (in the score block), vendor status text, deadline text, and a Sample-data tag.
- **Adjust panel**: vendor intel, assumptions (bordered adornment fields), score components, game plan.
- **Header**: wordmark, the exact credit **Powered by JTF Software Solutions** (all widths), model status with a dot, Coverage, Scoring.
- Drawers restyled to the same system; copy unchanged except case and the label renames below.

## Preserved (checked, see below)
Adjust + calendar flows, mobile touch targets (44px) and 16px inputs, keyboard
access, dialog focus trap/restore, `ROOFING_VERTICAL_CONFIG`, favicon, attribution
in header, footer, CSV footer row and print, truthful catalog/model copy, and the
hosted-AI 503 boundary (`api/ai.js` untouched).

## Test changes (stated explicitly)
- `verify_ui_readiness.cjs`: the three contrast checks previously computed ratios
  from hex literals typed into the test, so they could never fail when the
  stylesheet changed. They now read the live CSS custom properties from the
  rendered page and check text pairs (>= 4.5:1) and score-tier markers (>= 3:1).
- The provider button's accessible name is now `OpenRouter` (was `OPENROUTER`;
  sentence-case copy, not behavior).
- Added: no horizontal overflow at 320/375/390/414/768/1024/1440 (closed and
  expanded), keyboard open/close of card details, event-type multi-select,
  score-badge accessible name, demo switch semantics, truthfulness note visible.
  No behavioral check was removed or weakened.
- `scripts/capture-screenshots.cjs` now captures every view at 1440 and 390, plus a
  game-plan view; `scripts/axe-check.cjs` is new (axe-core 4.10.2 from cdnjs).

## Known gaps / not changed
- The Coverage drawer still claims adapters are "Connected" and shows 100% stats.
  The front end never calls those adapters, so this copy cannot be verified from
  the UI. Copy left as-is; the green "connected" dots were removed so the visual
  design no longer asserts it. Recommend an audit by whoever owns the data layer.
- Market suggestions are mouse-only (pre-existing); the field itself is keyboard
  operable and Enter scouts.
- `README.md`, `package.json` and the Vercel project name still say "terminal".
