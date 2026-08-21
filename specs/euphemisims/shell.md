# Euphemisims — hub and work shell

Shared frame for all works. Work-specific design and mechanics are in
[`cohesion.md`](./cohesion.md) and [`euphemisims.md`](../euphemisims.md).

---

## Routes

| URL | Page |
|-----|------|
| `/experiments/euphemisims/` | Hub — work list |
| `/experiments/euphemisims/work.html?slug={slug}` | Single work |

Vite entries: `euphemisims/index.html`, `euphemisimsWork` → `work.html` (`vite.config.ts`).

---

## Hub (`index.html`)

**Chrome:**

- Top left: Suruchi Choksi → `/`
- Bottom left: `← Poet` → `/poet.html`

**Content:**

- Title: EUPHEMISIMS (uppercase, large).
- Short intro paragraph.
- List of works from `registry.ts` **in registry order** (not random).

Each list item links to `work.html?slug={slug}` with the work **title** as label.

---

## Work shell (`work.html` + `work.ts`)

**DOM:**

```html
<a class="nav-home">…</a>
<a class="work-hub-link" href="./">← Euphemisims</a>
<nav class="work-adj-nav">
  <a id="work-prev" class="work-adj-link work-adj-prev">…</a>
  <a id="work-next" class="work-adj-link work-adj-next">…</a>
</nav>
<main class="work-shell">
  <div id="work-stage" class="work-stage"></div>
</main>
```

**Loader (`work.ts`):**

1. Read `?slug=` from query string.
2. Resolve `getWorkEntry(slug)` from `registry.ts`.
3. Wire prev/next via `getAdjacentWorks(slug)` — **new random pair each load**.
4. Set `document.title` to `{work title} — Euphemisims`.
5. Dynamic `import()` the work module; call `mount(work-stage)`; register `dispose` on `beforeunload`.

**Errors:** missing slug or unknown slug → message in `#work-stage` only.

---

## Navigation rules

| Control | Behavior |
|---------|----------|
| Suruchi Choksi | Leave Euphemisims to site home |
| ← Euphemisims | Hub index (work list) |
| ← {title} (bottom left) | Random **other** work (prev slot) |
| {title} → (bottom right) | Random **other** work (next slot) |

- Prev and next are **always two distinct works** when at least two others exist.
- Labels use **work titles**, not the words “previous” / “next”.
- **Not** the same order as the hub list.
- **Not** stored across the session — re-randomised on every page open (including
  back-forward cache restore via `pageshow`).

Implementation: `registry.ts` → `getAdjacentWorks`.

---

## Shared CSS (`shared.css`)

Fixed positions (typical):

- `nav-home`: top 36px, left 42px, `z-index: 20`
- `work-hub-link`: top 36px, right 42px, `z-index: 20`
- `work-adj-nav`: bottom 34px, left/right 42px, `z-index: 20`, flex space-between

`.work-shell` / `.work-stage` center a default content column (`min(720px, 100%)`).
Fullscreen works override this inside their own scoped CSS.

---

## What the shell does not do

- No shared poem renderer.
- No shared scroll or pointer model.
- No work title in the top-right (that slot is hub only).
- No Euphemisims link on the bottom left on work pages (that slot is work-to-work nav).
