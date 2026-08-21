import type {
  CursorConfig,
  CursorState,
  CursorSystem,
} from './types';

const DEFAULT_CONFIG: CursorConfig = {
  radius: 180,
  smoothing: 0.88,
};

const clampToUnitRange = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

interface MutableVec2 {
  x: number;
  y: number;
}

const getViewportCenter = (): MutableVec2 => {
  return {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
  };
};

export function createCursorSystem(config?: Partial<CursorConfig>): CursorSystem {
  const mergedConfig: CursorConfig = {
    radius: config?.radius ?? DEFAULT_CONFIG.radius,
    smoothing: config?.smoothing ?? DEFAULT_CONFIG.smoothing,
  };

  const center = getViewportCenter();
  const targetPosition: MutableVec2 = { ...center };
  const lightPosition: MutableVec2 = { ...center };
  const previousLightPosition: MutableVec2 = { ...center };
  const velocity: MutableVec2 = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    targetPosition.x = event.clientX;
    targetPosition.y = event.clientY;
  };

  const onResize = (): void => {
    if (!Number.isFinite(targetPosition.x) || !Number.isFinite(targetPosition.y)) {
      const fallbackCenter = getViewportCenter();
      targetPosition.x = fallbackCenter.x;
      targetPosition.y = fallbackCenter.y;
    }
    lightPosition.x = Math.min(lightPosition.x, window.innerWidth);
    lightPosition.y = Math.min(lightPosition.y, window.innerHeight);
    targetPosition.x = Math.min(targetPosition.x, window.innerWidth);
    targetPosition.y = Math.min(targetPosition.y, window.innerHeight);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  return {
    update(dt: number): void {
      const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 1 / 60;
      const alpha = 1 - Math.pow(mergedConfig.smoothing, safeDt * 60);

      previousLightPosition.x = lightPosition.x;
      previousLightPosition.y = lightPosition.y;
      lightPosition.x += (targetPosition.x - lightPosition.x) * alpha;
      lightPosition.y += (targetPosition.y - lightPosition.y) * alpha;

      velocity.x = (lightPosition.x - previousLightPosition.x) / safeDt;
      velocity.y = (lightPosition.y - previousLightPosition.y) / safeDt;
    },

    getState(): CursorState {
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);

      return {
        lightPosition: {
          x: lightPosition.x,
          y: lightPosition.y,
        },
        lightUV: {
          x: clampToUnitRange(lightPosition.x / viewportWidth),
          y: clampToUnitRange(1 - lightPosition.y / viewportHeight),
        },
        velocity: {
          x: velocity.x,
          y: velocity.y,
        },
        radius: mergedConfig.radius,
      };
    },

    dispose(): void {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
    },
  };
}
