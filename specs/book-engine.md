# Book Engine — Build Spec

**Status:** Handoff to Production (Frozen Experiment)
**Lives at:** `experiments/book-engine/` (Reference)
**Target Production Path:** `src/components/book/` or similar
**Aesthetic Anchor:** A heavy, physical art book resting in a dark cinematic studio environment. High-contrast golden rim light, deep shadows, tactile film grain, and 1-to-1 physical page turning.

---

## The Core Philosophy

The book MUST NOT look like a "3D model of a book". It must look like a real physical book that happens to be rendered in 3D. Imperfections like film grain, bloom, and soft shadows are required to ground it in reality.

---

## Architectural Constraints & Solutions

The primary challenge of this system was creating the illusion of 50+ pages turning individually, without actually rendering 50+ high-resolution physics-enabled page meshes (which destroys memory and framerate).

### 1. The Block / Page Separation
- **The System:** The book is rendered as two solid static blocks (Left Stack and Right Stack) sitting underneath the active pages. Only the pages *currently turning* are rendered as individual curved meshes.
- **The Hand-off:** When a page lifts off the Right Stack, the texture on the top of the Right Stack must instantly update to the *next* page. When the turning page lands on the Left Stack, it instantly becomes the new top texture of the Left Stack.

### 2. The React 1-Frame Lag Bug (CRITICAL)
- **Problem:** Updating the block textures using React `useState` (`setRightTex`, `setLeftTex`) causes a 1-to-2 frame lag. Because the 3D graphics loop runs continuously while React state updates wait for the next render commit, the old texture ghosts on the block for a fraction of a second.
- **Solution:** Bypass React state completely for the static block textures. Inject direct memory references (`useRef<THREE.MeshStandardMaterial>`) into the block materials, and synchronously mutate `.map` and `.color` inside the animation frame exactly when the page threshold is crossed.

### 3. Spine Clipping & The Lift Arc
- **Problem:** When a flat, rigid 3D plane rotates 180 degrees from right to left, the center (the spine) sinks downward into the 3D space, clipping through the static blocks beneath it.
- **Solution:** The `ActivePage` vertex shader injects a `liftArc`. We use `sin(progress * PI)` to calculate the apex of the turn, and push the vertices upward on the Z-axis by a set `LIFT_HEIGHT`, mathematically guaranteeing the page clears the blocks underneath during rotation.

### 4. Floating Point Asymptotes in Reverse Flips
- **Problem:** When flipping backwards, `Math.ceil` and `Math.floor` fail to accurately sync the block stacks because floating-point precision causes the math to hover infinitely close to integers without crossing them.
- **Solution:** Use strict threshold values for the block sync: `if (progress >= 0.995)` (landed left) and `if (progress <= 0.005)` (landed right).

### 5. Memory Management (TextureManager)
- Loading 50+ 2400px textures will crash mobile browsers.
- The `TextureManager` operates an `AbortController`-backed subscription system. It only loads a window of `[-2, +2]` textures around the current page.
- It loads `1200px` textures during rapid `TURNING` states, and upgrades to `2400px` textures only when the book is `SETTLED`.

---

## Visual Aesthetic & Post-Processing

### Cinematic Film Grain & Vignette
- The `background` MUST NOT be a CSS gradient behind the canvas. If it is, the 3D book is disconnected from the background.
- The background is set *inside* Three.js (`<color attach="background" args={['#121110']} />`).
- The `EffectComposer` runs a `Noise` pass (film grain) and `Vignette` over the *entire scene*. This visually unifies the book and the dark background, making it look like it was shot on analog film.

### Six-Point Lighting Rig
1. **Front Ambient:** Very subtle base visibility (`intensity: 0.02`).
2. **Main Front Directional:** Top-right, warm white, casts the primary soft drop shadow.
3. **Fill Front Directional:** Left side, cool white, fills harsh shadows.
4. **Golden Core SpotLight:** `[0, 1.0, -6]`, directly behind the book. Intense golden white that bleeds through the edges.
5. **Golden Wrap SpotLight:** `[0, 0, -8]`, wide angle amber that wraps the spine in warmth.
6. **Ambient Golden SpotLight:** `[0, 0, -10]`, furthest back, washes the scene in sunset orange.

---

## Interface Definition (Cursor Handoff)

When Cursor re-implements this in `src/`, the component should take the following props:
- `images: string[]` — An array of high-resolution image URLs.
- `onPageChange?: (index: number) => void` — Callback for when a page settles.
- `mode: 'SHOWCASE' | 'READING'` — Showcase rotates the book slightly with the mouse; Reading locks it center for interaction.

**What Cursor Must Not Do:**
- Do not re-introduce React state for syncing the `PageBlockAssembly` textures. Keep the ref mutation.
- Do not put the background outside of the WebGL canvas; it breaks the film grain unification.
- Do not remove the `zOffset` epsilon (`0.002`) logic, or severe Z-fighting will occur on the stacks.
