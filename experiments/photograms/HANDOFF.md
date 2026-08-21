# Photograms Tearing Experiment — Handoff

This document describes the interface and constraints for promoting the photograms tearing prototype to production.

## What it takes in
- A sequence of photogram image paths (currently defined in `images.ts`).
- Scroll events (`wheel`) on the window to procedurally rip the cloth.
- The `zOffset` parameter to stack the cloth layers properly.

## What it produces
- A React Three Fiber scene where each image is rendered as a procedurally tearable verlet-integrated cloth (`ClothMesh`).
- A Web Worker (`cloth.worker.ts`) that runs the heavy physics simulation to avoid blocking the main UI thread. It exposes a `proceduralTear` method that breaks cloth constraints in localized elliptical regions.
- Progressive disclosure: scrolling 3-5 times causes the cloth to progressively tear, followed by a dramatic "drop" that reveals the next cloth layer beneath it.

## What it must not do
- **Do not run physics on the main thread.** The vertex buffer array transfers and calculations must remain isolated in the Worker.
- **Do not stack interactive layers indiscriminately.** Only the top-most unbroken cloth should receive `tearTrigger` events. 
- **Do not mutate the passed geometry attributes directly outside the worker message handler.** All vertex positions and normals are owned by the simulation step.
- **Do not let memory leak.** The worker lifecycle (init/dispose) must be tied strictly to the cloth mesh lifecycle.
- **Do not run 6 workers at once.** Implement visibility culling so only the active front cloth and the one immediately behind it are rendered. This prevents physics threads from multiplying out of control.
- **Do not instantly advance the layer index.** When a cloth is marked dropped, wait for its fall animation to conclude (e.g. 2.8 seconds) before shifting interactivity and advancing the active layer index, so the transition feels physical rather than instantaneous.

## Implementation Notes for Cursor
- **Scroll-driven tearing:** Interaction is driven by the `wheel` event passed through a debounced state machine (`320ms` delay to prevent trackpad flooding) in the main scene. Mouse grab/drag has been entirely removed.
- **tearTrigger:** The parent scene passes a `tearTrigger` integer to the `ClothMesh`. Each increment causes the mesh to dispatch a `proceduralTear` message to its worker with random tear origin parameters.
- Ensure `noUncheckedIndexedAccess` rules are followed. The worker uses non-null assertions `!` since typed arrays are initialized fully at the start.
