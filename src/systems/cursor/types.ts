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
 * nothing else.
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
