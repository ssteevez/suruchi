# After Image Carousel (Spec)

## 1. Overview
The After Image Carousel is an immersive, physics-driven 3D gallery designed to display a series of artworks. It operates as an endless, asymmetrical loop where cards fan out densely on the left side of the screen and instantly vanish as they are dragged to the right.

## 2. Core Behavior
- **Input:** Takes an array of image source strings.
- **Interaction:** Driven by `onPan` (drag) and `onWheel` (scroll) events. The raw drag distance is mapped to a highly damped physics spring (Mass 8, Stiffness 120) to simulate extreme physical weight.
- **Motion Mapping:** Uses a wrapping math function (`wrappedDist`) to allow the images to infinitely loop without resetting the physical drag accumulator.

## 3. Layout & Presentation
- **Placement:** The entire carousel is anchored to the right side of the screen (`right: 25vw`) to ensure the left side is completely free for typography (the Zero Plus header/nav style).
- **Asymmetry:**
  - Left Side: Cards are scaled down, pushed back in Z-space, heavily shadowed, and turned sharply inward (`rotateY` up to 60 degrees) to show their edges.
  - Right Side: Cards instantly fade to `opacity: 0` immediately after passing the center spot. There is no right-side stack.

## 4. Lighting & Shadows
- **Background:** The environment must be pure, clean black (`#050505`). There are no glowing background blobs or ambient rims.
- **Shadows:** Each card casts a massive, deep drop shadow (`0 60px 120px -20px rgba(0,0,0,1)`).
- **Ambient Occlusion:** Cards deeper in the left stack receive a heavy black `opacity` overlay (up to 80% black) so they fade into the darkness.
- **Incident Spotlight:** The active center card receives a hard-coded CSS spotlight overlay (`radial-gradient(circle at 50% -20%, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)`). This explicitly simulates light hitting the top of the canvas and casting a vignette shadow on the bottom. **Crucial:** Do not use CSS blend modes (like `mix-blend-mode: soft-light`) for this light, as it fails to render visibly on dark paintings or specific browsers.

## 5. Interface
Cursor should implement this inside `src/` (likely within the Painter / Zero Plus routes) as a drop-in replacement or addition, ensuring the parent container provides full viewport bounds and no overflow clipping. The data array should be populated with the Suruchi Choksi "After Image" collection.
