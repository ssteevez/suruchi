import type { TextWorkModule } from '../types.js';

const LINE_TOP = 'somewhere is nowhere is ';
const LINE_BOTTOM = 'nothing is something is ';

/** Idle drift when the user is not scrolling (px/s). */
const BASE_SPEED_PX_S = 34;
/** Wheel delta → added drift speed (px/s). */
const SCROLL_SPEED_GAIN = 0.48;
const SCROLL_SPEED_DECAY = 0.88;
const SCROLL_SPEED_MAX = 640;
const LOOP_COPIES = 6;

interface FlowLine {
  track: HTMLDivElement;
  segmentWidth: number;
  offset: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const appendBloomFilter = (svg: SVGSVGElement): void => {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', 'ss-bloom');
  filter.setAttribute('x', '-45%');
  filter.setAttribute('y', '-90%');
  filter.setAttribute('width', '190%');
  filter.setAttribute('height', '280%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const blurWide = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blurWide.setAttribute('in', 'SourceGraphic');
  blurWide.setAttribute('stdDeviation', '5.5');
  blurWide.setAttribute('result', 'wide');

  const blurMid = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blurMid.setAttribute('in', 'SourceGraphic');
  blurMid.setAttribute('stdDeviation', '2');
  blurMid.setAttribute('result', 'mid');

  const merge = document.createElementNS(SVG_NS, 'feMerge');
  for (const input of ['wide', 'mid', 'SourceGraphic']) {
    const node = document.createElementNS(SVG_NS, 'feMergeNode');
    node.setAttribute('in', input);
    merge.appendChild(node);
  }

  filter.append(blurWide, blurMid, merge);
  defs.appendChild(filter);
  svg.appendChild(defs);
};

const work: TextWorkModule = {
  title: 'Somewhere Something',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';
    document.documentElement.classList.add('ss-lock-scroll');

    const root = document.createElement('div');
    root.className = 'ss-root';

    const buildLine = (text: string): FlowLine => {
      const line = document.createElement('div');
      line.className = 'ss-line';

      const track = document.createElement('div');
      track.className = 'ss-track';

      for (let i = 0; i < LOOP_COPIES; i++) {
        const span = document.createElement('span');
        span.className = 'ss-phrase';
        span.textContent = text;
        span.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
        track.appendChild(span);
      }

      line.appendChild(track);
      root.appendChild(line);

      return { track, segmentWidth: 0, offset: 0 };
    };

    const top = buildLine(LINE_TOP);
    const bottom = buildLine(LINE_BOTTOM);

    const filterSvg = document.createElementNS(SVG_NS, 'svg');
    filterSvg.setAttribute('aria-hidden', 'true');
    filterSvg.style.cssText =
      'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    appendBloomFilter(filterSvg);

    container.append(filterSvg, root);

    const style = document.createElement('style');
    style.textContent = `
      html.ss-lock-scroll,
      html.ss-lock-scroll body {
        overflow: hidden;
        height: 100%;
        scrollbar-width: none;
      }
      html.ss-lock-scroll::-webkit-scrollbar,
      html.ss-lock-scroll body::-webkit-scrollbar {
        display: none;
      }
      .ss-root {
        position: fixed;
        inset: 0;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        gap: clamp(28px, 5vh, 56px);
        pointer-events: none;
        overflow: hidden;
      }
      .ss-line {
        width: 100%;
        overflow: hidden;
      }
      .ss-track {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        width: max-content;
        will-change: transform;
        filter: url(#ss-bloom);
      }
      .ss-phrase {
        flex: 0 0 auto;
        font-family: "American Typewriter", "Courier New", "Courier Prime", ui-monospace,
          monospace;
        font-size: clamp(22px, 4.2vw, 52px);
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: lowercase;
        color: rgba(255, 255, 255, 0.96);
        white-space: pre;
        text-shadow:
          0 0 12px rgba(255, 255, 255, 0.45),
          0 0 28px rgba(255, 255, 255, 0.22);
      }
    `;
    document.head.appendChild(style);

    const lines = [top, bottom];
    /** +1: top L→R / bottom R→L; −1: top R→L / bottom L→R. */
    let driftSign = 1;
    let scrollSpeedBoost = 0;
    let rafId = 0;
    let lastTs = 0;
    let dead = false;

    const measure = (): void => {
      for (const line of lines) {
        const first = line.track.querySelector('.ss-phrase');
        line.segmentWidth = first?.getBoundingClientRect().width ?? 0;
      }
    };

    const applyOffset = (line: FlowLine, x: number): void => {
      line.track.style.transform = `translate3d(${x}px, 0, 0)`;
    };

    const advanceLine = (line: FlowLine, travel: number): void => {
      const w = line.segmentWidth;
      if (w <= 0) return;
      line.offset += travel;
      let x = line.offset % w;
      if (x > 0) x -= w;
      applyOffset(line, x);
    };

    const tick = (ts: number): void => {
      if (dead) return;
      const dt = lastTs === 0 ? 0 : Math.min(48, ts - lastTs) / 1000;
      lastTs = ts;

      scrollSpeedBoost *= Math.pow(SCROLL_SPEED_DECAY, dt * 60);
      const speed = BASE_SPEED_PX_S + scrollSpeedBoost;
      const travel = speed * dt;

      advanceLine(top, -driftSign * travel);
      advanceLine(bottom, driftSign * travel);

      rafId = window.requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent): void => {
      const delta = e.deltaY;
      if (delta === 0) return;

      e.preventDefault();

      if (delta > 0) {
        driftSign = 1;
      } else if (delta < 0) {
        driftSign = -1;
      }

      scrollSpeedBoost = Math.min(
        SCROLL_SPEED_MAX,
        scrollSpeedBoost + Math.abs(delta) * SCROLL_SPEED_GAIN,
      );
    };

    measure();
    for (const line of lines) {
      const w = line.segmentWidth;
      if (w > 0) applyOffset(line, line.offset % w || 0);
    }

    const onResize = (): void => {
      measure();
      for (const line of lines) {
        const w = line.segmentWidth;
        if (w <= 0) continue;
        let x = line.offset % w;
        if (x > 0) x -= w;
        applyOffset(line, x);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      dead = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      document.documentElement.classList.remove('ss-lock-scroll');
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
