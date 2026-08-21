# specs/video-compositing.md

The technical contract for how video is rendered on the SuruchiWebsite
homepage. This file replaces the earlier placeholder.

This spec inherits from `CONSTITUTION.md` (especially §3 and §6) and
from `specs/cursor-system.md` (for the `CursorState` interface) and
`specs/tech-stack.md` (for the Three.js dependency). It does not
contradict them. Where they appear to disagree, the upstream document
wins.

The audience is two-fold: Cursor and Antigravity build against this
file; Claude audits against it.

---

## 1. What this system is

A Three.js scene containing one full-viewport plane that displays the
homepage's dark video, distorted by a cursor-driven displacement field
and locally brightened around the cursor. The distortion is implemented
using the **DataTexture-driven grid displacement pattern** documented
in Codrops's "Pixel Distortion Effect with Three.js" (Yuriy Artyukh,
January 2022). That tutorial is the canonical reference for the
technique. This spec defines how that technique is wired into the
SuruchiWebsite homepage.

The cursor system (`specs/cursor-system.md`) provides position,
velocity, and radius. This spec consumes those values and produces the
visible video output. The two systems are decoupled — the cursor
system has no idea this spec exists, and any other consumer could
plug into the same `CursorState`.

---

## 2. The render scene

A minimal Three.js scene:

- One `OrthographicCamera` covering the full viewport in clip space
  (left -1, right 1, top 1, bottom -1).
- One `PlaneGeometry(2, 2)` mesh covering the whole frustum.
- One `ShaderMaterial` (or `RawShaderMaterial`) on that mesh, with the
  shaders defined in §6.
- **Six** `THREE.VideoTexture` objects, one per scene (`video-1.mp4`
  through `video-6.mp4`). All six `<video>` elements are created at
  startup with `autoplay muted loop playsInline preload="auto"` and
  `play()` is called immediately. Two are active per frame — the current
  scene (A) and the next scene (B) — driven by the scroll system
  (`specs/scroll-transitions.md §3`). Three.js updates them automatically
  each frame. (Future: lazy-load only the active + next scenes to reduce
  startup bandwidth — see STATE.md.)
- A `THREE.DataTexture` storing the displacement field (see §3).
- One `THREE.WebGLRenderer` at `min(window.devicePixelRatio, 2)`.

No lighting, no other geometry, no postprocessing passes. Three.js's
scene graph is overkill for this — but Three.js is the chosen library
(see `specs/tech-stack.md` §3), and using its conventional scene
constructs is simpler than fighting them.

Resize handling: on viewport resize, update the renderer's size and
the displacement field's aspect-correction uniform. The camera does
not change.

---

## 3. The displacement field — DataTexture storage

The displacement field is a small `THREE.DataTexture` storing
per-cell displacement vectors.

- **Dimensions.** A grid of roughly **128 × 64 cells** (landscape
  aspect). Adjustable. Each cell stores one RGBA value.
- **Channel meaning.**
  - **R channel:** X displacement, scaled to a usable shader range
    (positive = push right, negative = push left).
  - **G channel:** Y displacement.
  - **B channel:** "intensity" — a scalar that drives any
    secondary effects (e.g. RGB shift, see §7). Decays alongside
    R and G.
  - **A channel:** reserved. Set to 1.0.
- **Storage format.** `THREE.FloatType` with `THREE.RGBAFormat`. Use
  floats; do not pack into bytes — the dynamic range of displacement
  values matters more than memory savings at this resolution.
- **Filtering.** `THREE.LinearFilter` for both min and mag. Wrapping
  set to `THREE.ClampToEdgeWrapping`. We want smooth interpolation
  across cells; we do not want wrap-around at the screen edges.

This DataTexture is the single source of truth for distortion at any
given frame. Read every fragment-shader frame; written every frame by
the cursor-write step (§4) and the relaxation step (§5).

---

## 4. The cursor-write step (per frame, before render)

Every frame, before `renderer.render()` runs, a JavaScript routine
"stamps" the cursor's current influence into the DataTexture.

Input: `CursorState` from the cursor system (`lightUV`, `velocity`,
`radius`).

Algorithm:

