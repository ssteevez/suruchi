import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

type Vec2 = { x: number; y: number };

type ImageMeta = {
  url: string;
  fileName: string;
  title: string;
  year: string;
};

type PlaneDescriptor = {
  key: string;
  position: [number, number, number];
  width: number;
  image: ImageMeta;
  rotation: number;
  layer: number;
};

type ChunkData = {
  key: string;
  cx: number;
  cy: number;
  planes: PlaneDescriptor[];
  constellation: number;
  lastSeenFrame: number;
};

const CHUNK_SIZE = 32;
const ACTIVE_RADIUS = 2;
const KEEP_RADIUS = 5;
const PLANES_PER_CHUNK = 4;
const DRAG_SENSITIVITY = 0.012;
const KEYBOARD_ACCEL = 0.085;
const TARGET_VELOCITY_DECAY = 0.93;
const VELOCITY_BLEND = 0.9;
const PAN_RESISTANCE = 0.94;
const ZOOM_DAMP = 0.92;
const ZOOM_WHEEL_SCALE = 0.00085;
const WHEEL_PAN_SENSITIVITY = 0.0024;
const CHUNK_BATCH_SIZE = 6;
const MAX_CHUNK_CACHE = 256;
const MIN_Z = 10;
const MAX_Z = 120;
const INITIAL_Z = 30;
const DEPTH_LAYER_COUNT = 4;
const FRONT_LAYER_LIMIT = 2;
const MAX_FRONT_FOCUS_COUNT = 5;
const LARGE_IMAGE_WIDTH_THRESHOLD = 5.2;
const LARGE_IMAGE_MIN_SPACING = CHUNK_SIZE * 0.62;


const SAFE_NAME_PATTERN = /^[A-Za-z0-9_. -/]+$/;
const PILGRIM_IMAGE_SET_COUNT = 3;

const PILGRIM_SERIES_IMAGE_NAMES: Record<string, string[]> = {
  "a-diary-of-faith": [
    "series/a-diary-of-faith/6O8B0122.webp",
    "series/a-diary-of-faith/6O8B0144.webp",
    "series/a-diary-of-faith/6O8B0152.webp",
    "series/a-diary-of-faith/6O8B0174.webp",
    "series/a-diary-of-faith/6O8B0310.webp",
    "series/a-diary-of-faith/6O8B0603.webp",
    "series/a-diary-of-faith/6O8B3303.webp",
    "series/a-diary-of-faith/6O8B3600.webp",
    "series/a-diary-of-faith/6O8B9880.webp",
    "series/a-diary-of-faith/DSC02076.webp",
    "series/a-diary-of-faith/Hederabad joined.webp",
    "series/a-diary-of-faith/IMG_0555.webp",
    "series/a-diary-of-faith/IMG_2775.webp",
    "series/a-diary-of-faith/IMG_4651.webp",
    "series/a-diary-of-faith/IMG_7089 2.webp",
    "series/a-diary-of-faith/IMG_9830.webp",
  ],
  "crawford-diaries": [
    "series/crawford-diaries/6O8B0016.webp",
    "series/crawford-diaries/6O8B0017.webp",
    "series/crawford-diaries/6O8B0025.webp",
    "series/crawford-diaries/6O8B0047.webp",
    "series/crawford-diaries/6O8B0072.webp",
    "series/crawford-diaries/6O8B0090.webp",
    "series/crawford-diaries/6O8B0129.webp",
    "series/crawford-diaries/6O8B0186.webp",
    "series/crawford-diaries/6O8B0192.webp",
    "series/crawford-diaries/6O8B0203.webp",
    "series/crawford-diaries/6O8B0279.webp",
    "series/crawford-diaries/6O8B9965.webp",
    "series/crawford-diaries/6O8B9998-Edit.webp",
    "series/crawford-diaries/6O8B9999.webp",
    "series/crawford-diaries/Copy of 6O8B0279.webp",
  ],
  "ephemera": [
    "series/ephemera/50.webp",
    "series/ephemera/6O8B0522-Edit.webp",
    "series/ephemera/6O8B0548.webp",
    "series/ephemera/6O8B8134.webp",
    "series/ephemera/6O8B8616.webp",
    "series/ephemera/6O8B9183_print.webp",
    "series/ephemera/6O8B9431.webp",
    "series/ephemera/IMG_2137.webp",
  ],
  "kolkata-diaries": [
    "series/kolkata-diaries/6O8B0932.webp",
    "series/kolkata-diaries/IMG_0915.webp",
    "series/kolkata-diaries/IMG_1737.webp",
    "series/kolkata-diaries/IMG_1896-Edit.webp",
    "series/kolkata-diaries/IMG_1922.webp",
    "series/kolkata-diaries/IMG_4762.webp",
    "series/kolkata-diaries/IMG_4768-Edit.webp",
    "series/kolkata-diaries/IMG_4783.webp",
    "series/kolkata-diaries/IMG_4821.webp",
    "series/kolkata-diaries/IMG_4860.webp",
    "series/kolkata-diaries/IMG_4866.webp",
    "series/kolkata-diaries/IMG_4913.webp",
    "series/kolkata-diaries/IMG_4925-Edit-Edit-Edit.webp",
    "series/kolkata-diaries/IMG_4930.webp",
    "series/kolkata-diaries/IMG_4987-Edit_B&W-Edit-2.webp",
    "series/kolkata-diaries/IMG_4996-Edit-Edit-2-Edit.webp",
    "series/kolkata-diaries/IMG_7577.webp",
    "series/kolkata-diaries/IMG_7634-Edit.webp",
    "series/kolkata-diaries/IMG_7905-Edit.webp",
    "series/kolkata-diaries/IMG_7926-Edit.webp",
  ],
  "lifelines": [
    "series/lifelines/thumbnail.webp",
  ],
  "mono-no-aware": [
    "series/mono-no-aware/Ephemera_Print1 Final.webp",
    "series/mono-no-aware/Ephemera_Print2 Final.webp",
    "series/mono-no-aware/Ephemera_Print3 Final.webp",
    "series/mono-no-aware/IMG_5900-Edit.webp",
  ],
  "once-was": [
    "series/once-was/6O8B0155.webp",
    "series/once-was/6O8B8021-Edit-Edit.webp",
    "series/once-was/6O8B9866.webp",
    "series/once-was/6O8B9871.webp",
    "series/once-was/IMG_0193.webp",
    "series/once-was/IMG_1935-Edit.webp",
    "series/once-was/IMG_1948.webp",
    "series/once-was/IMG_1950-Edit.webp",
    "series/once-was/IMG_1963-Edit-2.webp",
    "series/once-was/IMG_1996.webp",
    "series/once-was/IMG_2004.webp",
    "series/once-was/IMG_8625-Edit.webp",
    "series/once-was/IMG_9648.webp",
    "series/once-was/IMG_9655-Edit-Edit.webp",
    "series/once-was/IMG_9655-Edit-Final.webp",
  ],
  "the-banned-band": [
    "series/the-banned-band/thumbnail.webp",
  ],
};


