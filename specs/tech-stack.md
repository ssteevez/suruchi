# specs/tech-stack.md

The technical stack for the SuruchiWebsite homepage. This file replaces
the earlier placeholder. It inherits from `CONSTITUTION.md` §6 and does
not contradict it.

---

## 1. Language

**TypeScript**, strict mode. The following `tsconfig.json` settings are
non-negotiable:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

No `any` anywhere in the codebase. For a curator who does not read code
directly, the type system is the readable spec — `any` defeats the audit.

---

## 2. Build tool

**Vite**, vanilla-ts template.

```bash
npm create vite@latest [project-name] -- --template vanilla-ts
```

No framework (no React, no Vue, no Svelte). The homepage does not need
component reactivity — it needs a tight WebGL render loop and a small
amount of DOM. A framework would add bundle weight and indirection for
no benefit on this page.

If a later quest (e.g. About, Press) genuinely needs a framework, that
quest may add one — but it is a per-quest decision, not a project-wide
default.

---

## 3. WebGL library — Three.js

**Three.js.** This is the homepage's primary rendering dependency.

**Why Three.js and not OGL** (the previous spec named OGL; this is
the change):

The committed visual technique is a **DataTexture-driven grid
displacement** of the video surface, as documented in the Codrops
"Pixel Distortion Effect with Three.js" tutorial (Yuriy Artyukh, January
2022) and "Grid Displacement Texture with RGB Shift using Three.js GPGPU
and Shaders" (August 2024). Three.js provides `THREE.DataTexture` and
`GPUComputationRenderer` as first-class utilities for exactly this
pattern. Doing the same in OGL is possible but means writing the
GPGPU plumbing from scratch.

This also re-aligns the homepage with the proposal PDF, which named
Three.js. The 3D Exhibition Environment module (a later, separate
quest) was always planned to use Three.js. Using one library across
both modules is operationally simpler than two.

Logged as a decision in `DECISIONS.md` (2026-05-23).

**Version pinning.** Pin to a specific Three.js release in `package.json`,
not a range. Three.js has had silent API changes between minor versions
(notably around materials and `WebGLRenderer` defaults). A pinned version
means audits and prototypes are reproducible. Choose the latest stable
release at project start, then update only deliberately.

---

## 4. Permitted runtime dependencies

Dependencies are scoped by page. Adding anything outside these lists
requires curator approval and a `DECISIONS.md` entry justifying the
addition and its bundle cost.

### Homepage (`src/main.ts` and everything it imports)

- **three** — the WebGL library.
- **lenis** (or another lightweight smooth-scroll library) — only if
  `specs/scroll-transitions.md` confirms it is needed. Native scroll is
  preferred where it suffices. Do not add until the scroll spec confirms.

No framework (React, Vue, Svelte, etc.) on the homepage. It does not need
component reactivity — it needs a tight WebGL render loop and a small amount
of DOM. A framework adds bundle weight and indirection for no benefit here.

### Works pages (`src/pilgrim/`, and future `src/poet/`, `src/painter/`)

- **three** — shared with the homepage.
- **react** and **react-dom** — authorized for Works pages that require
  component-based rendering. Ratified 2026-05-24; see `DECISIONS.md`.
- **@react-three/fiber** — authorized for Works pages that host a 3D
  canvas. Ratified 2026-05-24; see `DECISIONS.md`.

Bundle cost note: React ~40 KB gzip, R3F ~90 KB gzip. Acceptable for
Works pages; these are kept out of the homepage bundle by Vite's
multi-entry code-splitting.

Any other runtime dependency — GSAP, OGL (removed), Lottie, Three.js
plugin packages, etc. — requires curator approval regardless of page.

---

## 5. Permitted build-time dependencies

- **vite** — the build tool.
- **typescript** — the language.
- **@types/three** — Three.js type definitions.

Linting and formatting (eslint, prettier) may be added at the curator's
discretion. Test frameworks are deferred — the homepage's correctness
is judged visually by the curator and by Claude's audit against the
specs, not by automated tests at this stage.

---

## 6. Browser targets

- **Desktop only** for the cursor system and the distortion effect.
- Latest stable Chrome, Firefox, Safari, Edge. No IE, no legacy.
- WebGL 2 minimum (Three.js's modern path uses it; falling back to
  WebGL 1 is not a project goal).
- macOS, Windows, Linux desktops with discrete or integrated GPUs from
  the last ~5 years are the assumed audience.
- Mobile / touch devices receive the static poster fallback (§7).

---

## 7. The fallback path

Where any of the following is true, the homepage shows a static dark
poster image and no effects:

- WebGL 2 is unavailable.
- `WebGLRenderer` construction throws.
- `prefers-reduced-motion: reduce` is set.
- The user is on a touch-only device (no `pointer: fine` media query
  match).

The poster is a single image file in `public/`. The implementation does
not construct the cursor system or any WebGL context in the fallback
case — it simply renders the poster. This is the floor, not a richer
fallback.

The poster's filename, dimensions, and format are decided at the time
the spec is implemented and logged in `DECISIONS.md` then. For
prototype purposes, an `<img>` tag pointing at a placeholder is
sufficient.

---

## 8. File and folder layout

The homepage's source tree lives under `src/`. Layout:

```
src/
  main.ts                          ← entry point, top-level wiring
  systems/
    cursor/
      types.ts                     ← interface from specs/cursor-system.md §3
      CursorSystem.ts              ← implementation
  scenes/
    HomepageScene.ts               ← Three.js scene: video plane + distortion
  effects/
    DistortionField.ts             ← DataTexture write/relax logic
  shaders/
    video.vert                     ← passthrough vertex shader
    video.frag                     ← UV-warp + brightness fragment shader
public/
  video.mp4                        ← curator places this file
  poster.jpg                       ← static fallback image
```

Cursor and Antigravity may add files within this structure. They may
not invent new top-level folders without curator approval.

---

## 9. Bundle size budget

The homepage's production bundle, gzip, must be under **200 KB** of
JavaScript. Three.js alone is roughly 150 KB gzipped, so the budget
leaves ~50 KB for the project's own code and one small additional
library (if needed). If the budget is breached, the curator decides
whether to relax it or refactor.

Bundle size is checked by running `npm run build` and inspecting the
dist output. Audits include this check.

---

## 10. Permitted experimentation

Experimental code (`experiments/` folder, when it exists) is allowed
to use any library or technique. The constraints in this file apply to
**production code under `src/`**, not to experiments.

Experiments do not ship. Per `DECISIONS.md` (2026-05-16, "Experiments
are throwaway"), promotion to production means a re-implementation
under `src/` against this stack, not a copy.
