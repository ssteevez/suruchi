import { initCarousel } from './carousel.js';
import { initGradientBackground } from './gradientBackground.js';



// ── Systems ──
const carousel = initCarousel();
const gradBg = initGradientBackground();

// ── RAF loop ──
let lastTime = performance.now();

function tick(): void {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  carousel.update(dt);
  gradBg.update(carousel.state.activeColor, carousel.state.nextColor, dt);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

window.addEventListener('beforeunload', () => {
  carousel.dispose();
});
