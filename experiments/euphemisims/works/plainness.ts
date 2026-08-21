import type { TextWorkModule } from '../types.js';

const PLAINNESS = 'plainness';
const TRAIL_WORD = 'exalted';
const TRAIL_MIN = 1;
/** ms of continuous movement before another “exalted” joins the stack. */
const MS_PER_STACK_WORD = 60;

/** Plainness magnet — how fast the label catches the cursor. */
const FOLLOW = 0.22;
/** Drift back to center when the pointer leaves the viewport. */
const RETURN = 0.08;
/** Plainness: bottom-right of the hotspot (top-left of the word anchored there). */
const PLAINNESS_OFFSET_X = 6;
const PLAINNESS_OFFSET_Y = 8;
/** Exalted trail: opposite corner — top-left of the hotspot (word anchored bottom-right). */
const EXALTED_OFFSET_X = 6;
const EXALTED_OFFSET_Y = 8;

/** Path samples between trail slots (small = tighter trail). */
const TRAIL_HISTORY_GAP = 2;
/** Min cursor travel (px) before recording a path sample. */
const TRAIL_SAMPLE_DIST = 10;
const TRAIL_SAMPLE_DIST_SQ = TRAIL_SAMPLE_DIST * TRAIL_SAMPLE_DIST;
/** Lead “exalted” catches the cursor anchor; tail copies lag each other. */
const TRAIL_FOLLOW_HEAD = 0.26;
const TRAIL_FOLLOW_CHAIN = 0.14;
/** px² — pointer must move more than this per event to count as moving. */
const MOVE_THRESHOLD_SQ = 9;
/** ms without movement before the exalted trail begins to fade. */
const TRAIL_IDLE_MS = 140;
/** Base ms for trail dissolve; grows slightly with stack length. */
const TRAIL_FADE_BASE_MS = 1400;
const TRAIL_FADE_PER_WORD_MS = 45;
/** How much of the timeline each word’s fade overlaps its neighbours (0–1). */
const TRAIL_FADE_OVERLAP = 0.72;
/** Extra ms at the end — all remaining copies ease out together. */
const TRAIL_FADE_TAIL_MS = 520;

interface Point {
  x: number;
  y: number;
}

const trailCountForSession = (sessionMs: number): number =>
  Math.max(TRAIL_MIN, 1 + Math.floor(sessionMs / MS_PER_STACK_WORD));

/** Each trail copy is this fraction of the one nearer the cursor (index 0 = 1). */
const TRAIL_OPACITY_STEP = 0.86;

const opacityForIndex = (index: number): number => {
  if (index === 0) return 1;
  return Math.max(0.05, TRAIL_OPACITY_STEP ** index);
};

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const easeOutQuint = (t: number): number => 1 - (1 - clamp01(t)) ** 5;

const fadeDurationMs = (wordCount: number): number =>
  TRAIL_FADE_BASE_MS + wordCount * TRAIL_FADE_PER_WORD_MS;