function computeSeriesItems(imageNames: string[]) {
  const baseItems = imageNames.filter((name) => {
    return SAFE_NAME_PATTERN.test(name);
  }).map((name) => {
    const optimizedFile = `${name.replace(/\.[^/.]+$/, '')}.jpg`;
    return {
      url: `/images/pilgrim/${optimizedFile}`,
      fileName: name,
      title: humanizeFileName(name),
      year: extractYearFromName(name),
    };
  });

  return { baseItems };
}

const SERIES_CACHE: Record<string, { baseItems: ImageMeta[] }> = {};
for (const [seriesId, names] of Object.entries(PILGRIM_SERIES_IMAGE_NAMES)) {
  SERIES_CACHE[seriesId] = computeSeriesItems(names);
}
const ALL_IMAGE_ITEMS = Object.values(SERIES_CACHE).flatMap(c => c.baseItems);

const InfinitePilgrim: React.FC<{
  seriesId?: string;
  onImageOpen: (image: ImageMeta) => void;
}> = ({ seriesId, onImageOpen }) => {
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const velocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const targetVelocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragStateRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const targetZRef = useRef<number>(INITIAL_Z);
  const keyboardRef = useRef<Record<string, boolean>>({});
  const chunksRef = useRef<Map<string, ChunkData>>(new Map());
  const chunkQueueRef = useRef<Array<{ key: string; cx: number; cy: number; replace: boolean }>>([]);
  const queueKeysRef = useRef<Set<string>>(new Set());
  const idleHandleRef = useRef<number | null>(null);
  const constellationRef = useRef(0);
  const zoomCycleRef = useRef(getZoomCycle(INITIAL_Z));
  const pendingZSnapRef = useRef<number | null>(null);
  const activeCenterRef = useRef<{ cx: number; cy: number } | null>(null);
  const frameRef = useRef(0);
  const focusedFrontPlaneKeysRef = useRef<Set<string>>(new Set());
  const [visibleChunkKeys, setVisibleChunkKeys] = useState<string[]>([]);
  const [chunkVersion, setChunkVersion] = useState(0);
  const { gl } = useThree();

  useEffect(() => {
    gl.setClearColor('#050506');
  }, [gl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      keyboardRef.current[event.key] = true;
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      keyboardRef.current[event.key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = 'grab';

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      dragStateRef.current.active = true;
      dragStateRef.current.lastX = event.clientX;
      dragStateRef.current.lastY = event.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragStateRef.current.active) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.lastX;
      const deltaY = event.clientY - dragStateRef.current.lastY;
      dragStateRef.current.lastX = event.clientX;
      dragStateRef.current.lastY = event.clientY;

      const speedScale = camera.position.z / INITIAL_Z;
      targetVelocityRef.current.x -= deltaX * DRAG_SENSITIVITY * speedScale;
      targetVelocityRef.current.y += deltaY * DRAG_SENSITIVITY * speedScale;
    };

    const onPointerUp = (): void => {
      dragStateRef.current.active = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      canvas.style.cursor = 'default';
    };
  }, [camera, gl]);

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    // Trackpad pinch / Ctrl+wheel keeps zoom behavior.
    if (event.ctrlKey || event.metaKey) {
      const next = targetZRef.current * (1 + event.deltaY * ZOOM_WHEEL_SCALE);
      applyWrappedZoom(next);
      return;
    }

    // Normal wheel pans through the infinite canvas endlessly.
    const speedScale = Math.max(camera.position.z / INITIAL_Z, 0.55);
    targetVelocityRef.current.x -= event.deltaX * WHEEL_PAN_SENSITIVITY * speedScale;
    targetVelocityRef.current.y += event.deltaY * WHEEL_PAN_SENSITIVITY * speedScale;
  };

  useEffect(() => {
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [camera]);

  useFrame((_state, dt) => {
    const camFromState = camera;
    frameRef.current += 1;
    if (pendingZSnapRef.current !== null) {
      camFromState.position.z = pendingZSnapRef.current;
      pendingZSnapRef.current = null;
    }

    const keys = keyboardRef.current;
    const effectiveZoom = getEffectiveZoom(camFromState.position.z);
    const keyboardBoost = Math.max(effectiveZoom / INITIAL_Z, 0.55);
    if (keys.ArrowLeft) targetVelocityRef.current.x -= KEYBOARD_ACCEL * keyboardBoost;
    if (keys.ArrowRight) targetVelocityRef.current.x += KEYBOARD_ACCEL * keyboardBoost;
    if (keys.ArrowUp) targetVelocityRef.current.y += KEYBOARD_ACCEL * keyboardBoost;
    if (keys.ArrowDown) targetVelocityRef.current.y -= KEYBOARD_ACCEL * keyboardBoost;
    if (keys['='] || keys['+']) {
      applyWrappedZoom(targetZRef.current - 0.2);
    }
    if (keys['-'] || keys['_']) {
      applyWrappedZoom(targetZRef.current + 0.2);
    }

    const inertiaBlend = 1 - Math.pow(VELOCITY_BLEND, dt * 60);
    velocityRef.current.x += (targetVelocityRef.current.x - velocityRef.current.x) * inertiaBlend;
    velocityRef.current.y += (targetVelocityRef.current.y - velocityRef.current.y) * inertiaBlend;

    const panScale = Math.max(effectiveZoom / 40, 0.42);
    camFromState.position.x += velocityRef.current.x * panScale * dt * 60;
    camFromState.position.y += velocityRef.current.y * panScale * dt * 60;

    targetVelocityRef.current.x *= Math.pow(TARGET_VELOCITY_DECAY, dt * 60);
    targetVelocityRef.current.y *= Math.pow(TARGET_VELOCITY_DECAY, dt * 60);
    velocityRef.current.x *= Math.pow(PAN_RESISTANCE, dt * 60);
    velocityRef.current.y *= Math.pow(PAN_RESISTANCE, dt * 60);

    const zoomLerp = 1 - Math.pow(ZOOM_DAMP, dt * 60);
    camFromState.position.z += (targetZRef.current - camFromState.position.z) * zoomLerp;

    const halfHeight =
      Math.tan(THREE.MathUtils.degToRad(camFromState.fov * 0.5)) * Math.max(camFromState.position.z, MIN_Z * 0.5);
    const halfWidth = halfHeight * camFromState.aspect;
    const viewportPad = 6;
    const frontCandidates = visiblePlanes
      .filter((plane) => {
        if (plane.layer > FRONT_LAYER_LIMIT) {
          return false;
        }
        const dx = Math.abs(plane.position[0] - camFromState.position.x);
        const dy = Math.abs(plane.position[1] - camFromState.position.y);
        return dx <= halfWidth + viewportPad && dy <= halfHeight + viewportPad;
      })
      .sort((a, b) => {
        const da = Math.hypot(a.position[0] - camFromState.position.x, a.position[1] - camFromState.position.y);
        const db = Math.hypot(b.position[0] - camFromState.position.x, b.position[1] - camFromState.position.y);
        return da - db;
      });
    const focusedFrontKeys = selectDistributedFrontFocus(frontCandidates, MAX_FRONT_FOCUS_COUNT);
    focusedFrontPlaneKeysRef.current = new Set(focusedFrontKeys);

    const centerCx = Math.floor(camFromState.position.x / CHUNK_SIZE);
    const centerCy = Math.floor(camFromState.position.y / CHUNK_SIZE);
    const activeCenter = activeCenterRef.current;
    if (!activeCenter || activeCenter.cx !== centerCx || activeCenter.cy !== centerCy) {
      updateVisibleChunks(centerCx, centerCy);
    }
  });

  const updateVisibleChunks = (centerCx: number, centerCy: number): void => {
    activeCenterRef.current = { cx: centerCx, cy: centerCy };
    const visible: string[] = [];
    const missingVisible: Array<{ key: string; cx: number; cy: number; distance: number }> = [];

    for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx += 1) {
      for (let dy = -ACTIVE_RADIUS; dy <= ACTIVE_RADIUS; dy += 1) {
        const cx = centerCx + dx;
        const cy = centerCy + dy;
        const key = `${cx}:${cy}`;
        const chunk = chunksRef.current.get(key);
        if (chunk) {
          chunk.lastSeenFrame = frameRef.current;
          visible.push(key);
          continue;
        }
        missingVisible.push({ key, cx, cy, distance: Math.hypot(dx, dy) });
      }
    }

    missingVisible.sort((a, b) => a.distance - b.distance);
    for (const item of missingVisible) {
      enqueueChunk(item.key, item.cx, item.cy, true, false);
    }

    for (let dx = -KEEP_RADIUS; dx <= KEEP_RADIUS; dx += 1) {
      for (let dy = -KEEP_RADIUS; dy <= KEEP_RADIUS; dy += 1) {
        if (Math.abs(dx) <= ACTIVE_RADIUS && Math.abs(dy) <= ACTIVE_RADIUS) {
          continue;
        }
        const cx = centerCx + dx;
        const cy = centerCy + dy;
        const key = `${cx}:${cy}`;
        enqueueChunk(key, cx, cy, false, false);
      }
    }

    setVisibleChunkKeys(visible);
    scheduleChunkProcessing();
  };

  const visiblePlanes = useMemo(() => {
    const planes: PlaneDescriptor[] = [];
    for (const key of visibleChunkKeys) {
      const chunk = chunksRef.current.get(key);
      if (chunk) {
        planes.push(...chunk.planes);
      }
    }
    return planes;
  }, [visibleChunkKeys, chunkVersion]);

  const enqueueChunk = (key: string, cx: number, cy: number, urgent: boolean, replace: boolean): void => {
    if (!replace && chunksRef.current.has(key)) {
      return;
    }
    if (queueKeysRef.current.has(key)) {
      return;
    }
    queueKeysRef.current.add(key);
    if (urgent) {
      chunkQueueRef.current.unshift({ key, cx, cy, replace });
      return;
    }
    chunkQueueRef.current.push({ key, cx, cy, replace });
  };

  const scheduleChunkProcessing = (): void => {
    if (idleHandleRef.current !== null || chunkQueueRef.current.length === 0) {
      return;
    }

    idleHandleRef.current = requestIdleCompat((deadline) => {
      idleHandleRef.current = null;
      let processed = 0;

      while (
        chunkQueueRef.current.length > 0 &&
        processed < CHUNK_BATCH_SIZE &&
        (deadline.timeRemaining() > 3 || deadline.didTimeout)
      ) {
        const next = chunkQueueRef.current.shift();
        if (!next) {
          break;
        }
        queueKeysRef.current.delete(next.key);
        if (next.replace || !chunksRef.current.has(next.key)) {
          const chunk = createChunk(next.cx, next.cy, constellationRef.current, seriesId ?? null);
          chunk.lastSeenFrame = frameRef.current;
          chunksRef.current.set(next.key, chunk);
          processed += 1;
        }
      }

      evictChunkCache();
      refreshVisibleFromActiveCenter();
      setChunkVersion((value) => value + 1);

      if (chunkQueueRef.current.length > 0) {
        scheduleChunkProcessing();
      }
    });
  };

  const refreshVisibleFromActiveCenter = (): void => {
    const center = activeCenterRef.current;
    if (!center) {
      return;
    }
    const visible: string[] = [];
    for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx += 1) {
      for (let dy = -ACTIVE_RADIUS; dy <= ACTIVE_RADIUS; dy += 1) {
        const key = `${center.cx + dx}:${center.cy + dy}`;
        const chunk = chunksRef.current.get(key);
        if (chunk) {
          chunk.lastSeenFrame = frameRef.current;
          visible.push(key);
        }
      }
    }
    setVisibleChunkKeys(visible);
  };

  const evictChunkCache = (): void => {
    if (chunksRef.current.size <= MAX_CHUNK_CACHE) {
      return;
    }
    const center = activeCenterRef.current;
    if (!center) {
      return;
    }
    let removedAny = false;

    while (chunksRef.current.size > MAX_CHUNK_CACHE) {
      let oldestKey: string | null = null;
      let oldestFrame = Number.POSITIVE_INFINITY;
      for (const [key, chunk] of chunksRef.current) {
        const dx = chunk.cx - center.cx;
        const dy = chunk.cy - center.cy;
        if (Math.abs(dx) <= KEEP_RADIUS && Math.abs(dy) <= KEEP_RADIUS) {
          continue;
        }
        if (chunk.lastSeenFrame < oldestFrame) {
          oldestFrame = chunk.lastSeenFrame;
          oldestKey = key;
        }
      }
      if (!oldestKey) {
        break;
      }
      chunksRef.current.delete(oldestKey);
      removedAny = true;
    }

    if (removedAny) {
      cleanupUnreferencedTextures(chunksRef.current);
    }
  };

  const switchConstellation = (cycleShift: number): void => {
    constellationRef.current += cycleShift;

    const center = activeCenterRef.current;
    if (center) {
      const queued: Array<{ key: string; cx: number; cy: number; distance: number }> = [];
      for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx += 1) {
        for (let dy = -ACTIVE_RADIUS; dy <= ACTIVE_RADIUS; dy += 1) {
          const cx = center.cx + dx;
          const cy = center.cy + dy;
          queued.push({
            key: `${cx}:${cy}`,
            cx,
            cy,
            distance: Math.hypot(dx, dy),
          });
        }
      }
      queued.sort((a, b) => a.distance - b.distance);
      for (const item of queued) {
        // Keep center immediate, stream outer replacements for a softer cycle transition.
        const urgent = item.distance <= 0.25;
        enqueueChunk(item.key, item.cx, item.cy, urgent, true);
      }
    }
    scheduleChunkProcessing();
  };

  const applyWrappedZoom = (nextValue: number): void => {
    const zoomRange = MAX_Z - MIN_Z;
    if (zoomRange <= 0) {
      targetZRef.current = nextValue;
      return;
    }

    let wrapped = clamp(nextValue, MIN_Z * 0.5, MAX_Z * 1.5);
    let cycleShift = 0;
    if (wrapped > MAX_Z) {
      const overshoot = wrapped - MAX_Z;
      cycleShift = Math.floor(overshoot / zoomRange) + 1;
      wrapped = MIN_Z + (overshoot % zoomRange);
    } else if (wrapped < MIN_Z) {
      const undershoot = MIN_Z - wrapped;
      cycleShift = -(Math.floor(undershoot / zoomRange) + 1);
      wrapped = MAX_Z - (undershoot % zoomRange);
    }

    targetZRef.current = wrapped;
    if (cycleShift !== 0) {
      zoomCycleRef.current += cycleShift;
      pendingZSnapRef.current = wrapped;
      switchConstellation(cycleShift);
    }
  };

  useEffect(() => {
    return () => {
      if (idleHandleRef.current !== null) {
        cancelIdleCompat(idleHandleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log('Visible planes count:', visiblePlanes.length, 'Series ID:', seriesId);
  }, [visiblePlanes.length, seriesId]);

  return (
    <>
      <group>
        {visiblePlanes.map((plane) => (
          <ImagePlane
            key={plane.key}
            plane={plane}
            camera={camera}
            onOpenImage={onImageOpen}
            isFrontFocusAllowed={(key) => focusedFrontPlaneKeysRef.current.has(key)}
          />
        ))}
      </group>
    </>
  );
};

const ImagePlane: React.FC<{
  plane: PlaneDescriptor;
  camera: THREE.PerspectiveCamera;
  onOpenImage: (image: ImageMeta) => void;
  isFrontFocusAllowed: (key: string) => boolean;
}> = ({ plane, camera, onOpenImage, isFrontFocusAllowed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Mesh>(null);
  const focusAmountRef = useRef(0);
  const texture = useSafeTexture(plane.image.url);
  const nearColorRef = useRef(new THREE.Color(1, 1, 1));
  const hazeColorRef = useRef(new THREE.Color('#9a9ba3'));
  
  const isSeries = plane.image.year === 'Series';

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const source = texture.source.data as { width?: number; height?: number } | undefined;
    const imgWidth = source?.width ?? 1;
    const imgHeight = source?.height ?? 1;
    const aspect = imgWidth > 0 && imgHeight > 0 ? imgWidth / imgHeight : 1;
    const foregroundScale = plane.layer === 1 ? 2.9 : plane.layer === 2 ? 1.68 : 1.82;
    const scaledWidth = plane.width * foregroundScale;
    const scaledHeight = scaledWidth / aspect;
    mesh.scale.set(scaledWidth, scaledHeight, 1);
    
    if (textRef.current) {
      textRef.current.position.set(0, -scaledHeight / 2 - plane.width * 0.12, 0);
    }
  }, [texture, plane.width, plane.layer]);

  useFrame((_state, dt) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    const planeWorldZ = plane.position[2];
    group.position.set(plane.position[0], plane.position[1], planeWorldZ);
    mesh.position.set(0, 0, 0);

    const planarDistance = Math.hypot(group.position.x - camera.position.x, group.position.y - camera.position.y);
    const fadeStart = 18 + camera.position.z * 0.28;
    const fadeEnd = fadeStart + 62;
    let fade = 1 - smoothstep(fadeStart, fadeEnd, planarDistance);
    const hazeNear = 14 + camera.position.z * 0.2;
    const hazeFar = hazeNear + 56;
    const distanceHaze = smoothstep(hazeNear, hazeFar, planarDistance);
    const baseLayerFog =
      plane.layer <= 1
        ? 0
        : 0.4 + ((plane.layer - 2) / Math.max(DEPTH_LAYER_COUNT - 2, 1)) * 0.6;
    const zoomNorm = clamp((getEffectiveZoom(camera.position.z) - MIN_Z) / (MAX_Z - MIN_Z), 0, 1);
    const focusLayer = 1 + zoomNorm * (DEPTH_LAYER_COUNT - 1);
    const layerDistance = Math.abs(plane.layer - focusLayer);
    const focusWeight = 1 - smoothstep(0.25, 1.35, layerDistance);
    const layerFog = baseLayerFog * (1 - focusWeight * 0.85);
    const frontFocusAllowed = isFrontFocusAllowed(plane.key);
    const overflowFog = plane.layer <= FRONT_LAYER_LIMIT && !frontFocusAllowed ? 0.58 : 0;
    let hazeAmount = clamp(distanceHaze * 0.72 + layerFog * 0.8 + overflowFog, 0, 1);
    const material = mesh.material as THREE.MeshBasicMaterial;
    
    // --- focus / glow ---
    const focusRadius = 7 + camera.position.z * 0.14;
    const rawFocus = Math.max(0, 1 - planarDistance / focusRadius);
    const targetFocus = fade > 0.2 ? rawFocus : 0;
    focusAmountRef.current += (targetFocus - focusAmountRef.current) * (1 - Math.pow(0.91, dt * 60));

    if (isSeries) {
      fade = 1;
      hazeAmount = 0;
      material.opacity = 1;
      material.depthWrite = true;
    } else {
      // Base opacity heavily reduced by haze
      let targetOpacity = fade * (1 - hazeAmount * 0.65);
      
      // Boost opacity aggressively if in focus
      targetOpacity = Math.min(1, targetOpacity + focusAmountRef.current * 0.7);
      
      material.opacity += (targetOpacity - material.opacity) * (1 - Math.pow(0.86, dt * 60));
      material.depthWrite = material.opacity > 0.92 && hazeAmount < 0.18;
    }
    
    // Lerp towards bright white if in focus to simulate a sharp spotlight, otherwise normal haze
    const baseColor = nearColorRef.current.clone().lerp(hazeColorRef.current, hazeAmount * 0.85);
    material.color.copy(baseColor).lerp(new THREE.Color(0xffffff), focusAmountRef.current * 0.4);

    const glowMesh = glowRef.current;
    if (glowMesh) {
      const t = performance.now() * 0.001;
      const phase = plane.position[0] * 0.31 + plane.position[1] * 0.19;
      const breathe = Math.sin(t * 0.52 + phase) * 0.5 + 0.5;
      // Much stronger glow for focused images
      const glowOpacity = focusAmountRef.current * (0.35 + breathe * 0.15);
      const glowMat = glowMesh.material as THREE.MeshBasicMaterial;
      glowMat.opacity = glowOpacity;
      glowMesh.visible = glowOpacity > 0.006;
    }

    mesh.visible = material.opacity > 0.025;
    mesh.rotation.z = plane.rotation;
    
    if (textRef.current && textRef.current.material) {
      (textRef.current.material as THREE.Material).opacity = material.opacity;
    }
  });

  return (
    <group ref={groupRef} position={plane.position}>
      <mesh
        ref={meshRef}
        rotation={[0, 0, plane.rotation]}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 8) {
            return;
          }
          event.stopPropagation();
          onOpenImage(plane.image);
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent opacity={0} />
        
        <mesh ref={glowRef} position={[0, 0, -0.08]} scale={[1.85, 1.85, 1]} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={getGlowTexture()}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </mesh>
      
      {isSeries && (
        <Text
          ref={textRef}
          position={[0, -plane.width * 1.4, 0]}
          fontSize={plane.width * 0.2}
          color="rgba(245,245,245,0.7)"
          anchorX="center"
          anchorY="top"
          letterSpacing={0.1}
        >
          {plane.image.title.toUpperCase()}
        </Text>
      )}
    </group>
  );
};

