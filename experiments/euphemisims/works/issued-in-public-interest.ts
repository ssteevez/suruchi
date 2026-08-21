import type { TextWorkModule } from '../types.js';

const TITLE = 'ISSUED IN PUBLIC INTEREST';

const BODY = `“Love of the truth puts you on the spot."
Only to the extent that we expose ourselves over and over to annihilation can
that which is indestructible be found in us.
This very moment is the perfect teacher, and it's always with us
Awakeness is found in our pleasure and our pain, our confusion and our wisdom,
available in each moment of our weird, unfathomable, ordinary everyday lives.
The experience of certain feelings can seem particularly pregnant with desire
for resolution: loneliness, boredom, anxiety. Unless we can relax with these
feelings, it's very hard to stay in the middle when we experience them. We want
victory or defeat, praise or blame. For example, if somebody abandons us, we
don't want to be with that raw discomfort. Instead, we conjure up a familiar
identity of ourselves as a hapless victim. Or maybe we avoid the rawness by
acting out
and righteously telling the person how messed up he or she is. We automatically
want to cover over the pain in one way or another, identifying with victory or
victimhood.
Usually we regard loneliness as an enemy. Heartache is not something we choose
to invite in. It's restless and pregnant and hot with the desire to escape and
find something or some- one to keep us company. When we can rest in the middle,
we begin to have a nonthreatening relationship with loneliness, a relaxing and
cooling loneliness that completely turns ourusual fearful patterns upside down.`;

const BG = '#000000';
const INK = '#ffffff';
/** Words that finish settling per ~one viewport of scroll (curator: 5–7). */
const WORDS_REVEALED_PER_VIEWPORT = 6;
const SCRAMBLE_ROT_DEG = 30;
const HORIZONTAL_MARGIN_PERCENT = 20;
/** Inset for scatter pool inside viewport (matches layout margins). */
const SCRAMBLE_VIEWPORT_INSET = 0.04;
/** Higher = more scroll needed between each word resolving. */
const STAGGER_PER_WORD = 1.05;
const BODY_FONT_MIN_PX = 8;
/** Line-height ratio — lower = heavier overlap between lines. */
const BODY_LINE_HEIGHT = 0.46;
/** How much of the margin box the body may fill when fitting type. */
const BODY_FONT_FILL = 0.99;
/** Bias toward filling vertical space before width clamp shrinks size. */
const BODY_FONT_HEIGHT_BIAS = 1.08;
/** Sticky viewport padding (title+body block). */
const VIEWPORT_PAD_TOP_VH = 0.15;
const VIEWPORT_PAD_BOTTOM_VH = 0.2;
const BODY_LINE_COUNT = BODY.split('\n').length;

const lineIndexForChar = (charIndex: number): number => {
  let line = 0;
  for (let i = 0; i < charIndex; i += 1) {
    if (BODY[i] === '\n') line += 1;
  }
  return line;
};
/** Min gap between title block and body (also scales with viewport). */
const TITLE_BODY_GAP_MIN_PX = 36;
const TITLE_BODY_GAP_VH = 0.06;

interface ScrambleChar {
  el: HTMLSpanElement;
  targetX: number;
  targetY: number;
  scrambleX: number;
  scrambleY: number;
  rotate: number;
  index: number;
}

interface WordGroup {
  start: number;
  end: number;
  wordIndex: number;
}

const isWhitespaceChar = (ch: string): boolean => ch === ' ' || ch === '\n' || ch === '\t';

