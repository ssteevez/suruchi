# Beach Balloon Shooting — Build Spec

**Status:** Experiment  
**Lives at:** `experiments/beach-shooting/`  
**Entry point:** `experiments/beach-shooting/index.html`  
**Aesthetic anchor:** Indian beach shooting stalls (Tamil Nadu/Chennai coast) — capsule balloons packed on a metal board, toy air rifle, warm amber light, salt haze, sand grain.

---

## Cultural Context

The reference is a classic beach-stall shooting game found on Indian coastal beaches. A metal board is loaded with rows of small two-tone capsule-shaped toy balloons (think elongated pill shape, not round — upper half one colour, lower half another). You rest a lightweight toy air rifle on a wooden bench rest, aim through an open barrel, and try to pop balloons to win prizes. The visual language is: dense colourful capsule grid, chalky hand-painted score boards, rough wood, warm evening light, faint sea haze.

---

## Perspective and Layout

### Camera / View
- **First-person** — the player looks down an open barrel/sight toward the balloon board.
- The barrel appears in the lower-centre of the screen as a subtle dark circular vignette framing device (optional: a cylindrical inner ring suggesting the rifle bore).
- The balloon wall fills roughly 55–65% of the vertical viewport, centred horizontally, slightly back (depth cue via slight perspective foreshortening).

### Balloon Wall
- Grid of **capsule-shaped** balloons — SVG or Canvas path: two arcs joined at equator, upper and lower halves different colours.
- Layout: approximately **7 columns × 5 rows = 35 balloons** (configurable). Stagger optional.
- Each balloon assigned a random two-tone colour pair from a warm, saturated Indian palette — marigold/vermillion, cyan/hot pink, lime/violet, cobalt/orange, etc.
- Small horizontal tie-wire across each row, faint shadow beneath each balloon, subtle ambient oscillation (each balloon bobs gently ±2–3px on its own slow sine wave with individual phase/frequency so the wall breathes).
- Balloons are backed by a **metal board** — painted flat dark green or cream, slightly peeling, studded edges.

---

## Aiming Mechanic

- The **crosshair / aim point** follows the mouse (or touch position on mobile).
- The crosshair is a fine hair-cross with a small circle at centre — styled like a painted target marker, not a digital HUD.
- **The crosshair does NOT map 1:1 with the mouse.** The mouse sets the *intended* aim; a simulated drift/disturbance perturbs the actual shot direction continuously. The gap between "where you intend" (mouse) and "where you'll actually shoot" (live aim dot) is the core challenge.

---

## Disturbance System — Mixed Randomised

All three disturbance types run simultaneously, combined by addition:

### 1. Sinusoidal Sea-Breeze Drift
- A slow oscillating offset: `sin(t * freqA) * ampA` on X, `cos(t * freqB) * ampB` on Y.
- `freqA ≈ 0.4–0.7 Hz`, `freqB ≈ 0.3–0.5 Hz` (slightly different so X and Y drift independently).
- Amplitude `ampA ≈ ampB ≈ 18–28px` in screen space.
- Both frequency and amplitude should slowly wander over time (modulate with a very slow secondary sin, period ~12–18s) so no two moments feel identical.

### 2. Wind Gust Events
- Randomly scheduled gusts (Poisson-distributed, mean gap ~4–7s).
- Each gust: a short lateral impulse that ramps up over ~0.3s and decays over ~0.8–1.2s.
- Direction: mostly horizontal (sea-to-shore) with small Y component.
- Max gust offset: ~40–60px.
- A faint visual tell ~0.2s before a gust peaks — subtle screen-edge grain brightening or a barely visible ripple of sand particles — gives a hint but not a clear warning.

### 3. Micro-Jitter (Random Walk Noise)
- Per-frame smooth noise (Simplex or Perlin, or a low-pass filtered random walk).
- Small amplitude: ±6–10px, high frequency compared to the sea-breeze.
- Gives the feel of your hands/breathing never being fully still.

### Combining
```
actualAimX = mouseX + seaBreezeDX + gustDX + jitterDX
actualAimY = mouseY + seaBreezeDY + gustDY + jitterDY
```
The "live aim dot" (or crosshair drift indicator) shows `actualAim`. The player tries to compensate by moving the mouse so that `actualAim` lands on the balloon they want to pop.

---

## Firing

- **Left click** or **Space** to fire.
- The shot is evaluated at the `actualAim` position at the exact moment of firing (not the mouse position).
- A brief lock-frame (≤16ms) — disturbance is frozen for one frame at fire moment so the outcome is deterministic.
- **No cooldown between shots** — fire as fast as you like (simulates air rifle trigger). Optional: a very short 120ms recock animation on the barrel vignette.

---

## Balloon Pop

