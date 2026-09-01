export interface SmokyLabelSystem {
  isSmoking(el: HTMLElement): boolean;
  dispose(): void;
}

interface SmokyLabelState {
  element: HTMLElement;
  labelContainer: HTMLElement;
  word: string;
  href: string;
  index: number;
  dispMapEl: SVGFEDisplacementMapElement;
  isSmoking: boolean;
  disableShuffle?: boolean;
  clickHandler?: () => void;
  rafId?: number;
}

export const createSmokyLabelSystem = (
  labels: Array<{ 
    element: HTMLElement; 
    word: string; 
    href: string;
    hoverWord?: string;
    hoverHref?: string;
    disableShuffle?: boolean;
  }>,
  positions: string[] = ['suruchi-pos-1', 'suruchi-pos-2', 'suruchi-pos-3']
): SmokyLabelSystem => {
  // SVG inject
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.pointerEvents = 'none';
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);

  labels.forEach((_, i) => {
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = `smoke-lbl-${i}`;
    filter.setAttribute('x', '-100%');
    filter.setAttribute('y', '-100%');
    filter.setAttribute('width', '300%');
    filter.setAttribute('height', '300%');

    const turb = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.04');
    turb.setAttribute('numOctaves', '3');
    turb.setAttribute('result', 'noise');

    const disp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    disp.id = `disp-${i}`;
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'noise');
    disp.setAttribute('scale', '0');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(turb);
    filter.appendChild(disp);
    defs.appendChild(filter);
  });

  document.body.appendChild(svg);

  // States
  const states: SmokyLabelState[] = [];
  const timeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  const setWordChars = (state: SmokyLabelState, wordLower: string): HTMLElement[] => {
    state.labelContainer.textContent = '';
    for (const char of wordLower) {
      const span = document.createElement('span');
      span.className = 'suruchi-char';
      span.textContent = char === ' ' ? '\u00A0' : char;
      state.labelContainer.appendChild(span);
    }
    return Array.from(state.labelContainer.querySelectorAll<HTMLElement>('.suruchi-char'));
  };

  labels.forEach((data, i) => {
    const labelContainer = data.element.querySelector<HTMLElement>('.suruchi-label');
    if (!labelContainer) return;

    labelContainer.style.display = 'inline-block';
    labelContainer.style.filter = `url(#smoke-lbl-${i})`;

    const dispMapEl = document.getElementById(`disp-${i}`) as unknown as SVGFEDisplacementMapElement;

    const state: SmokyLabelState = {
      element: data.element,
      labelContainer,
      word: data.word,
      href: data.href,
      index: i,
      dispMapEl,
      isSmoking: false,
      disableShuffle: data.disableShuffle,
    };
    states.push(state);

    setWordChars(state, data.word.toLowerCase());
    data.element.style.cursor = 'pointer';

    state.clickHandler = () => {
      window.location.href = state.href;
    };
    state.element.addEventListener('click', state.clickHandler);

    if (data.hoverWord && data.hoverHref) {
      let isHovered = false;
      data.element.addEventListener('mouseenter', () => {
        isHovered = true;
        if (!state.isSmoking && state.word === data.word) {
          animateSmokeTransition(state, data.hoverWord!, data.hoverHref!, () => {
            if (!isHovered) {
              animateSmokeTransition(state, data.word, data.href, () => {}, true);
            }
          }, false, 15); // Fast smoke transition
        }
      });
      data.element.addEventListener('mouseleave', () => {
        isHovered = false;
        if (!state.isSmoking && state.word === data.hoverWord) {
          animateSmokeTransition(state, data.word, data.href, () => {
            if (isHovered) {
              animateSmokeTransition(state, data.hoverWord!, data.hoverHref!, () => {}, false, 15);
            }
          }, true); // Instant revert
        }
      });
    }

  });

  const animateSmokeTransition = (
    state: SmokyLabelState,
    newWord: string,
    newHref: string,
    onDone: () => void,
    instant: boolean = false,
    speed: number = 1
  ) => {
    if (instant) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.dispMapEl.setAttribute('scale', '0');
      state.word = newWord;
      state.href = newHref;
      const spans = setWordChars(state, newWord.toLowerCase());
      spans.forEach((span) => {
        span.style.opacity = '';
        span.style.transform = '';
        span.style.filter = '';
      });
      state.isSmoking = false;
      onDone();
      return;
    }

    state.isSmoking = true;
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const charSpans = Array.from(state.labelContainer.querySelectorAll<HTMLElement>('.suruchi-char'));
    const staggerMs = 120 / speed;

    // Dissolve out
    const dissolveDuration = 1200 / speed;
    const totalOutDuration = dissolveDuration + (charSpans.length - 1) * staggerMs;

    let outStart: number | null = null;
    const dissolveAnim = (timestamp: number) => {
      if (!outStart) outStart = timestamp;
      const elapsed = timestamp - outStart;
      const progress = Math.min(elapsed / dissolveDuration, 1);

      // ease-in
      const scale = progress * progress * 120; // Huge dispersion
      state.dispMapEl.setAttribute('scale', scale.toString());

      if (progress < 1) {
        state.rafId = requestAnimationFrame(dissolveAnim);
      }
    };
    state.rafId = requestAnimationFrame(dissolveAnim);

    const outAnimations: Animation[] = [];
    charSpans.forEach((span, i) => {
      const anim = span.animate(
        [
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
          { opacity: 0, filter: 'blur(24px)', transform: 'translateY(-40px)' }, // Rise up and blur heavily
        ],
        {
          duration: dissolveDuration,
          delay: i * staggerMs,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'both',
        }
      );
      outAnimations.push(anim);
    });

    const gapMs = 400; // Let the smoke settle before the new word forms
    const t1 = setTimeout(() => {
      // Clean up out animations
      outAnimations.forEach((a) => a.cancel());

      // Rebuild chars for materialize
      state.word = newWord;
      state.href = newHref;
      const newSpans = setWordChars(state, newWord.toLowerCase());

      const materializeDuration = 1400 / speed; // Slow, dramatic formation
      const inAnimations: Animation[] = [];

      let inStart: number | null = null;
      const materializeAnim = (timestamp: number) => {
        if (!inStart) inStart = timestamp;
        const elapsed = timestamp - inStart;
        const progress = Math.min(elapsed / materializeDuration, 1);

        // ease-out
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const scale = 120 * (1 - easeOut);
        state.dispMapEl.setAttribute('scale', scale.toString());

        if (progress < 1) {
          state.rafId = requestAnimationFrame(materializeAnim);
        } else {
          state.dispMapEl.setAttribute('scale', '0');
        }
      };
      state.rafId = requestAnimationFrame(materializeAnim);

      newSpans.forEach((span, i) => {
        const anim = span.animate(
          [
            { opacity: 0, filter: 'blur(24px)', transform: 'translateY(20px)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' },
          ],
          {
            duration: materializeDuration,
            delay: i * staggerMs,
            easing: 'cubic-bezier(0, 0, 0.2, 1)',
            fill: 'both',
          }
        );
        inAnimations.push(anim);
      });

      const totalInDuration = materializeDuration + (newSpans.length - 1) * staggerMs;
      const t2 = setTimeout(() => {
        inAnimations.forEach((a) => a.cancel());
        newSpans.forEach((span) => {
          span.style.opacity = '';
          span.style.transform = '';
          span.style.filter = '';
        });
        state.isSmoking = false;
        if (onDone) onDone();
      }, totalInDuration + 50);
      timeouts.add(t2);
    }, totalOutDuration + (gapMs / speed));
    timeouts.add(t1);
  };

  const shufflePositions = () => {
    const available = states.filter((s) => !s.isSmoking && !s.disableShuffle);
    if (available.length < positions.length || positions.length < 2) return;

    // Pick exactly two random items to move
    const indices = Array.from({ length: available.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j] as number, indices[i] as number];
    }
    
    const m0 = available[indices[0] as number] as SmokyLabelState;
    const m1 = available[indices[1] as number] as SmokyLabelState;
    
    const pos0 = positions.find(p => m0.element.classList.contains(p));
    const pos1 = positions.find(p => m1.element.classList.contains(p));
    
    if (!pos0 || !pos1) return;
    
    let moves = [
      { state: m0, oldClass: pos0, newClass: pos1 },
      { state: m1, oldClass: pos1, newClass: pos0 }
    ];

    moves.forEach(m => {
      if (!m.oldClass || !m.newClass) return;
      const charSpans = Array.from(m.state.labelContainer.querySelectorAll<HTMLElement>('.suruchi-char'));
      const staggerMs = 120;
      const totalOutDuration = 1200 + (charSpans.length - 1) * staggerMs;
      
      setTimeout(() => {
        m.state.element.classList.remove(m.oldClass);
        m.state.element.classList.add(m.newClass);
      }, totalOutDuration + 200);

      animateSmokeTransition(m.state, m.state.word, m.state.href, () => {});
    });
  };

  const scheduleSwapLoop = () => {
    const delay = 10000;
    const t = setTimeout(() => {
      shufflePositions();
      scheduleSwapLoop();
    }, delay);
    timeouts.add(t);
  };
  scheduleSwapLoop();

  return {
    isSmoking(el: HTMLElement) {
      const state = states.find((s) => s.element === el);
      return state ? state.isSmoking : false;
    },
    dispose() {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      states.forEach((state) => {
        if (state.clickHandler) {
          state.element.removeEventListener('click', state.clickHandler);
        }
        if (state.rafId) {
          cancelAnimationFrame(state.rafId);
        }
      });
      svg.remove();
    },
  };
};