const createChunk = (cx: number, cy: number, constellation: number, seriesId: string | null): ChunkData => {
  const seed = hash(`${constellation}:${cx}:${cy}`);
  const rng = mulberry32(seed);
  const planes: PlaneDescriptor[] = [];
  
  // Heavily reduce distribution: 80% chance of 1 image, 20% chance of 2 images
  const numItems = rng() < 0.8 ? 1 : 2;
  
  const minX = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const maxX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const minY = cy * CHUNK_SIZE - CHUNK_SIZE / 2;
  const maxY = cy * CHUNK_SIZE + CHUNK_SIZE / 2;
  
  const points: Array<{ x: number; y: number; w: number }> = [];
  
  for (let i = 0; i < numItems; i++) {
    // Map chunk coordinates to a global index to prevent nearby repetition
    // We use prime multipliers 17 and 31 to distribute adjacent chunks far apart in the array
    const baseIndex = Math.abs(cx * 17 + cy * 31);
    const imageIndex = (baseIndex + i * 47) % ALL_IMAGE_ITEMS.length;
    const image = ALL_IMAGE_ITEMS[imageIndex]!;
    
    let accepted = false;
    let w = 10 + rng() * 6; // Smaller sizes to increase perceived gaps (10 to 16)
    
    // Confine images strictly within chunk bounds to prevent inter-chunk overlap
    // Increased padding to force more gap at the borders
    const padding = 2 + rng() * 4;
    let safeMinX = minX + (w / 2) + padding;
    let safeMaxX = maxX - (w / 2) - padding;
    let safeMinY = minY + (w / 2) + padding;
    let safeMaxY = maxY - (w / 2) - padding;
    
    if (safeMaxX < safeMinX) safeMaxX = safeMinX;
    if (safeMaxY < safeMinY) safeMaxY = safeMinY;
    
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = safeMinX + rng() * (safeMaxX - safeMinX);
      const y = safeMinY + rng() * (safeMaxY - safeMinY);
      
      const overlaps = points.some(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.hypot(dx, dy);
        
        // Only 10% chance to allow intentional randomized overlap
        const allowOverlap = rng() < 0.10;
        const reqDist = allowOverlap 
          ? ((p.w + w) * 0.45) // overlap allowed, but max ~55% overlap
          : ((p.w + w) / 2 + 3 + rng() * 3); // large standard gap
          
        return dist < reqDist;
      });
      
      if (!overlaps) {
        points.push({ x, y, w });
        accepted = true;
        break;
      }
    }
    
    if (!accepted) {
      points.push({ x: safeMinX + rng() * (safeMaxX - safeMinX), y: safeMinY + rng() * (safeMaxY - safeMinY), w });
    }
    
    const p = points[points.length - 1]!;
    const z = INITIAL_Z - 70 - rng() * 30; // Random depth
    
    planes.push({
      key: `img:${cx}:${cy}:${i}`,
      position: [p.x, p.y, z],
      width: p.w,
      image,
      rotation: 0,
      layer: getLayerFromDepth(z)
    });
  }
  
  return { key: `${cx}:${cy}`, cx, cy, planes, constellation, lastSeenFrame: 0 };
};

