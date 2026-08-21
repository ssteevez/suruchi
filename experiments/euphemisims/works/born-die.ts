import type { TextWorkModule } from '../types.js';

const BG = '#000000';
const INK = '#ffffff';
const INK_THRESHOLD = 48;
const GHOST_ALPHA = 0.52;

const stripLegacyBgParams = (): void => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('bg') && !url.searchParams.has('palette')) return;
  url.searchParams.delete('bg');
  url.searchParams.delete('palette');
  window.history.replaceState(null, '', url);
};

/** Default wave tuning (hardcode after ?tune=1 slider session). */
export const DEFAULT_WAVE_TUNING = {
  ambientWaveAmp: 3.2,
  ambientWaveAmp2: 2,
  staticAmbientMuddleGain: 1.85,
  maxDisplaceCss: 26,
  muddleTurbAmp: 8,
  muddleTurbAmp2: 5.5,
  gentleMuddleMin: 0.2,
  calmReadabilityBlend: 0.28,
} as const;

export type WaveTuning = {
  [K in keyof typeof DEFAULT_WAVE_TUNING]: number;
};

interface TuneSliderSpec {
  key: keyof WaveTuning;
  label: string;
  min: number;
  max: number;
  step: number;
}

const TUNE_SLIDERS: TuneSliderSpec[] = [
  { key: 'gentleMuddleMin', label: 'hover muddle floor', min: 0.05, max: 0.5, step: 0.01 },
  { key: 'ambientWaveAmp', label: 'ambient amp 1', min: 1, max: 10, step: 0.1 },
  { key: 'ambientWaveAmp2', label: 'ambient amp 2', min: 0.5, max: 8, step: 0.1 },
  { key: 'staticAmbientMuddleGain', label: 'static ambient gain', min: 1, max: 2.5, step: 0.05 },
  { key: 'muddleTurbAmp', label: 'turb amp 1', min: 2, max: 14, step: 0.1 },
  { key: 'muddleTurbAmp2', label: 'turb amp 2', min: 1, max: 10, step: 0.1 },
  { key: 'maxDisplaceCss', label: 'max displace (px)', min: 10, max: 40, step: 1 },
  { key: 'calmReadabilityBlend', label: 'hover legibility', min: 0, max: 0.8, step: 0.02 },
];

const tunePanelRequested = (): boolean =>
  new URLSearchParams(window.location.search).has('tune');
/** Seconds (e-folding) for whole phrase to settle on hover / release. */
const CALM_RAMP_TAU_IN = 1.35;
const CALM_RAMP_TAU_OUT = 1.05;
const DISPLACE_SMOOTH_RADIUS = 2;
const DISPLACE_CHOP_RADIUS = 0;
const WARP_PAD_EXTRA_CSS = 36;
const REFLECT_WARP_ALPHA = 1;
/** Cap retina cost — warp is pixel-bound. */
const MAX_RENDER_DPR = 1.5;
const TOP_WORDS = ['born', 'to', 'die'] as const;
const BOTTOM_WORDS = ['die', 'to', 'be', 'born'] as const;
const HORIZONTAL_MARGIN_PERCENT = 12;
const CANVAS_EDGE_PAD_CSS = 12;
const VIEWPORT_PAD_VH = 0.06;
const FONT_MIN_PX = 28;
const FONT_FIT_ITERATIONS = 12;
const FONT_FILL = 0.98;
const REFLECT_HEIGHT_RATIO = 0.95;
const WORD_SPACE_EM = 0.28;
const LETTER_SPACING_EM = 0.02;

interface GlyphDraw {
  ch: string;
  x: number;
  y: number;
}

