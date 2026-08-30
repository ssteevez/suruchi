# WORKLOG.md — implementation and audit log

This file is **append-only** and is maintained by Cursor (implementation) and
Claude (architectural review and audit). Every session either agent does
meaningful work, it appends a dated entry at the bottom describing what was
done and why. Old entries are never rewritten — they are permanent record.

This file is **readable by the curator** as a plain-language history of
every code change. It is not law (that is `CONSTITUTION.md`) and not
decision record (that is `DECISIONS.md`) — it is the implementation diary.

**Override rule:** If the curator leaves a note below an entry marked
`CURATOR OVERRIDE:`, Cursor reads that note on its next session and acts
on it. This is the mechanism for evolving design decisions without opening
a full Constitution amendment. Overrides are logged in `DECISIONS.md` once
settled.

Format per entry:
```
## YYYY-MM-DD — Short title of the session's work
Files touched: list
What was done: plain English
Why: what decision or spec drove this
Open questions / notes for curator: anything that needs a decision
```

---

<!-- Cursor appends new entries below this line. Most recent entry is at the bottom. -->

## 2026-05-24 — Fallback, prefetch, and cache hardening pass
Files touched: `src/main.ts`, `src/systems/cursor/CursorSystem.ts`, `src/scenes/HomepageScene.ts`, `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Added a strict fallback gate in `main.ts` for reduced-motion, coarse-pointer, and WebGL-unavailable cases that renders a fixed poster image and skips all cursor/scene/RAF setup; added ahead-of-scene prefetch wiring in the RAF loop; clamped cursor positions on resize in `CursorSystem.ts`; changed homepage video loading in `HomepageScene.ts` to start with scenes 0 and 1 and added `prefetchScene()` for scene-ahead loading; added Pilgrim texture-cache cleanup coupled to chunk eviction so disposed chunks can release unreferenced GPU textures.
Why: Constitution §6 and `specs/tech-stack.md` §7 require poster fallback for reduced motion/mobile/WebGL failure; `specs/scroll-transitions.md` + current six-scene loop design support scene-ahead prefetching; STATE/optimization notes explicitly called out resize clamping and Pilgrim texture cache growth as pending defects.
Open questions / notes for curator: Task 2 (`git rm -r --cached '._*'`) could not be completed because the mounted project path is currently not a git repository (`git status` fails with “not a git repository”). If this should be a git workspace, the `.git` directory/clone needs to be restored before sidecar untracking can be staged.

## 2026-05-24 — Git initialization and repo hygiene
Files touched: `.gitignore`, `WORKLOG.md`, `STATE.md`
What was done: Initialized git repository. Deleted all `._*` macOS sidecar files from disk. Added large binary exclusions to `.gitignore` (videos, images, `.pydeps`, `scratch`). Made first commit.
Why: Project had no `.git` directory — git could not track changes or run `git rm`. `STATE.md` listed this as a blocker. `.gitignore` already had `._*` excluded but files needed physical removal.
Open questions / notes for curator: Videos and images in `public/` are now gitignored. If you want version-controlled asset tracking, consider Git LFS (`git lfs track "*.mp4"` etc.) — but do not add it without curator approval. A remote origin (GitHub/GitLab) has not been set up. To push: `git remote add origin <url>` then `git push -u origin main`.

## 2026-05-24 — Pilgrim pan direction and zoom loop fixes
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Fixed wheel Y pan direction (was inverted vs drag; changed `-=` to `+=`). Fixed zoom loop accumulation: `targetZRef` and `camera.position.z` now wrap back into `[MIN_Z, MAX_Z]` at cycle boundaries instead of accumulating indefinitely. Added `pendingZSnapRef` to apply the wrap cleanly from `useFrame`. Removed the `[2, 900]` clamp and replaced with a range-relative clamp.
Why: Wheel Y inversion was a sign inconsistency between `onWheel` and the drag handler. Zoom accumulation caused the camera to escape the fog-designed depth range after one cycle, making the canvas go black on subsequent cycles.
Open questions / notes for curator: The fog near value (currently `30`) may need a small adjustment after the zoom loop fix — worth reviewing visually at `MIN_Z` and `MAX_Z`. The `INITIAL_Z` (`30`) puts you roughly one-third of the way through the first cycle. Consider whether that starting zoom level is right, or whether starting at a shallower depth (for example `18`) feels better for first impression.

## 2026-05-24 — Pilgrim fluid drag tuning and cycle-wrap continuity fix
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Retuned pan feel to be slower and more fluid by reducing drag/wheel sensitivity and increasing inertia (`DRAG_SENSITIVITY`, `WHEEL_PAN_SENSITIVITY`, `TARGET_VELOCITY_DECAY`, `VELOCITY_BLEND`, `PAN_RESISTANCE`, and pan scale divisor/minimum). Replaced cycle detection math with explicit wrapped zoom application (`applyWrappedZoom`) so crossing `MIN_Z`/`MAX_Z` computes cycle shift and wrapped depth in one place without cycle ping-pong. Kept `pendingZSnapRef` and snap-before-lerp behavior to avoid long lerps after wrap.
Why: User reported movement felt too fast/stiff and zoom transitions remained jittery after boundary crossings. Previous cycle math compared absolute cycle index against wrapped target depth, causing immediate reverse shifts and broken continuity.
Open questions / notes for curator: Please re-check interaction feel on trackpad and mouse in real use. If motion still feels too fast, next adjustment should be lowering `panScale` further before changing inertia constants again.

## 2026-05-24 — Pilgrim slower zoom cadence and deeper background layering
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Delayed cycle turnover by extending zoom range (`MAX_Z` to `120`) and reducing zoom input rate (`ZOOM_WHEEL_SCALE` and keyboard zoom step). Increased perceived image density by raising planes per chunk and adding a farther depth tier in `pickDepth`. Tuned depth-based width scaling to keep distant layers readable and extended fog far plane to preserve deep-layer visibility.
Why: User feedback indicated cycle swaps happened too quickly and the scene needed a stronger illusion of many more photos in depth.
Open questions / notes for curator: If performance drops on lower-end GPUs, first rollback knob should be `PLANES_PER_CHUNK` from `4` to `3` while keeping the slower zoom cadence.

## 2026-05-24 — Pilgrim density increase with overlap control tuning
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Increased `PLANES_PER_CHUNK` to `7` as requested. Reduced heavy stacking by rebalancing spacing and footprint: lowered chunk `minDistance` for stable 7-plane placement, increased sparse-point placement attempts, added least-overlap fallback sampling for failed placements, and reduced average plane width/scale in `pickWidth`.
Why: User requested much denser chunks but with moderated overlap (~40% acceptable), not severe pileups.
Open questions / notes for curator: If overlap still feels heavy, next knob should be lowering final width multiplier (`1.45`) slightly before reducing `PLANES_PER_CHUNK`.

## 2026-05-24 — Pilgrim distribution made half-sparser (denser)
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Reduced chunk placement sparsity by halving the spacing threshold (`minDistance`: `CHUNK_SIZE * 0.26` -> `CHUNK_SIZE * 0.13`) to produce a visibly denser photo field.
Why: User requested the distribution to be about half as sparse as the previous tuning.
Open questions / notes for curator: If this now feels too clustered in some chunks, the safest next micro-adjustment is `CHUNK_SIZE * 0.15` to keep the denser look while reducing local pileups.

## 2026-05-24 — Pilgrim black-space reduction via larger photo coverage
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Kept the current distribution pattern and increased image footprint by raising width tiers and final width multiplier in `pickWidth` to reduce unused black gaps between planes.
Why: User confirmed distribution felt right but reported too much black space with overlaps feeling too restrained.
Open questions / notes for curator: If overlap now feels slightly heavy in near layers, lower only the final width multiplier (from `1.62` toward `1.55`) without touching spacing logic.

## 2026-05-24 — Pilgrim depth-layer focus fog (2nd to 7th layers)
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Added explicit depth layer tagging for planes (`layer` 1–7) and introduced layer-aware fog weighting so fog starts effectively from layer 2 and increases gradually toward layer 7. Added zoom-coupled focus logic so the active focus layer shifts with zoom depth, reducing haze near the focused layer while preserving stronger haze on non-focused deeper layers.
Why: User reported overlap feeling overpowering and asked for stronger front-plane focus with progressive deep-layer reveal as zoom changes.
Open questions / notes for curator: Please verify the focus transition pace while zooming; if focus jumps too quickly between layers, we can widen the focus falloff curve without changing distribution.

## 2026-05-24 — Pilgrim fog curve rebalance (40% at layer 2)
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Replaced layer fog baseline with an explicit distribution: layer 1 remains 0 fog, layer 2 starts at 40% fog, and remaining 60% is distributed linearly across layers 3–7 (reaching full fog at layer 7). Kept zoom-coupled focus attenuation on top of this baseline.
Why: User requested stronger fog presence starting at the second layer with a controlled gradual ramp to the deepest layer.
Open questions / notes for curator: If layer transitions feel too stepped, we can switch the linear ramp to an eased curve while preserving the same 40% and 100% anchor points.

## 2026-05-24 — Pilgrim foreground focus reduction
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Reduced the number of foreground images staying in sharp focus by tightening the focus falloff window and reducing near-depth generation probability in `pickDepth`.
Why: User requested fewer in-focus images in the foreground to reduce visual crowding at the front plane.
Open questions / notes for curator: If foreground still feels busy, next adjustment can lower near-depth probability from `0.08` to `0.06` without affecting zoom loop behavior.

## 2026-05-24 — Pilgrim hard cap: max 5 front-plane images in focus
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Added a viewport-aware front-focus gate that selects front-layer candidates and keeps only the nearest five (`MAX_FRONT_FOCUS_COUNT = 5`) eligible for sharp focus. Extra front-layer planes are pushed behind additional haze.
Why: User required an explicit per-viewport limit so no more than five foreground images are in focus at any given time.
Open questions / notes for curator: If the cap feels too strict during fast panning, we can keep cap=5 but reduce extra haze slightly so overflow planes remain present without competing for focus.

## 2026-05-24 — Pilgrim adaptive black-space fill without heavy overlap
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Added adaptive per-plane width fitting in chunk generation. Each plane now computes local room from nearest-neighbor spacing and edge room, then blends its base width toward a local target width and clamps to local min/max bounds.
Why: User wanted to reduce massive overlap while still filling unused black space dynamically. Adaptive sizing shrinks crowded planes and expands isolated ones.
Open questions / notes for curator: If this still feels too overlap-heavy, reduce the local target factor (`0.9`) slightly; if too sparse, increase it slightly.

## 2026-05-24 — Pilgrim 4-layer depth stack and larger foreground plane
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Reduced depth layering from 7 to 4 (`DEPTH_LAYER_COUNT = 4`). Kept layer-fog baseline behavior so layer 2 starts around 40% fog and ramps to full fog by layer 4. Increased foreground (layer 1) image scale by 60% via per-plane scaling in `ImagePlane`.
Why: User requested fewer depth layers, stronger foreground emphasis, and a clearer zoom-driven perception of photos shifting through layers.
Open questions / notes for curator: If foreground feels too dominant after zooming in, keep 4 layers but reduce foreground boost from `1.6` to `1.45`.

## 2026-05-24 — Pilgrim dynamic focus-thumbnail scaling tied to zoom
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Replaced one-time foreground scaling with per-frame dynamic scaling. The five focus-allowed front thumbnails now receive a strong zoom-linked size boost; non-focused front planes are damped in size and haze-boosted. Added smooth scale interpolation so focus-size shifts are readable, not popping.
Why: User reported foreground did not visibly increase and requested clearly larger focus thumbnails in viewport linked to zoom level.
Open questions / notes for curator: If focused thumbnails now feel too dominant, reduce `focusBoost` multiplier first before changing front-focus cap logic.

## 2026-05-24 — Revert dynamic thumbnail resizing
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Rolled back per-frame zoom-linked thumbnail size changes in `ImagePlane`. Restored stable sizing behavior with static scaling (foreground layer retains fixed boost, no runtime size pulsing).
Why: User feedback indicated dynamic size changes were visually unpleasant and should be removed.
Open questions / notes for curator: If foreground still needs more emphasis, increase fixed foreground scale slightly without reintroducing dynamic resizing.

## 2026-05-24 — Foreground scale increased to 400%+ bigger
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Increased fixed foreground layer scale multiplier from `1.6` to `5.0` for layer-1 planes in `ImagePlane`.
Why: User requested front images be at least 400% bigger while keeping stable (non-dynamic) sizing behavior.
Open questions / notes for curator: If this overwhelms composition in some views, the fallback range to test is `4.0` to `4.5` while preserving the same fixed-scaling approach.

## 2026-05-24 — Foreground overlap reduction while preserving large size
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Reduced front-layer crowding by lowering near-depth generation probability and switching focus selection to a distributed spacing-aware strategy (`selectDistributedFrontFocus`) instead of picking the nearest 5 only. The 5 focused front images are now more spatially separated in viewport.
Why: User liked current front-image size/motion but reported overlap as too heavy.
Open questions / notes for curator: If overlap is still high, next step is increasing the focus-distribution minimum spacing constant slightly (`CHUNK_SIZE * 0.6` -> `0.7`).

## 2026-05-24 — Pilgrim bloom/halo on focused images
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Added a soft animated glow halo to ImagePlane. Focus is determined spatially — images near the camera's current XY pan position glow softly. The halo is a child mesh with AdditiveBlending and a canvas-generated radial gradient texture (warm white, 256×256, singleton). Scale [1.85, 1.85, 1] inherits parent mesh's aspect ratio so the halo always matches the image shape. Opacity pulses at ~12s period with per-image phase offsets to avoid synchronised breathing.
Why: Curator requested soft bloom/halo on in-focus images. Previous attempt by Cursor produced a plain stroke. This approach uses additive blending and a radial gradient, which reads as a photographic glow rather than a UI decoration.
Open questions for curator: The focus threshold (focusRadius formula) and max glow opacity are tunable. If the effect needs to be stronger or more localised, those two numbers are the levers. No new dependencies were added.

## 2026-05-24 — Pilgrim glow visibility hotfix
Files touched: `src/pilgrim/main.tsx`, `WORKLOG.md`, `STATE.md`
What was done: Increased glow visibility by widening focus radius, lowering opacity gate for glow activation, and raising glow opacity envelope. Enabled `depthTest={false}` on halo material so additive bloom is not lost behind depth-tested surfaces while still keeping `depthWrite={false}`.
Why: User reported no visible bloom/halo in real interaction; prior values were too restrained to read in current scene/fog/scale conditions.
Open questions for curator: If this is now too strong, reduce only the glow envelope (`0.2 + breathe * 0.18`) before tightening focus radius.

## 2026-05-24 — Corner label reshuffle and page routing
Files touched: `src/main.ts`, `poet.html`, `painter.html`, `vite.config.ts`, `WORKLOG.md`, `STATE.md`
What was done: Added `createLabelReshuffleSystem()` in `main.ts`. Each of the three nav labels (POET, PAINTER, PILGRIM) runs an independent ambient timer. On each fire, letters individually cycle through random pool characters then snap back to the correct spelling, staggered ~110ms per character in randomised order. Click navigation wired: POET → `poet.html`, PAINTER → `painter.html`, PILGRIM → `pilgrim.html` (existing). Created `poet.html` and `painter.html` as minimal dark placeholder pages. Added both to `vite.config.ts` input map.
Why: Curator requested letter reshuffle tied to the shared letter pool across the three words. All three words visible always. Timer-driven, per-word independent, no cross-screen letter travel.
Open questions for curator: Interval cadence (8.5–9.5s) and stagger delays are tunable constants inside `createLabelReshuffleSystem`. If the reshuffle feels too frequent or too rare, those are the first knobs. Click-to-navigate currently waits for one full reshuffle pass before routing; if too long, click pass can use lower cycle counts. Also, `DECISIONS.md` update is pending curator action per repository governance.

## 2026-05-24 — Corner labels swap words between positions
Files touched: `src/main.ts`, `DECISIONS.md`, `WORKLOG.md`, `STATE.md`
What was done: Upgraded `createLabelReshuffleSystem()` so labels are stateful (word+href bound to the displayed word, not fixed corner). Added periodic pairwise swaps where two of the three labels exchange words/targets and reshuffle into their new spelling. Click navigation now always follows the currently displayed word. Appended the requested decision entry in `DECISIONS.md`.
Why: Curator requested occasional two-label position interchange while preserving correct routing by word identity.
Open questions for curator: Swap cadence is currently randomised around 11–15s between swaps; this can be slowed or sped up independently of ambient reshuffle cadence.

## 2026-05-24 — Painter page — 3D carousel, colour bloom, shadow follower
Files touched: `painter.html`, `src/painter/main.ts`, `src/painter/carousel.ts`, `src/painter/colorExtractor.ts`, `src/painter/gradientBackground.ts`, `src/painter/shadowFollower.ts`, `scripts/optimize-painter.mjs`, `package.json` (sharp added)
What was done: Built the Painter page from scratch and replaced the placeholder with a complete page implementation. Added image optimisation pipeline and generated 7 optimised images in `public/images/painter-opt/`. Implemented CSS 3D ring carousel with 7 portrait cards, autoplay rotation, active-card detection, and lightbox-on-click. Added canvas-based dominant colour extraction per image, reactive two-blob gradient background updates, cursor-following active-card shadow, and subtitle font-size binary search so "Painter" matches the artist name block width.
Why: Curator instruction — Painter quest, referencing Codrops 3D Gradient Carousel and Framer Horizon Carousel patterns.
Open questions / notes for curator: None.

## 2026-05-24 — Painter — visual depth and bloom fixes
Files touched: `painter.html`, `src/painter/carousel.ts`, `src/painter/gradientBackground.ts`, `src/painter/main.ts`, `src/painter/colorExtractor.ts`, `WORKLOG.md`
What was done: Applied eight targeted fixes from user review: (1) increased scene depth and horizon angle by changing `#carousel-scene` perspective to `600px` and origin to `50% 35%`; (2) added active-card scale in the carousel transform (`scale(1.14)` for front card); (3) increased card dimensions to `340x454` in both CSS and carousel constants; (4) increased ring radius formula in all three locations to `Math.max(440, Math.min(window.innerWidth * 0.40, 700))`; (5) replaced gradient background implementation with per-frame RGB lerp using `dt`, removed non-interpolating CSS gradient transition, tightened blob size to `72vw`, and raised opacity to `0.45`; (6) replaced dominant-colour extraction with mid-tone band averaging (`lum` 28–228) to avoid highlight bias; (7) removed `.carousel-card` `box-shadow` CSS transition so shadow follower smoothing is only JS-driven; (8) added hover pause with `mouseenter`/`mouseleave` flag and gated auto-rotation with `!hovering`.
Why: User review identified flat perspective, invisible/non-lerped bloom, and lack of clear active-card emphasis; these fixes align the Painter motion/depth/bloom behavior with the intended references.
Open questions / notes for curator: None.

