import type { CursorState } from '../systems/cursor/types';

interface WaterRippleEffectOptions {
  readonly maxRipples: number;
  readonly spawnVelocityThreshold: number;
  readonly rippleLifetime: number;
  readonly intensity: number;
}

type Ripple = {
  x: number;
  y: number;
  age: number;
  life: number;
  strength: number;
};

export class WaterRippleEffect {
  private readonly maxRipples: number;
  private readonly spawnVelocityThreshold: number;
  private readonly rippleLifetime: number;
  private readonly intensity: number;
  private readonly ripples: Ripple[] = [];
  private lastSpawnX = Number.NaN;
  private lastSpawnY = Number.NaN;
  private spawnCooldown = 0;

  constructor(options: WaterRippleEffectOptions) {
    this.maxRipples = Math.max(1, options.maxRipples);
    this.spawnVelocityThreshold = Math.max(0, options.spawnVelocityThreshold);
    this.rippleLifetime = Math.max(0.5, options.rippleLifetime);
    this.intensity = clamp(options.intensity, 0, 1);
  }

  update(cursorState: CursorState, dt: number): void {
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 1 / 60;
    this.spawnCooldown = Math.max(0, this.spawnCooldown - safeDt);

    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = this.ripples[i];
      if (!ripple) {
        continue;
      }
      ripple.age += safeDt;
      if (ripple.age >= ripple.life) {
        this.ripples.splice(i, 1);
      }
    }

    const velocity = Math.hypot(cursorState.velocity.x, cursorState.velocity.y);
    if (velocity < this.spawnVelocityThreshold || this.spawnCooldown > 0) {
      return;
    }

    const x = clamp(cursorState.lightUV.x, 0, 1);
    const y = clamp(cursorState.lightUV.y, 0, 1);

    if (Number.isFinite(this.lastSpawnX) && Number.isFinite(this.lastSpawnY)) {
      const moved = Math.hypot(x - this.lastSpawnX, y - this.lastSpawnY);
      if (moved < 0.022) {
        return;
      }
    }

    const strength = clamp((velocity / 1400) * (0.55 + this.intensity * 0.85), 0.05, 0.35);
    this.spawnRipple({
      x,
      y,
      age: 0,
      life: this.rippleLifetime * (0.88 + Math.random() * 0.24),
      strength,
    });

    this.lastSpawnX = x;
    this.lastSpawnY = y;
    this.spawnCooldown = 0.025;
  }

  getCount(): number {
    return this.ripples.length;
  }

  writeUniformData(target: Float32Array): void {
    target.fill(0);
    const maxCount = Math.min(this.ripples.length, Math.floor(target.length / 4));
    for (let i = 0; i < maxCount; i += 1) {
      const ripple = this.ripples[i];
      if (!ripple) {
        continue;
      }
      const base = i * 4;
      target[base] = ripple.x;
      target[base + 1] = ripple.y;
      target[base + 2] = clamp(ripple.age / ripple.life, 0, 1);
      target[base + 3] = ripple.strength;
    }
  }

  private spawnRipple(ripple: Ripple): void {
    this.ripples.unshift(ripple);
    if (this.ripples.length > this.maxRipples) {
      this.ripples.length = this.maxRipples;
    }
  }
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};
