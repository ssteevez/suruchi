import * as THREE from 'three';
import type { CursorState } from '../systems/cursor/types';

interface DistortionFieldOptions {
  readonly width: number;
  readonly height: number;
  readonly forceScale: number;
  readonly maxForce: number;
}

export class DistortionField {
  private readonly width: number;
  private readonly height: number;
  private readonly forceScale: number;
  private readonly maxForce: number;
  private readonly data: Float32Array;
  private readonly scratch: Float32Array;
  private readonly texture: THREE.DataTexture;

  constructor(options: DistortionFieldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.forceScale = options.forceScale;
    this.maxForce = options.maxForce;
    this.data = new Float32Array(this.width * this.height * 4);
    this.scratch = new Float32Array(this.width * this.height * 4);

    for (let index = 0; index < this.width * this.height; index += 1) {
      this.data[index * 4 + 3] = 1.0;
    }

    this.texture = new THREE.DataTexture(
      this.data,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  getTexture(): THREE.DataTexture {
    return this.texture;
  }

  update(cursorState: CursorState, viewportWidth: number, dt: number): void {
    const safeWidth = Math.max(viewportWidth, 1);
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 1 / 60;

    this.writeCursorInfluence(cursorState, safeWidth);
    this.propagateAndRelax(safeDt);
    this.texture.needsUpdate = true;
  }

  private writeCursorInfluence(cursorState: CursorState, viewportWidth: number): void {
    const cellX = cursorState.lightUV.x * this.width;
    const cellY = cursorState.lightUV.y * this.height;
    const radiusInCells = (cursorState.radius / viewportWidth) * this.width;

    if (radiusInCells <= 0) {
      return;
    }

    const velocityMagnitude = Math.hypot(cursorState.velocity.x, cursorState.velocity.y);
    const force = Math.min(this.maxForce, velocityMagnitude * this.forceScale);
    if (force <= 0) {
      return;
    }

    const minX = Math.max(0, Math.floor(cellX - radiusInCells));
    const maxX = Math.min(this.width - 1, Math.ceil(cellX + radiusInCells));
    const minY = Math.max(0, Math.floor(cellY - radiusInCells));
    const maxY = Math.min(this.height - 1, Math.ceil(cellY + radiusInCells));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - cellX;
        const dy = y - cellY;
        const distance = Math.hypot(dx, dy);

        if (distance <= 0.0001 || distance >= radiusInCells) {
          continue;
        }

        const falloff = 1 - smoothstep(0, radiusInCells, distance);
        const dirX = dx / distance;
        const dirY = dy / distance;
        const index = (y * this.width + x) * 4;

        const currentX = this.data[index] ?? 0;
        const currentY = this.data[index + 1] ?? 0;
        const currentB = this.data[index + 2] ?? 0;

        this.data[index] = clampSigned(currentX + falloff * force * dirX);
        this.data[index + 1] = clampSigned(currentY + falloff * force * dirY);
        this.data[index + 2] = clampUnit(currentB + falloff * (force / this.maxForce));
      }
    }
  }

  private propagateAndRelax(dt: number): void {
    const relax = Math.pow(0.93, dt * 60);
    const diffusion = 1 - Math.pow(0.82, dt * 60);
    const cellCount = this.width * this.height;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const index = (y * this.width + x) * 4;

        const leftIndex = (y * this.width + Math.max(0, x - 1)) * 4;
        const rightIndex = (y * this.width + Math.min(this.width - 1, x + 1)) * 4;
        const upIndex = (Math.max(0, y - 1) * this.width + x) * 4;
        const downIndex = (Math.min(this.height - 1, y + 1) * this.width + x) * 4;

        const currentX = this.data[index] ?? 0;
        const currentY = this.data[index + 1] ?? 0;
        const currentB = this.data[index + 2] ?? 0;

        const avgX =
          ((this.data[leftIndex] ?? 0) +
            (this.data[rightIndex] ?? 0) +
            (this.data[upIndex] ?? 0) +
            (this.data[downIndex] ?? 0)) *
          0.25;
        const avgY =
          ((this.data[leftIndex + 1] ?? 0) +
            (this.data[rightIndex + 1] ?? 0) +
            (this.data[upIndex + 1] ?? 0) +
            (this.data[downIndex + 1] ?? 0)) *
          0.25;

        const propagatedX = (currentX + (avgX - currentX) * diffusion) * relax;
        const propagatedY = (currentY + (avgY - currentY) * diffusion) * relax;
        const waveIntensity = clampUnit(Math.hypot(propagatedX, propagatedY) * 1.8);
        const propagatedB = Math.max(currentB * relax, waveIntensity);

        this.scratch[index] = propagatedX;
        this.scratch[index + 1] = propagatedY;
        this.scratch[index + 2] = propagatedB;
        this.scratch[index + 3] = 1.0;
      }
    }

    for (let i = 0; i < cellCount * 4; i += 1) {
      this.data[i] = this.scratch[i] ?? 0;
    }
  }
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clampUnit((value - edge0) / Math.max(edge1 - edge0, Number.EPSILON));
  return t * t * (3 - 2 * t);
};

const clampUnit = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

const clampSigned = (value: number): number => {
  return Math.max(-1, Math.min(1, value));
};
