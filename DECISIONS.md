# DECISIONS.md

Append-only log of settled decisions. One dated line (or short block) per
decision. Never edited; only appended. If a decision changes later, that is a
new dated entry — the old one stays.

**Curator only.** No agent writes to this file. An agent that thinks a
decision should be logged reports it to the curator, who appends it.

Before re-opening any question, search this file. Do not re-litigate what is
logged here.

Format: `YYYY-MM-DD — short title.` then a brief reason on the next line if
useful.

---

## 2026-05-16 — Initial settled decisions

2026-05-16 — **Project documentation structure locked.**
Root: `CONSTITUTION.md`, `AGENTS.md`, `DECISIONS.md`, `STATE.md`,
`references.md`. Subfolder `specs/` containing `cursor-system.md`,
`tech-stack.md`, `video-compositing.md`, `scroll-transitions.md`. Eight files
total. Justification: short enough for an agent to read fully; one clear
purpose per file.

2026-05-16 — **The Constitution supersedes the proposal PDF where they differ.**
The proposal is the original client agreement; the Constitution is the current
evolving truth. Differences are intentional and logged.

2026-05-16 — **Aesthetic non-negotiables: dark, sparse, cinematic, weighted,
breathable, restrained.**
Explicitly avoid: startup aesthetics, glassmorphism, award-site noise,
overloaded interactivity. The goal is controlled atmosphere, not maximal
interactivity.

2026-05-16 — **Interaction hierarchy: three layers only.**
Primary (input): the cursor system. Secondary (input): scroll transitions.
Ambient (not input): video and blur. A new idea must displace an existing
layer, never stack a fourth.

2026-05-16 — **Cursor is one coupled system.**
One pointer, one influence radius, one smoothing value. Drives illumination
and block displacement only. Both effects share the same radius and the same
smoothing — never tuned separately.
*(NOTE: amended on 2026-05-23, see entries below.)*

2026-05-16 — **The cursor does NOT touch the blur.**
No sharpening, no focus restoration, no deblur. The cursor brightens; it does
not resolve clarity. The blur is independent decorative framing.

2026-05-16 — **Blur is decorative, screen-bottom, fully independent.**
A fixed band along the bottom of the viewport. Not interactive. Not wired to
the cursor. Not wired to the column headings (which sit at the column TOP, so
the blur does not veil them — it veils whatever else scrolls beneath it).
Chosen for filmic framing over system coherence; reversible if the curator
amends.

2026-05-16 — **Homepage has two phases.**
Phase 1: 2–3 dark video scenes, center-out box reveal between them. Phase 2:
single screen, three vertical columns Poet / Painter / Pilgrim, headings at
top, video continues playing behind.

2026-05-16 — **Phase 2 scroll is a progress dial.**
Scroll locks when Phase 2 enters the viewport, paints columns left to right
(Poet → Painter → Pilgrim), releases when all three are filled. The page does
not advance during this fill.

2026-05-16 — **Columns fill only their own third of the screen.**
Each column's fill animation is contained to its column. Not fullscreen.

2026-05-16 — **The three columns are a GATEWAY, not the Works section itself.**
Each column's Enter button routes to a separate Works page (Poet, Painter,
Pilgrim) built later as its own quest. The homepage establishes the universe
and hands off. It does not absorb Works.

2026-05-16 — **What sits below Phase 2 is DEFERRED.**
Footer, contact, or nothing — undecided. Agents reaching this point stop and
ask. No invented content.

2026-05-16 — **Language: TypeScript, strict mode. No `any`.**
`strict`, `noImplicitAny`, `noUncheckedIndexedAccess` all on. For a curator who
does not read code directly, the type system is the readable spec.

2026-05-16 — **The homepage is a WebGL application.**
Per-fragment shader access required for video effects. No CSS-only path.

2026-05-16 — **Fallback floor: static dark poster, no effects.**
Where WebGL is unavailable, or `prefers-reduced-motion` is set, the homepage
shows a static dark poster image and nothing else. The cursor system is not
constructed in that case.

2026-05-16 — **Mobile is a separate interaction design.**
Not a port. Built later as its own quest. The homepage cursor system does not
attempt to run on touch devices.

