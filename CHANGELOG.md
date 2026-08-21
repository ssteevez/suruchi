
## 2026-05-24: Replaced Homepage Label Reshuffle with Smoky Dissolution

**What was changed and in which files:**
- Created `src/systems/smokyLabel/SmokyLabelSystem.ts`: Implemented a new animation system that uses SVG filters and the Web Animations API (WAAPI) to dissolve labels into smoke.
- Modified `src/main.ts`: Removed the old `createLabelReshuffleSystem` (and its types) and integrated `createSmokyLabelSystem`. Replaced the previous instantiation and added a lifecycle `isSmoking` guard in the RAF loop.

**Why each decision was made:**
- **Per-label SVG filters vs Shared:** The SVG filters are defined per-label (`#smoke-lbl-N`) because animating the `feDisplacementMap` scale is done by mutating the DOM element's attributes via RAF. If a shared filter were used, the smoke animation (scale mutation) on one swapping label would unintentionally trigger smoke effects on the other labels using that same filter.
- **WAAPI cancellation on completion:** The WAAPI animations are configured with `fill: forwards` to override base styles during the transition. Calling `cancel()` on them after the animation finishes strips the WAAPI effect layer entirely. This is crucial because it returns control of the inline styles (`transform`, `opacity`) back to the cursor's RAF loop cleanly.
- **The `isSmoking` RAF guard:** The cursor-influence loop in `main.ts` aggressively sets inline `transform` and `opacity` every frame. By skipping elements in the RAF loop when `isSmoking(item)` is true, we prevent the cursor system from "fighting" or overwriting the WAAPI translation and fade effects mid-smoke.

**What was deliberately left untouched and why:**
- **The Top-Left Corner Item (Suruchi / Choksi):** This item uses `.suruchi-word` instead of `.suruchi-label`. It was left completely out of the smoky system configuration to maintain its stationary, non-animated state.
- **WebGL HomepageScene, Cursor System, & Scroll Wrapping:** These core systems handle the background video, physics, and global interactivity. They operate independently of the corner UI labels, so they were preserved exactly as-is to prevent breaking the gallery experience.