1. Compute the cursor's grid coordinate: `cellX = lightUV.x *
   gridWidth`, `cellY = lightUV.y * gridHeight`.
2. Compute the radius in grid-cell units: `radiusInCells = (radius /
   viewportWidth) * gridWidth`. Use viewport width for both axes to
   keep the influence circular in screen space.
3. For each cell within `radiusInCells` of `(cellX, cellY)`:
   - Compute distance from cell to cursor.
   - Compute falloff: `falloff = 1 - smoothstep(0, radiusInCells,
     distance)`.
   - Compute the direction from cursor to cell:
     `dirX = (cellX - cell.x) / distance`,
     `dirY = (cellY - cell.y) / distance`.
   - Compute force magnitude from velocity:
     `force = clamp(velocityMagnitude * forceScale, 0, maxForce)`.
   - Add to the cell's R: `falloff * force * dirX`.
   - Add to the cell's G: `falloff * force * dirY`.
   - Add to the cell's B: `falloff * (force / maxForce)` —
     normalized 0..1 intensity.
4. Mark the DataTexture's `needsUpdate = true` so Three.js uploads
   the changes.

The direction vector points **from the cursor to the cell** — i.e.
cells are pushed *away* from the cursor, as if the cursor is shoving
the video surface aside. Inverting this direction (cells pulled toward
the cursor) is wrong and would feel like suction.

Tunable constants (start with these values, refine on the curator's
review): `forceScale = 0.005`, `maxForce = 0.5`.

Important: this step writes **additively** into the existing field
values, not overwriting them. The previous frame's residual force is
still there and will be reduced by the relaxation step (§5). The
combination is what produces the visible trail.

---

## 5. The relaxation step (per frame, after cursor write)

Every frame, after the cursor write, the DataTexture's values decay
toward zero. This is what makes the distortion "spring back" when
the cursor leaves an area.

Algorithm: multiply every cell's R, G, B by a decay factor `relax`
each frame.

Tunable starting value: `relax = 0.93`. Lower = faster snapback,
higher = longer-lasting trail. The trail length the curator wants is
calibrated by adjusting this single value.

For a frame-rate-independent implementation: `relax = Math.pow(0.93,
dt * 60)`. This keeps the visible trail behavior consistent across
60Hz and 120Hz.

Implementation note: the cursor write and the relaxation step happen
on the CPU, looping over the DataTexture's pixel array. This is
cheap at 128×64 = 8192 cells per frame. If profiling later shows
this is a bottleneck, the work can be moved to a `GPUComputationRenderer`
fragment shader — but do not optimize preemptively.

---

## 6. The shaders

### `video.vert` — passthrough vertex shader

Pass through the plane's UVs to the fragment shader. No vertex
displacement at this stage — the displacement happens in fragment-space
UV sampling, not vertex-space position. Standard `gl_Position =
projectionMatrix * modelViewMatrix * vec4(position, 1.0)`.

### `video.frag` — UV-warp + brightness + cross-dissolve fragment shader

The fragment shader receives:

- `uniform sampler2D uVideoTextureA` — the current scene video frame.
- `uniform sampler2D uVideoTextureB` — the next scene video frame.
- `uniform float uBlendProgress` — 0..1 cross-dissolve progress from the
  scroll system. 0 = fully A, 1 = fully B.
- `uniform sampler2D uDisplacement` — the DataTexture from §3.
- `uniform vec2 uLightUV` — from `CursorState`.
- `uniform float uRadiusUV` — `radius / viewportWidth`, the radius in
  UV space.
- `uniform float uRestBrightness` — the resting darkness of the video
  (default `0.40`, controllable at runtime — see §8).
- `uniform vec2 uResolution` — for aspect-correct distance.
- `uniform float uRGBShift` — the strength of the RGB split (default
  `0.0` initially, see §7).

**Warp sign convention:** The displacement field stores vectors pointing
*away* from the cursor. The shader *subtracts* the displacement from the UV,
which moves the sampling point in the opposite direction — producing the
correct visual of the video surface being pushed away from the cursor.
`warpedUV = vUv − displacement.rg × warpFactor`.

**Transition warp amplification:** During a cross-dissolve, the outgoing
scene's warp is briefly scaled up as `blend` increases, and the incoming
scene's warp is scaled down. This gives the transition a brief "stretch"
quality. The constants are `outgoingWarp = 0.022 × (1 + blend × 0.8) × (0.35 + 0.65 × intensity)`,
`incomingWarp = 0.022 × (1 + (1 − blend) × 0.5) × (0.35 + 0.65 × intensity)`.

Algorithm:

```glsl
// 1. Sample displacement at this fragment's UV.
vec4 displacement = texture2D(uDisplacement, vUv);
float intensity = displacement.b;
float blend = smoothstep(0.0, 1.0, uBlendProgress);

// 2. Compute per-video warp factors (amplified at transition).
float outgoingWarp = 0.022 * (1.0 + blend * 0.8) * (0.35 + 0.65 * intensity);
float incomingWarp = 0.022 * (1.0 + (1.0 - blend) * 0.5) * (0.35 + 0.65 * intensity);

// 3. Sample each video through its warped UV (minus = push away from cursor).
vec2 warpedA = vUv - displacement.rg * outgoingWarp;
vec2 warpedB = vUv - displacement.rg * incomingWarp;
float shift = uRGBShift * intensity;
vec3 colorA = sampleVideo(uVideoTextureA, warpedA, shift);
vec3 colorB = sampleVideo(uVideoTextureB, warpedB, shift);
vec3 videoColor = mix(colorA, colorB, blend);

// 4. Compute aspect-correct brightness falloff around the cursor.
vec2 aspectUV = vec2(vUv.x * (uResolution.x / uResolution.y), vUv.y);
vec2 aspectLight = vec2(uLightUV.x * (uResolution.x / uResolution.y), uLightUV.y);
float dist = distance(aspectUV, aspectLight);
float aspectRadius = uRadiusUV * (uResolution.x / uResolution.y);
float falloff = 1.0 - smoothstep(0.0, aspectRadius, dist);