2026-05-16 — **Agent role assignments.**
ChatGPT: concept, interaction logic, documentation structure, critique.
Claude: independent review, spec auditing, technical sanity checking.
Cursor: production implementation.
Antigravity: experimental prototypes, especially motion/WebGL.

2026-05-16 — **The agent that writes a system does not review it.**
A different agent audits, against the relevant spec. No self-review.

2026-05-16 — **Edit permissions are conventions, not technical locks.**
Agents are *instructed* not to edit certain files; nothing physically prevents
them. The curator's review before commit is the real enforcement.

2026-05-16 — **Experiments are throwaway.**
When an experiment is promoted to production, it is *re-implemented* in `src/`
against the spec — not copied verbatim. The experiment is then frozen, not
maintained in parallel.

2026-05-16 — **Cursor system interface is closed.**
The public surface is `Vec2`, `CursorConfig`, `CursorState`, `CursorSystem`,
and `createCursorSystem`. Adding fields, methods, or runtime tuning requires
amending `specs/cursor-system.md` — not a silent addition.

---

## 2026-05-23 — Pivot: cursor effect is elastic mesh distortion, not block displacement

2026-05-23 — **CORRECTION: the original "block displacement" model was a
misreading of the reference sites.**
The intended visual was never decorative squares laid over a video. It was
the video's own surface deforming around the cursor — like a thin rubber
sheet — as observed on sileent.com. The previous block-displacement spec was
built from a flawed mental model on Claude's part. Logged honestly so this
pivot is on record and not silently rewritten.

2026-05-23 — **Cursor system's two effects are now illumination AND elastic
distortion of the video surface.**
Amends the 2026-05-16 "Cursor is one coupled system" entry. The system is
still one coupled system with one radius and one smoothing. The two effects
it drives are now (a) brightness modulation of the video, and (b) elastic
displacement of the video's own pixels via a cursor-driven displacement
field. There are no discrete decorative blocks.

2026-05-23 — **`CursorState` gains a `velocity` field.**
The distortion effect is velocity-driven — fast cursor motion creates
stronger distortion and a longer trail than slow motion. Velocity is a
property of the cursor's motion, not a separate system, so it lives on the
cursor's state object. The `CursorState` interface now exposes four fields:
`lightPosition`, `lightUV`, `velocity`, `radius`. Anything outside those
four is still forbidden.