## 2026-05-24 — Painter — Horizon reference alignment pass
Files touched: `painter.html`, `src/painter/carousel.ts`, `WORKLOG.md`
What was done: Tightened the carousel toward the Horizon reference with three targeted changes: reduced scene perspective from `920px` to `500px` for stronger foreshortening, increased card corner radius from `6px` to `20px` for the curved visual profile at side angles, and changed card visibility logic so the full back half is hidden (`cosVal <= 0` => opacity `0` and `pointer-events: none`, front half uses `Math.pow(cosVal, 0.65)`). Kept existing overflow/backface handling already present on `.carousel-card`.
Why: User review flagged that the current look remained too far from the reference (insufficient depth and too many visible back-side cards).
Open questions / notes for curator: None.

## 2026-05-28 — Cleanup pass, ripple approval, and Zero Plus routing
Files touched: `STATE.md`, `WORKLOG.md`, `vite.config.ts`, `zero-plus.html`, `painter.html`, `src/zeroPlus/*`, `src/scenes/HomepageScene.ts`, `specs/video-compositing.md`, `vite.config.ts.bak`
What was done: Rewrote `STATE.md` to match the actual current systems and removed obsolete references to `createLabelReshuffleSystem`. Recorded the curator-approved ripple effect in the video compositing spec as an extension of the cursor distortion expression while keeping it gated behind `?ripple=1` for visual review. Renamed `src/painter/` to `src/zeroPlus/`, wired `zero-plus.html` to the renamed TypeScript entry, and replaced `painter.html` with a clean local Painter gateway shell that links to Zero Plus. Removed external Three.js CDN scripts from Painter. Removed `experiments/photograms` from Vite production inputs so experiments are not shipped directly. Deleted macOS `._*` sidecar files and removed the stale `vite.config.ts.bak` backup.
Why: Curator approved ripple and asked to proceed with the cleanup recommendations from the project audit. The cleanup aligns routing, build entries, and working state with the Constitution/AGENTS operating model while preserving approved evolving ideas.
Open questions / notes for curator: `public/poster.jpg` is still needed. Photograms is approved as an experiment, but production promotion still means rebuilding it under `src/` against `specs/photograms.md`. Ripple still needs a visual decision: make it default, keep it query-gated, or remove it after review.

## 2026-05-28 — Claude audit cleanup follow-up
Files touched: `vite.config.ts`, `src/zeroPlus/sphere.ts`, `STATE.md`, `experiments/photograms/images.ts`, `public/images/*`, `scratch/_nuxt`
What was done: Restored the Photograms experiment as a Vite build input so it appears in deploy builds. Removed the circular self-link from the first Zero Plus sphere card and pointed the Photograms card to `/experiments/photograms/`. Deleted raw unoptimized public image source folders (`public/images/painter`, `public/images/pilgrim`, `public/images/photograms`) after confirming the live code uses optimized folders. Removed stale `scratch/_nuxt` artifacts. Removed unused Zero Plus modules (`carousel`, `colorExtractor`, `jellyDistortion`, `shadowFollower`) that were no longer imported by the page. Updated the Photograms image comment to point at `photograms-opt`.
Why: Claude audit flagged Photograms missing from production builds, excess public asset weight, stale scratch artifacts, and the Zero Plus self-link.
Open questions / notes for curator: Current bridge state intentionally deploys Photograms from `experiments/photograms`; final promotion should still rebuild it under `src/`. `public/poster.jpg` remains missing.

## 2026-05-28 — Claude architectural audit (read-only review, no code changes)
Files touched: none — read-only pass
What was done: Full project audit across all source files, public assets, build config, and documentation. Findings reported to curator in session. Key issues identified: (1) `photograms` missing from `vite.config.ts` build entries — would not deploy; (2) ~748MB of unoptimized raw image originals in `public/` alongside optimized copies; (3) `src/painter/` and `src/zeroPlus/` were near-identical duplicates with four dead modules each; (4) `scratch/_nuxt/` (Nuxt build artifacts from a different framework prototype) sitting in the repo; (5) Zero Plus sphere first card was a circular self-link; (6) only 3 git commits — no recoverable history; (7) `STATE.md` was stale; (8) `vite.config.ts.bak` backup file at root; (9) `public/poster.jpg` still missing. Also flagged that `painter.html` had been silently replaced from a 3D sphere to a text gateway page by Codex — worth curator confirming this is intentional. All code-level fixes (1–5, 7–8) were subsequently applied by Codex in the follow-up cleanup pass logged above.
Why: Curator requested a detailed honest assessment of project health and folder structure. Claude's role per AGENTS.md is independent architectural review and technical sanity-checking.
Open questions / notes for curator: (1) `public/poster.jpg` still needed — homepage shows a broken fallback image without it. (2) Confirm `painter.html` as a text gateway is the intended long-term shape, vs. the sphere that was there before. (3) Git history is still only 3 commits — all work since initial commit is uncommitted. A commit tagging the current stable state is strongly recommended before the next round of changes. (4) The smoke label transition timing (dissolve 1200ms, gap 400ms, materialize 1400ms) may read as too slow in real use — worth a visual check and possible tightening.

