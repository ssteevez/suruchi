import { extractDominantColor } from './colorExtractor.js';

export interface CarouselState {
  activeIndex: number;
  activeCard: HTMLElement | null;
  activeColor: [number, number, number];
  nextColor: [number, number, number];
  isOpen: boolean;
}

export interface Carousel {
  state: CarouselState;
  update(dt: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

const ZERO_PLUS_IMAGES = [
  '/images/painter/zero-plus/IMG_0695.jpg',
  '/images/painter/zero-plus/IMG_0696.jpg',
  '/images/painter/zero-plus/IMG_0697.jpg',
  '/images/painter/zero-plus/IMG_0698.jpg',
  '/images/painter/zero-plus/IMG_3067.jpg',
  '/images/painter/zero-plus/IMG_5028.jpg'
];

const IMAGE_COUNT = 6;
const ADVANCE_THRESHOLD = 80;
const CREDIT_RESET_GAP_MS = 360;
const ADVANCE_LOCKOUT_MS = 250;
// Very soft, overdamped spring — slow, gentle, smooth glide.
const SPRING_STIFFNESS = 35;
const SPRING_DAMPING = 14;
const MAX_ROTATION_VELOCITY = 120;
const STOP_ANGLE_EPSILON = 0.08;
const STOP_VELOCITY_EPSILON = 0.8;
const ACTIVE_INDEX_HYSTERESIS = 0.025;
const GLOW_BLUR_PX = 210;
const CARD_ASPECT = 0.74; // width / height
const FRONT_SCALE_MAX = 1.06; // matches scl at focusT = 1 in update()
const VERTICAL_MARGIN = 0.125; // 12.5% empty space top & bottom of viewport
const RING_SAMPLES = 28; // perimeter color samples for the multicolor bloom
const RING_RADIUS_RATIO = 1.3; // ring radius relative to card width
// Opacity targets by ring distance from the focus card (0 = front). Keeps cards
// 3–4 steps back (e.g. paintings 4 & 5) readable as a depth stack.
const DEPTH_OPACITY = [1, 0.84, 0.68, 0.52, 0.42];
// How much larger the front card renders due to perspective. The scene
// perspective is derived from this so the magnification stays constant at any
// carousel size (otherwise a large ring sits near the camera plane and the
// front card blows up to fill the screen).
const PERSPECTIVE_MAG = 1.85;

const normalizeAngleDeg = (angle: number): number => {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
};

const ringDistance = (index: number, focusIndex: number, count: number): number => {
  let d = Math.abs(index - focusIndex);
  if (d > count / 2) d = count - d;
  return d;
};

const shortestAngleDeltaDeg = (from: number, to: number): number => {
  return normalizeAngleDeg(to - from);
};

export function initCarousel(): Carousel {
  const ring = document.getElementById('carousel-ring') as HTMLElement | null;
  const scene = document.getElementById('carousel-scene') as HTMLElement | null;
  const lightbox = document.getElementById('lightbox') as HTMLElement | null;
  const lbImg = document.getElementById('lightbox-img') as HTMLImageElement | null;
  const lbTitle = document.getElementById('lightbox-title') as HTMLElement | null;
  const lbMeta = document.getElementById('lightbox-meta') as HTMLElement | null;
  const lbCaption = document.getElementById('lightbox-caption') as HTMLElement | null;
  const lbClose = document.getElementById('lightbox-close') as HTMLButtonElement | null;
  const lbPrev = document.getElementById('lightbox-prev') as HTMLButtonElement | null;
  const lbNext = document.getElementById('lightbox-next') as HTMLButtonElement | null;
  if (!ring || !lightbox || !lbImg || !lbTitle || !lbMeta || !lbCaption || !lbClose || !lbPrev || !lbNext) {
    throw new Error('Carousel: required DOM elements not found');
  }

  const stepDeg = 360 / IMAGE_COUNT;

  let rotationDeg = 0;
  let targetRotationDeg = 0;
  let rotationVelocityDegPerSec = 0;
  let scrollCredit = 0;
  let lastWheelTime = 0;
  let advanceLockUntil = 0;
  let paused = false;

  const colors: Array<[number, number, number]> = Array.from({ length: IMAGE_COUNT }, () => {
    return [30, 30, 30] as [number, number, number];
  });
  const edgeColors: Array<[number, number, number]> = Array.from({ length: IMAGE_COUNT }, () => {
    return [30, 30, 30] as [number, number, number];
  });

  const clampColor = (value: number): number => {
    return Math.max(0, Math.min(255, Math.round(value)));
  };

  const getContextColorAt = (index: number): [number, number, number] => {
    const edge = edgeColors[index] ?? [30, 30, 30];
    const dominant = colors[index] ?? [30, 30, 30];
    const mixed: [number, number, number] = [
      edge[0] * 0.78 + dominant[0] * 0.22,
      edge[1] * 0.78 + dominant[1] * 0.22,
      edge[2] * 0.78 + dominant[2] * 0.22,
    ];
    const avg = (mixed[0] + mixed[1] + mixed[2]) / 3;
    let r = avg + (mixed[0] - avg) * 1.38;
    let g = avg + (mixed[1] - avg) * 1.38;
    let b = avg + (mixed[2] - avg) * 1.38;
    const maxChan = Math.max(r, g, b);
    if (maxChan < 120 && maxChan > 0) {
      const boost = 120 / maxChan;
      r *= boost;
      g *= boost;
      b *= boost;
    }
    return [clampColor(r), clampColor(g), clampColor(b)];
  };

  // Push a context color to a vivid, luminous neon: strongly saturate around
  // the channel average, then lift toward full brightness so the bloom reads
  // as electric rather than a faint, washed-out tint.
  const neonize = (color: [number, number, number]): [number, number, number] => {
    const [r0, g0, b0] = color;
    const avg = (r0 + g0 + b0) / 3;
    const SATURATION = 2.6;
    let r = avg + (r0 - avg) * SATURATION;
    let g = avg + (g0 - avg) * SATURATION;
    let b = avg + (b0 - avg) * SATURATION;
    const maxChan = Math.max(r, g, b, 1);
    const lift = Math.min(255 / maxChan, 2.0);
    r *= lift;
    g *= lift;
    b *= lift;
    return [clampColor(r), clampColor(g), clampColor(b)];
  };

  // Sample the artwork's colour all the way around its perimeter and build a
  // conic gradient from those samples. Used as a blurred halo behind the card
  // so the bloom is multi-coloured — each part of the border glows with the
  // hue of the artwork edge it sits next to. Returns the gradient plus the
  // averaged neon colour (used for the soft far-reaching tail of the bloom).
  const buildRingGradient = (
    img: HTMLImageElement,
  ): { gradient: string; avg: [number, number, number] } | null => {
    const cw = 132;
    const ch = Math.round(cw / CARD_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) return null;

    // Draw the image with object-fit: cover semantics so samples match what is
    // actually visible inside the card.
    const scale = Math.max(cw / nw, ch / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    const { data } = ctx.getImageData(0, 0, cw, ch);

    const sampleBlock = (px: number, py: number): [number, number, number] => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const x = Math.max(0, Math.min(cw - 1, px + ox));
          const y = Math.max(0, Math.min(ch - 1, py + oy));
          const idx = (y * cw + x) * 4;
          r += data[idx] ?? 0;
          g += data[idx + 1] ?? 0;
          b += data[idx + 2] ?? 0;
          n += 1;
        }
      }
      return [r / n, g / n, b / n];
    };

    const cx = cw / 2;
    const cy = ch / 2;
    const hx = (cw / 2) * 0.94;
    const hy = (ch / 2) * 0.94;

    const stops: string[] = [];
    let avgR = 0;
    let avgG = 0;
    let avgB = 0;
    let firstColor = '';

    for (let i = 0; i < RING_SAMPLES; i += 1) {
      const a = (i / RING_SAMPLES) * Math.PI * 2; // 0 = top, clockwise
      const dirX = Math.sin(a);
      const dirY = -Math.cos(a); // screen up is -y
      const tx = dirX !== 0 ? hx / Math.abs(dirX) : Infinity;
      const ty = dirY !== 0 ? hy / Math.abs(dirY) : Infinity;
      const t = Math.min(tx, ty) * 0.92;
      const px = Math.round(cx + dirX * t);
      const py = Math.round(cy + dirY * t);
      const [nr, ng, nb] = neonize(sampleBlock(px, py));
      avgR += nr;
      avgG += ng;
      avgB += nb;
      const color = `rgb(${nr},${ng},${nb})`;
      if (i === 0) firstColor = color;
      const deg = ((i * 360) / RING_SAMPLES).toFixed(1);
      stops.push(`${color} ${deg}deg`);
    }
    stops.push(`${firstColor} 360deg`);

    const gradient = `conic-gradient(from 0deg at 50% 50%, ${stops.join(', ')})`;
    const avg: [number, number, number] = [
      clampColor(avgR / RING_SAMPLES),
      clampColor(avgG / RING_SAMPLES),
      clampColor(avgB / RING_SAMPLES),
    ];
    return { gradient, avg };
  };

