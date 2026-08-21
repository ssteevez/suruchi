# specs/scroll-transitions.md

The technical contract for scroll behavior on the SuruchiWebsite homepage.

This spec supersedes the earlier placeholder (2026-05-24). It inherits from
`CONSTITUTION.md` (§3, §5) and is consistent with `specs/video-compositing.md`.
Where they disagree, the upstream document wins.

The audience is two-fold: Cursor builds against this file; Claude audits
against it.

---

## 1. Design direction

Phase 1 scroll is a **continuous, infinite looping dial** through the six
video scenes — not a page that scrolls to a bottom, but a film loop: scenes
repeat, and scrolling advances or reverses the film. Scrolling forward
progresses scene 1 → 2 → 3 → ... → 6 → 1 → ...; scrolling backward
reverses through the same loop.

Adjacent scenes **cross-dissolve** as the scroll dial advances. There is no
hard cut and no theatrical box reveal in Phase 1 at this time. The original
center-out reveal design is parked, not cancelled — it may return as a Phase 1
revision in a later quest (see `DECISIONS.md` 2026-05-24).

Phase 2 (three-column gateway) scroll behavior is partially specified in §5.

---

## 2. Phase 1 scroll system

### Constants

| Name | Value | Meaning |
|---|---|---|
| `TOTAL_SECTIONS` | `6` | Number of video scenes in the loop |
| Loop span | `TOTAL_SECTIONS × innerHeight` | Total scroll distance for one full cycle |
| Body height | `(TOTAL_SECTIONS + 1) × 100vh` | DOM height; one extra section avoids edge-snap artefacts |

### Infinite looping

The scroll position wraps at both ends so the loop has no perceptible boundary:

- If `scrollY ≤ 1` (user reached the top): snap to `loopSpan − 2`. Upward
  scroll emerges from the last scene, feeling like the loop continues.
- If `scrollY ≥ loopSpan` (user reached the bottom): snap to `2`. Downward
  scroll loops back to the first scene.

The snap is immediate (`window.scrollTo`) and invisible — `smoothScrollY`
absorbs any discontinuity over the next few frames.

### Smooth interpolation

`targetScrollY` is set instantly on each `scroll` event. `smoothScrollY`
chases `targetScrollY` each frame using a frame-rate-independent decay:

```typescript
const scrollAlpha = 1 - Math.pow(0.86, dt * 60);
smoothScrollY += (targetScrollY - smoothScrollY) * scrollAlpha;
```

This produces a weighted, cinematic feel — the scene does not snap on release.

### Section progress

```typescript
sectionProgress = (smoothScrollY / loopSpan) * TOTAL_SECTIONS
// range: 0..TOTAL_SECTIONS (0..6), continuous
```

Passed to `HomepageScene.setSectionProgress(progress)` each frame.

---

## 3. Video selection and blending

`sectionProgress` drives which two videos are active and how they blend.
Inside `HomepageScene.render()`:

```typescript
const wrappedProgress = sectionProgress % sectionCount;
const sectionIndex = Math.floor(wrappedProgress);   // 0..5 — current scene
const blend = wrappedProgress - sectionIndex;         // 0..1 — cross-fade
```

- `uVideoTextureA` → `videoTextures[sectionIndex]`
- `uVideoTextureB` → `videoTextures[(sectionIndex + 1) % sectionCount]`
- `uBlendProgress` → `blend`

The fragment shader cross-fades A → B using `blend`. At the midpoint of the
transition the distortion warp is briefly amplified (see
`specs/video-compositing.md §5` for the `outgoingWarp` / `incomingWarp`
formula).

---

## 4. What is NOT in Phase 1 yet

- **Center-out box reveal** — parked. If the curator decides to replace the
  continuous blend with theatrical scene cuts, this spec will be amended.
- **Per-scene text or UI overlays** — not yet designed.
- **Audio sync** — out of scope for now.

---

## 5. Phase 2 scroll — three-column progress dial (partial spec)

When Phase 2 (the three-column gateway) enters the viewport, scroll behavior
changes. This section documents what is settled; unsettled items are flagged
explicitly.

### Settled (from `DECISIONS.md`):

- Scroll **locks** when Phase 2 enters the viewport — the page position
  freezes; scroll no longer advances the document.
- Locked scroll becomes a **progress dial**: accumulated scroll delta maps
  linearly to a fill-progress value from 0.0 to 1.0.
- Columns fill left to right: **Poet → Painter → Pilgrim**.
- Each column fills only its **own third of the screen** — never fullscreen.
- When all three columns reach 1.0 fill, scroll **releases** and normal
  page behavior resumes.

### Unsettled — do not implement until curator decides:

1. **What the visual "fill" treatment is.** Brightness rise? Colour wash?
   A masked reveal of underlying video? Each is a different build.
2. **Easing curves and durations** for per-column fill.
3. **Backward scroll during fill** — does the dial reverse, or is it
   one-directional?
4. **Where the soft intro text and Enter button appear** relative to the
   fill timeline.
5. **Scroll input sources** — wheel only, or trackpad momentum too?

**An agent reaching Phase 2 scroll stops and asks the curator** for these
answers before writing code. This is a hard stop, not a suggestion.

---

## 6. Scroll-jacking safety rules

These apply when Phase 2 scroll-lock is implemented:

- Must handle trackpad inertia: brief over-scroll after finger lift must
  not break the lock state machine.
- Must be transparent to the browser's back-navigation gesture (horizontal
  swipe on macOS).
- Under `prefers-reduced-motion`: the static poster is shown; no scroll
  behavior is constructed at all.
- Screen reader and keyboard-only navigation: requires explicit test plan
  before Phase 2 scroll is merged.
- If the lock ever fails to release (a bug), the user must be able to
  reach the rest of the page. A safety timer or overflow override is
  required as a last resort.

---

## 7. Out of scope for this spec

- The cursor system → `specs/cursor-system.md`.
- The video compositing, cross-fade warp → `specs/video-compositing.md`.
- The Phase 2 three-column visual treatment → a future spec.
- Mobile scroll — mobile is a separate quest; no scroll behavior is built
  for touch devices.