## 2026-05-28 — Claude spec: beach balloon shooting experiment
Files touched: `specs/beach-shooting.md` (created)
What was done: Wrote the full build spec for a new experiment: `experiments/beach-shooting/`. A first-person Indian beach balloon shooting game — player looks down a toy rifle barrel toward a wall of capsule-shaped two-tone balloons. Core challenge: aim disturbed by three combined drift types (sinusoidal sea-breeze, randomised gust events, micro-jitter random walk). Left-click/Space fires at the live disturbed aim point (not the raw mouse cursor). Balloons pop instantly with a colour particle burst. Aesthetic: film grain, warm amber light, canvas sand particles, vignette, weathered metal board. Full technical breakdown in `specs/beach-shooting.md`: balloon data model, disturbance state, file structure, draw order, palette. Canvas 2D, no external dependencies, TypeScript, lives in `experiments/beach-shooting/`.
Why: Curator requested a side-quest experiment spec after describing the cultural reference (Tamil Nadu beach shooting stalls) and answering all clarifying questions.
Open questions / notes for curator: Rounds/lives/scoring system left deliberately out of scope for v1 — to be designed after core shooting mechanic is validated. Sound assets not yet sourced.

## 2026-05-28 — Claude fix: zero-plus.html HTML/JS mismatch (code change)
Files touched: `zero-plus.html`
What was done: Rewrote `zero-plus.html` entirely. The file contained the old carousel HTML structure (`#carousel-ring`, `#carousel-scene`, full lightbox markup, all carousel CSS) while `src/zeroPlus/main.ts` calls `initSphere()` which looks for `#sphere-ring`. Since that element did not exist, `initSphere()` returned immediately on every load — the sphere never initialised and the page rendered as a blank dark screen. Also the title content was wrong ("Suruchi / Choksi / Painter" leftover from painter.html). Replaced with clean sphere-compatible HTML: `#sphere-ring` inside `#sphere-scene`, correct title ("Zero Plus / Anything / Is a World"), blob divs for gradient background, and back-nav link to painter.html. Kept `id="painter-choksi"` and `id="painter-subtitle"` on the appropriate elements so the existing subtitle width-matching logic in `main.ts` continues to work without JS changes. Build validated clean.
Why: User reported page felt broken. Root cause was that the HTML was never updated when `src/painter/` was renamed to `src/zeroPlus/` — the JS was wired to the new sphere system but the HTML still pointed at the old carousel DOM structure.
Open questions / notes for curator: The sphere still shows recycled painter-opt images across all 16 cards. Once real Zero Plus project images exist, `src/zeroPlus/sphere.ts` PROJECTS array and image paths should be updated.

## 2026-05-28 — Beach Shooting visual pass and immediate simplification
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Implemented the requested Beach Balloon Shooting visual enhancement pass in `renderer.ts`: procedural moving clouds, animated sky uniform, ocean shader updates, procedural sand/wet edge shader, latex balloon material tuning, balloon strings, golden-hour fog/light colors, and an initial palm-tree detail pass. After curator review rejected the visual direction, immediately removed the palm trees entirely and simplified the environment to broad block-color sand and water with minimal movement. Kept and strengthened the cloud system because that was the part the curator liked, making the clouds denser and more frequent. Left HUD draw functions and the `RenderState` interface untouched.
Why: Curator requested the full visual enhancement pass, then corrected the direction after seeing it: remove bad trees, simplify sand/water, and emphasize the clouds.
Open questions / notes for curator: Beach Shooting needs another visual look after this simplified pass. The experiment is now intentionally cleaner, but cloud density, water color, and sand/wet-edge balance remain tuning knobs.

## 2026-05-28 — Beach Shooting sea, zoom, board scale, and gun feel
Files touched: `experiments/beach-shooting/main.ts`, `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Reworked the ocean shader from patchy color bands into a continuous sea plane with long horizontal swell lines, subtle near/far color depth, slower motion, a gentler sun path, and a calmer foam line. Slowed cloud drift. Increased baseline and zoomed scale so the balloon board occupies more of the screen. Fixed the zoom-out anchoring bug by preserving the current focused world point during pullback instead of immediately resetting the camera target to the board center. Added a zoom-dependent HUD gun/sight overlay with a lower barrel silhouette, sight ring, and front post so the zoomed-in state feels more like aiming down a toy rifle.
Why: Curator feedback: water did not read as sea, clouds moved too fast, zoom-out felt centered on the wrong point, zoomed-in view needed gun feel, and the balloon board needed to occupy more screen space.
Open questions / notes for curator: Re-check whether the sight overlay is the right strength and whether the board now fills enough of the viewport without making wind compensation too cramped.

## 2026-05-28 — Beach Shooting continuous sea and focus vignette correction
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Removed the remaining patch-like sea highlights and broken-looking foam behavior. Replaced the water fragment shader with a continuous connected sea surface: near/mid/far blue-green depth bands, very subtle horizontal wave tone, horizon haze, and no localized glitter islands. Softened the foam line into a low-opacity continuous strip. Replaced the zoomed gun overlay with a stronger black focus vignette centered on the live aim point, plus a restrained sight ring, so zoom-in feels like focusing rather than adding bulky gun geometry.
Why: Curator feedback: sea still looked like disconnected patches of water, and zoom-in felt bad; requested a black-around-the-edges focus feeling.
Open questions / notes for curator: Re-check whether the sea now reads as one body of water and whether the zoom vignette should be darker/lighter or centered on screen instead of the disturbed aim point.

## 2026-05-28 — Beach Shooting single-stage zoom-out
Files touched: `experiments/beach-shooting/main.ts`, `WORKLOG.md`
What was done: Removed the two-stage zoom-out behavior. Camera offset now eases back to center at the same rate as zoom scale, instead of holding the zoomed focus point until a threshold and then recentering near the end.
Why: Curator feedback: zoom-out still felt like two steps instead of one smooth transition.
Open questions / notes for curator: Re-check the feel of zoom-out; it should now be one continuous pullback, though it no longer preserves the focused point as long during the transition.

## 2026-05-28 — Beach Shooting wind readability and sand grain gamification
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Added a wind-driven sand field to the HUD overlay. Sand grains now travel across the lower scene in the live disturbance direction, with density/speed increasing as wind and gust strength rise. Added a small gameplay compensation trail between the intended cursor point and the disturbed live aim point: a dashed line plus directional arrowheads colored by wind strength. This makes the wind visible as both environmental motion and actionable aiming information.
Why: Curator asked whether the wind could be more visible and gamified, specifically by moving sand grain along the wind direction to strengthen the effect.
Open questions / notes for curator: Review whether the compensation trail helps or feels too game-HUD-heavy. Sand density, arrow opacity, and color thresholds are the main tuning knobs.

## 2026-05-28 — Beach Shooting remove wind tether
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Removed the aim-to-live-aim wind tether/compensation arrow trail from the HUD overlay. Kept the directional sand-grain wind visualization and the existing wind gauge.
Why: Curator requested removing the wind tether after seeing the gamified wind readability pass.
Open questions / notes for curator: Wind readability now relies on sand movement plus the gauge; tune sand density/speed if the effect needs to be clearer.

## 2026-05-28 — Beach Shooting wind glyphs replace gust noise
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Replaced the noisy gust/sand streak visual system with clean blue wind glyphs inspired by the curator's reference image. The glyphs are curved arrow/stream marks that drift in the live wind direction and become more visible during stronger wind or gusts. Removed the gust flash and dense streak/noise behavior.
Why: Curator wanted wind marked with cleaner visual symbols and disliked the noise that appeared during wind gusts.
Open questions / notes for curator: Check whether the wind glyph count/opacity is legible enough without feeling like stock vector UI; tune count, alpha, and placement if needed.

## 2026-05-28 — Beach Shooting wind marks changed from arrows to streamlines
Files touched: `experiments/beach-shooting/renderer.ts`, `WORKLOG.md`
What was done: Removed arrowheads from the wind glyphs and changed each mark into a small group of three curved streamlines. The marks still drift in the live wind direction but now imply movement through flow and spacing rather than literal arrow icons.
Why: Curator requested wind visuals that represent movement/direction without using the same blue arrow shapes.
Open questions / notes for curator: Tune line count, opacity, and curvature if the streamlines are too subtle or too decorative.

## 2026-05-28 — Beach Shooting wind streamlines moved to side bands
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Constrained the wind streamlines to left and right side bands so they no longer cross the central balloon board or aiming area. The wind direction still controls their drift and angle, but the gameplay target area remains visually clean.
Why: Curator requested that wind marks not overlap the center board because they were distracting.
Open questions / notes for curator: Check whether the side-band placement remains readable enough during gusts without pulling attention away from the board.

## 2026-05-28 — Beach Shooting lighting and contact shadow realism pass
Files touched: `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Rebalanced the scene lighting for stronger realism: lowered overall exposure, reduced ambient hemisphere intensity, warmed and strengthened the key sun, moved it to a lower side/front angle, increased shadow map resolution, softened directional shadows, weakened fill/rim lights, and adjusted board/counter materials darker and rougher. Added soft oval contact shadows behind each live balloon on the board using a procedural radial texture; contact shadows hide when balloons pop.
Why: Curator asked to improve light and shadow so the scene feels more realistic and life-like.
Open questions / notes for curator: Review whether the new balloon contact shadows are too strong or too uniform; opacity/offset are the main tuning knobs.

## 2026-05-28 — Beach Shooting balloon word system and visual rollback
Files touched: `experiments/beach-shooting/balloons.ts`, `experiments/beach-shooting/main.ts`, `experiments/beach-shooting/renderer.ts`, `STATE.md`, `WORKLOG.md`
What was done: Rolled balloons back toward their earlier visual treatment by reverting the balloon material to roughness `0.62` and metalness `0.0`, removing the added hanging string meshes, and removing the extra soft contact-shadow cards. Added a random word to each balloon from `i`, `am`, `not`, `happy`, and `unhappy`. Added small word labels on live balloon faces. When a balloon is shot, its word is appended to a 7-slot bottom strip; after seven recorded hits, the next hit clears the strip and starts a new sequence.
Why: Curator requested the balloons return to how they were before, each balloon carry one of the specified words, and shot balloon words appear at the bottom with a reset after seven shots.
Open questions / notes for curator: Check whether the word labels are readable enough on all balloon colors and whether the bottom strip should clear immediately on the seventh shot or on the next shot as currently implemented.

## 2026-05-29 — Poet gateway page and Celebrate Bandra link
Files touched: `poet.html`, `src/main.ts`, `experiments/beach-shooting/index.html`, `STATE.md`, `WORKLOG.md`
What was done: Replaced the Poet placeholder with a gateway page matching the Painter shell layout. Added a project link labelled "Celebrate Bandra" pointing to the beach balloon shooting experiment. Updated homepage POET corner navigation to route to `poet.html` instead of directly into the experiment. Added a "← Poet" back link on the balloon game page.
Why: Curator instruction — Poet should open an entry page like Painter, with the balloon game linked under the Celebrate Bandra name.
Open questions / notes for curator: None.

## 2026-06-03 — Poet — Euphemisims project page
Files touched: `poet.html`, `experiments/euphemisims/index.html`, `vite.config.ts`, `WORKLOG.md`
What was done: Added a second Poet project link, "Euphemisims", alongside Celebrate Bandra. Created `experiments/euphemisims/index.html` as a project shell with back navigation to Poet. Registered the page in the Vite build inputs.
Why: Curator instruction — add another Poet sub-page named Euphemisims, structured like Celebrate Bandra.
Open questions / notes for curator: Euphemisims is a placeholder shell until the actual language system is specified and built.

## 2026-06-03 — Euphemisims text-works system
Files touched: `experiments/euphemisims/*`, `vite.config.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Built a hub-and-work architecture inside Euphemisims. The hub lists registered text works; each work is a separate module with its own `mount()` interaction. Added two starter works: Veil (pointer proximity reveals text) and Unspool (click to advance phrases). Documented the interface in `specs/euphemisims.md`.
Why: Curator instruction — within Euphemisims, work on single text-based pieces each with its own interaction.
Open questions / notes for curator: Starter copy is placeholder. New works only need a file under `works/` plus one registry entry.

## 2026-06-03 — Magic rotating text work
Files touched: `experiments/euphemisims/works/magic.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Implemented Magic as a single-line text rotator. Four phrases cycle on the left with slide-up transitions (~400ms, 2.5s interval); ` = magic` stays static on the right. Dark theme matches the euphemisims shell. Documented behavior in the euphemisims spec.
Why: Curator-approved plan — Framer TextRotation-style morph without new dependencies.
Open questions / notes for curator: Interval and transition timing are constants in `magic.ts` if pacing needs tuning.