  const state: CarouselState = {
    activeIndex: 0,
    activeCard: null,
    activeColor: [30, 30, 30],
    nextColor: [30, 30, 30],
    isOpen: false,
  };

  const cards: HTMLElement[] = [];
  const images: HTMLImageElement[] = [];
  const fogs: (HTMLElement | null)[] = [];
  const glows: (HTMLElement | null)[] = [];
  const inners: (HTMLElement | null)[] = [];
  const ringGradients: (string | null)[] = Array.from({ length: IMAGE_COUNT }, () => null);
  const ringAvgColors: Array<[number, number, number]> = Array.from(
    { length: IMAGE_COUNT },
    () => [30, 30, 30] as [number, number, number],
  );

  const extractEdgeColor = (img: HTMLImageElement): [number, number, number] => {
    const size = 56;
    const border = 8;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [30, 30, 30];

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const isEdge = x < border || x >= size - border || y < border || y >= size - border;
        if (!isEdge) continue;
        const idx = (y * size + x) * 4;
        const r = data[idx] ?? 0;
        const g = data[idx + 1] ?? 0;
        const b = data[idx + 2] ?? 0;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum < 16 || lum > 242) {
          continue;
        }
        sumR += r;
        sumG += g;
        sumB += b;
        count += 1;
      }
    }

    if (count === 0) return [30, 30, 30];
    return [
      Math.round(sumR / count),
      Math.round(sumG / count),
      Math.round(sumB / count),
    ];
  };

  const getCardSize = (): { width: number; height: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= 900;
    const sceneW = isMobile ? vw : Math.min(vw * 0.54, 760);

    // Target the on-screen size of the focused card: it should span the middle
    // (1 - 2*margin) of the viewport height, leaving symmetric top/bottom
    // margins at any window size. The layout size is smaller than the rendered
    // size because perspective magnifies the front card and it is also scaled.
    const renderScale = FRONT_SCALE_MAX * PERSPECTIVE_MAG;
    let height = (vh * (1 - 2 * VERTICAL_MARGIN)) / renderScale;
    let width = height * CARD_ASPECT;

    // Guard against the focused card overflowing the scene horizontally on
    // tall, narrow windows (compare against its rendered width).
    const maxFrontW = sceneW * (isMobile ? 0.96 : 0.92);
    if (width * renderScale > maxFrontW) {
      width = maxFrontW / renderScale;
      height = width / CARD_ASPECT;
    }

    return { width: Math.round(width), height: Math.round(height) };
  };

  const getRingRadius = (): number => {
    const { width } = getCardSize();
    return Math.round(width * RING_RADIUS_RATIO);
  };

  // Set the scene perspective from the ring radius so the front-card
  // magnification equals PERSPECTIVE_MAG regardless of carousel size.
  const applyPerspective = (): void => {
    if (!scene) return;
    const radius = getRingRadius();
    const perspective = (radius * PERSPECTIVE_MAG) / (PERSPECTIVE_MAG - 1);
    scene.style.perspective = `${Math.round(perspective)}px`;
  };

  const applyCardSize = (card: HTMLElement): void => {
    const { width, height } = getCardSize();
    card.style.width = `${Math.round(width)}px`;
    card.style.height = `${Math.round(height)}px`;
    card.style.left = `${-Math.round(width / 2)}px`;
    card.style.top = `${-Math.round(height / 2)}px`;
  };

  const onWheel = (event: WheelEvent): void => {
    if (state.isOpen) return;
    const now = performance.now();
    if (now < advanceLockUntil) return;

    let normalizedDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      normalizedDelta *= 16;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      normalizedDelta *= window.innerHeight;
    }
    const delta = Math.max(-100, Math.min(100, normalizedDelta));

    if (now - lastWheelTime > CREDIT_RESET_GAP_MS) scrollCredit = 0;
    lastWheelTime = now;
    scrollCredit += delta;

    if (Math.abs(scrollCredit) >= ADVANCE_THRESHOLD) {
      const dir = Math.sign(scrollCredit);
      targetRotationDeg = normalizeAngleDeg(targetRotationDeg - dir * stepDeg);
      scrollCredit = 0;
      advanceLockUntil = now + ADVANCE_LOCKOUT_MS;
    }
  };
  window.addEventListener('wheel', onWheel, { passive: true });

  for (let i = 0; i < IMAGE_COUNT; i += 1) {
    const card = document.createElement('div');
    card.className = 'carousel-card';
    applyCardSize(card);

    const glow = document.createElement('div');
    glow.className = 'card-glow';

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const img = document.createElement('img');
    img.alt = `Painting ${i + 1}`;
    img.draggable = false;
    img.src = ZERO_PLUS_IMAGES[i % ZERO_PLUS_IMAGES.length] || '';
    img.onload = () => {
      colors[i] = extractDominantColor(img);
      const ringData = buildRingGradient(img);
      if (ringData) {
        ringGradients[i] = ringData.gradient;
        ringAvgColors[i] = ringData.avg;
      }
      if (i === state.activeIndex) {
        state.activeColor = getContextColorAt(i);
      }
    };
    
    const fog = document.createElement('div');
    fog.className = 'card-fog';
    
    inner.appendChild(img);
    inner.appendChild(fog);

    card.appendChild(glow);
    card.appendChild(inner);
    ring.appendChild(card);
    cards.push(card);
    images.push(img);
    fogs.push(fog);
    glows.push(glow);
    inners.push(inner);
    card.addEventListener('click', () => {
      if (!state.isOpen) {
        openLightbox(i);
      }
    });
  }

  let currentLightboxIndex = -1;

  const openLightbox = (index: number): void => {
    currentLightboxIndex = index;
    const img = images[index];
    if (!img) return;
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbTitle.textContent = `Untitled Painting ${index + 1}`;
    lbMeta.textContent = 'Oil / Acrylic placeholder · Year placeholder · Size placeholder';
    lbCaption.textContent =
      'Placeholder curatorial text. This section will include title context, process notes, and interpretive description for this painting.';
    
    if (!state.isOpen) {
      lightbox.classList.add('open');
      state.isOpen = true;
      paused = true;
    }
  };

  const closeLightbox = (): void => {
    lightbox.classList.remove('open');
    state.isOpen = false;
    paused = false;
    currentLightboxIndex = -1;
  };

  const navLightbox = (direction: 1 | -1): void => {
    if (!state.isOpen || currentLightboxIndex === -1) return;
    let nextIndex = (currentLightboxIndex + direction) % IMAGE_COUNT;
    if (nextIndex < 0) nextIndex += IMAGE_COUNT;
    openLightbox(nextIndex);
  };

  lbPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navLightbox(-1);
  });
  
  lbNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navLightbox(1);
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  lbClose.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (!state.isOpen) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      navLightbox(-1);
    } else if (e.key === 'ArrowRight') {
      navLightbox(1);
    }
  });

  window.addEventListener('resize', () => {
    applyPerspective();
    const r = getRingRadius();
    cards.forEach((card, i) => {
      applyCardSize(card);
      const angleDeg = rotationDeg + i * stepDeg;
      card.style.transform = `rotateY(${angleDeg}deg) translateZ(${r}px)`;
    });
  });

  applyPerspective();
  cards.forEach((card, i) => {
    const angleDeg = rotationDeg + i * stepDeg;
    card.style.transform = `rotateY(${angleDeg}deg) translateZ(${getRingRadius()}px)`;
  });

  return {
    state,

    update(_dt: number): void {
      if (!paused) {
        const dt = Math.min(Math.max(_dt, 0), 0.1);
        rotationDeg = normalizeAngleDeg(rotationDeg);
        targetRotationDeg = normalizeAngleDeg(targetRotationDeg);
        const deltaToTarget = shortestAngleDeltaDeg(rotationDeg, targetRotationDeg);

        const acceleration = deltaToTarget * SPRING_STIFFNESS - rotationVelocityDegPerSec * SPRING_DAMPING;
        rotationVelocityDegPerSec = Math.max(
          -MAX_ROTATION_VELOCITY,
          Math.min(MAX_ROTATION_VELOCITY, rotationVelocityDegPerSec + acceleration * dt),
        );
        rotationDeg += rotationVelocityDegPerSec * dt;

        if (
          Math.abs(deltaToTarget) < STOP_ANGLE_EPSILON &&
          Math.abs(rotationVelocityDegPerSec) < STOP_VELOCITY_EPSILON
        ) {
          rotationDeg = targetRotationDeg;
          rotationVelocityDegPerSec = 0;
        }
      }

      const currentR = getRingRadius();
      let bestIndex = 0;
      let bestCos = -Infinity;

      for (let i = 0; i < IMAGE_COUNT; i += 1) {
        const angleDeg = rotationDeg + i * stepDeg;
        const angleRad = (angleDeg * Math.PI) / 180;
        const cosVal = Math.cos(angleRad);
        if (cosVal > bestCos) {
          bestCos = cosVal;
          bestIndex = i;
        }
      }

      const activeAngleDeg = rotationDeg + state.activeIndex * stepDeg;
      const activeCos = Math.cos((activeAngleDeg * Math.PI) / 180);
      const shouldSwitchActive =
        bestIndex !== state.activeIndex &&
        bestCos > activeCos + ACTIVE_INDEX_HYSTERESIS;

      if (shouldSwitchActive) {
        state.activeIndex = bestIndex;
        state.activeColor = getContextColorAt(bestIndex);
        const nextIdx = (bestIndex + 2) % IMAGE_COUNT;
        state.nextColor = getContextColorAt(nextIdx);
      } else if (state.nextColor[0] === 30 && state.nextColor[1] === 30 && state.nextColor[2] === 30) {
        const nextIdx = (bestIndex + 2) % IMAGE_COUNT;
        state.nextColor = getContextColorAt(nextIdx);
      }

      const focusIndex = state.activeIndex;
      state.activeCard = cards[focusIndex] ?? null;

      for (let i = 0; i < IMAGE_COUNT; i += 1) {
        const card = cards[i];
        if (!card) continue;
        const img = images[i];
        if (!img) continue;
        const angleDeg = rotationDeg + i * stepDeg;
        const angleRad = (angleDeg * Math.PI) / 180;
        const cosVal = Math.cos(angleRad);

        const focusT = (cosVal + 1) / 2;
        const scl = 0.62 + focusT * 0.44;
        card.style.transform = `rotateY(${angleDeg}deg) translateZ(${currentR}px) scale(${scl})`;
        const depthZ = Math.round((cosVal + 1) * 1000);
        card.style.zIndex = i === focusIndex ? '3000' : `${depthZ}`;

        const dist = ringDistance(i, focusIndex, IMAGE_COUNT);
        const depthBase = DEPTH_OPACITY[Math.min(dist, DEPTH_OPACITY.length - 1)] ?? DEPTH_OPACITY.at(-1)!;
        const facing = Math.pow(focusT, 0.85);

        const stackOpacity =
          dist === 0 ? 1 : depthBase * (0.42 + facing * 0.58) + (dist >= 2 ? depthBase * 0.28 : 0);
        card.style.opacity = Math.min(1, stackOpacity).toFixed(3);
        card.style.pointerEvents = cosVal > -0.15 ? 'auto' : 'none';

        // Use an exponential curve so side cards are only slightly blurry, 
        // but the back cards become extremely blurry (up to 24px)
        const blurPx = (Math.pow(1 - focusT, 1.5) * 24).toFixed(2);
        const brightness = (0.38 + focusT * 0.62).toFixed(3);
        card.style.filter = `blur(${blurPx}px) brightness(${brightness})`;

        const fog = fogs[i] ?? null;
        if (fog) {
          // Fog disabled — trying the carousel without the darkening overlay
          // now that the bloom is intense. Restore `((1 - focusT) * 0.65)` to
          // bring it back.
          fog.style.opacity = '0';
        }

        // Glow layer is removed for the framed physical gallery aesthetic.
        // We let the CSS box-shadow handle the physical drop shadow without jumping.
      }
    },

    pause(): void {
      paused = true;
    },
    resume(): void {
      paused = false;
    },
    dispose(): void {
      window.removeEventListener('wheel', onWheel);
      while (ring.firstChild) {
        ring.removeChild(ring.firstChild);
      }
    },
  };
}
