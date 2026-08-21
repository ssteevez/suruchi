import type { TextWorkModule } from '../types.js';

const PHRASE = 'just so, just so, ';
const PATH_RESAMPLE_STEP = 14;
/** Seconds for one full letter-by-letter reveal around each trail. */
const REVEAL_DURATION_S = 72;

const TRAIL_WHITE = '#f5f2eb';
const TRAIL_COUNT = 7;

interface TrailSpec {
  waypoints: [number, number][];
  opacity: number;
  fontSizeVw: number;
  scrollDir: 1 | -1;
  loopDurationS: number;
}

interface Point {
  x: number;
  y: number;
}

interface PathLetter {
  el: SVGTextElement;
  dist: number;
}

interface ActiveTrail {
  guide: SVGPathElement;
  letters: PathLetter[];
  pathLength: number;
  scrollOffset: number;
  revealMaxDist: number;
  scrollDir: 1 | -1;
  scrollSpeed: number;
  fontSizePx: number;
  opacity: number;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

const clamp01 = (v: number): number => Math.max(0.08, Math.min(0.92, v));

const modDist = (d: number, len: number): number => {
  if (len <= 0) return 0;
  return ((d % len) + len) % len;
};

/** New random closed loop on each call (used per trail, per visit). */
const randomLoopWaypoints = (): [number, number][] => {
  const count = 7 + Math.floor(Math.random() * 5);
  const pts = Array.from({ length: count }, () => ({
    x: clamp01(rand(0.1, 0.9)),
    y: clamp01(rand(0.1, 0.9)),
  }));

  const cx = pts.reduce((s, p) => s + p.x, 0) / count;
  const cy = pts.reduce((s, p) => s + p.y, 0) / count;
  pts.sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );

  return pts.map((p) => [p.x, p.y] as [number, number]);
};

