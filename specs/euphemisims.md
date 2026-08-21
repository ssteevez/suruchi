# Euphemisims — text works system

## Purpose

A Poet sub-project: **single text-based works**, each with **its own interaction**.
Shared **hub + shell + chrome**; not a shared poem template.

**Location:** `experiments/euphemisims/` (experiment until promoted to `src/`).

---

## Documentation map

| Document | Contents |
|----------|----------|
| [**cohesion.md**](./euphemisims/cohesion.md) | Design, structure, mechanics rules for all works |
| [**shell.md**](./euphemisims/shell.md) | Hub, routes, navigation, `work.ts` loader |
| **This file** | Registry and per-work behavior sheets |

---

## Work registry

Hub list order (curator-stable). Prev/next on work pages use **random other works**
per visit — see [shell.md](./euphemisims/shell.md).

| Slug | Title | Primary interaction |
|------|-------|---------------------|
| `magic` | Magic | Timed phrase morph (` = magic` fixed) |
| `plainness` | Plainness | Cursor: plainness label + exalted trail |
| `just-so` | Just So | Seven SVG loop trails, letter reveal |
| `somewhere-something` | Somewhere Something | Dual marquee, wheel-driven drift |
| `issued-in-public-interest` | Issued in Public Interest | Scroll scramble reveal |
| `self` | SELF | Pointer lens + invert hidden line |
| `born-die` | born/die | Reflection water warp + phrase calm |
| `fact-fiction` | Fact Fiction | Retro LED marquee ticker |

---

## Work sheets

### Magic

**Copy:** Single horizontal line. Rotating phrases (loop): *the earth of earth* → *the
wetness of water* → *the heat of fire* → *the stillness of wind*. Suffix ` = magic`
always visible on the right.

**Visual:** Light ground, dark ink; monospace; row centered in viewport.

**Structure:** Full viewport; breaks out of default `work-stage` width; no page scroll.

**Mechanics:** Gooey liquid morph between phrases (blur + contrast ramp, cross-fade).
Timer-driven cycle. Reference: Framer-style morph idiom.

**Chrome:** Dark ink on light ground — shell links toned down in work CSS; still
top-left home, top-right hub, bottom random works.

**File:** [`works/magic.ts`](../experiments/euphemisims/works/magic.ts)

---

### Plainness

**Copy:** Word **plainness** (follows pointer). Trail word **exalted** (stacking copies).

**Visual:** Black ground, white sans uppercase labels; plainness bottom-right of
cursor hotspot; exalted trail from opposite (top-left of hotspot).

**Structure:** Full viewport fixed layers (`plainness-layer`, `exalted-trail-layer`).

**Mechanics:** Pointer move → plainness eases toward cursor; path samples spawn trail
“exalted” copies that follow and fade after idle. Stack grows while moving (~60ms per
extra copy). Opacity falloff along trail.

**Chrome:** Default dark shell chrome.

**File:** [`works/plainness.ts`](../experiments/euphemisims/works/plainness.ts)

---

### Just So

**Copy:** Phrase `just so, just so, ` repeated along paths.

**Visual:** Black field; **seven** white loop ribbons (staggered opacity/size); cream
path (`#f5f2eb`) on one loop per random refresh (inverted ribbon pair randomised).

**Structure:** Full viewport SVG; per-visit random closed loops; letters placed on
path (not `textPath` scroll).

**Mechanics:** Letter-by-letter reveal along each loop (~72s per circuit); scroll
offset animates around path. Paths re-randomise on refresh.

**Chrome:** Default dark shell chrome.

**File:** [`works/just-so.ts`](../experiments/euphemisims/works/just-so.ts)

---

### Somewhere Something

**Copy:** Two looping lines (full width):

1. `somewhere is nowhere is `
2. `nothing is something is `

**Visual:** Dark ground, grey type; top and bottom bands.

**Structure:** Full viewport; **no page scroll** (`ss-lock-scroll` on `html`).

