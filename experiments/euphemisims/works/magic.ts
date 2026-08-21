import type { TextWorkModule } from '../types.js';

const PHRASES = [
  'the earth of earth',
  'the wetness of water',
  'the heat of fire',
  'the stillness of wind',
] as const;

const INTERVAL_MS  = 4200;
const MORPH_MS     = 1800;  // crossfade duration
const BLUR_IN_MS   =  300;  // stdDeviation 0 → 4 before crossfade (A becomes fat)
const BLUR_OUT_MS  =  600;  // stdDeviation 4 → 0 after crossfade  (B sharpens)

/*
 * WHY SVG FILTER (not CSS filter: blur+contrast)
 * ───────────────────────────────────────────────
 * CSS contrast() works on colour distance from 50% grey.
 * Dark text on cream background at 50% opacity = midgrey → contrast
 * pushes it back to cream → text vanishes during crossfade.
 * This creates a "dead zone" where both phrases are invisible at the
 * exact midpoint of the fade.
 *
 * SVG feColorMatrix thresholds on ALPHA, not colour.
 * Semi-transparent dark text retains its alpha regardless of
 * background colour.  The threshold can be tuned so both phrases
 * survive simultaneously at their crossfade midpoints.
 *
 * THRESHOLD MATHS (for reference):
 *   feColorMatrix last row: A' = 30*A − 11  → threshold at A=0.367
 *   Bold font stroke (≈14px) + stdDeviation=4:
 *     blur spreads stroke → effective centre alpha ≈ opacity × 0.74
 *     Threshold opacity = 0.367 / 0.74 ≈ 0.496
 *   At midpoint both phrases at opacity=0.5 → centre alpha ≈ 0.37
 *   → both just above threshold → both visible simultaneously ✓
 *   → no dead zone, continuous organic morph ✓
 *
 * TIMING (simple linear crossfade):
 *   outgoing opacity:  1 → 0  over MORPH_MS
 *   incoming opacity:  0 → 1  over MORPH_MS
 *   Effect per phrase:
 *     opacity 0.0–0.45: invisible (below threshold after blur)
 *     opacity 0.45–0.55: materialises / dematerialises gradually
 *     opacity 0.55–1.0: fully blobby visible fat letterforms
 *   Overall:
 *     0→45% of MORPH_MS : fat outgoing only
 *     45–55%            : merged blob of both (peak gooey)
 *     55→100%           : fat incoming only
 *   Filter off at end → incoming phrase snaps sharp.
 */

const BG  = '#f4f2ea';
const INK = '#0d0d0f';

