import type { TextWorkModule } from '../types.js';

/** Looping marquee copy (trailing space separates repeats). */
const PHRASE = 'Fact is Fiction is ';
/** Readable connected script (legible at dot scale). */
const CURSIVE_FAMILY = 'Caveat';
const CURSIVE_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@400&display=swap';

const BG = '#050506';
const GRID_BG = '#08080a';
const LED_ON = '#f2f2f4';
const LED_OFF = '#141416';
const LED_BLOOM = 1.5;
const GLOW_TEX_SIZE = 64;
/** LED dome radius as a fraction of dot pitch (keep < 0.5 for round separation). */
const LED_RADIUS_FRAC = 0.46;
const LED_UNLIT_RADIUS_FRAC = 0.4;

const MARGIN_Y_FRAC = 0.1;
const MIN_PITCH_CSS = 6;
const SCROLL_DOTS_PER_SEC = 50;
const FLICKER_RATE = 0.008;
const GLITCH_CHECK_MS_MIN = 1100;
const GLITCH_CHECK_MS_MAX = 2800;
const GLITCH_SPAWN_CHANCE = 0.48;
const GLITCH_EXTRA_SPAWN_CHANCE = 0.22;
const GLITCH_DURATION_MS_MIN = 220;
const GLITCH_DURATION_MS_MAX = 1100;
const GLITCH_STAGGER_MS_MAX = 580;
const MAX_ACTIVE_GLITCHES = 8;
const MAX_DPR = 2;

/** Gray-only glitch palette (no hue shift). */
const GRAY_CORE = [
  '#0b0b0d',
  '#1a1a1f',
  '#2e2e34',
  '#4a4a52',
  '#6a6a74',
  '#90909a',
  '#b4b4bc',
  '#dedee4',
  '#f6f6f8',
] as const;

type GlitchKind =
  | 'shift'
  | 'tear'
  | 'spark'
  | 'dimRow'
  | 'brightCol'
  | 'dropSlice'
  | 'flash';

type Glitch = {
  effects: GlitchKind[];
  startMs: number;
  durationMs: number;
  row0: number;
  row1: number;
  col0: number;
  col1: number;
  shiftCols: number;
  seed: number;
};

const GLITCH_POOL: GlitchKind[] = [
  'shift',
  'tear',
  'spark',
  'dimRow',
  'brightCol',
  'dropSlice',
  'flash',
];

type CellGlitch = {
  scrollShift: number;
  core: string | null;
  lit: boolean | null;
  bloom: boolean | null;
};
/** Finer sample = sharper letterforms on the LED grid. */
const DOT_SAMPLE = 2;
const RASTER_FONT_SIZE = 128;

type BoardState = {
  dir: 1 | -1;
  phaseSec: number;
};

type PhraseRaster = {
  bitmap: boolean[];
  phraseW: number;
  bitmapW: number;
  bitmapH: number;
};

const seededUnit = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const cursiveFontSpec = (): string =>
  `400 ${RASTER_FONT_SIZE}px "${CURSIVE_FAMILY}", "Segoe Script", "Brush Script MT", cursive`;

const ensureCursiveFont = async (): Promise<void> => {
  if (!document.querySelector('#ff-cursive-font')) {
    const link = document.createElement('link');
    link.id = 'ff-cursive-font';
    link.rel = 'stylesheet';
    link.href = CURSIVE_FONT_URL;
    document.head.appendChild(link);
  }
  await document.fonts.load(cursiveFontSpec());
  await document.fonts.ready;
};

const resampleBitmapY = (
  src: boolean[],
  w: number,
  srcH: number,
  dstH: number,
): boolean[] => {
  if (dstH === srcH) return src.slice();
  const out = new Array<boolean>(w * dstH).fill(false);
  for (let row = 0; row < dstH; row += 1) {
    const sy = Math.min(srcH - 1, Math.floor((row * srcH) / dstH));
    for (let col = 0; col < w; col += 1) {
      out[row * w + col] = src[sy * w + col] ?? false;
    }
  }
  return out;
};

const LOOP_COPIES = 2;