**Mechanics:** Scroll-flow marquee (wheel only). Top and bottom **same speed**;
default opposite directions (top L→R, bottom R→L). Scroll down → same pairing,
faster; scroll up → **reverse** both directions + faster. Idle drift at base speed in
last direction. Reference: [ScrollFlowTextFX](https://www.framer.com/marketplace/components/scrollflowtextfx/).

**Chrome:** Default dark shell chrome.

**File:** [`works/somewhere-something.ts`](../experiments/euphemisims/works/somewhere-something.ts)

---

### Issued in Public Interest

**Copy:** Title **ISSUED IN PUBLIC INTEREST**; body is curator paragraph with **exact
line breaks** preserved.

**Visual:** Black ground, white American Typewriter; bold title; body very tight
`line-height` (~**0.46**) so lines overlap and touch.

**Structure:** Fixed root with **internal scroll** (hidden scrollbar); sticky viewport;
spacer height drives scramble progress.

**Mechanics:** Letters start scattered/rotated in viewport; scroll settles words in
order (title block, then body words). Reference: [Scramble Text Reveal](https://www.framer.com/marketplace/components/scramble-text-reveal/).

**Chrome:** Default dark shell chrome.

**File:** [`works/issued-in-public-interest.ts`](../experiments/euphemisims/works/issued-in-public-interest.ts)

---

### SELF

**Copy:** Two lines — visible and hidden (lens):

- Visible: `emp t i e d      o f` / `          |   SELF   |`
- Hidden: `filled` / `           with love` (*with love* italic)

**Visual:** Black ground, white typewriter; pre-formatted grid alignment between layers.

**Structure:** Full viewport; lens element follows pointer.

**Mechanics:** [Text Lens Revealer](https://www.framer.com/marketplace/components/text-lens-revealer/) —
inside circle, hidden layer visible with **invert**. Shell nav links invert on hover
when under lens (`z-index` 40).

**Chrome:** Invert-on-hover for `.nav-home`, `.work-hub-link`, `.work-adj-link`.

**File:** [`works/self.ts`](../experiments/euphemisims/works/self.ts)

---

### born/die

**Copy:** Top: **born to die**. Below, **die to be born** as one line rotated 180°
around shared **to** (foot-to-foot; **die** under **die**).

**Visual:** Black ground `#000000`, white serif lowercase; viewport-fitted size;
phrase block centered in viewport (ink bbox, not pivot-only).

**Structure:** Canvas layout engine; reflection band below pivot baseline; optional
`?tune=1` dev sliders for wave constants.

**Mechanics:** Reflection = turbulent water at rest (inverse pixel warp). Pointer
over reflection band → **whole phrase** calms over ~1s (not per-letter): ~20% minimum
motion + gentle wave; not a full freeze. Leaving band returns full muddle.

**Chrome:** Default dark shell chrome; tune panel bottom-left when `?tune=1` only.

**File:** [`works/born-die.ts`](../experiments/euphemisims/works/born-die.ts)

---

### Fact Fiction

**Copy:** `Fact is Fiction is ` (mixed case), looping marquee.

**Visual:** Dark room; white lit dots, bloom (sprite-based), dim unlit dots, subtle flicker. Letterforms sampled from **cursive handwriting** ([Caveat](https://fonts.google.com/specimen/Caveat)) into the dot matrix at fine resolution, scaled to one tall board. No frame or bezel.

**Structure:** **One** LED board band, edge-to-edge width, **10%** margin top and bottom; band height fills the middle **80%** of the viewport (vertical resample for legibility). Breaks out of default `work-stage` width.

**Mechanics:** Full phrase horizontal scroll marquee, endless loop. Scroll direction **random on page load / bfcache restore**; random phase offset. Resize rescales letter band to viewport height. No user input.

**Chrome:** Default dark shell chrome.

**File:** [`works/fact-fiction.ts`](../experiments/euphemisims/works/fact-fiction.ts)

---

## Adding a work

1. Implement `works/{slug}.ts` (`TextWorkModule` — see [cohesion.md](./euphemisims/cohesion.md)).
2. Register in `registry.ts`.
3. Add a work sheet above (same headings).
4. Verify shell chrome visible and readable on the work background.

---

## Constraints

- Dark, sparse, restrained by default (Constitution §2); per-work palette exceptions
  documented in work sheets.
- One primary interaction per work; no fourth global homepage layer here.
- Placeholder copy may be replaced without changing the interface.