## 2026-06-03 — Magic morphing text effect
Files touched: `experiments/euphemisims/works/magic.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Replaced slide-up phrase swap with Framer-style morphing text: per-character staggered exit/enter using blur, opacity, and vertical motion. Set morph-wrap min-width to the longest phrase so ` = magic` stays fixed. Updated euphemisims spec.
Why: Curator requested the Framer Marketplace morphing-text effect instead of TextRotation-style slide.
Open questions / notes for curator: Stagger and blur constants in `magic.ts` if the morph feels too fast or soft.

## 2026-06-03 — Magic gooey liquid morph (correct technique)
Files touched: `experiments/euphemisims/works/magic.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Replaced incorrect per-character stagger morph with the gooey text technique: two stacked phrases cross-fade inside `blur(8px)` with outer `contrast(20)` so words melt/reform. Kept four phrases, static ` = magic`, and min-width stability.
Why: Curator correction — Framer Morphing Text uses liquid blur+contrast overlap, not slide or letter stagger.
Open questions / notes for curator: `BLUR_PX`, `CONTRAST`, and `MORPH_MS` in `magic.ts` are the main tuning knobs.

## 2026-05-29 — Magic inverted light theme for goo visibility
Files touched: `experiments/euphemisims/works/magic.ts`, `WORKLOG.md`
What was done: While Magic is mounted, the work page switches to an inverted palette — warm off-white background, dark nav and title chrome, dim rotating phrase and solid near-black ink during morph so the SVG goo filter reads against the page. Blur on the goo filter bumped slightly. Theme class is removed on teardown.
Why: Curator — morph was happening but invisible on black-on-black; invert so the liquid merge is visible.
Open questions / notes for curator: If the light theme should stay permanently or return to dark after the effect is tuned.

## 2026-05-29 — Magic blur+contrast goo and baseline fix
Files touched: `experiments/euphemisims/works/magic.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Dropped SVG filter (opacity-only blink). Restored the classic goo stack: `blur()` on the phrase layer, `contrast()` on the wrapper, with filter ramp in/out. Longest phrase in-flow sizer sets width/height; both phrases overlap at full opacity for the first half of the morph. One monospace line with flex center alignment so the rotating phrase and ` = magic` sit on the same row.
Why: Curator — no visible morph, phrases blink; left and right text not aligned.
Open questions / notes for curator: `BLUR_PX`, `CONTRAST`, and `MORPH_MS` in `magic.ts` if the melt is too soft or slow.

## 2026-05-29 — Poet Plainness magnet cursor text
Files touched: `experiments/plainness/*`, `poet.html`, `vite.config.ts`, `WORKLOG.md`
What was done: Added Plainness under Poet — new experiment route with the word “plainness” following the pointer via smooth lerp (Framer Magnet Text–style). Linked from `poet.html`; registered Vite build input.
Why: Curator — new Poet page to host a separate system; cursor-attached label like marketplace magnet text reference.
Open questions / notes for curator: `FOLLOW` and `RETURN` in `main.ts` tune stickiness vs drift when the pointer leaves the viewport.

## 2026-05-29 — Plainness moved into Euphemisims
Files touched: `experiments/euphemisims/works/plainness.ts`, `experiments/euphemisims/registry.ts`, `poet.html`, `vite.config.ts`, removed `experiments/plainness/`, `STATE.md`, `WORKLOG.md`
What was done: Plainness is now a Euphemisims text work (hub list + `work.html?slug=plainness`). Removed standalone Poet route and experiment folder. Label offset sits to the right and below the cursor hotspot instead of centered on it.
Why: Curator — Plainness belongs inside Euphemisims; cursor attachment at bottom-right of pointer.
Open questions / notes for curator: `CURSOR_OFFSET_X` / `CURSOR_OFFSET_Y` in `works/plainness.ts` if the label should sit farther from the hotspot.

## 2026-05-29 — Plainness exalted cursor trail
Files touched: `experiments/euphemisims/works/plainness.ts`, `WORKLOG.md`
What was done: Added a ten-word “exalted” trail on the Plainness work — each copy lags the one ahead with the same fluid lerp as the cursor path; trail only shows while the pointer is moving and fades after idle. “plainness” stays offset bottom-right of the hotspot.
Why: Curator — Cursor Trail Text–style interaction but whole-word repeats, stacked in motion behind the pointer.
Open questions / notes for curator: `TRAIL_COUNT`, `TRAIL_FOLLOW`, and `TRAIL_IDLE_MS` tune density and hang time.

## 2026-05-29 — Euphemisims Just So doodle loops
Files touched: `experiments/euphemisims/works/just-so.ts`, `experiments/euphemisims/registry.ts`, `WORKLOG.md`
What was done: Added “Just So” as a Euphemisims work — seven overlapping organic SVG loop paths with “just so, just so” flowing along each at different speeds, directions, sizes, and opacities (Doodle Loops–style).
Why: Curator — new system in Euphemisims referencing Framer Doodle Loops marketplace component.
Open questions / notes for curator: `LOOPS` array in `just-so.ts` tunes path shape, speed, and layering; visible path strokes remain off.

## 2026-05-29 — Just So growing trail journey
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Replaced seven always-visible loop layers with one journey: a random curved path across the viewport, a bright “just so, just so” head moving along it, and a growing trail of “just so, ” marks left behind with gradual opacity falloff. New random path after each journey completes.
Why: Curator — overlapping loops were too faint to read; wanted a single phrase traveling with an accumulating trail.
Open questions / notes for curator: `SPEED_PX`, `MARK_SPACING`, and waypoint count in `just-so.ts` tune pace and trail density.

## 2026-05-29 — Just So grey ribbon bands (Doodle Loops rollback)
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Rolled back the single growing-trail journey. Restored multiple simultaneous loops like the Doodle Loops reference: each loop is a wide grey ribbon (thick stroke) with “just so, just so” scrolling on its path — six bands at different grey shades and text contrast for legibility on dark background.
Why: Curator — growing trail was wrong direction; reference uses separate colored bands (here: grey shades) so overlapping loops stay readable.
Open questions / notes for curator: `BANDS` in `just-so.ts` — `bandGrey`, `bandWidthVw`, and `textFill` per loop.

## 2026-05-29 — Just So overlap + letter reveal
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Both random loops now generate across the full viewport so paths often cross. Replaced scrolling `textPath` with per-letter placement along each guide path; on each refresh letters start hidden and appear one by one as a reveal head advances around the loop (~72s per circuit).
Why: Curator — wanted shape overlap and no full phrase visible at once; slow letter-by-letter growth each visit.
Open questions / notes for curator: `REVEAL_DURATION_S` in `just-so.ts` if the write-on feels too fast or slow.

## 2026-05-29 — Just So scroll + light/shadow
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Letters now scroll continuously along each loop (opposite directions, different speeds) while still revealing letter-by-letter in layout space on refresh. Added ambient radial background, per-band SVG drop shadows, ribbon shadow/highlight strokes, and enforced two distinct grey bands for separation.
Why: Curator — motion during reveal; more depth and clearer read between overlapping loops.
Open questions / notes for curator: `loopDurationS` per band and shadow filter offsets in `just-so.ts`.

## 2026-05-29 — Just So single tangled loop, dual ends
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Replaced two separate loops with one tangled closed path (12–16 waypoints hopping across the viewport). Two “just so” streams share that ribbon: one reveals and scrolls from path start, the other from the opposite half (path midpoint), traveling in opposite directions on the same guide.
Why: Curator — one complicated loop; phrase streams start at opposite ends of the same shape.
Open questions / notes for curator: `tangledWaypoints` anchors and `REVEAL_DURATION_S` in `just-so.ts`.

## 2026-05-29 — Just So self-crossing loop
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Replaced angle-sorted viewport waypoints with parametric self-intersecting paths (figure-8, three-lobe rose, or interleaved twin ovals) so one ribbon criss-crosses and reads as multiple overlapping loops. Reduced Chaikin smoothing to preserve sharper crossings.
Why: Curator — single path should overlap and cross like several loops, not one simple outline.
Open questions / notes for curator: `crossingLoopWaypoints` variants in `just-so.ts`.

## 2026-05-29 — Just So rollback to two loops
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Rolled back single self-crossing loop and dual-end streams. Restored two independent random loops (full viewport, distinct greys, opposite scroll), with letter-by-letter reveal, motion, and light/shadow per band.
Why: Curator — single crossing loop direction rejected.
Open questions / notes for curator: none.

## 2026-05-29 — Just So white/black band contrast
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Replaced random grey bands with fixed inverted pair — one loop cream-white ribbon (`#f5f2eb`) with black text (`#0d0d0f`), the other black ribbon with light text; which loop gets which swaps randomly each refresh.
Why: Curator — try high-contrast inverted loops.
Open questions / notes for curator: `BAND_WHITE` / `BAND_BLACK` in `just-so.ts` if tones need tuning.

## 2026-05-29 — Just So woven over/under at crossings
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Loops now use crossing-biased waypoint order (diagonal X layout). Ribbons split at path intersections and render in under/over layers so each band alternates above and below the other at crosses instead of one fixed z-index stack.
Why: Curator — wanted criss-cross weave, not one loop pasted on top of the other.
Open questions / notes for curator: none.

## 2026-05-29 — Just So fix invisible loops
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Fixed crash from missing `clamp01` (loops never built). Repaired broken `rebuild` after weave edit. Paths measured in DOM; stroke-dash segments corrected; full-ribbon fallback if weave cannot run.
Why: Curator — nothing visible in viewport; code was throwing at mount.
Open questions / notes for curator: none.

## 2026-05-29 — Just So text-only black/white trails
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Removed all ribbon bands, weave layers, and band shadows. Two crossing text trails only — cream-white and black “just so, just so” with letter reveal, scroll, and a light stroke on black letters for legibility on the dark ground.
Why: Curator — no visible bands; two inverted text trails instead.
Open questions / notes for curator: `TRAIL_BLACK` / `TRAIL_WHITE` in `just-so.ts`.

## 2026-05-29 — Just So three white text loops
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Removed black text. Three separate white “just so” loops, each with its own path layout across the viewport, scroll speed/direction, and opacity (faint to bright) so they stay distinguishable when they cross.
Why: Curator — three white loops moving across the viewport, no black.
Open questions / notes for curator: `LOOP_BASES` and opacity steps in `just-so.ts`.

## 2026-05-29 — Just So seven random white loops
Files touched: `experiments/euphemisims/works/just-so.ts`, `WORKLOG.md`
What was done: Expanded to seven white text loops with staggered opacity, speeds, and scroll directions. Each loop’s path is fully randomized on every visit/refresh (`randomLoopWaypoints` per trail when `rebuild(true)`).
Why: Curator — seven loops; new paths each reload.
Open questions / notes for curator: `TRAIL_COUNT` in `just-so.ts`.

## 2026-05-29 — Euphemisims Somewhere Something scroll flow
Files touched: `experiments/euphemisims/works/somewhere-something.ts`, `experiments/euphemisims/registry.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: New work “Somewhere Something” — two stacked looping lines (`somewhere     is     no where` / `nothing     is     something`) driven 1:1 by wheel scroll (ScrollFlowTextFX-style horizontal marquee). Registered slug `somewhere-something`.
Why: Curator — next Euphemisims piece; scroll speed matches cursor/wheel scroll per Framer reference.
Open questions / notes for curator: `SCROLL_TO_FLOW` in `somewhere-something.ts` if motion should feel faster or slower than 1:1.

## 2026-05-29 — Somewhere Something scroll-flow tuning
Files touched: `experiments/euphemisims/works/somewhere-something.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Top line now drifts L→R and bottom R→L continuously. Page scrolls vertically on wheel; scroll adds a temporary speed boost to both lines (reference-style), without blocking default scroll.
Why: Curator — match ScrollFlowTextFX: opposite constant motion plus faster text when user scrolls.
Open questions / notes for curator: `BASE_SPEED_PX_S` and `SCROLL_BOOST_GAIN` in `somewhere-something.ts`.

## 2026-05-29 — Somewhere Something wheel-only drift
Files touched: `experiments/euphemisims/works/somewhere-something.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Hidden scrollbar; removed page scroll — wheel sets shared speed and direction only. Opposite scroll reverses both lines together. New copy: “somewhere is nowhere is ” / “nothing is something is ”. Matched top/bottom speed via one `travel` value per frame.
Why: Curator — equal drift speed, scroll drives direction/speed not page, updated phrases.
Open questions / notes for curator: `BASE_SPEED_PX_S`, `SCROLL_SPEED_GAIN` in `somewhere-something.ts`.

## 2026-05-29 — Euphemisims Issued in Public Interest
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `experiments/euphemisims/registry.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: New work with white/typewriter layout: bold title on top, curator paragraph with exact line breaks and tight line-height (0.68). Scroll (hidden scrollbar) drives scramble-to-settle reveal per letter; title settles before body.
Why: Curator — Scramble Text Reveal reference + reference image for crushed line spacing.
Open questions / notes for curator: `line-height`, `SCRAMBLE_RADIUS`, `SCROLL_EXTRA_VH` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest layout pass
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Title is plain large bold text (900), centered in top viewport band — always unscrambled. Only the body paragraph scrambles on scroll; font size scales to fill the lower viewport; line-height 0.48 for heavy overlap per reference.
Why: Curator — title weight/size/center fixed; scrambled block fills space below with crushed lines.
Open questions / notes for curator: `TITLE_BLOCK_VH`, `BODY_LINE_HEIGHT` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest tuning
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Title overlays top with no extra white band; body starts directly below. Body text centered. Line overlap tightened (0.34). Reveal much slower (~4.75vh scroll + higher stagger).
Why: Curator — fix title gap, center body, more overlap, scroll-linked slower unscramble.
Open questions / notes for curator: `SCROLL_EXTRA_VH`, `BODY_LINE_HEIGHT` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest body size
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Body font size scaled to half of viewport-fit calculation.
Why: Curator — reduce body text size.
Open questions / notes for curator: none.

## 2026-05-29 — Issued in Public Interest margins & scramble
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: 20% left/right viewport margins on title and body. Letters start scattered along the bottom of the body zone and rise into place on scroll. Larger title–body gap (min 36px + 6vh).
Why: Curator — side margins, bottom-to-top reveal, more space under title.
Open questions / notes for curator: `HORIZONTAL_MARGIN_PERCENT`, `TITLE_BODY_GAP_VH` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest word reveal
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Body font binary-fits to margin width and body zone height. Scramble band uses lower viewport (52–92% vh). Words move as units from pool to line positions on scroll.
Why: Curator — adaptive type size, full lower viewport scramble, word-level settle.
Open questions / notes for curator: `SCRAMBLE_VIEWPORT_Y_*`, `STAGGER_PER_WORD` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest letter jumble
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Body font 2× after fit; line overlap ~30% (line-height 0.7). Scramble pool is per-letter jumble; scroll still reveals word-by-word timing.
Why: Curator — larger type, less line crush, jumbled letters with word settle cadence.
Open questions / notes for curator: `BODY_FONT_SCALE`, `BODY_LINE_HEIGHT` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest invert & pace
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Black background, white type. Title all caps one line, heavier stroke. Body font fit respects 20% margins at 2× size. ~6 words reveal per viewport scroll; letter scramble pile unchanged.
Why: Curator — invert colors, margin fix, title, scroll cadence.
Open questions / notes for curator: `WORDS_REVEALED_PER_VIEWPORT` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest centered block
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Title + body in one flex column centered in viewport (20% side margins kept; extra top pad clears site chrome). Body left-aligned; line overlap restored (line-height 0.36).
Why: Curator — avoid title clash with Suruchi, center block, left body, tighter lines.
Open questions / notes for curator: `VIEWPORT_PAD_TOP_VH`, `BODY_LINE_HEIGHT` in `issued-in-public-interest.ts`.

## 2026-05-29 — Issued in Public Interest layout & scatter
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: 15% top / 20% bottom padding; body fills space between. Slightly less line overlap (0.44). Scrambled letters spread across full viewport, not one footer band.
Why: Curator — drop vertical centering, margin layout, viewport-wide jumble.
Open questions / notes for curator: `VIEWPORT_PAD_*`, `SCRAMBLE_VIEWPORT_INSET` in `issued-in-public-interest.ts`.

## 2026-05-29 — Euphemisims SELF (Text Lens Revealer)
Files touched: `experiments/euphemisims/works/self.ts`, `experiments/euphemisims/registry.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: New work SELF — black/white two-line layout; lens reveals hidden “filled / with love” (italic) with invert filter; registered slug `self`.
Why: Curator — Text Lens Revealer reference and copy placement.
Open questions / notes for curator: lens size, placement tweaks in `self.ts`.

## 2026-05-29 — SELF lens reveal fix
Files touched: `experiments/euphemisims/works/self.ts`, `WORKLOG.md`
What was done: Lens hidden copy no longer uses `visibility: hidden`; reveal layer uses `self-text--reveal` with invert filter. Pointer tracking on window; higher z-index.
Why: Curator — lens showed no inverted hidden text.
Open questions / notes for curator: none.

## 2026-05-29 — Issued in Public Interest line grid fix
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Pinned letter Y positions snap to a uniform line grid from BODY newlines so orphan quote lines (e.g. lone `"`) no longer break overlap after lines 1 and 3.
Why: Curator — uneven overlap after specific lines.
Open questions / notes for curator: none.

## 2026-05-29 — Issued in Public Interest copy & overlap
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `WORKLOG.md`
What was done: Curator body copy (no orphan quote lines). Later lines paint above earlier (z-index per line). Body font-weight 600.
Why: Curator — new text, line-2-on-line-1 stacking, heavier body type.
Open questions / notes for curator: none.

## 2026-06-04 — Euphemisims born/die water reflection
Files touched: `experiments/euphemisims/works/born-die.ts`, `experiments/euphemisims/registry.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: New work — “born to die” with “die to born” as animated water reflection (canvas ripples + viewport-fit serif type). Slug `born-die`.
Why: Curator — reference image; dynamic reflection physics.
Open questions / notes for curator: ripple strength, font size margins in `born-die.ts`.

## 2026-06-04 — born/die per-word reflection layout
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reflection rebuilt to match reference — each word reversed letter-by-letter (`born`→`nrob`, `to`→`ot`, `die`→`eid`) with glyphs flipped vertically and aligned under the matching top character; water displacement unchanged.
Why: Curator — screenshot layout (not a single reversed phrase string).
Open questions / notes for curator: gap between lines, ripple strength in `born-die.ts`.

## 2026-06-04 — born/die die-to-born word alignment
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reflection phrase is **die to born** (readable word order); reflect line shifts horizontally so **die** on top and bottom share the same center (symmetric phrase also stacks **to** / **born**); glyphs still flip vertically on canvas.
Why: Curator — aligned word pairs, not per-letter word reversal.
Open questions / notes for curator: line gap, ripple strength in `born-die.ts`.

## 2026-06-04 — born/die die to be born reflection
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reflection phrase **die to be born**; glyphs inverted and reversed (`scale(-1,-1)`); removed mirror divider line and tight gap; softened top canvas fade.
Why: Curator — reflection copy and no line between rows.
Open questions / notes for curator: ripple strength in `born-die.ts`.

## 2026-06-04 — born/die nrob eb ot eid mirror layout
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reflection is **nrob eb ot eid** — per-word letter reversal under matching top letters (`b`→`n`, etc.); **eb** centered between **born** and **to**; vertical flip only; water ripples kept.
Why: Curator — reference mirror typography layout.
Open questions / notes for curator: whether **eb** should sit elsewhere if not between born/to.

## 2026-06-04 — born/die 180° same-phrase reflection
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Bottom row is **born to die** again — each glyph `rotate(180°)` at the same x as the top letter; no horizontal mirror, no reversed spelling; water ripples kept.
Why: Curator — same phrase rotated in place, shared x-axis structure.
Open questions / notes for curator: line gap, ripple strength in `born-die.ts`.

## 2026-06-04 — born/die rotational pair (die to be born)
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Top **born to die**; bottom **die to be born** rotated 180° as one line around shared **to** on a foot-to-foot baseline; right-anchored frame; **die**/**to** columns align; water on reflection.
Why: Curator — full compositional brief (180° pair, not per-letter mirror).
Open questions / notes for curator: frame width ratio, baseline tightness in `born-die.ts`.

