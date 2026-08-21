# specs/cursor-system.md

The technical contract for the cursor system on the SuruchiWebsite homepage.

This spec inherits from `CONSTITUTION.md` and does not contradict it. Where
this file and the Constitution appear to disagree, the Constitution wins
and this file is what needs fixing.

The audience is two-fold. Cursor and Antigravity build against this file.
Claude audits against it. The curator, who does not read code directly,
uses the **TypeScript interface in §3** as the readable control surface —
it is the single artifact the curator can inspect to verify the
implementation has not drifted.

**Amendment 2026-05-23.** This spec was rewritten when the project pivoted
from a discrete-block displacement model to an elastic mesh distortion of
the video surface. The previous "block displacement" framing was a
misreading of the reference sites and has been retired. The cursor system's
*interface* gains a `velocity` field; everything else about its rules
(one coupled system, one radius, no runtime tuning) stays.

---

## 1. What this system is, in one paragraph

The cursor system listens to the mouse pointer, smooths its motion into
a lagged "light position," tracks its velocity, and exposes that lagged
position, the velocity, and a fixed influence radius to whoever needs
them. It is **one coupled system with one input.** From that single input,
two effects are derived downstream: illumination of the dark video, and
elastic distortion of the video surface (the displacement field that
warps the video's pixels around the cursor). Both effects share the
*same* lagged position, the *same* radius, and the *same* smoothing
value. They are never tuned separately.

This is the Constitution's §3 made into code: one pointer, one velocity,
one radius, one smoothing, two effects.

---

## 2. What this system does NOT do

Stated explicitly so an agent cannot quietly add capability:

- The cursor **does not** sharpen the video, restore focus, deblur, or
  alter the progressive blur in any way. Blur is independent of the
  cursor (Constitution §4).
- The cursor **does not** carry a second radius for distortion. There is
  one radius for both illumination and distortion.
- The cursor **does not** carry separate smoothing for distortion. There
  is one smoothing.
- The cursor **does not** emit particles, sparks, trails-as-objects, or
  decorative blocks. The "trail" of the distortion effect is a property
  of the displacement field (see `specs/video-compositing.md`), not a
  property of this system.
- The cursor **does not** modify the video's color, hue, or contrast
  curve. It modulates brightness within a soft falloff, and it drives a
  displacement field that warps UV sampling. RGB shift, if present in
  the distortion shader, is keyed to that displacement field, not added
  as a separate cursor effect.
- The cursor **does not** interact with the scroll system or with the
  bottom blur band. Those are independent layers.

If a future need genuinely requires one of these, it goes to the curator
as a proposed Constitution amendment — not into this system.

---

## 3. The TypeScript interface — the curator's control surface

This is the entire public surface of the cursor system. If the
implementation exposes anything beyond this — extra knobs, hidden state,
additional fields on `CursorState` — the system has drifted and the
audit must flag it.

```typescript
// src/systems/cursor/types.ts

/** A 2D point or vector. Coordinates in CSS pixels, origin top-left of
 *  the viewport (for positions) or pixels-per-second (for velocity). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Tuning values for the cursor. These are the ONLY knobs.
 * No other configuration is permitted. Adding a field here is a
 * Constitution-level change and requires curator approval.
 */
export interface CursorConfig {
  /** Influence radius in CSS pixels. ONE radius drives illumination AND
   *  distortion. Never split. */
  readonly radius: number;

  /** Smoothing coefficient, 0..1. Higher = heavier lag.
   *  0 means the light tracks the pointer instantly (forbidden — too
   *  sharp). Cinematic weight lives in this value. Expected range:
   *  0.80–0.92. */
  readonly smoothing: number;
}

/**
 * What the cursor system outputs every frame.
 * These FOUR fields are the system's ENTIRE effect on the world.
 * Consumers (the brightness pass, the distortion-field writer) read
 * this and nothing else.
 */
export interface CursorState {
  /** Smoothed (lagged) light position in CSS pixels. NOT the raw
   *  pointer. */
  readonly lightPosition: Vec2;

  /** Same position, normalized to 0..1 of the viewport. Shaders consume
   *  this. The Y component is flipped at this point so the UV space
   *  matches WebGL's bottom-left origin. */
  readonly lightUV: Vec2;

  /** Cursor velocity in CSS pixels per second, derived from the change
   *  in `lightPosition` over time. NOT the raw pointer velocity —
   *  the lagged one, so the velocity matches the visible motion. Used
   *  by the distortion-field writer to scale displacement force. */
  readonly velocity: Vec2;

  /** The single influence radius, passed through from config. */
  readonly radius: number;
}

/**
 * The cursor system itself.
 * Created once per page, ticked every frame, disposed on teardown.
 */
export interface CursorSystem {
  /** Advance the smoothing and velocity by one frame. dt is seconds
   *  since last frame. */
  update(dt: number): void;

  /** Read the current smoothed state. Called by consumers every frame. */
  getState(): CursorState;

  /** Tear down listeners and free anything held. Called on page unload. */
  dispose(): void;
}

/** Factory. The only way to create a cursor system. The implementation
 *  lives in `CursorSystem.ts`; this declaration is for type purposes only. */
export declare function createCursorSystem(
  config?: Partial<CursorConfig>
): CursorSystem;
```

**Notes on the interface, for the auditing agent:**

- Every field is `readonly`. The cursor system does not expose mutable
  state. If `lightPosition` is mutable in the implementation, that is
  a violation.
- There is no `setRadius`, no `setSmoothing`, no runtime tuning surface.
  Tuning is fixed at construction. If runtime tuning is ever needed, it
  is added by amending this spec, not by sneaking it in.
- `CursorState` has **four fields, no more.** If the implementation
  returns a state object with extra fields ("distortionStrength",
  "trailLength", "intensity"), that is the exact kind of hierarchy
  violation the Constitution forbids. Flag it.

---

## 4. How consumers use this system

Two consumers exist on the homepage:

1. **The brightness pass** (in the fragment shader for the video plane)
   reads `lightUV` and `radius` to compute a soft falloff that brightens
   the video locally. Velocity is not used here. See
   `specs/video-compositing.md` §3 for the brightness formula.

2. **The distortion-field writer** (a per-frame routine that writes into
   the displacement `DataTexture`) reads `lightUV`, `velocity`, and
   `radius`. It "stamps" the cursor's influence into the displacement
   field each frame — the magnitude and direction of the stamp are
   driven by the velocity, and the spatial extent is driven by the
   radius. See `specs/video-compositing.md` §4 for the displacement
   write logic. The relaxation (decay of the field back to zero) and the
   actual UV-warp sampling are *not* part of this system; they are
   properties of the displacement field itself.

Both consumers read `CursorState` every frame. Neither mutates it.
Neither holds its own copy of the radius or smoothing.

If an agent introduces a second radius constant in the distortion writer,
or scales smoothing differently between the two consumers, that is a
violation.

---

## 5. Behavior rules

- **Frame-rate independence.** Smoothing must produce the same perceived
  lag at 60Hz and 120Hz. A naive `light += (target - light) * 0.12` is
  wrong because it lags differently at different frame rates. The
  implementation must use a dt-based formulation (e.g.
  `1 - Math.pow(base, dt * 60)`).
- **Velocity calculation.** Velocity is derived from the change in the
  *lagged* `lightPosition` between frames, divided by `dt`, not from
  the raw pointer's change. This way velocity matches the visible
  motion: if the pointer jumps but the light is still catching up,
  velocity reflects the light's motion, not the pointer's.
- **Initial position and velocity.** On creation, `lightPosition` is
  the viewport center, and `velocity` is zero. A light starting in the
  top-left corner reads as a bug.
- **Y-axis convention.** `lightPosition` is in CSS pixels, top-left
  origin (Y increases downward). `lightUV.y` is flipped to WebGL's
  bottom-left origin convention (Y increases upward). This flip happens
  inside the cursor system, not in shaders. Shaders consume `lightUV`
  as-is.
- **Off-screen pointer.** When the pointer leaves the window, the light
  continues to track its last known target. It does not jump, snap, or
  hide. Velocity decays to zero naturally as the light arrives at the
  stationary target. When the pointer returns, smoothing resumes
  naturally.
- **Touch devices.** The cursor system is desktop-only. Mobile is a
  separate interaction design (Constitution §6) and does not use this
  system.
- **`prefers-reduced-motion`.** When the user has reduced motion enabled,
  the cursor system is *not constructed.* The homepage falls back to the
  static poster (Constitution §6). The cursor system has no internal
  "reduced motion mode" — that decision lives at the page level, not in
  this system.

---

## 6. What "working" looks like

For the audit and for the curator's aesthetic check, the cursor system
is working when all of the following are true:

1. The light position visibly *lags* the pointer with a smooth, weighted
   feel. Snappy, instantaneous tracking is wrong. Sluggish, molasses-slow
   tracking is also wrong. The feel is cinematic, not responsive.
2. The lag feels identical on 60Hz and 120Hz displays.
3. The illumination falloff and the distortion field's spatial extent
   visibly share the *same* radius — distortion happens within the same
   bright pool where illumination happens, not in a different zone.
4. Faster mouse motion creates visibly stronger distortion than slow
   motion. The velocity input is doing real work.
5. Removing the cursor (e.g. pointer leaves the window) does not cause
   the light to jump or vanish, and velocity decays to zero.
6. The blur band at the bottom of the screen is *visibly unaffected* by
   cursor motion. The cursor passing under or over the blur does
   nothing to it.
7. The implementation file `src/systems/cursor/types.ts` matches §3 of
   this spec exactly — no extra fields, no extra methods.

---

## 7. Out of scope for this spec

These belong elsewhere; do not let them creep in here:

- The actual displacement field's storage, layout, write logic, and
  relaxation → `specs/video-compositing.md`.
- The UV-warp shader that samples the video through the displacement
  field → `specs/video-compositing.md`.
- The brightness shader formula → `specs/video-compositing.md`.
- The RGB shift / chromatic aberration, if present → keyed to the
  displacement field, in `specs/video-compositing.md`.
- Scroll behavior, the center-out reveal, the Phase 2 progress dial →
  `specs/scroll-transitions.md`.
- The blur band itself → `specs/video-compositing.md`.
- Library choice (Three.js) → `specs/tech-stack.md`.

This file is *only* about the cursor system as a typed, observable
source of truth. Everything that consumes it is described elsewhere.