/** One rasterized cycle — width becomes the seamless loop period. */
const rasterizeSingleCopy = (
  text: string,
): { bitmap: boolean[]; bitmapW: number; bitmapH: number } => {
  const font = cursiveFontSpec();
  const padPx = 14;

  const probe = document.createElement('canvas');
  const pctx = probe.getContext('2d');
  if (!pctx) {
    throw new Error('fact-fiction: canvas 2d unavailable');
  }
  pctx.font = font;
  const textPx = Math.ceil(pctx.measureText(text).width) + padPx * 2;
  const ascent = RASTER_FONT_SIZE * 0.78;
  const descent = RASTER_FONT_SIZE * 0.28;
  const rasterH = Math.ceil(ascent + descent) + padPx * 2;

  const canvas = document.createElement('canvas');
  canvas.width = textPx;
  canvas.height = rasterH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('fact-fiction: canvas 2d unavailable');
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, textPx, rasterH);
  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, padPx, padPx + ascent);

  const bitmapW = Math.ceil(textPx / DOT_SAMPLE);
  const bitmapH = Math.ceil(rasterH / DOT_SAMPLE);
  const bitmap = new Array<boolean>(bitmapW * bitmapH).fill(false);
  const { data } = ctx.getImageData(0, 0, textPx, rasterH);

  for (let row = 0; row < bitmapH; row += 1) {
    for (let col = 0; col < bitmapW; col += 1) {
      let sum = 0;
      let count = 0;
      for (let py = 0; py < DOT_SAMPLE; py += 1) {
        for (let px = 0; px < DOT_SAMPLE; px += 1) {
          const sx = col * DOT_SAMPLE + px;
          const sy = row * DOT_SAMPLE + py;
          if (sx >= textPx || sy >= rasterH) continue;
          const i = (sy * textPx + sx) * 4;
          sum += data[i] ?? 0;
          count += 1;
        }
      }
      bitmap[row * bitmapW + col] = count > 0 && sum / count > 42;
    }
  }

  return { bitmap, bitmapW, bitmapH };
};

/** Tile identical copies so scroll wrap at phraseW has no visual jump. */
const buildLoopBitmap = (
  single: { bitmap: boolean[]; bitmapW: number; bitmapH: number },
  copies: number,
): PhraseRaster => {
  const phraseW = single.bitmapW;
  const bitmapH = single.bitmapH;
  const bitmapW = phraseW * copies;
  const bitmap = new Array<boolean>(bitmapW * bitmapH).fill(false);

  for (let copy = 0; copy < copies; copy += 1) {
    const x0 = copy * phraseW;
    for (let row = 0; row < bitmapH; row += 1) {
      for (let col = 0; col < phraseW; col += 1) {
        bitmap[row * bitmapW + x0 + col] =
          single.bitmap[row * phraseW + col] ?? false;
      }
    }
  }

  return { bitmap, phraseW, bitmapW, bitmapH };
};

const rasterizePhrase = (text: string, copies: number): PhraseRaster =>
  buildLoopBitmap(rasterizeSingleCopy(text), copies);

const createGlowDotCanvas = (): HTMLCanvasElement => {
  const el = document.createElement('canvas');
  el.width = GLOW_TEX_SIZE;
  el.height = GLOW_TEX_SIZE;
  const g = el.getContext('2d');
  if (!g) return el;
  const r = GLOW_TEX_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
  return el;
};

const rollBoardState = (phraseW: number): BoardState => ({
  dir: Math.random() < 0.5 ? -1 : 1,
  phaseSec: Math.random() * (phraseW / SCROLL_DOTS_PER_SEC),
});

/** Continuous scroll offset (wrap happens in bitmap index, not here). */
const boardScrollPos = (board: BoardState, elapsedSec: number): number =>
  board.phaseSec + board.dir * SCROLL_DOTS_PER_SEC * elapsedSec;

type Layout = {
  cssW: number;
  cssH: number;
  pitchCss: number;
  bandDotRows: number;
  textDotRows: number;
};

const rollGlitchEffects = (): GlitchKind[] => {
  const shuffled = [...GLITCH_POOL].sort(
    () => seededUnit(Math.random() * 999) - 0.5,
  );
  const count = 1 + Math.floor(Math.random() * 3);
  const picked = shuffled.slice(0, count);
  if (Math.random() < 0.32 && picked.length < 4) {
    const extra = shuffled[count];
    if (extra) picked.push(extra);
  }
  return picked;
};