// 5. Combine brightness with the warped, dissolved video.
float brightness = uRestBrightness + falloff * (1.0 - uRestBrightness);
gl_FragColor = vec4(videoColor * brightness, 1.0);
```

Where `sampleVideo` handles the RGB shift: when `uRGBShift > 0.0`, it
samples R, G, B at slightly offset UVs (keyed to `shift = uRGBShift ×
intensity`); otherwise it samples normally.

The aspect correction in step 3 ensures the bright pool is visually
circular, not stretched to an oval on landscape viewports.

---

## 7. RGB shift — keyed to the displacement field

A subtle RGB channel split (chromatic aberration) is permitted in
distorted regions. It is **not** a separate effect — it is part of
the elastic distortion, and is keyed to the displacement field's B
channel ("intensity"). Where displacement is zero, RGB shift is zero
and the video is sampled cleanly.

Default `uRGBShift = 0.0` — the prototype starts with RGB shift OFF.
The curator turns it on after seeing the base distortion, by setting
a non-zero value via the runtime hook (§8). Recommended exploration
range: `0.005` to `0.020`. Higher values look glitchy in a way
inconsistent with the Constitution's aesthetic — restraint applies
here too.

If the curator decides the RGB shift is unwanted, leave `uRGBShift`
at `0.0` and the effect is invisible. The code path stays in the
shader for revertibility.

## 7a. Curator-approved ripple extension

The optional water ripple pass is approved as part of the cursor's elastic
distortion expression, not as a fourth homepage layer. It is gated behind
`?ripple=1` while it remains under visual review. When enabled, it writes
additional UV offset into the same video shader path as the displacement
field; it does not add particles, DOM elements, scroll behavior, or a new
interaction surface.

Before production launch, the curator either ratifies this as the default
distortion behavior or removes the query-gated code path.

---

## 8. Runtime tuning hooks

Two values are exposed for live tuning during the prototype phase:

- `window.suruchiPrototype.setRestBrightness(value)` — sets
  `uRestBrightness`. Default `0.40`. Useful range `0.20` to `0.60`.
- `window.suruchiPrototype.setRGBShift(value)` — sets `uRGBShift`.
  Default `0.0`. Useful range `0.005` to `0.020`.

These are temporary. Mark each with a code comment: `// TUNING HOOK
— remove before production.` No other runtime tuning hooks may be
added without curator approval.

The displacement constants (`forceScale`, `maxForce`, `relax`) are
**not** runtime-tunable in this iteration. Changing them requires
editing the source and reloading. This is deliberate — the
displacement physics should not become a knob-festival; if a value
needs frequent tuning, that is information about the spec, not a
reason to add more hooks.

---

## 9. The blur band

The bottom-of-viewport blur band defined in `CONSTITUTION.md` §4
is **not** part of this spec yet. The prototype does not implement
it. It will be added in a later pass to this spec once the
distortion pipeline is validated, because adding both at once means
debugging both at once.

When the blur band is added, it will be a separate render pass
positioned over the video plane in a defined screen-space rectangle.
It will sample from the (already-distorted) video output and apply
a Kawase or similar multi-pass blur with a gradient strength along
the vertical axis. It will be unaware of the cursor entirely.

---

## 10. Performance budget

- 60 fps on the curator's reference machine at 1440px wide, full
  effect on.
- DataTexture writes (cursor + relax) cost at 128×64 = ~8000 cells
  per frame should be well under 1ms on the CPU.
- Fragment shader cost dominated by video texture sampling. The RGB
  shift triples that cost when enabled; if performance suffers with
  RGB shift on, reduce shift to one extra sample (one channel
  shifted, others on the same UV) rather than disabling it entirely.
- `devicePixelRatio` capped at 2.

If performance falls short of 60 fps on the curator's machine, the
first lever is to halve the renderer resolution and let the browser
upscale — this is invisible at the dim-video aesthetic and is far
cheaper than reducing the distortion grid.

---

## 11. What "working" looks like

The video-compositing system is working when all of the following are
true:

1. The video plays, dimmed to `uRestBrightness` everywhere by default.
2. Moving the cursor produces visible warping of the video around the
   cursor's location. The warp follows the cursor with the cinematic
   lag from the cursor system.
3. Fast cursor motion produces visibly stronger warping than slow
   motion (velocity is doing work).
4. When the cursor stops moving, the warp visibly relaxes back to flat
   over roughly half a second. The exact duration is the `relax`
   constant.
5. The bright pool of illumination is visually circular, centered on
   the lagged cursor position, and the warp happens within the same
   pool — not in a different region.
6. With `uRGBShift = 0.0`, no color split is visible. With
   `uRGBShift = 0.01`, a subtle color trail is visible only in
   actively distorted regions; static regions are clean.
7. `npx tsc --noEmit` passes with strict mode.

---

## 12. Out of scope for this spec

- The cursor system itself → `specs/cursor-system.md`.
- The center-out scroll reveal and the Phase 2 progress-dial →
  `specs/scroll-transitions.md`.
- The Phase 2 three-column gateway visual treatment → a future spec.
- Audio response, head tracking, books mini-site, exhibition module —
  all out of scope; later quests.
