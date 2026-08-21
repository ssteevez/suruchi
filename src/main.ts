import * as THREE from 'three';
import { createCursorSystem } from './systems/cursor/CursorSystem';
import { HomepageScene } from './scenes/HomepageScene';
import { createSmokyLabelSystem } from './systems/smokyLabel/SmokyLabelSystem';

const TOTAL_SECTIONS = 6;

declare global {
  interface Window {
    suruchiPrototype?: {
      setRestBrightness: (value: number) => void;
      setRGBShift: (value: number) => void;
    };
  }
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element.');
}

document.documentElement.style.margin = '0';
document.documentElement.style.height = '100%';
document.documentElement.style.backgroundColor = '#000000';
document.body.style.margin = '0';
document.body.style.backgroundColor = '#000000';
document.body.style.minHeight = `${(TOTAL_SECTIONS + 1) * 100}vh`;
document.body.style.overflowY = 'auto';
app.style.position = 'fixed';
app.style.inset = '0';
app.style.width = '100%';
app.style.height = '100%';
app.style.backgroundColor = '#000000';

const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer =
  window.matchMedia('(pointer: coarse)').matches;
const rippleExperimentEnabled = new URLSearchParams(window.location.search).get('ripple') === '1';

let webglAvailable = true;
try {
  const testRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  testRenderer.dispose();
} catch {
  webglAvailable = false;
}