const spawnGlitch = (
  startMs: number,
  cols: number,
  rows: number,
  existing: Glitch[],
): Glitch => {
  const effects = rollGlitchEffects();
  const heavy =
    effects.includes('tear') ||
    effects.includes('shift') ||
    effects.includes('dropSlice') ||
    Math.random() < 0.4;

  const rowSpan = heavy
    ? Math.max(4, Math.floor(rows * (0.35 + Math.random() * 0.45)))
    : Math.max(3, Math.floor(rows * (0.18 + Math.random() * 0.35)));
  const colSpan = heavy
    ? Math.max(12, Math.floor(cols * (0.45 + Math.random() * 0.4)))
    : Math.max(8, Math.floor(cols * (0.28 + Math.random() * 0.4)));

  let row0 = Math.floor(Math.random() * Math.max(1, rows - rowSpan));
  let col0 = Math.floor(Math.random() * Math.max(1, cols - colSpan));

  if (existing.length > 0 && Math.random() < 0.5) {
    const anchor = existing[Math.floor(Math.random() * existing.length)]!;
    row0 = Math.round(
      anchor.row0 + (Math.random() - 0.5) * rowSpan * 0.85,
    );
    col0 = Math.round(
      anchor.col0 + (Math.random() - 0.5) * colSpan * 0.85,
    );
    row0 = Math.max(0, Math.min(rows - rowSpan, row0));
    col0 = Math.max(0, Math.min(cols - colSpan, col0));
  }

  let shiftCols = Math.round((Math.random() - 0.5) * (heavy ? 44 : 18));
  if (effects.includes('tear')) {
    shiftCols = Math.round((Math.random() - 0.5) * 56);
  }

  return {
    effects,
    startMs,
    durationMs:
      GLITCH_DURATION_MS_MIN +
      Math.random() * (GLITCH_DURATION_MS_MAX - GLITCH_DURATION_MS_MIN),
    row0,
    row1: Math.min(rows - 1, row0 + rowSpan),
    col0,
    col1: Math.min(cols - 1, col0 + colSpan),
    shiftCols,
    seed: Math.random() * 10000,
  };
};

const pushSpawnedGlitch = (
  glitches: Glitch[],
  timeMs: number,
  cols: number,
  rows: number,
): void => {
  const stagger = Math.random() * GLITCH_STAGGER_MS_MAX;
  glitches.push(spawnGlitch(timeMs + stagger, cols, rows, glitches));
};

const grayAt = (seed: number): string => {
  const i = Math.floor(seededUnit(seed) * GRAY_CORE.length);
  return GRAY_CORE[Math.min(GRAY_CORE.length - 1, i)] ?? LED_ON;
};

const glitchScrollShift = (
  glitches: Glitch[],
  timeMs: number,
  row: number,
  col: number,
): number => {
  let shift = 0;
  for (const g of glitches) {
    if (timeMs < g.startMs || timeMs > g.startMs + g.durationMs) continue;
    if (row < g.row0 || row > g.row1 || col < g.col0 || col > g.col1) continue;
    if (g.effects.includes('shift') || g.effects.includes('tear')) {
      shift += g.shiftCols;
    }
  }
  return shift;
};

/** Glitch styling applied only to lit text dots (see draw loop). */
const glitchTextStyle = (
  glitches: Glitch[],
  timeMs: number,
  row: number,
  col: number,
): CellGlitch => {
  let core: string | null = null;
  let lit: boolean | null = null;
  let bloom: boolean | null = null;

  for (const g of glitches) {
    if (timeMs < g.startMs || timeMs > g.startMs + g.durationMs) continue;
    if (row < g.row0 || row > g.row1 || col < g.col0 || col > g.col1) continue;

    const u = seededUnit(g.seed + row * 19 + col * 37);
    const pulse = seededUnit(g.seed + Math.floor(timeMs * 0.04));

    const order = [...g.effects].sort(
      (a, b) =>
        seededUnit(g.seed + a.charCodeAt(0) * 3) -
        seededUnit(g.seed + b.charCodeAt(0) * 3),
    );

    for (const effect of order) {
      switch (effect) {
        case 'spark':
          if (u < 0.34) {
            bloom = pulse > 0.35;
            core = grayAt(g.seed + row + col);
          } else if (u < 0.48) {
            lit = false;
            bloom = false;
            core = GRAY_CORE[1];
          }
          break;
        case 'dimRow':
          bloom = false;
          core = grayAt(g.seed + row * 5 + col * 2);
          break;
        case 'brightCol':
          bloom = u > 0.15;
          core = grayAt(g.seed * 1.7 + col);
          break;
        case 'dropSlice':
          lit = false;
          bloom = false;
          core = GRAY_CORE[0];
          break;
        case 'flash':
          bloom = false;
          core = pulse > 0.45 ? GRAY_CORE[8] : GRAY_CORE[2];
          break;
        default:
          break;
      }
    }
  }

  return { scrollShift: 0, core, lit, bloom };
};