2026-05-23 — **Homepage library: Three.js, not OGL.**
The distortion technique we are committing to is the DataTexture-based grid
displacement pattern documented in Codrops tutorials ("Pixel Distortion
Effect with Three.js" by Yuriy Artyukh, January 2022, and "Grid Displacement
Texture with RGB Shift using Three.js GPGPU and Shaders", August 2024).
Three.js's `DataTexture` and `GPUComputationRenderer` utilities are the
idiomatic tools for this pattern; doing it in OGL would be writing more
from scratch. This also re-aligns the homepage with the proposal PDF, which
named Three.js. OGL is removed from the project.

2026-05-23 — **The previous OGL prototype is frozen.**
Per the "experiments are throwaway" rule, the OGL prototype is not
maintained in parallel. It is preserved only as a reference for what the
cursor-system interface looks like in practice and what the dt-based
smoothing pattern was. The next prototype is built fresh in Three.js.

2026-05-23 — **Canonical reference tutorial for the technique.**
The Codrops "Pixel Distortion Effect with Three.js" tutorial (2022) is the
canonical reference for the implementation pattern. Cursor and Antigravity
may consult it directly. The visual *direction* still comes from the
Constitution and `references.md`; the *technique* comes from the tutorial.
The two are distinct: agents may copy the pattern, not the demo's visual
choices.

2026-05-23 — **RGB shift / chromatic aberration is permitted as part of the
distortion shader.**
The reference effect on sileent.com includes a subtle RGB-channel split in
the distorted regions, contributing to the "glitchy, premium" feel. This is
treated as part of effect (b) — elastic distortion — not a third effect. It
is keyed to the same displacement field. If the curator decides on review
that the RGB shift is too much, it can be muted to zero without restructuring.

---

## 2026-05-24 — Typographic cursor influence, multi-video scroll, and dependency ratifications

2026-05-24 — **Cursor primary layer gains a third expression: typographic
influence.**
The fixed corner labels ("Suruchi Choksi", "Poet", "Painter", "Pilgrim")
respond to the cursor's light field each frame — characters displace radially
and tangentially, scale, brighten, and ripple within the cursor's radius.
This is an extension of the primary cursor layer, not a fourth interaction
layer. It is ratified as part of the Constitution (§3 amended 2026-05-24).
All three expressions (illumination, video distortion, typography) share the
same lagged position, radius, and smoothing. No separate tuning.

2026-05-24 — **Phase 1 scroll is a continuous looping video dial, not
center-out box reveals.**
The original center-out reveal design is deferred. The ratified direction:
six video scenes in an infinite looping scroll, adjacent scenes cross-dissolve
as scroll advances, smooth interpolated scroll progress drives a `sectionProgress`
value into the scene. This is a deliberate evolution of the design — the
looping continuous model better serves the "entering an atmosphere" goal.
The center-out reveal may return as an option for a future Phase 1 revision;
until then it is parked, not cancelled.

2026-05-24 — **Homepage uses six video files (video-1.mp4 through video-6.mp4),
not one.**
The single-video model in the original `specs/video-compositing.md` has been
superseded. Six videos play in a looping sequence. Two are active per frame
(A and B); the scroll system provides the blend progress. All six are loaded
at startup with `preload="auto"` and `play()`. Lazy loading (pre-load next
scene only) is a future optimisation — not blocking now, logged in STATE.md.

2026-05-24 — **Fragment shader warp uses subtraction, not addition.**
`specs/video-compositing.md §6` originally stated `warpedUV = vUv + offset`.
The implementation uses `vUv - displacement.rg * warpFactor`. The sign
difference is correct: the displacement field stores directions pointing
away from the cursor; subtracting them pushes the UV sampling point in the
opposite direction, which produces the correct visual (video surface pushed
away from the cursor). The spec is updated to reflect this.

2026-05-24 — **`outgoingWarp` and `incomingWarp` amplify distortion at
scene transitions.**
During a cross-dissolve, the outgoing video's warp magnitude is scaled up
as blend increases (`1 + blend * 0.8`), and the incoming video's warp is
scaled down (`1 + (1 - blend) * 0.5`). This gives transitions a brief
"stretch" quality as scenes change. This is part of the video compositing
system, not a separate effect. Logged as it was not in the original spec.

2026-05-24 — **React 19, react-dom, and @react-three/fiber are authorized
runtime dependencies.**
Used exclusively by the Pilgrim Works page (`src/pilgrim/main.tsx`) and
future Works pages that require component-based 3D canvas rendering.
The homepage (`src/main.ts`) remains framework-free per the original spec.
Vite's multi-entry code-splitting keeps these out of the homepage bundle.
`specs/tech-stack.md §4` updated to reflect this. Bundle cost noted: React
~40 KB gzip, R3F ~90 KB gzip — acceptable for Works pages, not for homepage.

2026-05-24 — **WebGL fallback and `prefers-reduced-motion` guard are
required before production.**
Constitution §6 and `specs/tech-stack.md §7` both require a static dark
poster fallback when WebGL 2 is unavailable, when the renderer throws, or
when `prefers-reduced-motion: reduce` is active. This is NOT yet implemented.
It is a blocking production requirement. Cursor is tasked to implement it.
`public/poster.jpg` must be added by the curator. See STATE.md.

2026-05-24 — **Corner navigation labels gain letter-reshuffle animation
and page routing.**
POET, PAINTER, PILGRIM each run independent ambient timers (~8.5–9.5s
interval, staggered). Letters cycle through the shared pool (A E G I L M N O
P R T) before resolving. Click navigates to `poet.html` / `painter.html` /
`pilgrim.html`. `poet.html` and `painter.html` are placeholder shells; content
is a later quest. This is an extension of the ratified typographic expression
of the primary cursor layer (Constitution §3, amended 2026-05-24); the
reshuffle is ambient/timer-driven and the navigation is standard routing, not
a new interaction layer.
