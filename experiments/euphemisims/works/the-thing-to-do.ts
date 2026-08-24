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
    stampsContainer.style.pointerEvents = 'none';
    container.appendChild(stampsContainer);

    let active = true;
    let spawnTimeout: number | null = null;

    const spawn = () => {
      if (!active) return;
      const stamp = document.createElement('div');
      stamp.textContent = TEXT;
      
      // Keep rotation subtle so it doesn't clip top/bottom on narrow screens
      const rot = (Math.random() - 0.5) * 30; 
      // Constrain scale and center placement so it doesn't bleed off edges
      const scale = 0.6 + Math.random() * 0.7; 
      const x = window.innerWidth * (0.3 + Math.random() * 0.4); 
      const y = window.innerHeight * (0.3 + Math.random() * 0.4); 
      const maxOpacity = 0.75 + Math.random() * 0.2;
      
      stamp.style.position = 'absolute';
      stamp.style.left = `${x}px`;
      stamp.style.top = `${y}px`;
      stamp.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
      stamp.style.fontFamily = '"Stardos Stencil", cursive';
      stamp.style.fontSize = 'clamp(14px, 3.5vw, 48px)';
      stamp.style.fontWeight = '700';
      stamp.style.textAlign = 'center';
      stamp.style.maxWidth = '90vw';
      stamp.style.whiteSpace = 'normal'; // Allow wrapping on very narrow mobile screens
      stamp.style.color = INK;
      stamp.style.opacity = '0';
      stamp.style.pointerEvents = 'none';
      stamp.style.filter = 'url(#graffiti-simple)';
      stamp.style.textShadow = '1px 1px 2px rgba(255,255,255,0.1)';
      stamp.style.mixBlendMode = 'screen';
      stamp.style.transition = 'opacity 1s ease-in-out';
      
      stampsContainer.appendChild(stamp);
      
      requestAnimationFrame(() => {
        if (!active) return;
        stamp.style.opacity = String(maxOpacity);
      });
      
      setTimeout(() => {
        if (!active) return;
        stamp.style.transition = 'opacity 2s ease-in-out';
        stamp.style.opacity = '0';
        
        spawnTimeout = window.setTimeout(spawn, 0);
        
        setTimeout(() => {
          if (stamp.parentNode) stamp.remove();
        }, 2000);
      }, 3000);
    };

    // Kick it off
    spawn();

    // ── Font Loading ──────────────────────────────────────────────────────
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return (): void => {
      active = false;
      if (spawnTimeout) clearTimeout(spawnTimeout);
      document.body.style.background = '';
      container.innerHTML = '';
      link.remove();
      style.remove();
    };
  },
};

export default work;