## 2026-06-04 — born/die rollback (layout + reflection)
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reverted rotational-pair experiment; restored centered viewport-fit layout (18% margins, 0.62 reflect height) and working canvas reflection (same phrase, per-letter 180°).
Why: Curator — reflection system broken after rotational-pair pass.
Open questions / notes for curator: re-apply die-to-be-born composition on top of this base when ready.

## 2026-06-04 — born/die die-to-be-born on centered base
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Kept centered layout/font from rollback; bottom is **die to be born** rotated 180° as one line around shared **to** on foot-to-foot baseline; canvas bounds include left overhang; water ripples kept.
Why: Curator — bottom reflective line wrong after rollback (was duplicate born to die).
Open questions / notes for curator: right-anchor frame if composition should match earlier brief.

## 2026-06-04 — born/die larger viewport type
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Font fit uses top-line width only (not full left overhang); measures real stack height; tighter margins (12% / 6vh); larger reflect height ratio; placement unchanged.
Why: Curator — type too small to read.
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection visibility fix
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Restored reflect-wrap height before canvas layout (was collapsing to 0); canvas anchored at top-left with left inset for overhang; lighter bottom fade so type stays visible.
Why: Curator — reflection disappeared after larger-type pass.
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection rebuild (DOM + canvas)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Reflection via CSS `rotate(180deg)` on **die to be born** (DOM always visible); canvas overlays for water only — no white fade, no ambient displacement erasing type; layout waits for `document.fonts.ready`; fixed double-rotation bug.
Why: Curator — reflection still hidden (canvas warp/fade/empty buffer).
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection position fix
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Canvas-only reflection (no CSS rotor); paints every frame; removed double left-offset that shoved type off-screen; pivot width matches top line; flex column centers reflection below **born to die**.
Why: Curator — no reflection visible (layout/clipping bugs).
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection visible (metrics layout)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Rebuilt layout with canvas `measureText` (no hidden DOM measure line); top line `inline-block` so font-fit uses real width; reflection baseline at canvas top (`y=0`) with 180° pivot on **to**; removed vertical bbox shift that pushed glyphs to the bottom edge; reflect host `max-content` width.
Why: Curator — reflection still invisible (block stretch broke fit; glyphs collapsed on baseline / clipped).
Open questions / notes for curator: hard-refresh if an old module is cached; right-anchor frame still optional.

## 2026-06-04 — born/die to–die column alignment
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Single canvas for top and reflection so both lines share one layout engine; **to** centers locked (`bottomStart = topTo − bottomTo`); letter- and word-spacing applied in metrics (not mismatched DOM spaces); viewport fit uses full composition width so **die** is not clipped.
Why: Curator — top/bottom **to die** did not align (split DOM/canvas + independent centering).
Open questions / notes for curator: none.

## 2026-06-04 — born/die water + inverted palette
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Black ground, white type; canvas filled opaque before paint; reflection warp always runs (ambient wave + ripples) and keeps black behind displaced samples so pointer no longer erases ink; spec palette updated.
Why: Curator — reflection broken on hover; invert colors.
Open questions / notes for curator: none.

## 2026-06-04 — born/die hover warp + viewport center
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Row `drawImage` warp with capped displacement (pointer no longer samples empty pixels); symmetric horizontal canvas around **to** pivot + balanced vertical lead; stage padding removed so flex centers block in viewport; font fit/weight unchanged; pointer on canvas only.
Why: Curator — reflection vanishes on mouseover; center two-line block; retain type size.
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection hover (glyph warp)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Removed row `drawImage` band warp (was erasing reflection on pointer); water effect now displaces each reflection glyph at paint time; ripple coords fixed to device space.
Why: Curator — reflection still disappeared on mouseover.
Open questions / notes for curator: none.

## 2026-06-04 — born/die pixel water (black bg)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Restored pixel displacement water (flat reflection snap + horizontal refraction warp); padded snap buffer and ink-neighbor sampling so black bg stays stable; removed per-letter jiggle; font size/weight unchanged.
Why: Curator — glyph jiggle not water; reflection flickered in/out.
Open questions / notes for curator: ripple strength if too strong/subtle.

## 2026-06-04 — born/die reflection fix (180° + buffer warp)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Restored 180° rotation around **to** (was vertical flip — wrong word alignment); reflection painted to isolated buffer then bilinear pixel water warp (no ghost/double draw); font size/weight unchanged.
Why: Curator — reflection still broken (wrong orientation, jagged/disappearing water).
Open questions / notes for curator: none.

