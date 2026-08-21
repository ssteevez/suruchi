import type { TextWorkModule } from '../types.js';

const BG = '#050505';
const INK = 'rgba(245, 245, 245, 0.8)';
const TEXT = 'THE THING TO DO IS TO DO NOTHING';

const work: TextWorkModule = {
  title: 'The Thing To Do',

  mount(container: HTMLElement): () => void {
    container.innerHTML = '';
    document.body.style.background = BG;
    
    // ── Global Styles Override ────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
      .work-stage {
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 10;
        cursor: none !important;
        overflow: hidden !important;
      }
      .work-shell {
        padding: 0 !important;
      }
    `;
    document.head.appendChild(style);

    // ── SVG Filter ────────────────────────────────────────────────────────
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;';

    const defs = document.createElementNS(NS, 'defs');
    const fil = document.createElementNS(NS, 'filter');
    fil.id = 'graffiti-simple';
    fil.setAttribute('x', '-20%');
    fil.setAttribute('y', '-20%');
    fil.setAttribute('width', '140%');
    fil.setAttribute('height', '140%');

    const fTurb = document.createElementNS(NS, 'feTurbulence');
    fTurb.setAttribute('type', 'fractalNoise');
    fTurb.setAttribute('baseFrequency', '0.1');
    fTurb.setAttribute('result', 'noise');

    const fDisp = document.createElementNS(NS, 'feDisplacementMap');
    fDisp.setAttribute('in', 'SourceGraphic');
    fDisp.setAttribute('in2', 'noise');
    fDisp.setAttribute('scale', '3');
    fDisp.setAttribute('xChannelSelector', 'R');
    fDisp.setAttribute('yChannelSelector', 'G');

    fil.append(fTurb, fDisp);
    defs.appendChild(fil);
    svg.appendChild(defs);
    container.appendChild(svg);

    // ── Container for stamps ──────────────────────────────────────────────
    const stampsContainer = document.createElement('div');
    stampsContainer.style.position = 'absolute';
    stampsContainer.style.inset = '0';
    stampsContainer.style.pointerEvents = 'none'; // let clicks pass through to container
    container.appendChild(stampsContainer);

    // ── Ghost Cursor ──────────────────────────────────────────────────────
    const ghost = document.createElement('div');
    ghost.textContent = TEXT;
    ghost.style.position = 'fixed';
    ghost.style.left = '-1000px';
    ghost.style.top = '-1000px';
    ghost.style.transform = 'translate(-50%, -50%)';
    ghost.style.fontFamily = '"Stardos Stencil", cursive';
    ghost.style.fontSize = '3vw'; // Smaller than before
    ghost.style.fontWeight = '700';
    ghost.style.whiteSpace = 'nowrap';
    ghost.style.color = 'rgba(245, 245, 245, 0.3)';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0';
    ghost.style.transition = 'opacity 0.15s ease';
    
    // Default starting rotation and scale to look natural
    let currentGhostRotation = (Math.random() - 0.5) * 90; // -45 to +45 degrees
    let currentGhostScale = 0.5 + Math.random() * 1.5; // 0.5x to 2.0x scale
    
    container.appendChild(ghost);

    // ── Events ────────────────────────────────────────────────────────────
    let ghostVisible = false;

    const onMouseMove = (e: MouseEvent) => {
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      ghost.style.transform = `translate(-50%, -50%) rotate(${currentGhostRotation}deg) scale(${currentGhostScale})`;
    };

    const onMouseEnter = () => {
      ghostVisible = true;
      ghost.style.opacity = '1';
    };

    const onMouseLeave = () => {
      ghostVisible = false;
      ghost.style.opacity = '0';
    };

    const onClick = (e: MouseEvent) => {
      // Create stamp
      const stamp = document.createElement('div');
      stamp.textContent = TEXT;
      
      const opacity = 0.75 + Math.random() * 0.2;
      
      stamp.style.position = 'absolute';
      stamp.style.left = `${e.clientX}px`;
      stamp.style.top = `${e.clientY}px`;
      stamp.style.transform = `translate(-50%, -50%) rotate(${currentGhostRotation}deg) scale(${currentGhostScale})`;
      stamp.style.fontFamily = '"Stardos Stencil", cursive';
      stamp.style.fontSize = '3vw'; // Base size, adjusted by scale
      stamp.style.fontWeight = '700';
      stamp.style.whiteSpace = 'nowrap';
      stamp.style.color = INK;
      stamp.style.opacity = String(opacity);
      stamp.style.pointerEvents = 'none';
      stamp.style.filter = 'url(#graffiti-simple)';
      stamp.style.textShadow = '1px 1px 2px rgba(255,255,255,0.1)';
      stamp.style.mixBlendMode = 'screen';
      
      stampsContainer.appendChild(stamp);
      
      // Immediately pick a NEW random angle and scale for the next click (the ghost cursor)
      currentGhostRotation = (Math.random() - 0.5) * 90; // Aggressive angles
      currentGhostScale = 0.5 + Math.random() * 1.5; // Randomized sizes
      ghost.style.transform = `translate(-50%, -50%) rotate(${currentGhostRotation}deg) scale(${currentGhostScale})`;
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('click', onClick);

    // ── Thumbnail Mode ────────────────────────────────────────────────────
    // If loaded as a thumbnail iframe, auto-populate some stamps so it's not blank
    if (document.body.classList.contains('is-thumbnail')) {
      ghost.style.display = 'none'; // hide ghost in thumb
      for (let i = 0; i < 5; i++) {
        onClick({
          clientX: window.innerWidth * (0.2 + Math.random() * 0.6),
          clientY: window.innerHeight * (0.2 + Math.random() * 0.6),
        } as unknown as MouseEvent);
      }
    }

    // ── Font Loading ──────────────────────────────────────────────────────
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return (): void => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('click', onClick);
      document.body.style.background = '';
      container.innerHTML = '';
      link.remove();
      style.remove();
    };
  },
};

export default work;