const tickGlitches = (
  glitches: Glitch[],
  timeMs: number,
  cols: number,
  rows: number,
  nextRollAt: number,
): number => {
  const live = glitches.filter((g) => timeMs - g.startMs < g.durationMs);
  glitches.length = 0;
  glitches.push(...live);

  if (timeMs < nextRollAt) return nextRollAt;

  if (
    Math.random() < GLITCH_SPAWN_CHANCE &&
    glitches.length < MAX_ACTIVE_GLITCHES
  ) {
    pushSpawnedGlitch(glitches, timeMs, cols, rows);
    if (
      Math.random() < GLITCH_EXTRA_SPAWN_CHANCE &&
      glitches.length < MAX_ACTIVE_GLITCHES
    ) {
      pushSpawnedGlitch(glitches, timeMs, cols, rows);
    }
  }

  return (
    timeMs +
    GLITCH_CHECK_MS_MIN +
    Math.random() * (GLITCH_CHECK_MS_MAX - GLITCH_CHECK_MS_MIN)
  );
};

const computeLayout = (): Layout => {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight * (1 - 2 * MARGIN_Y_FRAC);
  const bandDotRows = Math.max(16, Math.floor(cssH / MIN_PITCH_CSS));
  const pitchCss = cssH / bandDotRows;
  return {
    cssW,
    cssH,
    pitchCss,
    bandDotRows,
    textDotRows: bandDotRows - 4,
  };
};

