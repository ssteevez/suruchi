import { initDisturbance, updateDisturbance } from './disturbance';
import { initBalloons } from './balloons';
import { spawnBurst, updateParticles } from './particles';
import type { Particle } from './particles';
import { initRenderer, render, testHit3D, onResize, projectBalloonToScreen } from './renderer';
import { playPopSound } from './audio';

const container = document.getElementById('game-container') as HTMLDivElement;

let width  = container.clientWidth;
let height = container.clientHeight;

// ── Zoom state ────────────────────────────────────────────────────────────────
const ZOOM_OUT = 0.95;
const ZOOM_IN  = 1.85;
let zoomed      = false;
let currentZoom = ZOOM_OUT;
let zoomTargetWorldX = 0;
let zoomTargetWorldY = 0;

let camOffsetX = 0;
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
  width  = container.clientWidth;
  height = container.clientHeight;
  onResize(width, height);
});

container.addEventListener('mousemove', (e) => {
  const rect = container.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

container.addEventListener('touchmove', (e) => {
  const rect = container.getBoundingClientRect();
  mouseX = e.touches[0].clientX - rect.left;
  mouseY = e.touches[0].clientY - rect.top;
}, { passive: true });

container.addEventListener('click', fire);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); fire(); }
});

container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  zoomed = !zoomed;
  if (zoomed) {
    zoomTargetWorldX = Math.max(-420, Math.min(420, camOffsetX + (mouseX - width  / 2) / currentZoom));
    zoomTargetWorldY = Math.max(-620, Math.min(50,  camOffsetY - (mouseY - height / 2) / currentZoom));
  }
});

// ── Fire ──────────────────────────────────────────────────────────────────────

const SHOT_GUST_CHANCE = 0.62;

let shotsFired = 0;
const balloonsCountEl = document.getElementById('balloons-count');
const shotsCountEl = document.getElementById('shots-count');
const resultSentenceEl = document.getElementById('result-sentence');
const shotWordsListEl = document.getElementById('shot-words-list');
const cbIam = document.getElementById('cb-iam') as HTMLInputElement;
const cbHappy = document.getElementById('cb-happy') as HTMLInputElement;
const cbNot = document.getElementById('cb-not') as HTMLInputElement;
const cbUnhappy = document.getElementById('cb-unhappy') as HTMLInputElement;

function updateSentence() {
  const parts = [];
  if (cbIam && cbIam.checked) parts.push('I AM');
  if (cbNot && cbNot.checked) parts.push('NOT');
  if (cbHappy && cbHappy.checked) parts.push('HAPPY');
  if (cbUnhappy && cbUnhappy.checked) parts.push('UNHAPPY');
  
  if (resultSentenceEl) {
    resultSentenceEl.textContent = parts.join(' ');
  }
}

if (cbIam) cbIam.addEventListener('change', updateSentence);
if (cbHappy) cbHappy.addEventListener('change', updateSentence);
if (cbNot) cbNot.addEventListener('change', updateSentence);
if (cbUnhappy) cbUnhappy.addEventListener('change', updateSentence);

function updateStats() {
  const aliveBalloons = balloons.filter(b => b.alive);
  
  if (balloonsCountEl) {
    balloonsCountEl.textContent = aliveBalloons.length.toString().padStart(2, '0');
  }
  if (shotsCountEl) {
    shotsCountEl.textContent = shotsFired.toString().padStart(2, '0');
  }

  // Update checkboxes based on what survives on the wall
  const survivingWords = new Set(aliveBalloons.map(b => b.word));
  
  const hasIam = survivingWords.has('I') || survivingWords.has('AM');
  const hasHappy = survivingWords.has('HAPPY');
  const hasNot = survivingWords.has('NOT');
  const hasUnhappy = survivingWords.has('UNHAPPY');

  if (cbIam) {
    if (!hasIam) cbIam.checked = false;
    cbIam.disabled = !hasIam;
  }
  if (cbHappy) {
    if (!hasHappy) cbHappy.checked = false;
    cbHappy.disabled = !hasHappy;
  }
  if (cbNot) {
    if (!hasNot) cbNot.checked = false;
    cbNot.disabled = !hasNot;
  }
  if (cbUnhappy) {
    if (!hasUnhappy) cbUnhappy.checked = false;
    cbUnhappy.disabled = !hasUnhappy;
  }
  
  if (shotWordsListEl) {
    shotWordsListEl.textContent = shotWords.join(' — ');
  }

  updateSentence();
}

function fire(): void {
  shotsFired++;
  
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
    shotWords.push(hit.word);
    
    // Project balloon's 3D world position to HUD screen coords for particles
    const sp = projectBalloonToScreen(hit, width, height);
    particles.push(...spawnBurst(sp.x, sp.y, hit.colorTop, hit.colorBottom));
    playPopSound();
  }
  
  updateStats();
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop(now: number): void {
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;

  // Zoom lerp
  const zoomTarget = zoomed ? ZOOM_IN : ZOOM_OUT;
  currentZoom += (zoomTarget - currentZoom) * 0.12;

  camOffsetX = 0;
  camOffsetY = 0;

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
updateStats();