const chaikinClosed = (pts: Point[], iterations: number): Point[] => {
  let current = pts;
  for (let n = 0; n < iterations; n++) {
    const next: Point[] = [];
    const len = current.length;
    for (let i = 0; i < len; i++) {
      const p0 = current[i]!;
      const p1 = current[(i + 1) % len]!;
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    current = next;
  }
  return current;
};

const catmullClosed = (pts: Point[]): string => {
  const n = pts.length;
  if (n < 3) return '';

  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1x = p1.x + (p2.x - p0.x) / 5;
    const c1y = p1.y + (p2.y - p0.y) / 5;
    const c2x = p2.x - (p3.x - p1.x) / 5;
    const c2y = p2.y - (p3.y - p1.y) / 5;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
};

const waypointPath = (
  w: number,
  h: number,
  normalized: [number, number][],
): string => {
  const padX = w * 0.04;
  const padY = h * 0.04;
  const scaled = normalized.map(([nx, ny]) => ({
    x: padX + nx * (w - padX * 2),
    y: padY + ny * (h - padY * 2),
  }));
  const smooth = chaikinClosed(scaled, 2);
  return catmullClosed(smooth);
};

const resampleClosedPath = (pathEl: SVGPathElement, step: number): string => {
  const len = pathEl.getTotalLength();
  if (len <= 0) return '';

  const pts: Point[] = [];
  for (let d = 0; d < len; d += step) {
    const p = pathEl.getPointAtLength(d);
    pts.push({ x: p.x, y: p.y });
  }
  const end = pathEl.getPointAtLength(len);
  pts.push({ x: end.x, y: end.y });

  let out = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    out += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return `${out} Z`;
};

const generateTrails = (): TrailSpec[] =>
  Array.from({ length: TRAIL_COUNT }, (_, index) => {
    const t = index / Math.max(1, TRAIL_COUNT - 1);
    return {
      waypoints: randomLoopWaypoints(),
      opacity: 0.34 + t * 0.62,
      fontSizeVw: 1.9 + index * 0.06,
      scrollDir: index % 2 === 0 ? 1 : -1,
      loopDurationS: rand(32, 54),
    };
  });

const placeLetter = (
  el: SVGTextElement,
  path: SVGPathElement,
  dist: number,
  char: string,
  fontSizePx: number,
  opacity: number,
  letterOpacity: number,
): void => {
  const len = path.getTotalLength();
  const d = Math.min(modDist(dist, len), Math.max(0, len - 0.5));
  const p = path.getPointAtLength(d);
  const ahead = path.getPointAtLength(modDist(d + 2, len));
  const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;

  el.textContent = char;
  el.setAttribute('font-size', `${fontSizePx}px`);
  el.setAttribute('fill', TRAIL_WHITE);
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('dominant-baseline', 'middle');
  el.setAttribute('opacity', String(opacity * letterOpacity));
  el.setAttribute(
    'transform',
    `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`,
  );
};

const layoutLettersAlongPath = (
  path: SVGPathElement,
  fontSizePx: number,
  opacity: number,
  lettersG: SVGGElement,
): PathLetter[] => {
  const pathLen = path.getTotalLength();
  const charStep = fontSizePx * 0.52;
  const letters: PathLetter[] = [];
  let dist = charStep * 0.35;
  let phraseIdx = 0;

  while (dist < pathLen - charStep * 0.5) {
    const ch = PHRASE[phraseIdx] ?? ' ';
    phraseIdx = (phraseIdx + 1) % PHRASE.length;

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    placeLetter(el, path, dist, ch, fontSizePx, opacity, 0);
    lettersG.appendChild(el);
    letters.push({ el, dist });

    dist += ch === ' ' ? charStep * 0.55 : charStep;
  }

  return letters;
};

const work: TextWorkModule = {
  title: 'Just So',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'just-so-root';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'just-so-svg');
    svg.setAttribute('aria-hidden', 'true');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'just-so-trails');
    svg.appendChild(g);
    root.appendChild(svg);
    container.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      .just-so-root {
        position: fixed;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        overflow: hidden;
        background:
          radial-gradient(
            ellipse 72% 58% at 48% 42%,
            rgba(48, 48, 58, 0.55) 0%,
            rgba(18, 18, 24, 0.92) 48%,
            #06060a 100%
          );
      }
      .just-so-root::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(
          circle at 52% 38%,
          rgba(255, 255, 255, 0.06) 0%,
          transparent 42%
        );
        pointer-events: none;
      }
      .just-so-svg {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
        z-index: 1;
      }
      .just-so-trail path.just-so-guide {
        fill: none;
        stroke: none;
        visibility: hidden;
      }
      .just-so-trail text {
        font-family: "American Typewriter", "Courier New", "Courier Prime", ui-monospace,
          monospace;
        font-weight: 400;
        letter-spacing: 0.02em;
        text-transform: lowercase;
        fill: ${TRAIL_WHITE};
      }
    `;
    document.head.appendChild(style);

    const active: ActiveTrail[] = [];
    let sessionTrails: TrailSpec[] | null = null;
    let rafId = 0;
    let lastTs = 0;
    let dead = false;

    const rebuild = (newSession = false): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      g.replaceChildren();
      active.length = 0;

      if (newSession) {
        sessionTrails = generateTrails();
      } else if (!sessionTrails) {
        sessionTrails = generateTrails();
      }

      const sorted = [...sessionTrails].sort((a, b) => a.opacity - b.opacity);

      for (const spec of sorted) {
        const trailG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        trailG.setAttribute('class', 'just-so-trail');

        const smoothD = waypointPath(w, h, spec.waypoints);
        const sampler = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        sampler.setAttribute('d', smoothD);
        const guideD = resampleClosedPath(sampler, PATH_RESAMPLE_STEP);

        const guide = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        guide.setAttribute('class', 'just-so-guide');
        guide.setAttribute('d', guideD);

        const lettersG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        lettersG.setAttribute('class', 'just-so-letters');

        trailG.append(guide, lettersG);
        g.appendChild(trailG);

        const fontSizePx = (spec.fontSizeVw / 100) * w;
        const letters = layoutLettersAlongPath(guide, fontSizePx, spec.opacity, lettersG);

        const pathLength = guide.getTotalLength();

        active.push({
          guide,
          letters,
          pathLength,
          scrollOffset: 0,
          revealMaxDist: 0,
          scrollDir: spec.scrollDir,
          scrollSpeed: pathLength > 0 ? pathLength / spec.loopDurationS : 0,
          fontSizePx,
          opacity: spec.opacity,
        });
      }
    };

    const tick = (ts: number): void => {
      if (dead) return;
      const dt = lastTs === 0 ? 0 : Math.min(48, ts - lastTs) / 1000;
      lastTs = ts;

      for (const trail of active) {
        trail.scrollOffset = modDist(
          trail.scrollOffset + trail.scrollDir * trail.scrollSpeed * dt,
          trail.pathLength,
        );

        if (trail.revealMaxDist < trail.pathLength) {
          trail.revealMaxDist = Math.min(
            trail.pathLength,
            trail.revealMaxDist + (trail.pathLength / REVEAL_DURATION_S) * dt,
          );
        }

        for (const letter of trail.letters) {
          const visible = letter.dist < trail.revealMaxDist;
          const along = modDist(letter.dist + trail.scrollOffset, trail.pathLength);
          const ch = letter.el.textContent ?? ' ';
          placeLetter(
            letter.el,
            trail.guide,
            along,
            ch,
            trail.fontSizePx,
            trail.opacity,
            visible ? 1 : 0,
          );
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const onResize = (): void => {
      rebuild(false);
    };

    rebuild(true);
    rafId = window.requestAnimationFrame(tick);
    window.addEventListener('resize', onResize);

    return () => {
      dead = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
