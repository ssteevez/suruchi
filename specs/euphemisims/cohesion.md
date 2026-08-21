# Euphemisims — design, structure, and mechanics cohesion

Plain-language rules so every work under Euphemisims reads as one system, not seven
separate mini-sites. Individual behavior still lives in each work’s section in
[`euphemisims.md`](../euphemisims.md); this file is the shared contract.

---

## What Euphemisims is

- A **Poet sub-project**: single text-based **works**, each with **one interaction**.
- **Not** a shared interaction template — the mechanic changes per work; the
  **frame** (hub, shell, chrome, mount pattern) stays consistent.
- Lives in `experiments/euphemisims/` until promoted to `src/`.

---

## Three layers (do not blur)

| Layer | Who owns it | What it is |
|-------|-------------|------------|
| **Site chrome** | `shared.css` + `work.html` / `index.html` | Suruchi home (top left), Euphemisims hub link (top right on works), random prev/next (bottom), Poet back on hub only |
| **Work shell** | `work.ts` + `#work-stage` | Loads one work by `?slug=`; empty container the work mounts into |
| **Work body** | `works/{slug}.ts` | Full experience: copy, type, motion, input — usually `position: fixed; inset: 0` over the shell |

Works **mount only into `#work-stage`** but often paint a **fixed fullscreen** layer
(`z-index` 1–5) so the poem fills the viewport. That is intentional; the shell’s
720px cap must not constrain fullscreen works (several works override `.work-stage`
width in their own CSS).

---

## Shared chrome (all work pages)

See [`shell.md`](./shell.md) for routes and navigation detail.

- **Top left:** `Suruchi Choksi` → site home (`/`).
- **Top right:** `← Euphemisims` → hub (`index.html`) — **not** the current work title.
- **Bottom:** two links to **random other works** (titles visible, e.g. `← Plainness`,
  `Just So →`). New random pair on **every** work page load (not hub list order).

Works must **not** replace this chrome with their own “back” or “next” controls unless
the curator explicitly asks. They **may** restyle chrome when the page background
inverts (see below).

---

## Mount contract (every work)

Every work exports a default `TextWorkModule` (`types.ts`):

```ts
{
  title: string;           // registry + document.title suffix
  mount(container: HTMLElement): () => void;  // dispose on leave
}
```

**On mount:**

1. Clear `container` (`#work-stage`).
2. Build DOM + inject scoped styles (usually a `<style>` block and a root class on
   `document.documentElement`, e.g. `html.bd-active`, `html.self-active`).
3. Set `body` / root background if the work owns the whole viewport.
4. Start listeners / `requestAnimationFrame` / timers.

**On dispose (returned function):**

1. Remove listeners, cancel animation frames.
2. Remove injected styles and root classes.
3. `container.innerHTML = ''`.
4. Reset `body` inline styles the work set.

No hidden global singletons outside the work module. No `any`.

---

## Visual cohesion

**Default mood (Constitution §2):** dark, sparse, restrained.

| Aspect | Default (shell / hub) | Work may override |
|--------|----------------------|-------------------|
| Page ground | `#050506` (hub, shell gap) | Per work (e.g. Magic light, born/die black) |
| Chrome type | Uppercase sans, 12px, letter-spacing ~0.14em, ~62% white | Invert filter on hover when work is light or high-contrast |
| Work type | — | Work chooses face (serif, typewriter, monospace) inside mount |
| Motion | — | One primary interaction per work; avoid a second “mode” |

**Palette modes in use:**

- **Dark poem / black ground:** born/die, SELF, Issued in Public Interest, Plainness, Just So (black field).
- **Light poem:** Magic (light ground, dark ink).
- **Dark field + grey type:** Somewhere Something.

When a work uses a **light or inverted** ground, it should update chrome legibility
(SELF and Magic invert shell links under the pointer or via scoped CSS) so navigation
stays readable without changing link positions.

---

## Structural cohesion

**Hub (`index.html`):**

- Lists works in **registry order** (stable, curator-facing).
- Does not use random order.

**Work page (`work.html?slug=`):**

- Registry order is **not** the prev/next order.
- Prev/next are random other slugs per visit (`registry.ts` → `getAdjacentWorks`).

**Layout patterns (by work):**

| Pattern | Works | Notes |
|---------|-------|-------|
| Full viewport fixed stage | Most | `inset: 0`, work root `z-index` 1–5 |
| Scroll-driven progress | Issued in Public Interest | Hidden scrollbar, sticky viewport, spacer height |
| No page scroll | Somewhere Something, Magic | Wheel / time only |
| Canvas raster | born/die | 2D warp on reflection band |
| SVG paths | Just So | Seven loops, letter-on-path |
| DOM + lens | SELF | Pointer lens, invert reveal |

New works should pick one primary pattern and document it in `euphemisims.md`.

---

## Mechanics cohesion

- **One interaction hierarchy per work** — no second global system (no extra homepage
  layer inside Euphemisims).
- **Input** is defined per work (pointer, scroll, wheel, timer); document it.
- **Copy** is curator-owned; placeholders may be swapped without changing the interface.
- **Performance:** prefer CSS/DOM; canvas/WebGL only when the spec requires it (born/die).
- **Accessibility:** `role` / `aria-label` where the work is image-like (e.g. born/die canvas);
  decorative layers `aria-hidden` when duplicated (Plainness trail).

---

## Z-index guide (avoid chrome buried)

| Range | Use |
|-------|-----|
| 0–5 | Work background and main content |
| 10–12 | Work UI overlays (SELF lens, Plainness labels) |
| 20 | Shared shell chrome (`shared.css`) |
| 30+ | Work dev/tune panels only (e.g. born/die `?tune=1`) |
| 40 | Chrome above invert layers (SELF nav invert) |

Shell chrome stays at **20** unless a work document explains a higher override for nav only.

---

## Adding a work (checklist)

1. Add `works/{slug}.ts` implementing `TextWorkModule`.
2. Register in `registry.ts` (slug, title, dynamic import).
3. Add a section to [`euphemisims.md`](../euphemisims.md) using the **Work sheet** template below.
4. Confirm chrome still visible and readable on the work’s background.
5. Do not change hub list order for random nav — only registry array order.

### Work sheet template (copy into `euphemisims.md`)

```markdown
### {Title}

**Copy:** {what text, line breaks, casing}

**Visual:** {ground, ink, typeface, layout}

**Structure:** {fullscreen / scroll / canvas; breakout from work-stage?}

**Mechanics:** {primary interaction; input; reference if any}

**Chrome:** {default / invert / special}

**File:** [`works/{slug}.ts`](../experiments/euphemisims/works/{slug}.ts)
```

---

## Files map

| File | Role |
|------|------|
| `index.html` + `hub.ts` | Hub |
| `work.html` + `work.ts` | Shell loader + nav wiring |
| `shared.css` | Hub + shell chrome |
| `registry.ts` | Work list + random adjacent |
| `types.ts` | `TextWorkModule`, `WorkEntry` |
| `works/*.ts` | One module per work |

---

## Related specs

- [`euphemisims.md`](../euphemisims.md) — index and per-work behavior
- [`shell.md`](./shell.md) — routes and navigation only