const work: TextWorkModule = {
  title: 'Magic',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';

    document.body.style.background = BG;
    document.body.style.color      = INK;

    // ── SVG filter ──────────────────────────────────────────────────────
    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText =
      'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;';

    const defs = document.createElementNS(NS, 'defs');
    const fil  = document.createElementNS(NS, 'filter');
    fil.id = 'mg-goo';
    // Filter region large enough for stdDeviation=4 spread (3σ = 12px)
    fil.setAttribute('x',      '-15%');
    fil.setAttribute('y',      '-80%');
    fil.setAttribute('width',  '130%');
    fil.setAttribute('height', '260%');
    fil.setAttribute('color-interpolation-filters', 'sRGB');

    const fBlur = document.createElementNS(NS, 'feGaussianBlur');
    fBlur.setAttribute('in',           'SourceGraphic');
    fBlur.setAttribute('stdDeviation', '4');
    fBlur.setAttribute('result',       'blur');

    const fMatrix = document.createElementNS(NS, 'feColorMatrix');
    fMatrix.setAttribute('in',   'blur');
    fMatrix.setAttribute('mode', 'matrix');
    // A' = 30×A − 11  →  threshold at α=0.367 (≈ opacity 0.496 after blur)
    // Slope 30 (not 200) gives a softer, more organic edge to the blobs.
    fMatrix.setAttribute('values',
      '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -11');

    fil.append(fBlur, fMatrix);
    defs.appendChild(fil);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    // ── DOM ─────────────────────────────────────────────────────────────
    const root = document.createElement('div');
    root.className = 'mg-root';

    const line = document.createElement('div');
    line.className = 'mg-line';
    line.setAttribute('aria-live', 'polite');

    const morpher = document.createElement('span');
    morpher.className = 'mg-morph';

    const pA = document.createElement('span');
    pA.className = 'mg-phrase';
    pA.textContent = PHRASES[0]!;
    pA.style.opacity = '1';

    const pB = document.createElement('span');
    pB.className = 'mg-phrase';
    pB.textContent = PHRASES[1]!;
    pB.style.opacity = '0';

    morpher.append(pA, pB);

    for (const p of PHRASES) {
      const s = document.createElement('span');
      s.className = 'mg-sizer';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = p;
      morpher.appendChild(s);
    }

    const stat = document.createElement('span');
    stat.className = 'mg-static';
    stat.textContent = '= magic';

    line.append(morpher, stat);
    
    const clicker = document.createElement('button');
    clicker.className = 'mg-clicker';
    clicker.innerHTML = '<span>TAP</span>';

    root.append(line, clicker);
    container.appendChild(root);

    // ── Styles ──────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
      .mg-root {
        display: grid;
        place-items: center;
        gap: 60px;
        width: 100%;
        min-height: 50vh;
      }
      
      .mg-clicker {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        border: 1px solid rgba(13,13,15,0.4);
        background: transparent;
        color: ${INK};
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 150ms ease, background 150ms ease, color 150ms ease, border-color 150ms ease;
        pointer-events: auto;
      }
      .mg-clicker:hover {
        background: ${INK};
        color: ${BG};
        border-color: ${INK};
        transform: scale(1.05);
      }
      .mg-clicker:active {
        transform: scale(0.95);
      }

      .mg-line {
        display: flex;
        align-items: baseline;
        /* font-size is set dynamically by fitFont() */
        font-size: 5vw;
        line-height: 1.2;
        letter-spacing: -0.01em;
        white-space: nowrap;
        color: ${INK};
      }

      /* inline-grid — all children share grid-area 1/1 (stacked).
         NO transform, will-change, isolation — they create GPU layers
         that prevent the SVG filter seeing child opacity mid-states. */
      .mg-morph {
        display: inline-grid;
        vertical-align: baseline;
        line-height: inherit;
      }

      /* SVG filter on the container only.
         NO background here — SVG filter works on alpha, not colour.
         The page BG (${BG}) shows through transparent filter areas. */
      .mg-morph.is-active {
        filter: url(#mg-goo);
      }

      .mg-phrase,
      .mg-sizer {
        grid-area: 1 / 1;
        white-space: nowrap;
        /* right-align so the last letter is always flush against " =" */
        justify-self: end;
      }

      .mg-phrase {
        color: ${INK};
        font-weight: 800;
        /* NO filter here */
      }

      .mg-sizer {
        font-weight: 800;
        visibility: hidden;
        pointer-events: none;
        user-select: none;
      }

      /* "= magic" matches the phrase exactly — same weight, same size (inherited) */
      .mg-static {
        white-space: nowrap;
        color: ${INK};
        font-weight: 800;
        margin-left: 0.35em;
      }

      .back-btn, .next-btn {
        color: rgba(13,13,15,0.40) !important;
      }
      .back-btn:hover, .next-btn:hover {
        color: rgba(13,13,15,0.90) !important;
      }

      /* Break out of the 720px work-stage cap so text can fill the viewport */
      .work-stage {
        width: 100% !important;
        max-width: none !important;
      }
      .work-shell {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .mg-root {
        padding: 0 clamp(16px, 3vw, 48px);
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(style);

    // ── Dynamic font scaling — fill the viewport width ───────────────────
    // Measures the line at a known font-size, computes the ratio needed to
    // reach 96% of viewport width, then applies it.  Reruns on resize.
    let resizeTimer = 0;
    const fitFont = (): void => {
      line.style.fontSize = '100px';
      void line.offsetWidth;                         // force layout
      const textW  = line.scrollWidth;
      // Use viewport width minus the padding we set on .mg-root
      const pad    = Math.min(48, Math.max(16, window.innerWidth * 0.03));
      const availW = window.innerWidth - pad * 2;
      if (textW > 0 && availW > 0) {
        line.style.fontSize = `${Math.floor(availW / textW * 100)}px`;
      }
    };
    const onResize = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fitFont, 60);
    };
    window.setTimeout(fitFont, 0);   // run after first paint
    window.addEventListener('resize', onResize);

    // ── rAF animation ───────────────────────────────────────────────────
    let idx       = 0;
    let aIsActive = true;
    let busy      = false;
    let dead      = false;
    let rafId     = 0;

    const tween = (
      duration: number,
      onTick: (t: number) => void,
    ): Promise<void> =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick  = (now: number): void => {
          if (dead) { resolve(); return; }
          const t = Math.min(1, (now - start) / duration);
          onTick(t);
          if (t < 1) { rafId = requestAnimationFrame(tick); }
          else resolve();
        };
        rafId = requestAnimationFrame(tick);
      });

    // Animate the SVG blur stdDeviation between two values.
    // This lets the text gradually fatten (0→4) or sharpen (4→0).
    const tweenStd = (from: number, to: number, duration: number): Promise<void> =>
      tween(duration, (t) => {
        fBlur.setAttribute('stdDeviation', String((from + (to - from) * t).toFixed(3)));
      });

    const STD = 4;  // peak blur radius

    const step = async (): Promise<void> => {
      if (dead || busy) return;
      busy = true;

      const nextIdx = (idx + 1) % PHRASES.length;
      const out     = aIsActive ? pA : pB;
      const inc     = aIsActive ? pB : pA;

      inc.textContent   = PHRASES[nextIdx]!;
      out.style.opacity = '1';
      inc.style.opacity = '0';

      // Phase 1 — blur in: A fattens from sharp → blob (stdDev 0 → STD)
      fBlur.setAttribute('stdDeviation', '0');
      morpher.classList.add('is-active');
      void morpher.offsetWidth;
      await tweenStd(0, STD, BLUR_IN_MS);
      if (dead) return;

      // Phase 2 — crossfade: A → B through merged blob (stdDev stays at STD)
      await tween(MORPH_MS, (t) => {
        out.style.opacity = String(1 - t);
        inc.style.opacity = String(t);
      });
      if (dead) return;

      // Phase 3 — blur out: B sharpens from blob → clean (stdDev STD → 0)
      // Both opacities are already snapped (out=0, inc=1) so only B is visible.
      out.style.opacity = '0';
      inc.style.opacity = '1';
      await tweenStd(STD, 0, BLUR_OUT_MS);
      if (dead) return;

      morpher.classList.remove('is-active');
      fBlur.setAttribute('stdDeviation', String(STD)); // reset for next morph

      idx       = nextIdx;
      aIsActive = !aIsActive;
      busy      = false;
    };

    clicker.onclick = () => {
      void step();
    };

    return (): void => {
      dead = true;
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.body.style.background = '';
      document.body.style.color      = '';
      svg.remove();
      style.remove();
      container.innerHTML = '';
    };
  },
};

export default work;
