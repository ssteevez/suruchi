# I Was Not Among My Kind, Distinctive (Spec)

## 1. Overview
This experiment is a cinematic, deeply immersive Three.js environment that acts as the dedicated page for the "I Was Not, Among My Kind, Distinctive" series. It translates the poetic themes of the work into a massive 700vh WebGL scroll sequence where independent image planes elegantly collapse into a shared structural cylinder, followed by a dark, meditative dive into the tunnel.

## 2. Core Behavior
- **Input:** Takes an array of 6 image paths from the `raw-images/painter/i-was-not-among/` directory.
- **Interaction:** Driven entirely by native window scrolling (`onScroll`), mapped to a physics-damped spring tracker to ensure buttery smooth transitions regardless of scroll wheel velocity.
- **Scroll Track:** The layout relies on a fixed `100dvh` WebGL canvas sitting behind a `700vh` scrollable empty div.

## 3. The 3D Choreography (The Timeline)
- **Phase 1: Pure Intro (0.0 to 0.05)**
  - The scene is entirely dark except for the central title, the intro text block, and a bouncing "Scroll to view" prompt. The images are completely invisible.
  - The camera sits perfectly flat at eye level outside the structure (`Y=0, Z=16`).
  - As soon as the user scrolls, the intro text begins to vanish rapidly.
- **Phase 2: The Wide Showcase (0.05 to 0.35)**
  - The images fade in as flat, independent planes floating in a massive ring (`radius + 8.0`). 
  - The massive ring spins slowly, completing *exactly* one full 360-degree rotation (calculated dynamically) so the viewer sees every image undistorted.
- **Phase 3: The Convergence (0.35 to 0.45)**
  - The wide gaps elegantly close as the planes pull inward to the base radius (`4.0`).
  - **Crucial Tech:** The planes utilize a custom GLSL vertex shader (`onBeforeCompile`) that dynamically bends them in real-time. By the time they touch, they stitch together edge-to-edge to form a perfect, continuous curved cylinder.
  - The camera rises up and over the top rim of the newly formed cylinder.
- **Phase 4: Cinematic Sway (0.45 to 0.65)**
  - The camera dives inside the cylinder to a locked Y-axis (`2.5`).
  - The camera performs a slow, rhythmic sine-wave sway on the X-axis as it pushes downward, simulating the chaotic feeling of falling or sinking.
- **Phase 5: The Deep Push (0.65 to 1.0)**
  - The sway stops. The camera drops smoothly into the dark void at the bottom.
  - Paragraphs 2-5 of the poetic text fade in and out sequentially against the dark void.

## 5. Interface & Migration Notes
Cursor should re-implement this inside `src/` under the Painter section. 
The WebGL component should be placed directly inside the standard site layout (which already includes the "Suruchi Choksi" global header and navigation). The `HTMLOverlay` from the experiment should be migrated as standard React/CSS layers positioned over the canvas, using `mix-blend-mode: difference` so the text remains legible over both the dark void and the bright images.