### Instant Pop
- Balloon **instantly vanishes** (no slow animation delay).
- On pop: a burst of **~12–16 colour particles** launches radially from the balloon centre.
  - Particles are small filled circles or tiny shard polygons in the two colours of that balloon.
  - Physics: initial velocity ~200–350px/s outward, gravity pulls them down (~400px/s²), 300–500ms lifetime, fade out.
- A short **pop sound** (optional/placeholder): a small synthetic click or a base64-encoded short audio blob if feasible.
- The balloon's grid slot remains **empty** — the board shows a bare metal peg/stub where the balloon was.
- No respawn during a session (board clears progressively as you play).

---

## Visual Aesthetic

### Required texture/atmosphere (the "more texture" directive):

1. **Film grain overlay** — a fixed-size canvas element on top of everything, redrawn each frame with low-opacity salt-and-pepper noise. Intensity: subtle but present (opacity ~0.04–0.07).

2. **Vignette** — a radial gradient darkening at the corners and along the barrel aperture edges. The barrel opening itself should be the brightest zone.

3. **Warm colour grade** — overall scene leans warm amber/golden (beach late afternoon light). Implement via a CSS `mix-blend-mode: multiply` or `color` overlay layer, or via canvas globalCompositeOperation.

4. **Sand particle ambient** — a handful (~20–30) of very fine dust/sand particles drifting across the scene slowly, leftward, fading in/out. Not distracting, just present like lens dust.

5. **Background** — behind the balloon board: a blurred, low-contrast beach background — blurry distant sea, hazy sky meeting sand. Can be a simple CSS radial gradient (sky blue-grey fading to warm sand at bottom) rather than a photograph. Optional: a subtle horizon line.

6. **Board weathering** — the metal board has a faint painted texture: slightly off-white or dark green with faint brush-stroke noise, worn corners. Achievable with a canvas fill + noise pass or an SVG filter.

7. **Score board** — a small chalky hand-painted-style score display in one corner. Font: monospace or a rough-edged bitmap-feel font. Shows current pop count out of total.

---

## Technical Approach

### Rendering
- **Canvas 2D** is sufficient and preferred (no WebGL needed unless particle count demands it).
- Single `<canvas>` fullscreen, RAF loop.
- Draw order each frame:
  1. Background (sky/sand gradient)
  2. Sand particles (ambient)
  3. Metal board (rect + texture pass)
  4. Tie-wires (thin horizontal lines)
  5. Balloons (alive ones, with bob offset applied)
  6. Particles from recent pops (in-flight burst particles)
  7. Barrel vignette (dark radial overlay at edges)
  8. Crosshair / aim indicator
  9. Film grain overlay
  10. Score display (Canvas text or DOM overlay)

### State
```typescript
interface BalloonState {
  id: number;
  col: number;
  row: number;
  alive: boolean;
  colorTop: string;
  colorBottom: string;
  bobPhase: number;       // individual phase offset for bob oscillation
  bobFreq: number;        // individual frequency
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  alpha: number;
  life: number;         // 0–1, 1 = just born
  maxLife: number;      // ms
}

interface DisturbanceState {
  seaBreeze: { phase: number; freqX: number; freqY: number; ampX: number; ampY: number; };
  gust: { active: boolean; dx: number; dy: number; progress: number; duration: number; nextGustAt: number; };
  jitter: { x: number; y: number; };   // updated via random walk each frame
}
```

### File Structure
```
experiments/beach-shooting/
├── index.html
├── main.ts           (or main.js — match project convention)
├── balloons.ts       (balloon layout, draw, pop logic)
├── disturbance.ts    (drift/gust/jitter system)
├── particles.ts      (pop burst particle system)
├── renderer.ts       (background, grain, vignette, score)
└── audio.ts          (optional — placeholder pop sfx)
```

### No external dependencies
- Pure Canvas 2D + TypeScript.
- No Three.js, no physics library, no game engine.
- Should compile cleanly under the existing Vite config (add entry to `vite.config.ts` if needed).

---

## Interaction Summary

| Action | Result |
|--------|--------|
| Move mouse | Intended aim tracks cursor; actual aim drifts with disturbance |
| Click / Space | Fire at actual aim position |
| Hit balloon | Instant pop + particle burst |
| Miss | Nothing — disturbance continues |
| All balloons cleared | "Board cleared" message + optional restart prompt |

---

## Out of Scope (v1)

- Scoring / high-score persistence
- Rounds / lives / timer (to be designed after core system works — per curator instruction)
- Sound design beyond a placeholder pop click
- Mobile touch full implementation (basic touch should work, fine-tuning later)
- Leaderboard, networking, save state

---

## Vibe Reference

Indian beach evenings. The overhead bulb swings slightly. The board smells like old paint and rubber. The balloons catch the amber light and cast soft shadows. You lean forward on the wooden bench rest, squint one eye, and the barrel sways gently with the sea breeze. The stall owner watches with arms crossed. Pop one. Pop another. The torn rubber nub hangs from the peg.

That's the feel.
