import type { TextWorkModule } from '../types.js';

const BG = '#000000';
const INK = '#ffffff';
const INVERTED_BG = '#ffffff';
const HORIZONTAL_MARGIN_PERCENT = 20;
const VIEWPORT_PAD_TOP_VH = 0.12;
const VIEWPORT_PAD_BOTTOM_VH = 0.12;
const FONT_MIN_PX = 10;
const FONT_FIT_ITERATIONS = 14;
const FONT_FILL = 0.98;
/** Lens diameter relative to fitted font size. */
const LENS_DIAMETER_RATIO = 6;
const LENS_BORDER = '1px solid rgba(255, 255, 255, 0.35)';
const LENS_FOLLOW = 0.42;

/** Visible layer — curator placement (spaces significant). */
const VISIBLE_TEXT = `emp t i e d      o f
          |   SELF   |`;

/** Hidden layer — same grid; “with love” italic. */
const HIDDEN_HTML = `filled 
           <em class="self-love">with love</em>`;

const work: TextWorkModule = {
  title: 'SELF',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    document.body.style.background = BG;
    document.body.style.color = INK;

    const stage = document.createElement('div');
    stage.className = 'self-stage';

    const lensBg = document.createElement('div');
    lensBg.className = 'self-lens-bg';
    lensBg.setAttribute('aria-hidden', 'true');

    const block = document.createElement('div');
    block.className = 'self-block';

    const sizer = document.createElement('pre');
    sizer.className = 'self-text self-text--sizer';
    sizer.textContent = VISIBLE_TEXT;
    sizer.setAttribute('aria-hidden', 'true');

    const hidden = document.createElement('pre');
    hidden.className = 'self-text self-text--hidden';
    hidden.innerHTML = HIDDEN_HTML;

    const visible = document.createElement('pre');
    visible.className = 'self-text self-text--visible';
    visible.textContent = VISIBLE_TEXT;

    const lens = document.createElement('div');
    lens.className = 'self-lens';
    lens.setAttribute('aria-hidden', 'true');

    block.append(sizer, hidden, visible);
    stage.append(lensBg, block, lens);
    container.appendChild(stage);

    const style = document.createElement('style');
    style.textContent = `
      html.self-active,
      html.self-active body {
        background: ${BG};
        color: ${INK};
        margin: 0;
      }
      .self-stage {
        position: fixed;
        inset: 0;
        z-index: 5;
        background: ${BG};
        overflow: visible;
        touch-action: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: ${VIEWPORT_PAD_TOP_VH * 100}vh ${HORIZONTAL_MARGIN_PERCENT}%
          ${VIEWPORT_PAD_BOTTOM_VH * 100}vh ${HORIZONTAL_MARGIN_PERCENT}%;
      }
      .self-block {
        position: relative;
        z-index: 10;
        margin: 0;
        max-width: 100%;
        max-height: 100%;
        --self-font-size: 16px;
        --self-lens-radius: 48px;
      }
      .self-text {
        margin: 0;
        padding: 0;
        border: 0;
        font-family: "American Typewriter", "Courier New", "Courier Prime", ui-monospace,
          monospace;
        font-size: var(--self-font-size);
        font-weight: 500;
        letter-spacing: 0.02em;
        line-height: 1.35;
        white-space: pre;
        color: ${INK};
        background: transparent;
      }
      .self-text--sizer {
        position: relative;
        z-index: 0;
        visibility: hidden;
        pointer-events: none;
      }
      .self-text--hidden {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        filter: invert(1);
        -webkit-filter: invert(1);
        mask-repeat: no-repeat;
        -webkit-mask-repeat: no-repeat;
        mask-mode: alpha;
        -webkit-mask-mode: alpha;
      }
      .self-text--visible {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 2;
        width: 100%;
        height: 100%;
        mask-repeat: no-repeat;
        -webkit-mask-repeat: no-repeat;
        mask-mode: alpha;
        -webkit-mask-mode: alpha;
      }
      .self-love {
        font-style: italic;
        font-weight: 400;
      }
      .self-lens-bg {
        position: fixed;
        left: 0;
        top: 0;
        width: calc(var(--self-lens-radius) * 2);
        height: calc(var(--self-lens-radius) * 2);
        border-radius: 50%;
        background: ${INVERTED_BG};
        pointer-events: none;
        z-index: 5;
        opacity: 0;
        visibility: hidden;
        transform: translate(-50%, -50%);
      }
      .self-lens-bg.is-active {
        opacity: 1;
        visibility: visible;
      }
      .self-lens {
        position: fixed;
        left: 0;
        top: 0;
        width: calc(var(--self-lens-radius) * 2);
        height: calc(var(--self-lens-radius) * 2);
        border-radius: 50%;
        pointer-events: none;
        z-index: 12;
        border: ${LENS_BORDER};
        box-shadow: 0 0 28px rgba(255, 255, 255, 0.08);
        background: transparent;
        opacity: 0;
        visibility: hidden;
        transform: translate(-50%, -50%);
      }
      .self-lens.is-active {
        opacity: 1;
        visibility: visible;
      }
      html.self-active .back-btn,
      html.self-active .next-btn {
        z-index: 40;
        transition: filter 0.12s ease, opacity 0.12s ease;
      }
      html.self-active .back-btn:hover,
      html.self-active .next-btn:hover,
      html.self-active .back-btn.self-nav-invert,
      html.self-active .next-btn.self-nav-invert {
        filter: invert(1);
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('self-active');

    const navLinks = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.back-btn, .next-btn',
      ),
    );

    const lensHitsElement = (el: HTMLElement, cx: number, cy: number, radius: number): boolean => {
      const rect = el.getBoundingClientRect();
      const pad = 10;
      const closestX = Math.max(rect.left - pad, Math.min(cx, rect.right + pad));
      const closestY = Math.max(rect.top - pad, Math.min(cy, rect.bottom + pad));
      const dx = cx - closestX;
      const dy = cy - closestY;
      return dx * dx + dy * dy <= radius * radius;
    };

    const updateNavInvert = (cx: number, cy: number, lensOn: boolean): void => {
      for (const el of navLinks) {
        const invert = lensOn && lensHitsElement(el, cx, cy, lensRadiusPx);
        el.classList.toggle('self-nav-invert', invert);
      }
    };

    const clearNavInvert = (): void => {
      for (const el of navLinks) {
        el.classList.remove('self-nav-invert');
      }
    };

    let lensRadiusPx = 48;
    let lensX = window.innerWidth * 0.5;
    let lensY = window.innerHeight * 0.5;
    let targetX = lensX;
    let targetY = lensY;
    let chasing = false;
    let rafId = 0;

    const contentBox = (): { width: number; height: number } => {
      const padH = window.innerWidth * (HORIZONTAL_MARGIN_PERCENT / 100) * 2;
      const padV = window.innerHeight * (VIEWPORT_PAD_TOP_VH + VIEWPORT_PAD_BOTTOM_VH);
      return {
        width: Math.max(80, (window.innerWidth - padH) * FONT_FILL),
        height: Math.max(80, (window.innerHeight - padV) * FONT_FILL),
      };
    };

    const setFontPx = (fontPx: number): void => {
      block.style.setProperty('--self-font-size', `${fontPx}px`);
      lensRadiusPx = (fontPx * LENS_DIAMETER_RATIO) / 2;
      const diameter = lensRadiusPx * 2;
      block.style.setProperty('--self-lens-radius', `${lensRadiusPx}px`);
      lensBg.style.width = `${diameter}px`;
      lensBg.style.height = `${diameter}px`;
      lens.style.width = `${diameter}px`;
      lens.style.height = `${diameter}px`;
    };

    const measureTextBlock = (): { width: number; height: number } => {
      const r = sizer.getBoundingClientRect();
      return { width: r.width, height: r.height };
    };

    const fitsInMargins = (fontPx: number): boolean => {
      setFontPx(fontPx);
      const { width: capW, height: capH } = contentBox();
      const { width, height } = measureTextBlock();
      return width <= capW && height <= capH;
    };

    const fitTypeToViewport = (): void => {
      const { height: capH } = contentBox();
      const lineCount = VISIBLE_TEXT.split('\n').length;
      const hiGuess = capH / (lineCount * 1.35);
      let lo = FONT_MIN_PX;
      let hi = Math.max(lo, hiGuess);

      for (let n = 0; n < FONT_FIT_ITERATIONS; n += 1) {
        const mid = (lo + hi) * 0.5;
        if (fitsInMargins(mid)) lo = mid;
        else hi = mid;
      }

      let fontPx = lo;
      while (fontPx > FONT_MIN_PX && !fitsInMargins(fontPx)) {
        fontPx -= 0.5;
      }
      setFontPx(fontPx);
    };

    const maskOffScreen = (): string =>
      `radial-gradient(circle ${lensRadiusPx}px at -100px -100px, transparent 0, transparent ${lensRadiusPx}px, transparent ${lensRadiusPx}px)`;

    const maskHoleInVisible = (localX: number, localY: number): string =>
      `radial-gradient(circle ${lensRadiusPx}px at ${localX}px ${localY}px, transparent 0, transparent ${lensRadiusPx}px, black ${lensRadiusPx}px)`;

    const maskRevealHidden = (localX: number, localY: number): string =>
      `radial-gradient(circle ${lensRadiusPx}px at ${localX}px ${localY}px, black 0, black ${lensRadiusPx}px, transparent ${lensRadiusPx}px)`;

    const applyMasks = (cx: number, cy: number): void => {
      const rect = block.getBoundingClientRect();
      const localX = cx - rect.left;
      const localY = cy - rect.top;
      const hole = maskHoleInVisible(localX, localY);
      const reveal = maskRevealHidden(localX, localY);
      visible.style.maskImage = hole;
      visible.style.webkitMaskImage = hole;
      hidden.style.maskImage = reveal;
      hidden.style.webkitMaskImage = reveal;
    };

    const clearHiddenMask = (): void => {
      const off = maskOffScreen();
      hidden.style.maskImage = off;
      hidden.style.webkitMaskImage = off;
    };

    const showVisibleOnly = (): void => {
      visible.style.maskImage = 'none';
      visible.style.webkitMaskImage = 'none';
      clearHiddenMask();
    };

    const placeLens = (x: number, y: number): void => {
      const pos = `${x}px`;
      lens.style.left = pos;
      lens.style.top = `${y}px`;
      lensBg.style.left = pos;
      lensBg.style.top = `${y}px`;
      const lensOn = lens.classList.contains('is-active');
      if (lensOn) applyMasks(x, y);
      updateNavInvert(x, y, lensOn);
    };

    const setLensActive = (active: boolean): void => {
      lens.classList.toggle('is-active', active);
      lensBg.classList.toggle('is-active', active);
    };

    const tick = (): void => {
      rafId = 0;
      lensX += (targetX - lensX) * LENS_FOLLOW;
      lensY += (targetY - lensY) * LENS_FOLLOW;
      placeLens(lensX, lensY);
      if (chasing) rafId = requestAnimationFrame(tick);
    };

    const chase = (): void => {
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const activateLens = (x: number, y: number): void => {
      setLensActive(true);
      chasing = true;
      targetX = x;
      targetY = y;
      chase();
    };

    const onPointerMove = (e: PointerEvent): void => {
      activateLens(e.clientX, e.clientY);
    };

    const onPointerLeave = (): void => {
      chasing = false;
      setLensActive(false);
      showVisibleOnly();
      clearNavInvert();
    };

    const onResize = (): void => {
      fitTypeToViewport();
      if (lens.classList.contains('is-active')) applyMasks(lensX, lensY);
      else showVisibleOnly();
    };

    const init = (): void => {
      fitTypeToViewport();
      showVisibleOnly();
      placeLens(lensX, lensY);
    };

    if (document.fonts?.ready) {
      void document.fonts.ready.then(init);
    } else {
      requestAnimationFrame(init);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
      clearNavInvert();
      document.documentElement.classList.remove('self-active');
      document.body.style.background = '';
      document.body.style.color = '';
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
