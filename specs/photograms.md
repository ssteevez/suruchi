# Photograms Interaction & Physics Prototype

This file serves as the formal handoff note from Antigravity (prototype) to Cursor (production), in accordance with `AGENTS.md`.

## Concept & Goal
The Photograms module renders a sequence of full-screen, high-resolution photographs as heavy, highly-tactile canvas sheets. Users progress through the gallery by scrolling. Each scroll dynamically and procedurally rips a hole in the current photograph. The final scroll releases the torn photograph, allowing it to organically peel off the wall, disintegrate along its tear lines, and billow away to reveal the next pristine photograph behind it.

## Interface Specifications

### Inputs
- A sequence of high-resolution images (`public/images/`)
- User scroll events (tracked via React `onWheel` / `useScroll`)
- Viewport dimensions (full-screen `react-three-fiber` canvas)

### Produces
- A WebGL scene containing two active cloths at any given time (the foreground active image, and the pristine background image waiting to be revealed).
- A background `WebWorker` running a custom Verlet integration physics engine at 60fps to calculate cloth dynamics and constraint tearing without blocking the main UI thread.

### Constraints & Rules (What it MUST NOT do)
- It MUST NOT use `MeshPhysicalMaterial` or complex noise shaders, as they crush WebGL performance. It MUST use `MeshStandardMaterial` combined with the generated coarse canvas normal map to achieve the physical weight.
- It MUST NOT use a `mix-blend-mode: overlay` CSS layer on top of the WebGL canvas.
- The top row of pins MUST NOT be instantly released upon drop. They must be sequentially unpinned based on the calculated structural damage (the number of broken constraints beneath them) to create the peeling/disintegration effect.
- Gravity MUST be kept exceptionally low (`0.0012`) during the drop, paired with the custom aerodynamic drag/parachute math, to ensure the cloth floats like silk rather than dropping like a brick.

## Architecture & State Machine

### 1. The React Thread (`main.tsx` & `ClothMesh.tsx`)
- Manages an `activeIndex` tracking the current foreground image, and a `fallingIndex` for the cloth currently dropping away.
- Triggers `worker.postMessage({ type: 'proceduralTear', ... })` on each standard scroll.
- Triggers `worker.postMessage({ type: 'drop' })` on the final scroll.
- Handles the custom high-contrast shadow camera setup (`ambientLight: 0.4`, `directionalLight: 1.4` with `2048x2048` map size and expanded frustum) to ensure tears cast deep, sharp shadows onto the image behind them.

### 2. The Physics Worker (`cloth.worker.ts`)
- Manages a `72x72` grid of particles (`particleCount: 5329`).
- Enforces structural constraints using Verlet integration (`damping: 0.996`, `iterations: 8`).
- **Tearing:** When a user scrolls, the worker deletes constraint links within a small radius. It then generates the updated `index` buffer and normal vectors for the broken mesh and transfers them back to the main thread via `ArrayBuffer` transfer to avoid memory leaks.
- **Dropping:** When commanded to drop, the worker calculates the damage per column, generates a sequential unpin delay for the top edge, and applies aerodynamic drag (a parachute effect on the lower half) to make the cloth fold over itself beautifully.

## Handoff Status
The prototype in `experiments/photograms/` is complete, tested, and approved by the Curator. It is ready for Cursor to audit against this spec and rebuild into `src/`.