const work: TextWorkModule = {
  title: 'Plainness',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    const layer = document.createElement('div');
    layer.className = 'plainness-layer';

    const trailLayer = document.createElement('div');
    trailLayer.className = 'exalted-trail-layer';
    trailLayer.setAttribute('aria-hidden', 'true');

    const word = document.createElement('p');
    word.className = 'plainness-word';
    word.textContent = PLAINNESS;

    const trailEls: HTMLParagraphElement[] = [];
    const trailCurrent: Point[] = [];

    layer.append(trailLayer, word);
    container.appendChild(layer);

    const style = document.createElement('style');
    style.textContent = `
      .plainness-layer {
        position: fixed;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        touch-action: none;
      }
      .exalted-trail-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0;
      }
      .exalted-trail-layer.is-active,
      .exalted-trail-layer.is-fading {
        opacity: 1;
      }
      .plainness-word,
      .exalted-trail-word {
        position: fixed;
        left: 0;
        top: 0;
        margin: 0;
        font-family: "Neue Haas Grotesk Text Pro", "Suisse Intl", "Avenir Next",
          "Helvetica Neue", Arial, sans-serif;
        font-weight: 360;
        line-height: 1;
        letter-spacing: 0.14em;
        text-transform: lowercase;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      }
      .plainness-word {
        font-size: clamp(28px, 5.5vw, 64px);
        color: rgba(245, 245, 245, 0.9);
        z-index: 2;
      }
      .exalted-trail-word {
        font-size: clamp(22px, 4.2vw, 48px);
        color: rgba(245, 245, 245, 0.92);
        z-index: 1;
      }
    `;
    document.head.appendChild(style);

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.5;
    let currentX = targetX;
    let currentY = targetY;
    let lastPointerX = targetX;
    let lastPointerY = targetY;
    let pointerInView = false;
    let trailActive = false;
    let trailFading = false;
    let fadeStartAt = 0;
    let fadeVisibleCount = 0;
    let moveSessionStart = 0;
    let visibleTrailCount = TRAIL_MIN;
    let lastMoveAt = 0;
    const pathHistory: Point[] = [];
    let rafId = 0;
    let dead = false;

    const exaltedAnchor = (x: number, y: number): Point => ({
      x: x - EXALTED_OFFSET_X,
      y: y - EXALTED_OFFSET_Y,
    });

    const exaltedTransform = (x: number, y: number): string =>
      `translate(${x}px, ${y}px) translate(-100%, -100%)`;

    const ensureTrailCount = (count: number, anchor: Point): void => {
      while (trailEls.length < count) {
        const el = document.createElement('p');
        el.className = 'exalted-trail-word';
        el.textContent = TRAIL_WORD;
        el.style.opacity = '0';
        el.style.transform = exaltedTransform(anchor.x, anchor.y);
        trailLayer.appendChild(el);
        trailEls.push(el);
        trailCurrent.push({ x: anchor.x, y: anchor.y });
      }
    };

    const clearTrailPool = (): void => {
      trailLayer.replaceChildren();
      trailEls.length = 0;
      trailCurrent.length = 0;
    };

    const setPointer = (x: number, y: number): void => {
      const dx = x - lastPointerX;
      const dy = y - lastPointerY;
      if (dx * dx + dy * dy >= MOVE_THRESHOLD_SQ) {
        const now = performance.now();
        if (!trailActive || trailFading) {
          moveSessionStart = now;
          clearTrailPool();
        }
        trailActive = true;
        trailFading = false;
        lastMoveAt = now;
        trailLayer.classList.add('is-active');
        trailLayer.classList.remove('is-fading');
        trailLayer.style.removeProperty('opacity');
      }
      lastPointerX = x;
      lastPointerY = y;
      targetX = x;
      targetY = y;
    };

    const onPointerMove = (e: PointerEvent): void => {
      pointerInView = true;
      setPointer(e.clientX, e.clientY);
    };

    const beginTrailFade = (): void => {
      if (trailFading) return;
      if (
        !trailActive &&
        trailEls.every((el) => (Number.parseFloat(el.style.opacity) || 0) < 0.02)
      ) {
        return;
      }
      trailActive = false;
      trailFading = true;
      fadeStartAt = performance.now();
      fadeVisibleCount = visibleTrailCount;
      pathHistory.length = 0;
      trailLayer.classList.remove('is-active');
      trailLayer.classList.add('is-fading');
    };

    const onPointerLeave = (): void => {
      pointerInView = false;
      beginTrailFade();
    };

    const onTouchMove = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (!t) return;
      pointerInView = true;
      setPointer(t.clientX, t.clientY);
    };

    const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

    const applyTrailGradientFade = (now: number): boolean => {
      const n = Math.max(1, fadeVisibleCount);
      const waveMs = fadeDurationMs(n);
      const totalMs = waveMs + TRAIL_FADE_TAIL_MS;
      const elapsed = now - fadeStartAt;
      const waveT = easeOutQuint(clamp01(elapsed / waveMs));
      const span = TRAIL_FADE_OVERLAP + 0.32;
      const tailT =
        elapsed <= waveMs
          ? 0
          : easeOutQuint(clamp01((elapsed - waveMs) / TRAIL_FADE_TAIL_MS));
      const tailMul = 1 - tailT;

      trailLayer.style.opacity = String(1 - smoothstep(waveT) * 0.12 * tailMul);

      for (let i = 0; i < trailEls.length; i++) {
        if (i >= n) {
          trailEls[i]!.style.opacity = '0';
          continue;
        }

        const stagger =
          n <= 1 ? 0 : ((n - 1 - i) / (n - 1)) * (1 - TRAIL_FADE_OVERLAP);
        const localT = clamp01((waveT - stagger) / span);
        const dissolve = easeOutQuint(localT);
        const o = opacityForIndex(i) * (1 - dissolve) * tailMul;
        trailEls[i]!.style.opacity = String(o);
        trailEls[i]!.style.zIndex = String(n - i);
      }

      return elapsed < totalMs;
    };

    const tick = (): void => {
      if (dead) return;

      const now = performance.now();
      if (trailActive && now - lastMoveAt > TRAIL_IDLE_MS) {
        beginTrailFade();
      }

      const ease = pointerInView ? FOLLOW : RETURN;
      const restX = window.innerWidth * 0.5;
      const restY = window.innerHeight * 0.5;
      const goalX = pointerInView ? targetX : restX;
      const goalY = pointerInView ? targetY : restY;

      currentX = lerp(currentX, goalX, ease);
      currentY = lerp(currentY, goalY, ease);

      word.style.transform = `translate(${currentX + PLAINNESS_OFFSET_X}px, ${currentY + PLAINNESS_OFFSET_Y}px)`;

      if (trailActive) {
        const sessionMs = now - moveSessionStart;
        visibleTrailCount = trailCountForSession(sessionMs);
        const head = exaltedAnchor(currentX, currentY);
        ensureTrailCount(visibleTrailCount, head);

        const lastHist = pathHistory[pathHistory.length - 1];
        if (!lastHist) {
          pathHistory.push({ x: currentX, y: currentY });
        } else {
          const hdx = currentX - lastHist.x;
          const hdy = currentY - lastHist.y;
          if (hdx * hdx + hdy * hdy >= TRAIL_SAMPLE_DIST_SQ) {
            pathHistory.push({ x: currentX, y: currentY });
            const cap = visibleTrailCount * TRAIL_HISTORY_GAP + 6;
            if (pathHistory.length > cap) {
              pathHistory.splice(0, pathHistory.length - cap);
            }
          }
        }

        let leadX = head.x;
        let leadY = head.y;

        for (let i = 0; i < visibleTrailCount; i++) {
          const histIdx = pathHistory.length - 1 - i * TRAIL_HISTORY_GAP;
          let goalX = leadX;
          let goalY = leadY;
          if (histIdx >= 0) {
            const anchored = exaltedAnchor(
              pathHistory[histIdx]!.x,
              pathHistory[histIdx]!.y,
            );
            goalX = anchored.x;
            goalY = anchored.y;
          }

          const pt = trailCurrent[i]!;
          const rate = i === 0 ? TRAIL_FOLLOW_HEAD : TRAIL_FOLLOW_CHAIN;
          pt.x = lerp(pt.x, goalX, rate);
          pt.y = lerp(pt.y, goalY, rate);
          trailEls[i]!.style.transform = exaltedTransform(pt.x, pt.y);
          trailEls[i]!.style.opacity = String(opacityForIndex(i));
          trailEls[i]!.style.zIndex = String(visibleTrailCount - i);
          leadX = pt.x;
          leadY = pt.y;
        }
      } else if (trailFading) {
        const anyVisible = applyTrailGradientFade(now);
        if (!anyVisible) {
          trailFading = false;
          trailLayer.classList.remove('is-fading');
          trailLayer.style.removeProperty('opacity');
          clearTrailPool();
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    rafId = window.requestAnimationFrame(tick);

    return () => {
      dead = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