const work: TextWorkModule = {
  title: 'Fact Fiction',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    document.body.style.background = BG;
    document.body.style.color = LED_ON;

    const root = document.createElement('div');
    root.className = 'ff-root';

    const boardEl = document.createElement('div');
    boardEl.className = 'ff-board';
    boardEl.setAttribute('role', 'img');
    boardEl.setAttribute('aria-label', `LED board: ${PHRASE.trim()}`);

    const canvas = document.createElement('canvas');
    canvas.className = 'ff-canvas';
    boardEl.appendChild(canvas);
    root.appendChild(boardEl);
    container.appendChild(root);

    const style = document.createElement('style');
    style.textContent = `
      html.ff-active,
      html.ff-active body {
        background: ${BG};
        margin: 0;
      }
      .work-stage {
        width: 100% !important;
        max-width: none !important;
      }
      .work-shell {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .ff-root {
        position: fixed;
        left: 0;
        right: 0;
        top: ${MARGIN_Y_FRAC * 100}%;
        width: 100%;
        height: ${(1 - 2 * MARGIN_Y_FRAC) * 100}%;
        z-index: 1;
        box-sizing: border-box;
        pointer-events: none;
      }
      .ff-board {
        width: 100%;
        height: 100%;
      }
      .ff-canvas {
        display: block;
        width: 100%;
        height: 100%;
        background: ${GRID_BG};
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('ff-active');

    const padCols = 2;
    const padRows = 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('fact-fiction: canvas 2d unavailable');
    }
    const glowTex = createGlowDotCanvas();

    let dpr = 1;
    let rafId = 0;
    let startMs = 0;
    let layoutW = 0;
    let layoutH = 0;
    let pitchPx = 1;
    let bandDotRows = 1;
    let boardState: BoardState = rollBoardState(1);
    let ready = false;

    let baseBitmap: boolean[] = [];
    let baseBitmapH = 1;
    let bitmap: boolean[] = [];
    let phraseW = 1;
    let bitmapW = 1;
    let bitmapH = 1;
    const activeGlitches: Glitch[] = [];
    let nextGlitchRollAt = 0;

    const applyDisplayBitmap = (textDotRows: number): void => {
      bitmap = resampleBitmapY(baseBitmap, bitmapW, baseBitmapH, textDotRows);
      bitmapH = textDotRows;
      bandDotRows = bitmapH + padRows * 2;
    };

    const rerollBoard = (): void => {
      if (!ready) return;
      boardState = rollBoardState(phraseW);
      startMs = 0;
    };

    const resize = (): void => {
      if (!ready) return;
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const layout = computeLayout();
      applyDisplayBitmap(layout.textDotRows);
      canvas.style.width = `${layout.cssW}px`;
      canvas.style.height = `${layout.cssH}px`;
      canvas.width = Math.floor(layout.cssW * dpr);
      canvas.height = Math.floor(layout.cssH * dpr);
      layoutW = canvas.width;
      layoutH = canvas.height;
      pitchPx = layout.pitchCss * dpr;
    };

    const draw = (timeMs: number): void => {
      if (!ready || layoutW === 0 || layoutH === 0 || pitchPx <= 0) return;

      if (startMs === 0) startMs = timeMs;
      const elapsedSec = (timeMs - startMs) / 1000;

      const pitch = pitchPx;
      const litRadius = pitch * LED_RADIUS_FRAC;
      const unlitRadius = pitch * LED_UNLIT_RADIUS_FRAC;
      const cols = Math.ceil(layoutW / pitch) + 2;
      const scrollPos = boardScrollPos(boardState, elapsedSec);
      const bandTop = 0;

      nextGlitchRollAt = tickGlitches(
        activeGlitches,
        timeMs,
        cols,
        bandDotRows,
        nextGlitchRollAt,
      );

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = GRID_BG;
      ctx.fillRect(0, 0, layoutW, layoutH);

      for (let row = 0; row < bandDotRows; row += 1) {
        const by = row - padRows;
        const inBand = by >= 0 && by < bitmapH;
        for (let col = 0; col < cols; col += 1) {
          const scrollShift = glitchScrollShift(
            activeGlitches,
            timeMs,
            row,
            col,
          );

          let lit = false;
          if (inBand) {
            const srcCol = col + scrollPos + scrollShift - padCols;
            const bx =
              ((Math.floor(srcCol) % bitmapW) + bitmapW) % bitmapW;
            lit = bitmap[by * bitmapW + bx] ?? false;
          }

          if (!lit) {
            const cx = col * pitch + pitch * 0.5;
            const cy = bandTop + row * pitch + pitch * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, unlitRadius, 0, Math.PI * 2);
            ctx.fillStyle = LED_OFF;
            ctx.fill();
            continue;
          }

          const style = glitchTextStyle(
            activeGlitches,
            timeMs,
            row,
            col,
          );
          if (style.lit !== null) lit = style.lit;
          if (!lit) {
            const cx = col * pitch + pitch * 0.5;
            const cy = bandTop + row * pitch + pitch * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, unlitRadius, 0, Math.PI * 2);
            ctx.fillStyle = style.core ?? LED_OFF;
            ctx.fill();
            continue;
          }

          let core = LED_ON;
          if (style.core !== null) core = style.core;

          let bloom = true;
          if (style.bloom !== null) bloom = style.bloom;

          const flicker =
            lit &&
            bloom &&
            seededUnit(
              row * 977 + col * 13 + Math.floor(timeMs * 0.02),
            ) < FLICKER_RATE
              ? 0.5
              : 1;
          const cx = col * pitch + pitch * 0.5;
          const cy = bandTop + row * pitch + pitch * 0.5;

          const radius = lit ? litRadius : unlitRadius;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.closePath();

          if (lit && bloom) {
            const bloomDiam = pitch * LED_BLOOM * flicker;
            const coreAlpha = 0.65 + 0.35 * flicker;

            ctx.save();
            ctx.clip();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.85 * flicker;
            ctx.drawImage(
              glowTex,
              cx - bloomDiam / 2,
              cy - bloomDiam / 2,
              bloomDiam,
              bloomDiam,
            );
            ctx.restore();

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = LED_OFF;
            ctx.fill();
            ctx.fillStyle = core;
            ctx.globalAlpha = coreAlpha;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = core;
            ctx.fill();
          }
        }
      }
    };

    const tick = (now: number): void => {
      rafId = requestAnimationFrame(tick);
      draw(now);
    };

    const onPageShow = (ev: PageTransitionEvent): void => {
      if (ev.persisted) rerollBoard();
    };

    const boot = async (): Promise<void> => {
      try {
        await ensureCursiveFont();
        const raster = rasterizePhrase(PHRASE, LOOP_COPIES);
        baseBitmap = raster.bitmap;
        baseBitmapH = raster.bitmapH;
        phraseW = raster.phraseW;
        bitmapW = raster.bitmapW;
        ready = true;
        resize();
        rerollBoard();
      } catch (err) {
        console.error('fact-fiction: cursive font failed', err);
      }
    };

    rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    window.addEventListener('pageshow', onPageShow);
    void boot();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pageshow', onPageShow);
      document.getElementById('ff-cursive-font')?.remove();
      document.documentElement.classList.remove('ff-active');
      document.body.style.background = '';
      document.body.style.color = '';
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