const work: TextWorkModule = {
  title: 'born/die',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    stripLegacyBgParams();

    const stage = document.createElement('div');
    stage.className = 'bd-stage';

    const phraseBox = document.createElement('div');
    phraseBox.className = 'bd-phrase-box';

    const canvas = document.createElement('canvas');
    canvas.className = 'bd-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'born to die; die to be born reflected',
    );

    phraseBox.appendChild(canvas);
    stage.appendChild(phraseBox);
    container.appendChild(stage);

    const style = document.createElement('style');
    document.head.appendChild(style);
    document.documentElement.classList.add('bd-active');
    document.body.style.background = BG;
    document.body.style.color = INK;

    style.textContent = `
      html.bd-active,
      html.bd-active body {
        background: ${BG};
        color: ${INK};
        margin: 0;
      }
      .bd-stage {
        position: fixed;
        inset: 0;
        z-index: 5;
        width: 100%;
        background: ${BG};
        box-sizing: border-box;
        overflow: hidden;
        pointer-events: none;
      }
      .bd-stage .bd-phrase-box,
      .bd-stage .bd-canvas {
        pointer-events: auto;
      }
      .bd-phrase-box {
        position: fixed;
        left: 50%;
        top: 50%;
        flex: 0 0 auto;
        box-sizing: content-box;
        transform: translate(-50%, -50%);
      }
      .bd-canvas {
        display: block;
        vertical-align: top;
        touch-action: none;
      }
      .bd-tune {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 30;
        width: min(320px, calc(100vw - 24px));
        max-height: min(70vh, 520px);
        overflow: auto;
        margin: 0;
        padding: 12px 14px;
        box-sizing: border-box;
        font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
        color: rgba(245, 245, 245, 0.92);
        background: rgba(12, 12, 14, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 6px;
        pointer-events: auto;
      }
      .bd-tune h2 {
        margin: 0 0 8px;
        font: 600 10px/1.2 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(245, 245, 245, 0.55);
      }
      .bd-tune p {
        margin: 0 0 10px;
        font: 10px/1.35 ui-sans-serif, system-ui, sans-serif;
        color: rgba(245, 245, 245, 0.45);
      }
      .bd-tune label {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 10px;
        align-items: center;
        margin-bottom: 8px;
        font-size: 10px;
      }
      .bd-tune label span.val {
        min-width: 3.2em;
        text-align: right;
        color: rgba(180, 220, 255, 0.95);
      }
      .bd-tune input[type='range'] {
        grid-column: 1 / -1;
        width: 100%;
        margin: 2px 0 0;
        accent-color: rgba(200, 200, 200, 0.9);
      }
      .bd-tune pre {
        margin: 10px 0 8px;
        padding: 8px;
        white-space: pre-wrap;
        word-break: break-all;
        font-size: 9px;
        background: rgba(0, 0, 0, 0.35);
        border-radius: 4px;
        color: rgba(220, 235, 255, 0.9);
      }
      .bd-tune button {
        margin-right: 6px;
        margin-top: 4px;
        padding: 5px 10px;
        font: 10px ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.04em;
        color: #111;
        background: rgba(245, 245, 245, 0.92);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .bd-tune button.secondary {
        color: rgba(245, 245, 245, 0.85);
        background: rgba(255, 255, 255, 0.12);
      }
    `;

    const wave: WaveTuning = { ...DEFAULT_WAVE_TUNING };

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('born-die: canvas 2d context unavailable');
    }

    let fontPx = 48;
    let dpr = 1;
    let warpPadPx = 0;
    let topGlyphs: GlyphDraw[] = [];
    let reflectGlyphs: GlyphDraw[] = [];
    let pivotX = 0;
    let pivotY = 0;
    let reflectBandTop = 0;
    let baselineCss = 0;
    let rafId = 0;
    let pointerActive = false;
    /** 0 = turbulent rest, 1 = full phrase calm (ramps over time). */
    let calmLevel = 0;
    let timeSec = 0;
    let lastFrameMs = 0;
    let started = false;
    let reflectSourceValid = false;
    let reflectSrc: ImageData | null = null;
    let reflectSrcBufW = 0;
    let reflectSrcBandH = 0;
    let warpedBuffer: ImageData | null = null;
    let frameBgRgb: [number, number, number] = [0, 0, 0];

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) {
      throw new Error('born-die: measure canvas unavailable');
    }

    const reflectBuffer = document.createElement('canvas');
    const reflectBufferCtx = reflectBuffer.getContext('2d', {
      willReadFrequently: true,
    });
    if (!reflectBufferCtx) {
      throw new Error('born-die: reflect buffer unavailable');
    }

    const fontSpec = (size: number): string =>
      `400 ${size}px Georgia, "Times New Roman", "Palatino Linotype", serif`;

    const applyFont = (target: CanvasRenderingContext2D, size: number): void => {
      target.font = fontSpec(size);
    };

    const letterGapPx = (size: number): number => size * LETTER_SPACING_EM;
    const wordGapPx = (size: number): number => size * WORD_SPACE_EM;

    const charWidth = (target: CanvasRenderingContext2D, ch: string): number =>
      target.measureText(ch).width;

    const wordWidth = (
      target: CanvasRenderingContext2D,
      word: string,
      size: number,
    ): number => {
      if (word.length === 0) return 0;
      const gap = letterGapPx(size);
      let w = 0;
      for (let i = 0; i < word.length; i += 1) {
        w += charWidth(target, word[i] ?? '');
        if (i < word.length - 1) w += gap;
      }
      return w;
    };

    const lineWidth = (
      target: CanvasRenderingContext2D,
      words: readonly string[],
      size: number,
    ): number => {
      let w = 0;
      words.forEach((word, index) => {
        if (index > 0) w += wordGapPx(size);
        w += wordWidth(target, word, size);
      });
      return w;
    };

    const wordCenterOffset = (
      target: CanvasRenderingContext2D,
      words: readonly string[],
      targetWord: string,
      size: number,
    ): number => {
      let x = 0;
      for (const word of words) {
        const w = wordWidth(target, word, size);
        if (word === targetWord) return x + w * 0.5;
        x += w + wordGapPx(size);
      }
      return x;
    };

    const layoutGlyphs = (
      target: CanvasRenderingContext2D,
      words: readonly string[],
      startX: number,
      baselineY: number,
      size: number,
    ): GlyphDraw[] => {
      const out: GlyphDraw[] = [];
      let x = startX;
      const letterGap = letterGapPx(size);
      words.forEach((word, wordIndex) => {
        if (wordIndex > 0) x += wordGapPx(size);
        for (let i = 0; i < word.length; i += 1) {
          const ch = word[i] ?? '';
          const w = charWidth(target, ch);
          out.push({ ch, x: x + w * 0.5, y: baselineY });
          x += w;
          if (i < word.length - 1) x += letterGap;
        }
      });
      return out;
    };

    const contentBox = (): { width: number; height: number } => {
      const padH = window.innerWidth * (HORIZONTAL_MARGIN_PERCENT / 100) * 2;
      const padV = window.innerHeight * VIEWPORT_PAD_VH * 2;
      return {
        width: Math.max(120, window.innerWidth - padH),
        height: Math.max(120, window.innerHeight - padV),
      };
    };

    const glyphInkExtents = (
      target: CanvasRenderingContext2D,
      ch: string,
      cx: number,
    ): { left: number; right: number } => {
      const metrics = target.measureText(ch);
      const fallback = charWidth(target, ch) * 0.5;
      return {
        left: cx - (metrics.actualBoundingBoxLeft ?? fallback),
        right: cx + (metrics.actualBoundingBoxRight ?? fallback),
      };
    };

    const extendGlyphBounds = (
      target: CanvasRenderingContext2D,
      glyphs: readonly GlyphDraw[],
      minX: number,
      maxX: number,
    ): { minX: number; maxX: number } => {
      let mn = minX;
      let mx = maxX;
      for (const g of glyphs) {
        const { left, right } = glyphInkExtents(target, g.ch, g.x);
        mn = Math.min(mn, left);
        mx = Math.max(mx, right);
      }
      return { minX: mn, maxX: mx };
    };

    const compositionMetrics = (
      size: number,
    ): {
      width: number;
      height: number;
      baselineY: number;
      pivotXLocal: number;
      topGlyphs: GlyphDraw[];
      reflectGlyphs: GlyphDraw[];
    } => {
      applyFont(measureCtx, size);
      const topLead = size * 0.1;
      const baselineY = size + topLead;
      const topTo = wordCenterOffset(measureCtx, TOP_WORDS, 'to', size);
      const bottomTo = wordCenterOffset(measureCtx, BOTTOM_WORDS, 'to', size);

      let inkLeft = Infinity;
      let inkRight = -Infinity;
      let maxReflectY = baselineY;

      const bottomStart = topTo - bottomTo;
      const topGlyphsProbe = layoutGlyphs(
        measureCtx,
        TOP_WORDS,
        0,
        baselineY,
        size,
      );
      const bottomGlyphsProbe = layoutGlyphs(
        measureCtx,
        BOTTOM_WORDS,
        bottomStart,
        baselineY,
        size,
      );

      ({ minX: inkLeft, maxX: inkRight } = extendGlyphBounds(
        measureCtx,
        topGlyphsProbe,
        inkLeft,
        inkRight,
      ));

      for (const g of bottomGlyphsProbe) {
        const rx = 2 * topTo - g.x;
        const ry = 2 * baselineY - g.y;
        const metrics = measureCtx.measureText(g.ch);
        const fallback = charWidth(measureCtx, g.ch) * 0.5;
        const anchorX = rx;
        const left = anchorX - (metrics.actualBoundingBoxRight ?? fallback);
        const right = anchorX + (metrics.actualBoundingBoxLeft ?? fallback);
        inkLeft = Math.min(inkLeft, left);
        inkRight = Math.max(inkRight, right);
        maxReflectY = Math.max(maxReflectY, ry + size * 0.2);
      }

      const padX = CANVAS_EDGE_PAD_CSS + wave.maxDisplaceCss;
      const padY = 10;
      const inkWidth = inkRight - inkLeft;
      const width = inkWidth + padX * 2;
      const xOffset = padX - inkLeft;

      const bottomLead = topLead;
      const height = maxReflectY + size * REFLECT_HEIGHT_RATIO + bottomLead + padY;

      const topGlyphsLocal = layoutGlyphs(
        measureCtx,
        TOP_WORDS,
        xOffset,
        baselineY,
        size,
      );
      const reflectGlyphsShifted = layoutGlyphs(
        measureCtx,
        BOTTOM_WORDS,
        bottomStart + xOffset,
        baselineY,
        size,
      );

      return {
        width,
        height,
        baselineY,
        pivotXLocal: topTo + xOffset,
        topGlyphs: topGlyphsLocal,
        reflectGlyphs: reflectGlyphsShifted,
      };
    };

    const measureForFit = (size: number): { width: number; height: number } => {
      applyFont(measureCtx, size);
      const m = compositionMetrics(size);
      return { width: m.width, height: m.height };
    };

    const fitsFont = (size: number): boolean => {
      const { width: capW, height: capH } = contentBox();
      const { width: textW, height: textH } = measureForFit(size);
      return textW <= capW * FONT_FILL && textH <= capH * FONT_FILL;
    };

    const fitFont = (): void => {
      const { width: capW, height: capH } = contentBox();
      const hiGuess = Math.min(capW * 0.28, capH * 0.48);
      let lo = FONT_MIN_PX;
      let hi = Math.max(lo, hiGuess);

      for (let n = 0; n < FONT_FIT_ITERATIONS; n += 1) {
        const mid = (lo + hi) * 0.5;
        if (fitsFont(mid)) lo = mid;
        else hi = mid;
      }

      fontPx = lo;
    };

    const invalidateReflectCache = (): void => {
      reflectSourceValid = false;
      reflectSrc = null;
      warpedBuffer = null;
    };

    const layout = (): void => {
      fitFont();
      dpr = Math.min(MAX_RENDER_DPR, window.devicePixelRatio || 1);
      warpPadPx = Math.ceil((wave.maxDisplaceCss + WARP_PAD_EXTRA_CSS) * dpr);

      const m = compositionMetrics(fontPx);
      topGlyphs = m.topGlyphs;
      reflectGlyphs = m.reflectGlyphs;
      pivotX = m.pivotXLocal * dpr;
      pivotY = m.baselineY * dpr;
      reflectBandTop = Math.floor(pivotY);
      baselineCss = m.baselineY;

      const canvasW = Math.max(1, Math.ceil(m.width));
      const canvasH = Math.max(1, Math.ceil(m.height));

      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      canvas.width = Math.floor(canvasW * dpr);
      canvas.height = Math.floor(canvasH * dpr);

      phraseBox.style.width = `${canvasW}px`;
      phraseBox.style.height = `${canvasH}px`;

      invalidateReflectCache();
    };

    const clampDisplace = (dx: number): number => {
      const cap = wave.maxDisplaceCss * dpr;
      return Math.max(-cap, Math.min(cap, dx));
    };

    const clamp01 = (v: number): number =>
      v < 0 ? 0 : v > 1 ? 1 : v;

    const phraseCalmEase = (t: number): number =>
      t * t * (3 - 2 * t);

    const stepPhraseCalm = (dt: number): void => {
      const target = pointerActive ? 1 : 0;
      const tau =
        target > calmLevel ? CALM_RAMP_TAU_IN : CALM_RAMP_TAU_OUT;
      if (tau <= 0) {
        calmLevel = target;
        return;
      }
      const k = 1 - Math.exp(-dt / tau);
      calmLevel += (target - calmLevel) * k;
      if (Math.abs(calmLevel - target) < 0.0008) calmLevel = target;
    };

    /** Whole reflection band shares ramped calmLevel (not per-letter). */
    const calmInfluenceAt = (_x: number, y: number): number => {
      if (y < reflectBandTop || calmLevel <= 0) return 0;
      return phraseCalmEase(calmLevel);
    };

    const muddleMixAt = (calm: number): number =>
      wave.gentleMuddleMin + (1 - wave.gentleMuddleMin) * (1 - calm);

    const displacementAt = (
      x: number,
      y: number,
      t: number,
      muddleMix: number,
    ): number => {
      const turbulentAmbient = 0.2 + muddleMix * wave.staticAmbientMuddleGain;
      const turbulentTurb = muddleMix * muddleMix;
      const knee = clamp01(
        (wave.gentleMuddleMin + 0.12 - muddleMix) / 0.12,
      );
      const ambientScale = turbulentAmbient * (1 - knee) + 1 * knee;
      const turbScale =
        turbulentTurb * (1 - knee) + wave.gentleMuddleMin * knee;

      let dx =
        (Math.sin(y * 0.028 + t * 1.4) * wave.ambientWaveAmp * dpr +
          Math.sin(y * 0.012 - t * 0.85 + 1.2) * wave.ambientWaveAmp2 * dpr) *
        ambientScale;

      if (turbScale >= 0.04) {
        dx +=
          Math.sin(x * 0.11 + y * 0.038 + t * 2.1) *
          wave.muddleTurbAmp *
          turbScale *
          dpr;
        dx +=
          Math.sin(x * 0.067 - y * 0.029 + t * 1.65) *
          wave.muddleTurbAmp2 *
          turbScale *
          dpr;
        dx +=
          Math.sin(x * 0.19 - t * 2.8) *
          wave.muddleTurbAmp *
          0.45 *
          turbScale *
          dpr;
      }

      return clampDisplace(dx);
    };

    const buildRowFields = (
      w: number,
      rowY: number,
      t: number,
    ): { dx: Float32Array; calm: Float32Array } => {
      const raw = new Float32Array(w);
      const calmRow = new Float32Array(w);
      const fullMuddle = muddleMixAt(0);

      for (let x = 0; x < w; x += 1) {
        const c = calmInfluenceAt(x, rowY);
        calmRow[x] = c;
        raw[x] =
          c > 0
            ? displacementAt(x, rowY, t, muddleMixAt(c))
            : displacementAt(x, rowY, t, fullMuddle);
      }

      const dx = new Float32Array(w);
      const r =
        (calmRow[Math.floor(w * 0.5)] ?? 0) > 0.35
          ? DISPLACE_SMOOTH_RADIUS
          : DISPLACE_CHOP_RADIUS;
      for (let x = 0; x < w; x += 1) {
        let sum = 0;
        let count = 0;
        for (let o = -r; o <= r; o += 1) {
          const xi = x + o;
          if (xi < 0 || xi >= w) continue;
          sum += raw[xi] ?? 0;
          count += 1;
        }
        dx[x] = count > 0 ? sum / count : 0;
      }
      return { dx, calm: calmRow };
    };

    const isInkLum = (lum: number): boolean => lum > INK_THRESHOLD;

    const fillBufferRgb = (
      data: Uint8ClampedArray,
      r: number,
      g: number,
      b: number,
    ): void => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    };

    const parseBgRgb = (hex: string): [number, number, number] => {
      const h = hex.replace('#', '');
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
      ];
    };

    const sampleBilinear = (
      data: Uint8ClampedArray,
      stride: number,
      height: number,
      fx: number,
      y: number,
    ): [number, number, number] => {
      const y0 = Math.max(0, Math.min(height - 1, y));
      const x0 = Math.floor(fx);
      const x1 = x0 + 1;
      const t = fx - x0;
      const sample = (x: number): [number, number, number] => {
        if (x < 0 || x >= stride) return frameBgRgb;
        const idx = (y0 * stride + x) * 4;
        return [data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 2] ?? 0];
      };

      const [r0, g0, b0] = sample(x0);
      const [r1, g1, b1] = sample(x1);
      const l0 = r0 + g0 + b0;
      const l1 = r1 + g1 + b1;

      if (!isInkLum(l0) && !isInkLum(l1)) return frameBgRgb;
      if (!isInkLum(l1)) return [r0, g0, b0];
      if (!isInkLum(l0)) return [r1, g1, b1];

      return [
        Math.round(r0 * (1 - t) + r1 * t),
        Math.round(g0 * (1 - t) + g1 * t),
        Math.round(b0 * (1 - t) + b1 * t),
      ];
    };

    const paintTop = (): void => {
      applyFont(ctx, fontPx * dpr);
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      for (const g of topGlyphs) {
        ctx.fillText(g.ch, g.x * dpr, g.y * dpr);
      }
    };

    const paintReflectionBuffer = (): void => {
      const w = canvas.width;
      const bandTop = reflectBandTop;
      const bandH = canvas.height - bandTop;
      if (bandH <= 0) return;

      const bufW = w + warpPadPx * 2;
      reflectBuffer.width = bufW;
      reflectBuffer.height = bandH;
      reflectBufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      reflectBufferCtx.fillStyle = BG;
      reflectBufferCtx.fillRect(0, 0, bufW, bandH);

      reflectBufferCtx.save();
      reflectBufferCtx.translate(warpPadPx, -bandTop);
      applyFont(reflectBufferCtx, fontPx * dpr);
      reflectBufferCtx.fillStyle = INK;
      reflectBufferCtx.textAlign = 'center';
      reflectBufferCtx.textBaseline = 'bottom';

      reflectBufferCtx.translate(pivotX, pivotY);
      reflectBufferCtx.rotate(Math.PI);
      reflectBufferCtx.translate(-pivotX, -pivotY);

      for (const g of reflectGlyphs) {
        reflectBufferCtx.fillText(g.ch, g.x * dpr, g.y * dpr);
      }

      reflectBufferCtx.restore();
    };

    const paintReflectionGhost = (): void => {
      const w = canvas.width;
      const bandTop = reflectBandTop;
      const bandH = canvas.height - bandTop;
      if (bandH <= 0) return;

      ctx.save();
      ctx.globalAlpha = GHOST_ALPHA * 0.28;
      ctx.drawImage(
        reflectBuffer,
        warpPadPx,
        0,
        w,
        bandH,
        0,
        bandTop,
        w,
        bandH,
      );
      ctx.restore();
    };

    const paintReflectionDepth = (w: number, bandTop: number, bandH: number): void => {
      const depthMix = 1;

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const fade = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
      fade.addColorStop(0, 'rgba(255,255,255,1)');
      fade.addColorStop(0.25, `rgba(210,210,210,${0.25 + 0.75 * depthMix})`);
      fade.addColorStop(0.65, `rgba(120,120,120,${0.35 + 0.65 * depthMix})`);
      fade.addColorStop(1, `rgba(55,55,55,${0.45 + 0.55 * depthMix})`);
      ctx.fillStyle = fade;
      ctx.fillRect(0, bandTop, w, bandH);
      ctx.restore();
    };

    const ensureReflectSource = (): ImageData => {
      const w = canvas.width;
      const bandH = canvas.height - reflectBandTop;
      const bufW = w + warpPadPx * 2;
      if (
        reflectSourceValid &&
        reflectSrc &&
        reflectSrcBufW === bufW &&
        reflectSrcBandH === bandH
      ) {
        return reflectSrc;
      }

      paintReflectionBuffer();
      reflectSrc = reflectBufferCtx.getImageData(0, 0, bufW, bandH);
      reflectSrcBufW = bufW;
      reflectSrcBandH = bandH;
      reflectSourceValid = true;
      return reflectSrc;
    };

    const ensureWarpedBuffer = (w: number, bandH: number): ImageData => {
      if (
        !warpedBuffer ||
        warpedBuffer.width !== w ||
        warpedBuffer.height !== bandH
      ) {
        warpedBuffer = ctx.createImageData(w, bandH);
      }
      return warpedBuffer;
    };

    const warpReflectionInverse = (
      w: number,
      bandTop: number,
      bandH: number,
      src: ImageData,
      bufW: number,
    ): void => {
      const [br, bg, bb] = frameBgRgb;
      const warped = ensureWarpedBuffer(w, bandH);
      fillBufferRgb(warped.data, br, bg, bb);

      for (let y = 0; y < bandH; y += 1) {
        const rowY = y + bandTop;
        const row = buildRowFields(w, rowY, timeSec);
        for (let x = 0; x < w; x += 1) {
          const dx = row.dx[x] ?? 0;
          const calm = row.calm[x] ?? 0;
          let [r, g, b] = sampleBilinear(
            src.data,
            bufW,
            bandH,
            x + warpPadPx + dx,
            y,
          );
          if (calm > 0.06) {
            const clarifyDx = dx * wave.gentleMuddleMin;
            const [fr, fg, fb] = sampleBilinear(
              src.data,
              bufW,
              bandH,
              x + warpPadPx + clarifyDx,
              y,
            );
            const blend = calm * wave.calmReadabilityBlend;
            r = Math.round(r * (1 - blend) + fr * blend);
            g = Math.round(g * (1 - blend) + fg * blend);
            b = Math.round(b * (1 - blend) + fb * blend);
          }
          const outIdx = (y * w + x) * 4;
          warped.data[outIdx] = r;
          warped.data[outIdx + 1] = g;
          warped.data[outIdx + 2] = b;
          warped.data[outIdx + 3] = 255;
        }
      }

      ctx.save();
      ctx.globalAlpha = REFLECT_WARP_ALPHA;
      ctx.putImageData(warped, 0, bandTop);
      ctx.restore();
    };

    const warpReflectionOntoMain = (): void => {
      const w = canvas.width;
      const bandTop = reflectBandTop;
      const bandH = canvas.height - bandTop;
      if (bandH <= 0 || !reflectSrc) return;

      const bufW = reflectSrcBufW;

      warpReflectionInverse(w, bandTop, bandH, reflectSrc, bufW);

      paintReflectionDepth(w, bandTop, bandH);
    };

    const drawFrame = (): void => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      frameBgRgb = parseBgRgb(BG);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      paintTop();
      ensureReflectSource();
      paintReflectionGhost();
      warpReflectionOntoMain();
    };

    const tick = (now: number): void => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, lastFrameMs > 0 ? (now - lastFrameMs) / 1000 : 1 / 60);
      lastFrameMs = now;
      timeSec += dt;
      stepPhraseCalm(dt);

      drawFrame();
    };

    const pointerOnReflection = (clientX: number, clientY: number): boolean => {
      const rect = canvas.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return false;
      }
      return clientY - rect.top >= baselineCss - 2;
    };

    const leaveReflection = (): void => {
      pointerActive = false;
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pointerOnReflection(e.clientX, e.clientY)) {
        leaveReflection();
        return;
      }
      pointerActive = true;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (!pointerOnReflection(e.clientX, e.clientY)) return;
      pointerActive = true;
    };

    const onPointerLeave = (): void => {
      leaveReflection();
    };

    const start = (): void => {
      if (started) return;
      started = true;
      layout();
      requestAnimationFrame(() => {
        layout();
        drawFrame();
        lastFrameMs = performance.now();
        rafId = requestAnimationFrame(tick);
      });
    };

    void document.fonts.ready.then(start);
    if (document.fonts.status === 'loaded') start();

    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    canvas.addEventListener('pointercancel', onPointerLeave, { passive: true });
    const onResize = (): void => {
      layout();
      drawFrame();
    };

    window.addEventListener('resize', onResize);

    const formatWaveForCopy = (): string => {
      const lines = [
        '// born/die wave tuning — paste into DEFAULT_WAVE_TUNING',
        'export const DEFAULT_WAVE_TUNING = {',
        `  ambientWaveAmp: ${wave.ambientWaveAmp},`,
        `  ambientWaveAmp2: ${wave.ambientWaveAmp2},`,
        `  staticAmbientMuddleGain: ${wave.staticAmbientMuddleGain},`,
        `  maxDisplaceCss: ${wave.maxDisplaceCss},`,
        `  muddleTurbAmp: ${wave.muddleTurbAmp},`,
        `  muddleTurbAmp2: ${wave.muddleTurbAmp2},`,
        `  gentleMuddleMin: ${wave.gentleMuddleMin},`,
        `  calmReadabilityBlend: ${wave.calmReadabilityBlend},`,
        '} as const;',
      ];
      return lines.join('\n');
    };

    let tunePanel: HTMLElement | null = null;
    let tunePre: HTMLPreElement | null = null;
    let tuneVisible = tunePanelRequested();

    const refreshTuneReadout = (): void => {
      if (tunePre) tunePre.textContent = formatWaveForCopy();
    };

    const onWaveTuningChange = (): void => {
      layout();
      if (started) drawFrame();
      refreshTuneReadout();
    };

    const mountTunePanel = (): void => {
      const panel = document.createElement('aside');
      panel.className = 'bd-tune';
      panel.hidden = !tuneVisible;

      const heading = document.createElement('h2');
      heading.textContent = 'Wave tune';
      panel.appendChild(heading);

      const hint = document.createElement('p');
      hint.textContent =
        'Live preview — drag any slider · T to hide · copy when done';
      panel.appendChild(hint);

      const tuneInputs = new Map<keyof WaveTuning, HTMLInputElement>();

      for (const spec of TUNE_SLIDERS) {
        const label = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = spec.label;
        const val = document.createElement('span');
        val.className = 'val';
        const input = document.createElement('input');
        input.type = 'range';
        input.dataset.key = spec.key;
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(wave[spec.key]);
        tuneInputs.set(spec.key, input);

        const sync = (): void => {
          const n = Number(input.value);
          wave[spec.key] = n;
          val.textContent =
            spec.step >= 1
              ? String(Math.round(n))
              : n.toFixed(2);
          onWaveTuningChange();
        };

        input.addEventListener('input', sync);
        label.append(name, val, input);
        panel.appendChild(label);
        sync();
      }

      tunePre = document.createElement('pre');
      panel.appendChild(tunePre);
      refreshTuneReadout();

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy values';
      copyBtn.addEventListener('click', () => {
        const text = formatWaveForCopy();
        void navigator.clipboard.writeText(text).catch(() => {
          window.prompt('Copy tuning block:', text);
        });
      });
      panel.appendChild(copyBtn);

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'secondary';
      resetBtn.textContent = 'Reset defaults';
      resetBtn.addEventListener('click', () => {
        Object.assign(wave, DEFAULT_WAVE_TUNING);
        for (const spec of TUNE_SLIDERS) {
          const input = tuneInputs.get(spec.key);
          if (!input) continue;
          input.value = String(wave[spec.key]);
          input.dispatchEvent(new Event('input'));
        }
      });
      panel.appendChild(resetBtn);

      document.body.appendChild(panel);
      tunePanel = panel;
    };

    mountTunePanel();

    const setTuneVisible = (show: boolean): void => {
      tuneVisible = show;
      if (tunePanel) tunePanel.hidden = !show;
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 't' || e.key === 'T') {
        setTuneVisible(!tuneVisible);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      tunePanel?.remove();
      tunePanel = null;
      tunePre = null;
      document.documentElement.classList.remove('bd-active');
      document.body.style.background = '';
      document.body.style.color = '';
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