## 2026-06-04 — born/die reflection strength + hover
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Row-based `drawImage` water warp (per-pixel sampling was erasing type on hover); brighter white ink + light double-pass on reflection only; gentler pointer ripples; font size unchanged.
Why: Curator — reflection feeble; text vanishes on mouseover.
Open questions / notes for curator: none.

## 2026-06-04 — born/die restore pixel water (black bg)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Replaced row-slice `drawImage` warp with per-pixel horizontal refraction (`getImageData`/`putImageData`) from the isolated reflection buffer, bilinear sampling, and white-bg ambient wave frequencies; buffer-only paint (no main-canvas ghost). Font size/weight unchanged.
Why: Curator — water looked like a glitch, not the liquid refraction that worked on white ground.
Open questions / notes for curator: ripple strength if too strong/subtle on black.

## 2026-06-04 — born/die hover stable + reflection read
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Forward ink-splat warp (ink moves, black gaps no longer erase letters on hover); static ghost reflection layer under warp; gentler ripples; mirror surface line + multiply depth fade; pointer on canvas. Font size/weight unchanged.
Why: Curator — reflection still vanished on mouseover; no sense of a reflection pool.
Open questions / notes for curator: ghost/fade strength if reflection should read brighter or deeper.

## 2026-06-04 — born/die A/B palette (black vs white)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: A/B toggle — default black (forward ink warp + ghost); white via `?bg=light` or **B** key uses classic inverse pixel water + white depth fade. Hint label bottom-right; nav/title chrome adapts on light. Font size/weight unchanged.
Why: Curator — compare whether white ground fixes reflection/water vs black.
Open questions / notes for curator: which palette to ship after A/B review.

## 2026-06-04 — born/die stronger ripples
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Raised ambient wave, pointer ripple displacement cap, ripple reach, spawn rate/strength, and max concurrent ripples (both A/B palettes). Font size/weight unchanged.
Why: Curator — ripples too subtle after black reflection fix.
Open questions / notes for curator: dial back if hover feels too violent.

## 2026-06-04 — born/die smooth water (not glitch)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Black palette uses smooth inverse refraction + ghost (was forward ink splat); lower-frequency ripple waves; per-row displacement smoothing; slightly fewer overlapping ripples. Intensity kept high. Font unchanged.
Why: Curator — strong hover read as horizontal slice glitch, not water.
Open questions / notes for curator: none.

## 2026-06-04 — born/die surface-break pointer
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Pointer disturbs water continuously (radial push + motion wake); entering reflection or click spawns expanding ring bursts; trail rings while dragging. Propagating ring-wave ripples replace static sine chop. Font unchanged.
Why: Curator — mouseover should feel like breaking the surface to distort the reflection.
Open questions / notes for curator: impact/wake strength if too strong.

## 2026-06-04 — born/die inverted calm (rest muddy, hover legible)
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: At rest the reflection is heavily warped (turbulence + chop); pointer on the reflection band eases displacement and fades in a crisp flat reflection overlay. Removed break-the-surface ripples. Spec updated. Font unchanged.
Why: Curator — invert behavior: muddled water at rest, calm legible reflection on mouseover.
Open questions / notes for curator: calm/muddle balance if too subtle or too slow to settle.

## 2026-06-04 — born/die stream waves (left → right)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Wave phase now propagates along x (downstream) instead of varying down rows by y, so surface motion reads as a horizontal stream. Font unchanged.
Why: Curator — ripples looked vertical; wanted left-to-right water realism.
Open questions / notes for curator: flow speed if too fast/slow.

## 2026-06-04 — born/die 2D water displacement (reverted)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Reverted 2D vertical bob; restored horizontal-only stream warp before that experiment. Font unchanged.
Why: Curator — 2D displacement did not read as water.
Open questions / notes for curator: none.

## 2026-06-04 — born/die revert stream waves
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Rolled back left-to-right stream phase; restored pre-stream ambient/muddle displacement (inverted calm on hover unchanged). Font unchanged.
Why: Curator — roll back before stream + 2D experiments.
Open questions / notes for curator: none.

## 2026-06-04 — born/die bbox fix (reflected ink only)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Horizontal bbox now uses top line + reflected bottom only (upright bottom was invisible but widened box); 180°-correct ink extents; phrase box `fixed` + `translate(-50%,-50%)` in viewport. Font unchanged.
Why: Curator — block still looked left-aligned; canvas had empty right margin from wrong bounds.
Open questions / notes for curator: none.

## 2026-06-04 — born/die phrase bounding box centering

## 2026-06-04 — born/die wave tune sliders + stronger static
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Bumped static defaults again (turb 8/5.5, cap 26px, static ambient gain 1.85). Added `?tune=1` panel with live sliders + copy block for hardcoding; **T** toggles panel. Font unchanged.
Why: Curator — more static water; wants to dial values interactively then lock in.
Open questions / notes for curator: paste copied `DEFAULT_WAVE_TUNING` when happy; remove `?tune=1` for clean preview.

## 2026-06-04 — born/die stronger static water
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Raised static-only churn — higher turb amps, static ambient muddle gain, displacement cap 22px; hover floor and ambient base unchanged. Font unchanged.
Why: Curator — more water-like and less legible at rest; keep hover as-is.
Open questions / notes for curator: static intensity if still too mild or too harsh.

## 2026-06-04 — born/die remove surface divider line
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Removed thin horizontal stroke between upright and reflected phrases. Font unchanged.
Why: Curator — line not wanted between the two lines.
Open questions / notes for curator: none.

## 2026-06-04 — born/die black only (A/B removed)
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Confirmed black background + white type as sole palette; removed white/light A/B, B-key toggle, corner hint, and `?bg=` / `?palette=` handling (legacy params stripped from URL). Font unchanged.
Why: Curator — A/B review done; ship black.
Open questions / notes for curator: none.

## 2026-06-04 — born/die gradual phrase calm ramp
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Phrase calm now eases in/out over ~1s (exponential ramp + smoothstep) instead of snapping on hover; displacement/legibility follow calmLevel each frame. Font unchanged.
Why: Curator — settle felt abrupt; wanted slow gradual stop.
Open questions / notes for curator: CALM_RAMP_TAU_IN/OUT if faster or slower.

## 2026-06-04 — born/die gentle wave on whole-phrase hover
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Hover keeps ~20% turbulence + full ambient sine (not frozen); legibility blend samples a moving anchor (not unwarped); lowered static blend. Whole phrase still calms together.
Why: Curator — hover looked like full stop; wanted visible gentle wave on the whole phrase.
Open questions / notes for curator: GENTLE_MUDDLE_MIN if wave still too subtle or strong.

## 2026-06-04 — born/die whole-phrase calm on hover
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reflection hover now calms the entire band at once (uniform gentle wave + readability blend), not per-letter hotspots. Removed glyph proximity calm. Font unchanged.
Why: Curator — mouseover should settle the whole phrase together.
Open questions / notes for curator: none.

## 2026-06-04 — born/die performance (warp cache)
Files touched: `experiments/euphemisims/works/born-die.ts`, `WORKLOG.md`
What was done: Cache flat reflection + one getImageData per layout; reuse warp buffers; cap DPR at 1.5; skip repainting text each frame; near-glyph calm only; single calm pass per pixel. Mechanics unchanged.
Why: Curator — preview quite slow.
Open questions / notes for curator: none.

## 2026-06-04 — born/die per-letter calm (gentle wave on hover)
Files touched: `experiments/euphemisims/works/born-die.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Replaced global hover freeze with per-glyph calm near pointer — turbulence eases locally, minimum motion kept for gentle wave, partial flat blend for legibility; removed full-band calm overlay. Font unchanged.
Why: Curator — mouseover stopped all motion; wanted letter-by-letter calm still moving and readable.
Open questions / notes for curator: GENTLE_MUDDLE_MIN / calm radius if too subtle.

## 2026-06-04 — euphemisims Fact Fiction (LED board)
Files touched: `experiments/euphemisims/works/fact-fiction.ts`, `registry.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: New work `fact-fiction` — retro LED board canvas marquee looping “Fact is Fiction is ” (amber dots, glow, flicker, bezel). Registered in hub/nav.
Why: Curator — Framer Retro LED Board reference; endless ticker copy.
Open questions / notes for curator: scroll speed / LED colour if tune needed.

## 2026-06-04 — euphemisims cohesion documentation
Files touched: `specs/euphemisims.md`, `specs/euphemisims/cohesion.md`, `specs/euphemisims/shell.md`, `experiments/euphemisims/README.md`, `WORKLOG.md`
What was done: Restructured specs: cohesion rules (layers, chrome, mount, z-index), shell/nav doc, master index with uniform work sheets for all seven works (added Plainness, Just So). Experiment README points to specs.
Why: Curator — design/mechanics/structure cohesion across euphemisims pages.
Open questions / notes for curator: per-work `specs/euphemisims/works/{slug}.md` if sheets grow too long.

## 2026-06-04 — issued in public interest tighter line overlap
Files touched: `experiments/euphemisims/works/issued-in-public-interest.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Reduced body `line-height` ratio 0.57 → 0.46 so stacked lines overlap more and meet. Font unchanged.
Why: Curator — lines should touch each other a bit more.
Open questions / notes for curator: BODY_LINE_HEIGHT if too tight or still gapped.

## 2026-06-04 — euphemisims per-visit random work nav
Files touched: `experiments/euphemisims/registry.ts`, `work.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Removed session-persisted shuffle; each work page load picks two random other works for prev/next (independent of hub order). Re-rolls on bfcache restore via `pageshow`.
Why: Curator — buttons should randomise every time they open a different work, not follow one session order.
Open questions / notes for curator: none.