if (prefersReducedMotion || isCoarsePointer || !webglAvailable) {
  const fallbackImage = document.createElement('img');
  fallbackImage.src = '/poster.jpg';
  fallbackImage.alt = 'Static poster fallback';
  fallbackImage.style.position = 'fixed';
  fallbackImage.style.inset = '0';
  fallbackImage.style.width = '100%';
  fallbackImage.style.height = '100%';
  fallbackImage.style.objectFit = 'cover';
  fallbackImage.style.background = '#000';
  fallbackImage.onerror = () => {
    fallbackImage.style.background = '#0a0a0b';
  };
  app.replaceChildren(fallbackImage);
} else {
  const overlayStyle = document.createElement('style');
  overlayStyle.textContent = `
    .suruchi-corner-frame {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 20;
      font-family: "Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: rgba(245, 245, 245, 0.82);
    }

    .suruchi-corner-item {
      position: fixed;
      font-size: 15px;
      line-height: 1;
      transition: opacity 180ms ease, color 140ms ease, text-shadow 140ms ease;
      pointer-events: auto;
      user-select: none;
      opacity: 0.84;
    }

    .suruchi-static-center-group {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 32px;
      z-index: 30;
      pointer-events: auto;
    }

    .suruchi-static-item {
      font-weight: 500;
      font-size: 44px;
      letter-spacing: 0.1em;
      color: rgba(245, 245, 245, 0.82);
    }

    .suruchi-static-link {
      color: inherit;
      text-decoration: none;
      display: inline-block;
      transition: text-shadow 200ms ease;
    }

    .suruchi-static-link:hover {
      text-shadow: 0 0 24px rgba(255, 255, 255, 0.6);
    }





    .suruchi-pos-1 { position: fixed; top: 76px; left: 84px; font-weight: 500; font-size: 45px; }
    .suruchi-pos-2 { position: fixed; top: 76px; left: 50%; transform: translateX(-50%); text-align: center; font-weight: 500; font-size: 45px; }
    .suruchi-pos-3 { position: fixed; top: 76px; right: 84px; text-align: right; font-weight: 500; font-size: 45px; }

    .suruchi-pos-bottom-1 { position: fixed; bottom: 24px; left: 84px; font-weight: 500; font-size: 22px; }
    .suruchi-pos-bottom-2 { position: fixed; bottom: 24px; right: 84px; text-align: right; font-weight: 500; font-size: 22px; }

    .suruchi-char {
      display: inline-block;
      transform-origin: center;
      will-change: transform, opacity, filter;
    }

    .suruchi-word {
      display: inline-block;
    }

    .suruchi-footer-line {
      position: fixed;
      bottom: 86px;
      left: 84px;
      right: 84px;
      height: 2px;
      background-color: rgba(90, 90, 90, 0.96);
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
      z-index: 20;
      pointer-events: none;
    }

    .suruchi-link {
      color: inherit;
      text-decoration: none;
      display: inline-block;
      cursor: pointer;
    }
  `;
  document.head.appendChild(overlayStyle);

  const cornerFrame = document.createElement('div');
  cornerFrame.className = 'suruchi-corner-frame';
  cornerFrame.innerHTML = `
    <div class="suruchi-static-center-group">
      <div class="suruchi-static-item">
        <span class="suruchi-label" style="display:inline-block; white-space:nowrap; cursor:default;">SURUCHI CHOKSI</span>
      </div>
    </div>

    <div class="suruchi-footer-line"></div>
    <div class="suruchi-corner-item suruchi-pos-1"><span class="suruchi-label">Pilgrim</span></div>
    <div class="suruchi-corner-item suruchi-pos-2"><span class="suruchi-label">Poet</span></div>
    <div class="suruchi-corner-item suruchi-pos-3"><span class="suruchi-label">Painter</span></div>
    <div class="suruchi-corner-item suruchi-pos-bottom-1"><span class="suruchi-label">Bio</span></div>
    <div class="suruchi-corner-item suruchi-pos-bottom-2"><span class="suruchi-label">Contact</span></div>
  `;
  document.body.appendChild(cornerFrame);
  const cornerItems = Array.from(
    cornerFrame.querySelectorAll<HTMLElement>('.suruchi-corner-item')
  );
  const letterGroups = Array.from(
    cornerFrame.querySelectorAll<HTMLElement>('.suruchi-word, .suruchi-label')
  );

  for (const group of letterGroups) {
    const raw = group.textContent ?? '';
    group.textContent = '';
    for (const char of raw) {
      const span = document.createElement('span');
      span.className = 'suruchi-char';
      span.textContent = char === ' ' ? ' ' : char;
      group.appendChild(span);
    }
  }

  const poetItem = cornerFrame.querySelector<HTMLElement>('.suruchi-pos-2');
  const pilgrimItem = cornerFrame.querySelector<HTMLElement>('.suruchi-pos-1');
  const painterItem = cornerFrame.querySelector<HTMLElement>('.suruchi-pos-3');
  
  const bioItem = cornerFrame.querySelector<HTMLElement>('.suruchi-pos-bottom-1');
  const contactItem = cornerFrame.querySelector<HTMLElement>('.suruchi-pos-bottom-2');

  const smokySystemTop = poetItem && painterItem && pilgrimItem
    ? createSmokyLabelSystem([
        { element: poetItem, word: 'POET', href: '/poet.html' },
        { element: painterItem, word: 'PAINTER', href: '/painter.html' },
        { element: pilgrimItem, word: 'PILGRIM', href: '/pilgrim.html' },
      ], ['suruchi-pos-1', 'suruchi-pos-2', 'suruchi-pos-3'])
    : null;

  const smokySystemBottom = bioItem && contactItem
    ? createSmokyLabelSystem([
        { element: bioItem, word: 'BIO', href: '/bio.html' },
        { element: contactItem, word: 'CONTACT', href: '/contact.html' },
      ], ['suruchi-pos-bottom-1', 'suruchi-pos-bottom-2'])
    : null;

  const cursorSystem = createCursorSystem({ radius: 180, smoothing: 0.94 });
  const scene = new HomepageScene({
    restBrightness: 0.40,
    rippleExperimentEnabled,
  });
  scene.mount(app);
  scene.startVideo();

  window.suruchiPrototype = {
    // TUNING HOOK — remove before production.
    setRestBrightness: (value: number) => {
      scene.setRestBrightness(value);
    },
    // TUNING HOOK — remove before production.
    setRGBShift: (value: number) => {
      scene.setRGBShift(value);
    },
  };

  let targetScrollY = window.scrollY;
  let smoothScrollY = window.scrollY;

  const getLoopScrollSpan = (): number => {
    return Math.max(window.innerHeight * TOTAL_SECTIONS, 1);
  };

  window.addEventListener(
    'scroll',
    () => {
      const loopSpan = getLoopScrollSpan();
      const y = window.scrollY;

      if (y <= 1) {
        const wrappedY = Math.max(loopSpan - 2, 1);
        window.scrollTo(0, wrappedY);
        targetScrollY = wrappedY;
        smoothScrollY = wrappedY;
        return;
      }

      if (y >= loopSpan) {
        const wrappedY = 2;
        window.scrollTo(0, wrappedY);
        targetScrollY = wrappedY;
        smoothScrollY = wrappedY;
        return;
      }

      targetScrollY = y;
    },
    { passive: true }
  );

  const resize = (): void => {
    const cappedDpr = Math.min(window.devicePixelRatio || 1, 2);
    scene.resize(window.innerWidth, window.innerHeight, cappedDpr);
  };

  resize();
  window.addEventListener('resize', resize);

  let lastFrameTimeMs = performance.now();
  let rafId = 0;

  const loop = (timeMs: number): void => {
    const dt = Math.min((timeMs - lastFrameTimeMs) / 1000, 0.1);
    lastFrameTimeMs = timeMs;

    const scrollAlpha = 1 - Math.pow(0.86, dt * 60);
    smoothScrollY += (targetScrollY - smoothScrollY) * scrollAlpha;
    const maxScroll = getLoopScrollSpan();
    const sectionProgress = Math.max(
      0,
      Math.min(TOTAL_SECTIONS, (smoothScrollY / maxScroll) * TOTAL_SECTIONS)
    );
    scene.setSectionProgress(sectionProgress);
    const wrappedProgress = ((sectionProgress % TOTAL_SECTIONS) + TOTAL_SECTIONS) % TOTAL_SECTIONS;
    const sectionIndex = Math.floor(wrappedProgress);
    scene.prefetchScene((sectionIndex + 2) % TOTAL_SECTIONS);

    cursorSystem.update(dt);
    const cursorState = cursorSystem.getState();
    scene.render(cursorState, dt);

    const velocityStrength = Math.min(
      1,
      Math.hypot(cursorState.velocity.x, cursorState.velocity.y) / 1400
    );

    for (const item of cornerItems) {
      if (smokySystemTop?.isSmoking(item) || smokySystemBottom?.isSmoking(item)) continue;
      const chars = Array.from(item.querySelectorAll<HTMLElement>('.suruchi-char'));
      let totalInfluence = 0;

      chars.forEach((char, index) => {
        const rect = char.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        const dx = centerX - cursorState.lightPosition.x;
        const dy = centerY - cursorState.lightPosition.y;
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / Math.max(cursorState.radius * 1.9, 1));
        totalInfluence += influence;

        const invDist = 1 / Math.max(distance, 1);
        const radialX = dx * invDist;
        const radialY = dy * invDist;
        const tangentX = -radialY;
        const tangentY = radialX;
        const ripple =
          Math.sin(timeMs * 0.015 + index * 0.9) *
          influence *
          (2.0 + velocityStrength * 6.0);

        const shiftX = radialX * influence * 10 + tangentX * ripple;
        const shiftY = radialY * influence * 10 + tangentY * ripple;
        const scale = 1 + influence * 0.18 + velocityStrength * 0.05;
        const charOpacity = 0.84 + influence * 0.16;

        char.style.transform = `translate(${shiftX.toFixed(2)}px, ${shiftY.toFixed(
          2
        )}px) scale(${scale.toFixed(3)})`;
        char.style.opacity = charOpacity.toFixed(3);
      });

      const averageInfluence = chars.length > 0 ? totalInfluence / chars.length : 0;
      const invertStart = 0.34;
      const invertAmount = Math.max(
        0,
        Math.min(1, (averageInfluence - invertStart) / (1 - invertStart))
      );
      const channel = Math.round(245 * (1 - invertAmount));
      item.style.opacity = `${(0.82 + averageInfluence * 0.18).toFixed(3)}`;
      item.style.color = `rgba(${channel}, ${channel}, ${channel}, 0.96)`;
      item.style.textShadow = `0 0 ${(8 + averageInfluence * 24).toFixed(
        2
      )}px rgba(255,255,255,${(0.12 + averageInfluence * 0.42 - invertAmount * 0.36).toFixed(
        3
      )})`;
    }

    rafId = window.requestAnimationFrame(loop);
  };

  rafId = window.requestAnimationFrame(loop);

  const dispose = (): void => {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    cursorSystem.dispose();
    scene.dispose();
    smokySystemTop?.dispose();
    smokySystemBottom?.dispose();
    cornerFrame.remove();
    overlayStyle.remove();
    delete window.suruchiPrototype;
  };

  window.addEventListener('beforeunload', dispose);
}
