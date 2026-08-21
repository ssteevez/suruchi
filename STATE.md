# STATE.md

Volatile working memory. This file is rewritten each session and reflects only
the current state.

Last updated: 2026-08-02

---

## What is done

- Homepage Phase 1 remains a Three.js/WebGL six-video scroll loop with cursor illumination and typography interactions.
- "Void" has been added to the homepage as a `.suruchi-pos-4` menu item, linking to the Book Engine experiment.
- `src/painter/` has been renamed to `src/zeroPlus/` (Zero Plus is the active production route).
- `poet.html` is a Poet gateway linking to Beach Shooting and Euphemisims.
- Beach Balloon Shooting exists in `experiments/beach-shooting/`.
- Euphemisims (`experiments/euphemisims/`) has multiple works in its registry.
- Admin Control Panel V1 & V2 exist with visual refinements.
- **Book Engine Experiment (`experiments/book-engine/`) is complete and frozen.**
  - Resolved floating-point sync issues and spine clipping with mathematical arcs.
  - Fixed 1-frame React lag during block handoffs by injecting memory refs directly into 3D materials.
  - Cinematic film grain, dynamic vignette, and 6-point tungsten lighting rig established.
  - The formal build spec has been handed off to `specs/book-engine.md`.
- **After Image Carousel has been migrated into production.**
  - Implemented as a standalone React route at `after-image.html`.
  - Accessible via the Painter gallery directory (`painter.html`).
  - Features asymmetric infinite layout and direct gallery spotlight rendering.

---

## What is in progress

- Zero Plus is the active production route for the former Painter system.
- Photograms is approved as an experiment and included in Vite build.
- Beach Balloon Shooting is still in visual/game-feel tuning.
- Control Panel V2 is a local experiment ready for curator testing.

---

## What is blocked / unresolved

- `public/poster.jpg` is still missing for the homepage fallback path.
- The ripple effect on the homepage needs final visual review.
- Photograms needs a final promotion rebuild under `src/photograms/`.
- Beach Balloon Shooting needs curator visual review.
- Control Panel V2 remains local-only without Supabase persistence.

---

## What is next

1. **Cursor builds the I Was Not Among My Kind, Distinctive page from `specs/i-was-not-among.md` into production `src/` under the Painter section.**
2. **Cursor builds the Book Engine from `specs/book-engine.md` into production `src/`.**
3. Curator reviews Control Panel V2 locally at `/experiments/control-panel-v2/`.
4. Curator provides `public/poster.jpg`.
5. Cursor rebuilds Photograms from `specs/photograms.md` into production.
6. Manual visual pass on all experiments and active production routes.

---

## Notes for next session

- The I Was Not Among My Kind experiment in `experiments/i-was-not-among/` should NO LONGER BE EDITED. It is the frozen prototype reference for Cursor.
- The Book Engine in `experiments/book-engine/` should NO LONGER BE EDITED. It is the frozen prototype reference for Cursor.
- Control Panel V2 data model lives in `src/types.ts`, seeded via `src/seed.ts`.
- Run experiments via Vite at `http://127.0.0.1:5173/experiments/...`.