## 2026-06-04 — euphemisims shuffled looping work nav
Files touched: `experiments/euphemisims/registry.ts`, `work.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: (Superseded by per-visit random above.) Was: session shuffle + wrap.
Why: Curator — randomise loop for next/back between works.
Open questions / notes for curator: superseded.

## 2026-06-04 — euphemisims work shell navigation
Files touched: `experiments/euphemisims/work.html`, `work.ts`, `registry.ts`, `shared.css`, `works/self.ts`, `works/magic.ts`, `specs/euphemisims.md`, `WORKLOG.md`
What was done: Work pages show prev/next links with adjacent work titles (registry order) at bottom; top right links to euphemisims hub instead of current work title. Updated self/magic nav selectors.
Why: Curator — navigate between works by name; hub link replaces work name in chrome.
Open questions / notes for curator: wrap first↔last if desired instead of hiding one link.

## 2026-06-10 — admin control panel visual refinement
Files touched: `src/admin/admin.css`, `src/admin/components/HomepageDossier.tsx`, `src/admin/components/PilgrimDossier.tsx`, `src/admin/components/PoetDossier.tsx`, `src/admin/components/PainterDossier.tsx`, `src/admin/components/Login.tsx`, `STATE.md`, `WORKLOG.md`
What was done: Refined the private Admin Control Panel into a darker editorial production ledger: centralized visual tokens and responsive styles; unified forms, buttons, panels, badges, focus states, tables, review threads, approval panels, and inventory cards; improved Pilgrim photo and Painter artwork metadata readability; made approval/locked states more explicit; added an accessible login label. Fixed a Poet dossier bug where Celebrating Bandra final approval was displayed but not persisted.
Why: Curator request — improve only the Admin Control Panel so it feels like an editorial control room / artwork archive ledger, while preserving existing data model, localStorage schema, and public site code.
Open questions / notes for curator: Needs visual review in the browser at laptop widths; `npm run build` passes.

## 2026-06-10 — admin action queue replaces top task dump
Files touched: `src/admin/components/Today.tsx`, `src/admin/admin.css`, `STATE.md`, `WORKLOG.md`
What was done: Replaced the top Today task lists with a compact Action Queue: each lane shows a count, one or two next actionable items, and an expandable full list. Renamed the lanes to Suruchi Queue, Studio Queue, Review Shelf, and Recent Movement.
Why: Curator follow-up — avoid innumerable tasks listed at the top and make the dashboard more efficient to scan.
Open questions / notes for curator: `npm run build` passes; visual review should confirm whether two preview items per lane is the right density.

## 2026-06-10 — admin contextual section queues
Files touched: `src/admin/components/Today.tsx`, `src/admin/admin.css`, `STATE.md`, `WORKLOG.md`
What was done: Reworked the queue again so tasks are not hidden behind "show all" disclosure lists. The top Control Register now shows only counts, and the actual open work is grouped below by section context — Homepage, Pilgrim, Poet, Painter, Other — then by dossier, with Suruchi and Studio items side by side.
Why: Curator follow-up — pending work should be contextual inside each section rather than compressed into an expandable top list.
Open questions / notes for curator: `npm run build` passes; visual review should confirm whether grouping by section then dossier is the preferred mental model.

## 2026-06-10 — admin queue opens one section at a time
Files touched: `src/admin/components/Today.tsx`, `src/admin/admin.css`, `STATE.md`, `WORKLOG.md`
What was done: Reduced Control Register crowding by replacing all-open section queues with a section picker. The dashboard keeps top-level counts visible, shows section buttons with totals, and renders only the selected section's contextual dossier/task list.
Why: Curator follow-up — showing every contextual section at once still crowded the control panel.
Open questions / notes for curator: `npm run build` passes; visual review should decide whether the default selected section should always be the first active section or remember the last selected section.

## 2026-06-10 — admin index-first layout and handoff gating
Files touched: `src/admin/App.tsx`, `src/admin/components/Today.tsx`, `src/admin/components/Overview.tsx`, `src/admin/templates.ts`, `STATE.md`, `WORKLOG.md`
What was done: Moved Project Index above the Control Register, removed the dashboard "New Project" button, clarified overview labels as dossier counts, and stabilized the Control Register section selector. Added central approval prerequisite logic so locked approvals only become actionable after the relevant Steevez/content/build chain is complete; final approvals now wait on their full prerequisite chain instead of appearing too early.
Why: Curator follow-up — Project Index should lead the dashboard; Control Register belongs below it; queue numbers need clear logic; Suruchi approvals should generally follow completed studio/content steps rather than appearing alongside them.
Open questions / notes for curator: `npm run build` passes. The "Create Empty Project" store helper still exists for possible import/future use, but the dashboard no longer exposes project creation.

## 2026-06-10 — homepage name opens admin during build
Files touched: `src/main.ts`, `STATE.md`, `WORKLOG.md`
What was done: Changed the homepage Suruchi/Choksi corner name anchors to route to `/suruchi-admin/`, whose React admin entry remains password protected. Poet, Pilgrim, and Painter labels were not changed.
Why: Curator request — during the build phase, clicking the Suruchi name on the homepage alone should open the admin panel.
Open questions / notes for curator: `npm run build` passes. This is marked temporary and should be revisited before public launch.

## 2026-06-12 — Control Panel V2 local experiment
Files touched: `experiments/control-panel-v2/index.html`, `experiments/control-panel-v2/src/main.tsx`, `experiments/control-panel-v2/src/App.tsx`, `experiments/control-panel-v2/src/types.ts`, `experiments/control-panel-v2/src/seed.ts`, `experiments/control-panel-v2/src/logic.ts`, `experiments/control-panel-v2/src/storage.ts`, `experiments/control-panel-v2/src/styles.css`, `STATE.md`, `WORKLOG.md`
What was done: Built a self-contained experiment-only V2 production cockpit under `experiments/control-panel-v2/`. It tracks Homepage and Poet page/subpage tasks, approvals, review threads, local assets, Netlify links, Google Drive/content fields, four payment milestones, lock reasons, admin overrides, and a small action log using localStorage-backed typed state.
Why: Curator request — create a reduced deterministic backend/control panel V2 locally inside `experiments`, with no `gitUpload` changes or production integration.
Open questions / notes for curator: Local-only admin password is `steevez`; this is not production security. The experiment passes a standalone strict TypeScript check and a standalone Vite build, and it was opened in the browser with no console errors. It is not yet wired to Supabase or added to `vite.config.ts` build inputs.

## 2026-06-12 — Control Panel V2 hierarchy revision
Files touched: `experiments/control-panel-v2/src/App.tsx`, `experiments/control-panel-v2/src/styles.css`, `STATE.md`, `WORKLOG.md`
What was done: Reworked the V2 experiment from a dense three-column control dashboard into a calmer guided tracker. The first viewport now emphasizes selected page, next action, progress ring, and a production-flow graph; admin login and lower-priority task controls are tucked behind disclosures; payment, review, history, links, and assets are moved into quieter support panels.
Why: Curator feedback — the first V2 pass was visually overwhelming, lacked hierarchy, and felt too much like a military dashboard with too many controls visible at once.
Open questions / notes for curator: Strict standalone TypeScript check passes; standalone Vite build passes; refreshed in-app browser shows no console errors. Review whether the new visual rhythm is calm enough and whether the flow graph should become the primary navigation later.

## 2026-06-12 — Control Panel V2 main overview and short queues
Files touched: `experiments/control-panel-v2/src/App.tsx`, `experiments/control-panel-v2/src/styles.css`, `STATE.md`, `WORKLOG.md`
What was done: Made the V2 experiment land on a main control panel instead of a page task view. The main panel shows overall website progress, page progress cards, and the payment tracker. Individual page/subpage views now show only the next five steps in sequence, with payment removed from those task views.
Why: Curator feedback — Steevez should be admin, Suruchi should be normal user, payment belongs in the main control panel, and task/approval lists should not be long lists; they should show only the next few items and then rely on navigation.
Open questions / notes for curator: Local-only admin password remains `steevez`; Suruchi is accessed through the normal person switch. Strict TypeScript check and standalone Vite build pass; browser refresh shows no console errors.

## 2026-06-12 — Control Panel V2 task-flow correction pass
Files touched: `experiments/control-panel-v2/src/App.tsx`, `experiments/control-panel-v2/src/logic.ts`, `experiments/control-panel-v2/src/seed.ts`, `experiments/control-panel-v2/src/styles.css`, `STATE.md`, `WORKLOG.md`
What was done: Moved the natural production flow fully into the main control panel, made flow stages clickable route targets, changed stage colors to green/orange/grey for approved/current/upcoming, capped page queues to three tasks with Back 3 / Next 3 navigation, added named Suruchi/Steevez approval buttons with admin rollback, hid reset seed from non-admin users, added Register link buttons for auto-link tasks, made Homepage aggregate content derive from Bio/Contact/Tearsheet mini tasks, removed current-page asset inventory UI, and added deterministic local Netlify preview generation buttons.
Why: Curator corrections — reduce locked-list clutter, put flow on the main page, make task navigation more direct, allow admin rollback, make shared responsibility explicit, remove current asset inventory, and clarify Netlify preview behavior.
Open questions / notes for curator: Real Netlify auto-generation is not implemented; current generated preview links are deterministic local placeholders. Strict TypeScript check and standalone Vite build pass; browser refresh shows no console errors.

## 2026-06-12 — Control Panel V2 Tearsheet and Poet ordering
Files touched: `experiments/control-panel-v2/src/App.tsx`, `experiments/control-panel-v2/src/logic.ts`, `experiments/control-panel-v2/src/seed.ts`, `experiments/control-panel-v2/src/storage.ts`, `experiments/control-panel-v2/src/styles.css`, `STATE.md`, `WORKLOG.md`
What was done: Added Tearsheet article-count setup: enter count, Suruchi approves/locks it, then the exact number of article input cards appears with individual save buttons. Updated Poet's main natural order to separate Bandra and Euphemisms structure/build/approval stages, added all eight current Euphemisms from the experiment registry, and moved Euphemism work selection into a compact left-panel list. Added localStorage migration so existing browser state gains the new seeded tasks/order.
Why: Curator corrections — Tearsheet needs count-driven article entry, Poet needs a clearer natural order, and Euphemisms should reflect all current works without making the main task body a long list.
Open questions / notes for curator: Strict TypeScript check and standalone Vite build pass. Browser verification confirms Poet order, all eight Euphemisms, and Tearsheet setup with the old article task label hidden.

## 2026-08-30 — Bio Page Layout and Portrait Added
Files touched: `bio.html`, `public/images/Bio/*`
What was done: Processed the newly uploaded `Suruchi_Portrait.jpg` via the `scripts/optimize-images.mjs` pipeline. Altered `bio.html` CSS and HTML to create a 2-column grid layout (`.bio-page-wrapper`) and added an `<aside>` block containing the optimized portrait on the right-hand side.
Why: Curator request — wanted her portrait from `raw images>bio` assimilated via the pipeline and placed on the bio page.
Open questions / notes for curator: Needs visual review in the browser to ensure the new 2-column grid and the image fit correctly within the overall design system.

## 2026-08-30 — Bio Portrait Tweaks
Files touched: `bio.html`
What was done: Removed `position: sticky` and `top: 120px` from `.bio-portrait` so it scrolls naturally with the page instead of floating. Added a radial-gradient mask (`-webkit-mask-image`) to the portrait to feather/blur the edges into the dark background.
Why: Curator feedback — requested the image to be anchored and not move while scrolling, and requested a blur all around the portrait.
Open questions / notes for curator: The "blur" was implemented as an edge-feathering mask to blend into the darkness; if a different style of blur (like a glow) was intended, this can be adjusted.

## 2026-08-30 — Bio Portrait Blur Strengthened
Files touched: `bio.html`
What was done: Replaced the subtle `mask-image` on the portrait with a strong inset `box-shadow` (`inset 0 0 120px 60px #050506`) on a pseudo-element overlay. 
Why: Curator feedback — the previous edge feathering/blur was not visible, requested a stronger blur all around the portrait.

## 2026-08-30 — Bio Portrait Vignette Boosted
Files touched: `bio.html`
What was done: Increased the `box-shadow` inset blur radius and added a `radial-gradient` overlay background to the portrait's pseudo-element.
Why: Curator feedback — requested more vignetting over the portrait.

## 2026-08-30 — Bio Portrait Vignette Reduced
Files touched: `bio.html`
What was done: Reduced the vignette overlay by half (`box-shadow` to 80px/40px, pushed radial gradient transparency outwards to 60%) to restore focus on the face.
Why: Curator feedback — the previous vignette obscured the face and was too heavy.

## 2026-08-30 — Content Drop Folder Created
Files touched: `raw-images/text/.keep`
What was done: Created a `raw-images/text` folder to act as a centralized drop zone for the curator to provide updated text documents, rather than pasting copy into the chat.
Why: Curator requested a dedicated spot to drop updated docs so they can be accessed in one place.

## 2026-08-30 — Implemented Curator Text Drops
Files touched: `src/afterImage/App.tsx`, `src/afterImage/styles/globals.css`, `experiments/beach-shooting/index.html`, `experiments/book-engine/index.html`, `experiments/book-engine/main.tsx`
What was done: Extracted text from five `.docx` files dropped into `raw-images/text`. 
- **Zero Plus Anything is a World** & **I Was Not Among My Kind**: Compared the `.docx` to the live site; they were already identical, so no changes were needed.
- **Afterimage**: Replaced the standalone title in `App.tsx` with a `.header-container` displaying the full multi-paragraph write-up next to the carousel.
- **Sthithapragya**: Updated the typography panel in `experiments/beach-shooting/index.html` to feature the newly provided long-form text (explaining the rules and Bhagavad Gita reference).
- **Emptying the Void**: Added a scrolling typography panel to `experiments/book-engine/main.tsx` to hold the book description and specifications block over the 3D book render.
Why: Curator requested placing the new text across all corresponding project pages to test design and placement.

## 2026-08-30 — Book Engine Layout Upgrades
Files touched: `experiments/book-engine/index.html`, `experiments/book-engine/main.tsx`
What was done: 
- Moved the Book Specifications list to the right-hand side of the screen as requested.
- Restored native scrolling to the Book Engine experiment. 
- Implemented a "sticky storytelling" scroll-jacking model: scrolling turns the book pages, and once the book is finished (or if the user clicks the new "Read About Project" CTA), the page native-scrolls down to reveal the large-text project description below the book.
Why: Curator feedback on the layout of Emptying the Void text placement.
- **Book Engine Keybindings**: Bound `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` and `Space` to book page turning, following the exact same scroll-jacking transition rules. Updated the UI hint text to "Scroll or use arrow keys to open and read".
- **Book Engine Layout Adjustments**: Removed the "Book specifications" heading, right-aligned the specifications text, and snapped it beneath the "BUY THE BOOK" CTA. Pushed the bottom "Read About Project" CTA and scroll instructions further down the screen (from 84px to 36px offset).
- **Book Engine Layout Adjustments**: Vertically centered the book specifications text back to the middle of the screen (top: 50%, translateY(-50%)) while maintaining the right-alignment.
- **Book Engine Updates**: Updated the `PURCHASE_URL` for the "BUY THE BOOK" button to link to the provided netlify app url.
- **I Was Not Among Assemblage Integration**: Received mapped visual positions of 19 high-res individual artworks over the base assemblage from the curator. Cleaned up unused images in the raw drop folder. Ran the universal image pipeline. Hardwired `App.tsx` to directly overlay the individual high-resolution (`.webp`/`.jpg`) images directly inside the split animation wrapper, ensuring crisp quality during the deep camera zooms while maintaining the full assemblage splitting effect seamlessly.
- **Afterburn Rename Check**: Replaced every instance of "Photograms" across the entire codebase to "Afterburn" per user request. This involved renaming the `experiments/photograms` and `public/images/painter/photograms` directories, as well as updating `vite.config.ts`, `painter.html`, the admin manifest arrays, and all component TS/TSX source files safely.
- **Afterimage Expansion**: Processed 3 new subfolders of artworks inside `raw-images/painter/after-image/` via the optimization pipeline. Upgraded the Afterimage `Carousel` and `Card` components to accept rich objects `(src, title, description)` instead of simple strings. Generated a new `images.ts` script that parses both filename and folder hierarchy to dynamically assign descriptive details to each piece (e.g. "AI 11 — 12 in x 16 in, Acrylic on Oil Paper"). Added an elegant fading descriptive caption under the cards that matches the dynamic 3D spotlighting engine.
- **Afterimage Iteration 2**: Stripped prefixes/filenames from the carousel description tags leaving only medium and dimension. Added `ArrowRight`, `ArrowLeft`, `ArrowDown`, and `ArrowUp` support mapped directly to the Carousel physics engine. Appended a global "Scroll, drag, or use arrow keys to navigate" footer instruction layer at the bottom of `App.tsx`.
- **I Was Not Among**: Added dimensional physical shadowboxing to the mapped high-res artworks, wrapping each piece in a brown wooden frame (`2px solid #8e6345`) with realistic drop shadowing. Since the camera relies on `transform: scale()`, these CSS properties scale with optical accuracy as the user zooms in and out.
- **I Was Not Among (Shadowboxes)**: Added a strong absolute inner shadow (`inset`) overlay directly inside the `picture` tags to simulate the physical depth of a shadowbox/matboard. This ensures the bright white artwork paper appears deeply recessed behind the brown wooden frames.
- **I Was Not Among (Shadowboxes Refined)**: Replaced the simple inset CSS shadow with a true 3D-mitered orthographic bevel structure, utilizing 4 distinct colored inner wall borders (top, bottom, left, right) to simulate directional lighting and deep physical framing. Layered ambient occlusion inside the new walls to ground the artwork perfectly as a physical sunk-in object.
- **I Was Not Among (Floater Frame & Specs)**: Replaced the orthographic bevels with a sleek floater frame setup (thin wooden edge, recessed dark void space, floating drop-shadowed canvas). Used bounding box percentage ratios against the provided Assemblage max dimensions (82.5w and 75w inches) to programmatically calculate the dimensions of all 19 panels. Injected dimension labels that dynamically fade into view only when the user zooms into focus on a specific canvas.
- **I Was Not Among (Floater Frame Fix)**: Replaced percentage-based padding with an absolute `3px` gap to correctly render the floater frame void. This prevents the gap from expanding massively relative to the container width, ensuring the artwork sits closely snuck to the thin wooden frame with realistic tight depth.
- **I Was Not Among (Gap Gradation)**: Hardcoded the outer wooden frame to an exact `2px`. Converted the plain black floater gap into a dynamic volumetric recess using a diagonal `linear-gradient` (`#555` to `#1a1a1a`) combined with a soft inset drop shadow. This produces a realistic gradation effect matching a top-left lighting source for the void.
- **I Was Not Among (Tour Navigation & Labels)**: Added native mouse wheel support to the tour engine, debounced to prevent runaway scrolling. Programmed the final navigation state: scrolling forward on the last artwork now automatically triggers the camera to zoom back out to the full wall overview, followed by an automatic cinematic split to reveal the text behind the wall. Pulled dimension labels up to sit tight against the bottom edge of the frames (with an elevated z-index) to resolve occlusion and collision issues with adjacent tightly-packed artworks.
- **I Was Not Among (Crash Fix & Frame Polish)**: Fixed a critical out-of-bounds array access that was causing React to crash and white-screen ("go blank") during the final cinematic transition. This crash happened when the wheel/keyboard navigator fired multiple times during the final 1.5s delay before the text split. Added a strict navigation ref blocker during the cinematic sequence and patched array bounds with optional chaining. Also swapped the outer 2px wood border for an ultra-thin `0.5px solid #000` black border based on user request.
- **Zero Plus (Floater Frame Migration)**: Migrated the heavy solid wood frame on the `zero-plus` experiment to the new dynamic Floater Frame architecture requested by the user, utilizing the gradient-lit gap and inset shadows. 
- **Specs (Floater Frame Documentation)**: Created `specs/floater-frame.md` to formally document the HTML/CSS structure of the gallery-grade floater frame so it can be reliably dropped into any future experiments or components across the site.
- **Euphemisms (Issued in Public Interest)**: Injected the new `byorder.png` graphical stamp directly into the `issued-in-public-interest.ts` experiment. Programmed it to remain hidden during the scrambled text scroll, and to fade in dynamically as an overlaid stamp (at the bottom of the viewport) only when the user reaches the absolute bottom of the scroll sequence (`progress === 1.0`).
- **Euphemisms (Issued in Public Interest Scroll Fix)**: Fixed a mathematical bug where `spacer.height` didn't account for the baseline viewport height, causing max `scrollTop` to fall short of `progress = 1.0`. This was causing the newly added `byorder.png` stamp to only flicker into existence during OS-level overscroll bounces. Expanded the physical scroll space at the bottom by an extra 60vh and directly mapped the stamp's opacity to that extra scroll space, allowing it to seamlessly fade into view (and out of view if scrolled backward) strictly after the poem finishes unscrambling.
- **Euphemisms (Issued in Public Interest Stamp)**: Reverted the explicit tie-to-scroll mechanic. Stripped the extra 60vh scroll padding but retained the exact math correction for the viewport height. Re-applied a CSS `ease-out` transition so that the stamp now triggers and gracefully fades onto the screen *automatically* the exact moment the poem hits `1.0` (fully unscrambled), anchoring it on screen without requiring the user to scroll further into empty space.
- **Euphemisms (Stamp Bug Fix)**: The stamp was failing to appear because of two combined issues: (1) CSS clipping/stacking context on the parent container was suppressing `position: fixed`, and (2) browser subpixel scroll-rounding often prevented `progress` from hitting precisely `1.0`. Moved the stamp insertion directly into `document.body` and relaxed the trigger threshold to `0.99` to guarantee it instantly appears at the visual end of the poem. Also removed the extra 100vh scroll void so it triggers precisely upon poem completion.
- **Euphemisms (Stamp Instant Pop)**: Removed the secondary CSS transition animation for the stamp to comply with the user's request for a single continuous loop with no extra animations or slides. The stamp now instantly pops into existence at full opacity the very frame the poem hits `0.99` progress, keeping the experience strictly tied to the single scrolling timeline.
- **Euphemisms (Dead Space Math Fix)**: Discovered a severe mathematical flaw in the original scroll progression mapping. The visual letter-unscrambling equation inherently saturated when `progress` reached `STAGGER_PER_WORD / (1 + STAGGER_PER_WORD)` (approx. 51.2%), leaving nearly 50% of the scroll track (about 4 full viewport heights) as completely dead, unresponsive space. Truncated the physical scroll boundaries exactly to this native completion point, and tied the stamp appearance directly to it. This cuts the required scrolling distance in half and makes the stamp appear instantly the moment the final letter locks in.
- **Euphemisms (Text Scale Doubled)**: The user requested the title and poem text to be doubled in size. Removed the artificial `720px` width bottleneck on the parent container (allowing it to scale gracefully up to `1440px` on desktop), and explicitly injected a `* 2` multiplier into the final calculated font sizes for both the Title and the Body. Because the layout engine measures DOM rects *after* the font size is applied, this safely forces the text to render at exactly 200% size, naturally wrapping and stacking lines without breaking the absolute positioning grid of the scrambled letters.
- **Euphemisms (Text Scale Proportional Fix)**: Reverted the aggressive `2.0x` multiplier which was causing vertical stacking overlaps and horizontal boundary bleeding. Kept the broadened `.work-stage` container constraint (`1440px` max-width). The physics engine's native `fitsInContentBox` loop now correctly scales the text to dynamically fill the maximum available proportional space (up to 99% of screen bounds) without breaking formatting or overlapping.
- **Euphemisms (Hub Thumbnails)**: Integrated the newly uploaded thumbnails for the "Archive of Unthought Knowns" hub. Moved the raw thumbnail files from `poet/euphemisms/thumbnails/` to the central `poet/thumbnails/` directory to match the `hub.ts` routing, and triggered the image optimization pipeline to cache them into the public build. Kept the existing `the-thing-to-do` thumbnail untouched as requested. Missing thumbnails will gracefully fall back to the built-in grey placeholder.
- **Euphemisms (Hub Thumbnails Fit)**: Changed the `object-fit` property of the hub thumbnails from `cover` to `contain`. Since the user uploaded images with wildly different aspect ratios (some vertical, some horizontal) into a strict `4:3` bounding box, `cover` was brutally center-cropping them and cutting off important content. `contain` ensures the entire image is proportionally scaled to fit and centered within the box without cropping.
- **Euphemisms (Hub Thumbnail Polish)**: Set the background color of the `thumbnail-video-wrap` frames to solid white (`#ffffff`), so the letterboxing gaps around the new `contain` thumbnails appear as stark white cards instead of blending into the black page background. Also added a specific slug-level override to return `the-thing-to-do` to `object-fit: cover` to preserve its original, intentional full-bleed cropping.
- **Euphemisms (Generated Thumbnails)**: To fill the missing visual gaps in the hub, I programmatically generated custom, high-fidelity SVGs for the `plainness` and `fact-fiction` thumbnails based perfectly on their experiment mechanics. `plainness` shows crisp text with a fading, offset trail of "exalted" behind it, and `fact-fiction` features an LED-matrix grid overlay with glowing monospace text and simulated glitch blocks. Saved them as `.jpg` into the raw folder and ran them through the pipeline.
- **Euphemisms (Session Randomization)**: Intercepted the `WORKS` array export in `registry.ts` and injected a robust session-based shuffle. It leverages `sessionStorage` to randomly shuffle the array on the very first page load of a visit, and locks that exact array order in memory. This ensures the hub grid is entirely unique per visit, while guaranteeing the "Next" button in full-screen mode traverses the exact same randomized order without breaking continuity.
- **Sthithapragya Rename**: Updated the title and headers in the `beach-shooting` experiment from "SHOOT THE BALLOON" to "STHITHAPRAGYA" as requested.
- **Painter (Sthithapragya Thumbnail Routing)**: Decoupled the balloon game's thumbnail from the `poet/thumbnails/` Euphemisms directory as requested. Created a dedicated `raw-images/painter/STHITHAPRAGYA/` directory for it, and updated `painter.html` to point to `/images/painter/STHITHAPRAGYA/thumbnail.jpg`.
- **Painter (Sthithapragya Thumbnail Rollback)**: The user requested to cancel the new thumbnail addition for Sthithapragya. Reverted `painter.html` back to using the original thumbnail image, deleted the temporary `STHITHAPRAGYA` raw directory, and recovered the originally deleted `.jpg` from git.
- **Pilgrim (Navigation Polish)**: Ripped out the complex "Help" overlay system, including the bottom-left text toggle, the circular right-side 'i' button, and the frosted glass information overlay. Replaced the bottom-left text element with a standard `BACK` link returning to the main menu (`/`), styled symmetrically to the other hubs for navigational consistency.