const SERIES_LIST = [
  { id: 'a-diary-of-faith', title: 'A Diary of Faith' },
  { id: 'crawford-diaries', title: 'Crawford Diaries' },
  { id: 'ephemera', title: 'Ephemera' },
  { id: 'kolkata-diaries', title: 'Kolkata Diaries' },
  { id: 'lifelines', title: 'Lifelines' },
  { id: 'mono-no-aware', title: 'Mono No Aware' },
  { id: 'once-was', title: 'Once Was' },
  { id: 'the-banned-band', title: 'The Banned Band' }
];

const SERIES_IMAGE_ITEMS: ImageMeta[] = SERIES_LIST.map(s => ({
  url: `/images/pilgrim/series/${s.id}/thumbnail.jpg`,
  fileName: s.id,
  title: s.title,
  year: 'Series'
}));

const App: React.FC = () => {
  const dprRange = useMemo(() => getCanvasDprRange(), []);
  const [selectedImage, setSelectedImage] = useState<ImageMeta | null>(null);
    const [showMeta, setShowMeta] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleNav = (direction: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedSeries || !selectedImage) return;
    const seriesItems = computeSeriesItems(PILGRIM_SERIES_IMAGE_NAMES[selectedSeries] || []).baseItems;
    const currentIndex = seriesItems.findIndex(img => img.url === selectedImage.url);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + direction + seriesItems.length) % seriesItems.length;
    const nextImage = seriesItems[nextIndex];
    if (nextImage) {
      setSelectedImage(nextImage);
      if (scrollRef.current) {
        const thumb = scrollRef.current.children[nextIndex + 1] as HTMLElement; // +1 for <style>
        if (thumb) {
          thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', background: '#050506' }}>
      <Canvas
        dpr={dprRange}
        flat
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 58, position: [0, 0, INITIAL_Z] }}
      >
        <fog attach="fog" args={['#070709', 30, 150]} />
        <InfinitePilgrim
          key="menu"
          seriesId={undefined}
          onImageOpen={(image) => {
            const seriesId = image.fileName.split('/')[1] || image.fileName;
            setSelectedSeries(seriesId);
            const seriesItems = computeSeriesItems(PILGRIM_SERIES_IMAGE_NAMES[seriesId] || []).baseItems;
            if (seriesItems.length > 0) {
              setSelectedImage(seriesItems[0]!);
            } else {
              setSelectedImage(image);
            }
            setShowMeta(true);
          }}
        />
      </Canvas>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 6,
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(255,255,255,0) 0%, rgba(8,8,10,0.28) 58%, rgba(5,5,6,0.7) 100%)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 7,
          background:
            'linear-gradient(to bottom, rgba(8,8,10,0.58) 0%, rgba(8,8,10,0.1) 22%, rgba(8,8,10,0.08) 72%, rgba(6,6,8,0.7) 100%)',
        }}
      />
      
      <div style={{
        position: 'absolute',
        top: 76,
        left: 84,
        color: 'rgba(245, 245, 245, 0.82)',
        fontSize: 34,
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        PILGRIM
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 30,
          left: 30,
          display: 'flex',
          gap: 16,
          zIndex: 10,
        }}
      >
        <a
          href="/"
          style={{
            background: 'none',
            color: 'rgba(245,245,245,0.7)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            border: 'none',
            padding: '8px 0',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          BACK
        </a>
      </div>
      
      
      {selectedImage ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { setSelectedImage(null); setSelectedSeries(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,5,8,0.92)',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(92vw, 1320px)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowMeta((value) => !value)}
                  style={modalButtonStyle}
                >
                  {showMeta ? 'Hide details' : 'Show details'}
                </button>
              </div>
              <button type="button" onClick={() => { setSelectedImage(null); setSelectedSeries(null); }} style={modalButtonStyle}>
                Close
              </button>
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.16)',
                background: '#0a0a0d',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                style={{ width: '100%', height: '65vh', objectFit: 'contain', display: 'block', flex: 1 }}
              />
              {selectedSeries && (
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(5,5,8,0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={(e) => handleNav(-1, e)}
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 16px', zIndex: 2 }}
                  >
                    {'<'}
                  </button>
                  <div
                    ref={scrollRef}
                    style={{
                      display: 'flex',
                      gap: 12,
                      overflowX: 'auto',
                      padding: '12px 0',
                      flex: 1,
                      scrollbarWidth: 'none', // hide scrollbar for Firefox
                      msOverflowStyle: 'none' // hide scrollbar for IE/Edge
                    }}
                  >
                    {/* Hide scrollbar for Chrome/Safari using inline style trick or just let it be since scrollbarWidth is set */}
                    <style>{`
                      ::-webkit-scrollbar { display: none; }
                    `}</style>
                    {computeSeriesItems(PILGRIM_SERIES_IMAGE_NAMES[selectedSeries] || []).baseItems.map((img) => (
                      <img
                        key={img.url}
                        src={img.url}
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                        style={{
                          height: 70,
                          cursor: 'pointer',
                          border: selectedImage?.url === img.url ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                          borderRadius: 4,
                          opacity: selectedImage?.url === img.url ? 1 : 0.4,
                          transition: 'opacity 0.2s, border 0.2s',
                          objectFit: 'contain'
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={(e) => handleNav(1, e)}
                    style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 16px', zIndex: 2 }}
                  >
                    {'>'}
                  </button>
                </div>
              )}
            </div>
            {showMeta ? (
              <div
                style={{
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(10,10,13,0.85)',
                  color: 'rgba(245,245,245,0.92)',
                  padding: '10px 12px',
        
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.9 }}>
                  Series: "{SERIES_LIST.find((s) => s.id === selectedSeries)?.title || 'Unknown'}"
                </div>
                <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                  Giclee Print on Archival Rag Paper
                </div>
                <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                  Sizes and Editions vary
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

type IdleDeadlineCompat = { didTimeout: boolean; timeRemaining: () => number };

const requestIdleCompat = (callback: (deadline: IdleDeadlineCompat) => void): number => {
  if ('requestIdleCallback' in globalThis) {
    const requestIdle = (globalThis as typeof globalThis & { requestIdleCallback: typeof window.requestIdleCallback })
      .requestIdleCallback;
    return requestIdle(callback, { timeout: 80 });
  }
  return globalThis.setTimeout(() => {
    callback({
      didTimeout: true,
      timeRemaining: () => 0,
    });
  }, 16);
};

const cancelIdleCompat = (id: number): void => {
  if ('cancelIdleCallback' in globalThis) {
    const cancelIdle = (globalThis as typeof globalThis & { cancelIdleCallback: typeof window.cancelIdleCallback })
      .cancelIdleCallback;
    cancelIdle(id);
    return;
  }
  globalThis.clearTimeout(id);
};

const textureCache = new Map<string, THREE.Texture>();
const textureFailedSet = new Set<string>();
let fallbackTextureSingleton: THREE.Texture | null = null;
let glowTextureSingleton: THREE.Texture | null = null;

const cleanupUnreferencedTextures = (chunkMap: Map<string, ChunkData>): void => {
  const referencedUrls = new Set<string>();
  for (const chunk of chunkMap.values()) {
    for (const plane of chunk.planes) {
      referencedUrls.add(plane.image.url);
    }
  }

  for (const [url, texture] of textureCache) {
    if (referencedUrls.has(url)) {
      continue;
    }
    texture.dispose();
    textureCache.delete(url);
  }
};

const useSafeTexture = (url: string): THREE.Texture => {
  const [texture, setTexture] = useState<THREE.Texture>(() => getFallbackTexture());

  useEffect(() => {
    let cancelled = false;
    if (!url || textureFailedSet.has(url)) {
      setTexture(getFallbackTexture());
      return;
    }
    const cached = textureCache.get(url);
    if (cached) {
      setTexture(cached);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loadedTexture) => {
        if (cancelled) {
          return;
        }
        configureLoadedTexture(loadedTexture);
        textureCache.set(url, loadedTexture);
        setTexture(loadedTexture);
      },
      undefined,
      (err) => {
        console.error('Failed to load texture:', url, err);
        if (cancelled) return;
        textureFailedSet.add(url);
        setTexture(getFallbackTexture());
      }
    );

    return () => {
      cancelled = true;
    };
  }, [url]);

  return texture;
};

const configureLoadedTexture = (texture: THREE.Texture): void => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
};

const getFallbackTexture = (): THREE.Texture => {
  if (fallbackTextureSingleton) {
    return fallbackTextureSingleton;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#16171a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  fallbackTextureSingleton = texture;
  return texture;
};

function getGlowTexture(): THREE.Texture {
  if (glowTextureSingleton) return glowTextureSingleton;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    gradient.addColorStop(0, 'rgba(255, 248, 235, 1)');
    gradient.addColorStop(0.22, 'rgba(255, 245, 225, 0.62)');
    gradient.addColorStop(0.5, 'rgba(248, 240, 215, 0.22)');
    gradient.addColorStop(0.78, 'rgba(235, 228, 205, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  glowTextureSingleton = texture;
  return texture;
}

function getCanvasDprRange(): [number, number] {
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const maxDpr = coarsePointer ? 1.25 : Math.min(1.8, deviceDpr);
  return [1, Math.max(1, maxDpr)];
}

const modalButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(18,18,24,0.85)',
  color: 'rgba(245,245,245,0.94)',
  borderRadius: 8,
  padding: '7px 10px',

  fontSize: 12,
  cursor: 'pointer',
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const lerp = (from: number, to: number, t: number): number => {
  return from + (to - from) * t;
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const generateSparsePoints = (
  rng: () => number,
  count: number,
  minDistance: number,
  padding: number
): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = [];
  const minDistanceSq = minDistance * minDistance;
  const min = -CHUNK_SIZE * 0.5 + padding;
  const max = CHUNK_SIZE * 0.5 - padding;

  for (let i = 0; i < count; i += 1) {
    let accepted = false;
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const candidate = { x: lerp(min, max, rng()), y: lerp(min, max, rng()) };
      const overlaps = points.some((point) => {
        const dx = point.x - candidate.x;
        const dy = point.y - candidate.y;
        return dx * dx + dy * dy < minDistanceSq;
      });
      if (!overlaps) {
        points.push(candidate);
        accepted = true;
        break;
      }
    }

    if (!accepted) {
      // If strict spacing cannot place all points, pick the least-overlapping
      // fallback candidate to avoid dense clumps.
      let bestCandidate = { x: lerp(min, max, rng()), y: lerp(min, max, rng()) };
      let bestDistanceScore = Number.NEGATIVE_INFINITY;
      for (let sample = 0; sample < 40; sample += 1) {
        const candidate = { x: lerp(min, max, rng()), y: lerp(min, max, rng()) };
        let nearestDistSq = Number.POSITIVE_INFINITY;
        for (const point of points) {
          const dx = point.x - candidate.x;
          const dy = point.y - candidate.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
          }
        }
        const distanceScore = points.length === 0 ? Number.POSITIVE_INFINITY : nearestDistSq;
        if (distanceScore > bestDistanceScore) {
          bestDistanceScore = distanceScore;
          bestCandidate = candidate;
        }
      }
      points.push(bestCandidate);
    }
  }

  return points;
};

const pickDepth = (rng: () => number): number => {
  const t = rng();
  if (t < 0.18) {
    return -(1.5 + rng() * 7);
  }
  if (t < 0.58) {
    return -(9 + rng() * 16);
  }
  if (t < 0.9) {
    return -(28 + rng() * 34);
  }
  return -(62 + rng() * 46);
};

const getLayerFromDepth = (z: number): number => {
  const depth = clamp(-z, 2, 110);
  const normalized = (depth - 2) / (110 - 2);
  return clamp(Math.round(1 + normalized * (DEPTH_LAYER_COUNT - 1)), 1, DEPTH_LAYER_COUNT);
};

const pickWidth = (rng: () => number, z: number): number => {
  const depth = -z;
  const tier = rng();
  let width = 0;

  if (depth < 10) {
    if (tier < 0.72) {
      width = 14 + rng() * 10;
    } else if (tier < 0.92) {
      width = 9 + rng() * 6.5;
    } else {
      width = 6 + rng() * 3.5;
    }
  } else if (depth < 30) {
    if (tier < 0.66) {
      width = 8.5 + rng() * 5.5;
    } else if (tier < 0.9) {
      width = 6 + rng() * 4.2;
    } else {
      width = 4 + rng() * 2.6;
    }
  } else if (depth < 60) {
    if (tier < 0.6) {
      width = 5.2 + rng() * 3.4;
    } else if (tier < 0.88) {
      width = 3.8 + rng() * 2.7;
    } else {
      width = 2.4 + rng() * 1.8;
    }
  } else {
    if (tier < 0.48) {
      width = 3.2 + rng() * 2.1;
    } else if (tier < 0.84) {
      width = 2.1 + rng() * 1.5;
    } else {
      width = 1.2 + rng() * 1.1;
    }
  }

  const depthNorm = clamp((-z - 2) / 108, 0, 1);
  const perspectiveScale = 1.18 - depthNorm * 0.72;
  return width * perspectiveScale * 1.18;
};

const getAdaptiveWidthForPoint = (
  point: { x: number; y: number },
  points: Array<{ x: number; y: number }>,
  baseWidth: number,
  padding: number
): number => {
  const min = -CHUNK_SIZE * 0.5 + padding;
  const max = CHUNK_SIZE * 0.5 - padding;

  let nearest = Number.POSITIVE_INFINITY;
  for (const other of points) {
    if (other === point) {
      continue;
    }
    const d = Math.hypot(other.x - point.x, other.y - point.y);
    if (d < nearest) {
      nearest = d;
    }
  }
  if (!Number.isFinite(nearest)) {
    nearest = CHUNK_SIZE * 0.58;
  }

  const edgeRoom = Math.max(0.6, Math.min(point.x - min, max - point.x, point.y - min, max - point.y));
  const localRoom = Math.max(1.4, Math.min(nearest, edgeRoom * 2));
  const targetWidth = localRoom * 0.74;
  const blended = lerp(baseWidth, targetWidth, 0.62);
  const minWidth = localRoom * 0.56;
  const maxWidth = localRoom * 0.95;
  return clamp(blended, minWidth, maxWidth);
};

const selectDistributedFrontFocus = (candidates: PlaneDescriptor[], maxCount: number): string[] => {
  if (candidates.length <= maxCount) {
    return candidates.map((plane) => plane.key);
  }

  const selected: PlaneDescriptor[] = [];
  const minSpacing = CHUNK_SIZE * 0.6;

  for (const candidate of candidates) {
    if (selected.length === 0) {
      selected.push(candidate);
      if (selected.length >= maxCount) {
        break;
      }
      continue;
    }
    const tooClose = selected.some((plane) => {
      return Math.hypot(candidate.position[0] - plane.position[0], candidate.position[1] - plane.position[1]) < minSpacing;
    });
    if (!tooClose) {
      selected.push(candidate);
      if (selected.length >= maxCount) {
        break;
      }
    }
  }

  if (selected.length < maxCount) {
    for (const candidate of candidates) {
      if (selected.some((plane) => plane.key === candidate.key)) {
        continue;
      }
      selected.push(candidate);
      if (selected.length >= maxCount) {
        break;
      }
    }
  }

  return selected.map((plane) => plane.key);
};

function getZoomCycle(value: number): number {
  const range = MAX_Z - MIN_Z;
  if (range <= 0) {
    return 0;
  }
  return Math.floor((value - MIN_Z) / range);
}

function getEffectiveZoom(value: number): number {
  const range = MAX_Z - MIN_Z;
  if (range <= 0) {
    return value;
  }
  let wrapped = ((value - MIN_Z) % range + range) % range;
  wrapped += MIN_Z;
  return wrapped;
}

function humanizeFileName(name: string): string {
  const withoutExt = name.replace(/\.[^/.]+$/, '');
  const withSpaces = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return withSpaces || 'Untitled';
}

function extractYearFromName(name: string): string {
  const match = name.match(/(19|20)\d{2}/);
  return match ? match[0] : 'Unknown';
}

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

declare global {
  interface Window {
    __pilgrimRoot?: Root;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root for pilgrim app.');
}
if (!window.__pilgrimRoot) {
  window.__pilgrimRoot = createRoot(rootElement);
}
window.__pilgrimRoot.render(<App />);