const buildWordGroups = (chars: ScrambleChar[]): WordGroup[] => {
  const groups: WordGroup[] = [];
  let i = 0;
  let wordIndex = 0;

  while (i < chars.length) {
    while (i < chars.length && isWhitespaceChar(chars[i]?.el.textContent ?? '')) {
      i += 1;
    }
    if (i >= chars.length) break;

    const start = i;
    while (i < chars.length && !isWhitespaceChar(chars[i]?.el.textContent ?? '')) {
      i += 1;
    }
    let end = i;
    while (end < chars.length && isWhitespaceChar(chars[end]?.el.textContent ?? '')) {
      end += 1;
    }

    groups.push({ start, end, wordIndex });
    wordIndex += 1;
    i = end;
  }

  return groups;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const seededUnit = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const appendBodyChars = (parent: HTMLElement, text: string): ScrambleChar[] => {
  const chars: ScrambleChar[] = [];

  for (let index = 0; index < text.length; index++) {
    const ch = text[index] ?? '';
    const span = document.createElement('span');
    span.className = 'ipi-char';
    span.textContent = ch;
    parent.appendChild(span);

    chars.push({
      el: span,
      targetX: 0,
      targetY: 0,
      scrambleX: 0,
      scrambleY: 0,
      rotate: 0,
      index,
    });
  }

  return chars;
};

const work: TextWorkModule = {
  title: 'Issued in Public Interest',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    document.body.style.background = BG;
    document.body.style.color = INK;

    const root = document.createElement('div');
    root.className = 'ipi-root';

    const sticky = document.createElement('div');
    sticky.className = 'ipi-sticky';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'ipi-title-block';

    const titleEl = document.createElement('h1');
    titleEl.className = 'ipi-title';
    titleEl.textContent = TITLE;
    titleBlock.appendChild(titleEl);

    const bodyZone = document.createElement('div');
    bodyZone.className = 'ipi-body-zone';

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'ipi-body-wrap';

    const field = document.createElement('div');
    field.className = 'ipi-field';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'ipi-body';

    field.appendChild(bodyEl);
    bodyWrap.append(field);
    bodyZone.appendChild(bodyWrap);

    const contentColumn = document.createElement('div');
    contentColumn.className = 'ipi-content';
    contentColumn.append(titleBlock, bodyZone);
    sticky.append(contentColumn);

    const spacer = document.createElement('div');
    spacer.className = 'ipi-spacer';
    spacer.setAttribute('aria-hidden', 'true');

    root.append(sticky, spacer);
    container.appendChild(root);

    const bodyChars = appendBodyChars(bodyEl, BODY);
    const wordGroups = buildWordGroups(bodyChars);

    const style = document.createElement('style');
    style.textContent = `
      html.ipi-active,
      html.ipi-active body {
        background: ${BG};
        color: ${INK};
        margin: 0;
      }
      .ipi-root {
        position: fixed;
        inset: 0;
        z-index: 5;
        overflow-x: hidden;
        overflow-y: auto;
        background: ${BG};
        scrollbar-width: none;
      }
      .ipi-root::-webkit-scrollbar {
        display: none;
      }
      .ipi-sticky {
        position: sticky;
        top: 0;
        height: 100vh;
        min-height: 100vh;
        box-sizing: border-box;
        overflow: visible;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        padding: ${VIEWPORT_PAD_TOP_VH * 100}vh ${HORIZONTAL_MARGIN_PERCENT}%
          ${VIEWPORT_PAD_BOTTOM_VH * 100}vh ${HORIZONTAL_MARGIN_PERCENT}%;
      }
      .ipi-content {
        width: 100%;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        box-sizing: border-box;
      }
      .ipi-title-block {
        position: relative;
        flex-shrink: 0;
        align-self: flex-start;
        width: auto;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 0;
        margin: 0;
        pointer-events: none;
        box-sizing: border-box;
      }
      .ipi-title {
        margin: 0;
        padding: 0;
        width: 100%;
        text-align: left;
        white-space: nowrap;
        font-family: "American Typewriter", "Courier New", "Courier Prime", ui-monospace,
          monospace;
        font-size: clamp(18px, 4.2vw, 72px);
        font-weight: 900;
        font-synthesis: weight;
        letter-spacing: 0.12em;
        line-height: 1;
        color: ${INK};
        -webkit-text-stroke: 0.45px ${INK};
        paint-order: stroke fill;
      }
      .ipi-body-zone {
        position: relative;
        width: 100%;
        flex: 1;
        min-height: 0;
        overflow: visible;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        box-sizing: border-box;
      }
      .ipi-body-wrap {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      }
      .ipi-body {
        margin: 0;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        font-family: "American Typewriter", "Courier New", "Courier Prime", ui-monospace,
          monospace;
        font-weight: 600;
        letter-spacing: 0.015em;
        line-height: ${BODY_LINE_HEIGHT};
        text-align: left;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        color: ${INK};
      }
      .ipi-field {
        position: relative;
        margin: 0;
        max-width: 100%;
      }
      .ipi-char {
        display: inline;
        will-change: transform;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('ipi-active');

    let layoutReady = false;
    let rafId = 0;

    const titleBodyGapPx = (): number =>
      Math.max(TITLE_BODY_GAP_MIN_PX, window.innerHeight * TITLE_BODY_GAP_VH);

    const bodyZoneMaxHeight = (): number => {
      const vh = window.innerHeight;
      const topPad = vh * VIEWPORT_PAD_TOP_VH;
      const botPad = vh * VIEWPORT_PAD_BOTTOM_VH;
      const titleH = titleBlock.offsetHeight;
      const gap = titleBodyGapPx();
      return Math.max(80, vh - topPad - botPad - titleH - gap);
    };

    const layoutContentBlock = (): void => {
      const gap = titleBodyGapPx();
      titleBlock.style.marginBottom = `${gap}px`;
      bodyZone.style.maxHeight = `${bodyZoneMaxHeight()}px`;
      bodyZone.style.height = 'auto';
    };

    const syncTitleToBodyWidth = (blockW: number): void => {
      const w = blockW > 0 ? Math.ceil(blockW) : bodyWrap.clientWidth;
      titleBlock.style.width = `${w}px`;
      titleEl.style.width = '100%';

      const maxPx = Math.min(72, window.innerWidth * 0.062);
      const minPx = 14;
      let sizePx = maxPx;
      titleEl.style.fontSize = `${sizePx}px`;

      while (sizePx > minPx && titleEl.scrollWidth > w + 1) {
        sizePx -= 1;
        titleEl.style.fontSize = `${sizePx}px`;
      }
    };

    const measureBodyBlock = (): { width: number; height: number } => {
      const fieldRect = field.getBoundingClientRect();
      let minX = Infinity;
      let maxX = 0;
      let maxY = 0;

      for (const ch of bodyChars) {
        const r = ch.el.getBoundingClientRect();
        const x = r.left - fieldRect.left;
        const y = r.top - fieldRect.top;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + r.width);
        maxY = Math.max(maxY, y + r.height);
      }

      const width = Number.isFinite(minX) ? maxX - minX : 0;
      return { width, height: maxY };
    };

    const scrollExtraVh = (): number => {
      const totalWords = Math.max(1, wordGroups.length);
      return (
        (totalWords * (1 + STAGGER_PER_WORD)) /
        (WORDS_REVEALED_PER_VIEWPORT * STAGGER_PER_WORD)
      );
    };

    const fitsInContentBox = (fontPx: number, heightCap: number, widthCap: number): boolean => {
      bodyEl.style.fontSize = `${fontPx}px`;
      const { width, height } = measureBodyBlock();
      return height <= heightCap && width <= widthCap;
    };

    const maxFontForHeight = (heightCap: number): number => {
      const lineFactor = (BODY_LINE_COUNT - 1) * BODY_LINE_HEIGHT + 0.5;
      return heightCap / Math.max(0.5, lineFactor);
    };

    const fitBodyFontToViewport = (): void => {
      layoutContentBlock();
      const zoneH = bodyZoneMaxHeight();
      const wrapW = bodyWrap.clientWidth;
      const heightCap = zoneH * BODY_FONT_FILL;
      const widthCap = wrapW * BODY_FONT_FILL;

      let fontPx = Math.max(
        BODY_FONT_MIN_PX,
        maxFontForHeight(heightCap) * BODY_FONT_HEIGHT_BIAS,
      );

      while (fontPx > BODY_FONT_MIN_PX && !fitsInContentBox(fontPx, heightCap, widthCap)) {
        fontPx -= 0.5;
      }
      bodyEl.style.fontSize = `${fontPx}px`;
    };

    const applyScrambleState = (progress: number): void => {
      const totalWords = wordGroups.length;
      const span = STAGGER_PER_WORD / Math.max(1, totalWords);

      for (const word of wordGroups) {
        const raw = clamp01(
          (progress * (1 + span * totalWords) - word.wordIndex * span) / span,
        );
        const settle = easeOutCubic(raw);
        const opacity = String(0.28 + settle * 0.72);

        for (let i = word.start; i < word.end; i += 1) {
          const ch = bodyChars[i];
          if (!ch) continue;
          const dx = ch.scrambleX * (1 - settle);
          const dy = ch.scrambleY * (1 - settle);
          const rot = ch.rotate * (1 - settle);
          ch.el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
          ch.el.style.opacity = opacity;
        }
      }
    };

    const assignCharScrambles = (leftShift: number, fieldRect: DOMRect): void => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const inset = SCRAMBLE_VIEWPORT_INSET;
      const xMin = vw * inset;
      const xMax = vw * (1 - inset);
      const yMin = vh * (VIEWPORT_PAD_TOP_VH + inset * 0.5);
      const yMax = vh * (1 - VIEWPORT_PAD_BOTTOM_VH - inset * 0.5);

      for (const ch of bodyChars) {
        const text = ch.el.textContent ?? '';
        if (isWhitespaceChar(text)) {
          ch.scrambleX = 0;
          ch.scrambleY = 0;
          ch.rotate = 0;
          continue;
        }

        const unit = seededUnit(ch.index + 11);
        const unit2 = seededUnit(ch.index + 29);
        const unit3 = seededUnit(ch.index + 41);
        const poolX = xMin + unit2 * (xMax - xMin);
        const poolY = yMin + unit * (yMax - yMin);
        const finalX = fieldRect.left + ch.targetX + leftShift;
        const finalY = fieldRect.top + ch.targetY;

        ch.scrambleX = poolX - finalX;
        ch.scrambleY = poolY - finalY;
        ch.rotate = (unit3 - 0.5) * SCRAMBLE_ROT_DEG * 2;
      }
    };

    const measureAndPin = (): void => {
      for (const ch of bodyChars) {
        ch.el.style.position = '';
        ch.el.style.left = '';
        ch.el.style.top = '';
        ch.el.style.display = 'inline';
        ch.el.style.transform = '';
        ch.el.style.opacity = '';
      }
      field.style.height = '';
      field.style.width = '';

      fitBodyFontToViewport();

      const fieldRect = field.getBoundingClientRect();
      let minX = Infinity;
      let maxX = 0;

      let maxY = 0;

      for (const ch of bodyChars) {
        const r = ch.el.getBoundingClientRect();
        ch.targetX = r.left - fieldRect.left;
        ch.targetY = r.top - fieldRect.top;
        maxY = Math.max(maxY, ch.targetY + r.height);
        minX = Math.min(minX, ch.targetX);
        maxX = Math.max(maxX, ch.targetX + r.width);
      }

      const leftShift = Number.isFinite(minX) ? -minX : 0;

      const blockW = maxX - minX;
      field.style.width = blockW > 0 ? `${Math.ceil(blockW)}px` : 'auto';
      field.style.height = `${Math.ceil(maxY + 4)}px`;

      syncTitleToBodyWidth(blockW);
      layoutContentBlock();
      const fieldRectPinned = field.getBoundingClientRect();
      assignCharScrambles(leftShift, fieldRectPinned);

      for (const ch of bodyChars) {
        const line = lineIndexForChar(ch.index);
        ch.el.style.display = 'inline-block';
        ch.el.style.position = 'absolute';
        ch.el.style.left = `${(ch.targetX + leftShift).toFixed(2)}px`;
        ch.el.style.top = `${ch.targetY}px`;
        ch.el.style.margin = '0';
        ch.el.style.zIndex = String(line);
      }

      layoutReady = true;
      applyScrambleState(0);
    };

    const updateScroll = (): void => {
      if (!layoutReady) return;
      const scrollSpan = window.innerHeight * scrollExtraVh();
      const progress = clamp01(root.scrollTop / Math.max(1, scrollSpan));
      applyScrambleState(progress);
    };

    const onScroll = (): void => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateScroll();
      });
    };

    const setSpacerHeight = (): void => {
      spacer.style.height = `${window.innerHeight * scrollExtraVh()}px`;
    };

    const init = (): void => {
      setSpacerHeight();
      measureAndPin();
      updateScroll();
    };

    if (document.fonts?.ready) {
      void document.fonts.ready.then(init);
    } else {
      requestAnimationFrame(init);
    }

    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      layoutReady = false;
      for (const ch of bodyChars) {
        ch.el.style.position = '';
        ch.el.style.left = '';
        ch.el.style.top = '';
        ch.el.style.display = '';
        ch.el.style.transform = '';
      }
      field.style.height = '';
      field.style.width = '';
      setSpacerHeight();
      requestAnimationFrame(measureAndPin);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      root.removeEventListener('scroll', onScroll);
      document.documentElement.classList.remove('ipi-active');
      document.body.style.background = '';
      document.body.style.color = '';
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
