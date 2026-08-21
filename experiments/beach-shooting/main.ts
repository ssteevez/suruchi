import { initDisturbance, updateDisturbance } from './disturbance';
import { initBalloons } from './balloons';
import { spawnBurst, updateParticles } from './particles';
import type { Particle } from './particles';
import { initRenderer, render, testHit3D, onResize, projectBalloonToScreen } from './renderer';
import { playPopSound } from './audio';

const container = document.getElementById('game-container') as HTMLDivElement;

let width  = window.innerWidth;
let height = window.innerHeight;

// ── Zoom state ────────────────────────────────────────────────────────────────
const ZOOM_OUT = 0.95;
const ZOOM_IN  = 1.85;
let zoomed      = false;
let currentZoom = ZOOM_OUT;
let zoomTargetWorldX = 0;
let zoomTargetWorldY = 0;

const requiredVisibleHeightInit = Math.max(window.innerHeight, 844 + 320);
const visibleWidthInit = requiredVisibleHeightInit * (window.innerWidth / window.innerHeight);
let camOffsetX = -visibleWidthInit * 0.10;
let camOffsetY = 0;

// ── Board fractions (kept for reference; 3D uses world origin) ────────────────
const BOARD_CX_FRAC = 0.70;
const BOARD_CY_FRAC = 0.43;

let mouseX = width  / 2;
let mouseY = height / 2;
let aimX   = mouseX;
let aimY   = mouseY;

const balloons   = initBalloons();
let particles: Particle[] = [];
const disturbance = initDisturbance(performance.now());
let score    = 0;
const total  = balloons.length;
let lastTime = performance.now();
let shotWords: string[] = [];

let shotGustFlashUntil = 0;

// ── Init 3D scene ─────────────────────────────────────────────────────────────
initRenderer(container, width, height);

// ── Input ─────────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  width  = window.innerWidth;
  height = window.innerHeight;
  onResize(width, height);
});

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) { mouseX = t.clientX; mouseY = t.clientY; }
}, { passive: true });

window.addEventListener('click', fire);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); fire(); }
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  zoomed = !zoomed;
  if (zoomed) {
    // Capture the world point under cursor from the current camera transform.
    zoomTargetWorldX = Math.max(-420, Math.min(420, camOffsetX + (mouseX - width  / 2) / currentZoom));
    zoomTargetWorldY = Math.max(-340, Math.min(340, camOffsetY - (mouseY - height / 2) / currentZoom));
  }
});

// ── Fire ──────────────────────────────────────────────────────────────────────

const SHOT_GUST_CHANCE = 0.62;

function fire(): void {
  let fx = aimX;
  let fy = aimY;

  if (Math.random() < SHOT_GUST_CHANCE) {
    const dir = Math.random() > 0.5 ? 1 : -1;
    fx += dir * (75 + Math.random() * 80);
    fy += (Math.random() - 0.5) * 35;
    shotGustFlashUntil = performance.now() + 320;
  }

  const hit = testHit3D(fx, fy, width, height, balloons);
  if (hit) {
    hit.alive = false;
    score++;
    if (shotWords.length >= 7) shotWords = [];
    shotWords.push(hit.word);

    if (shotWords.length === 7) {
      setTimeout(() => {
        if (shotWords.length === 7) shotWords = [];
      }, 2000);
    }

    // Project balloon's 3D world position to HUD screen coords for particles
    const sp = projectBalloonToScreen(hit, width, height);
    particles.push(...spawnBurst(sp.x, sp.y, hit.colorTop, hit.colorBottom));
    playPopSound();
  }
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop(now: number): void {
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;

  // Zoom lerp + camera pan toward aim point
  const zoomTarget = zoomed ? ZOOM_IN : ZOOM_OUT;
  currentZoom += (zoomTarget - currentZoom) * 0.12;
  const requiredVisibleHeight = Math.max(height, 844 + 320);
  const visibleWidth = requiredVisibleHeight * (width / height);
  const defaultCamOffsetX = -visibleWidth * 0.10;

  const desiredCamOffsetX = zoomed ? zoomTargetWorldX : defaultCamOffsetX;
  const desiredCamOffsetY = zoomed ? zoomTargetWorldY : 0;
  camOffsetX += (desiredCamOffsetX - camOffsetX) * 0.12;
  camOffsetY += (desiredCamOffsetY - camOffsetY) * 0.12;

  const bx = width  * BOARD_CX_FRAC;
  const by = height * BOARD_CY_FRAC;

  const dist = updateDisturbance(disturbance, dt, now);
  aimX = mouseX + dist.dx;
  aimY = mouseY + dist.dy;

  updateParticles(particles, dt);

  render(null, width, height, {
    balloons,
    particles,
    mouseX,
    mouseY,
    aimX,
    aimY,
    boardCenterX:  bx,
    boardCenterY:  by,
    score,
    total,
    gustActive:    dist.gustActive,
    gustDX:        dist.gustDX,
    gustIntensity: dist.gustIntensity,
    seaBreezeX:    dist.seaBreezeX,
    shotWords,
    time:          now,
    zoomScale:     currentZoom,
    shotGustFlash: now < shotGustFlashUntil,
    camOffsetX,
    camOffsetY,
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
