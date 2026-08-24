import * as THREE from 'three';
import {
  type BalloonState,
  BALLOON_WIDTH, BALLOON_HEIGHT,
  COLS, ROWS, SPACING_X, SPACING_Y, GRID_START_Y,
} from './balloons';
import type { Particle } from './particles';

// ── Public render state ────────────────────────────────────────────────────────

export interface RenderState {
  balloons:      BalloonState[];
  particles:     Particle[];
  mouseX:        number;
  mouseY:        number;
  aimX:          number;
  aimY:          number;
  boardCenterX:  number;
  boardCenterY:  number;
  score:         number;
  total:         number;
  gustActive:    boolean;
  gustDX:        number;
  gustIntensity: number;
  seaBreezeX:    number;
  shotWords:     string[];
  time:          number;
  zoomScale:     number;
  shotGustFlash: boolean;
  camOffsetX:    number;
  camOffsetY:    number;
}

const ZOOM_OUT_SCALE = 0.95;
const ZOOM_IN_SCALE = 1.85;

// ── Module-level scene state ───────────────────────────────────────────────────

let glRenderer: THREE.WebGLRenderer;
let scene:      THREE.Scene;
let camera:     THREE.PerspectiveCamera;
let cameraBaseZ = 1;
let hudCanvas:  HTMLCanvasElement;
let hud:        CanvasRenderingContext2D;
let raycaster:  THREE.Raycaster;
let seaUnifsRef: { uTime: { value: number } } | null = null;
let skyUnifsRef: { uTime: { value: number } } | null = null;
let groundUnifsRef: { uTime: { value: number } } | null = null;

interface BalloonSet {
  sprite: THREE.Sprite;
}
const balloonMap = new Map<number, BalloonSet>();

// ── Board dimensions (match balloon grid) ──────────────────────────────────────
const BW = (COLS - 1) * SPACING_X + (SPACING_X / 2) + BALLOON_WIDTH; // 779
const BH = (ROWS - 1) * SPACING_Y + BALLOON_HEIGHT; // 708
const FW = 15;

// ── Balloon geometry factory ───────────────────────────────────────────────────

// Sample a cubic bezier at n+1 evenly-spaced t values → [r, y] pairs
function sampleBezier(
  P0: [number,number], P1: [number,number],
  P2: [number,number], P3: [number,number],
  n: number,
): [number,number][] {
  const pts: [number,number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const it = 1 - t;
    const c0 = it * it * it;
    const c1 = 3 * it * it * t;
    const c2 = 3 * it * t * t;
    const c3 = t * t * t;
    pts.push([
      c0 * P0[0] + c1 * P1[0] + c2 * P2[0] + c3 * P3[0],
      c0 * P0[1] + c1 * P1[1] + c2 * P2[1] + c3 * P3[1],
    ]);
  }
  return pts;
}

let _balloonGeoTemplate: THREE.BufferGeometry | null = null;
function getBalloonGeoTemplate(): THREE.BufferGeometry {
  if (_balloonGeoTemplate) return _balloonGeoTemplate;
  const R  = BALLOON_WIDTH  / 2;   // 20
  const H  = BALLOON_HEIGHT / 2;   // 40
  const tH = H  * 0.96;            // top y  (+38.4)
  const bH = -tH;                  // knot y (-38.4)

  // These bezier control points reproduce the 2D renderer's balloon exactly,
  // transposed to 3D coords (y-up, r = x radius).
  //
  // Segment A: top → equator  (t=0 at top, t=1 at equator y=0)
  const segA = sampleBezier(
    [0,       tH      ],   // P0: top tip
    [R*1.02,  tH      ],   // P1: spread wide at top level
    [R,       H*0.10  ],   // P2: reach full radius near equator
    [R,       0       ],   // P3: equator (widest)
    12,
  );

  // Segment B: equator → knot  (t=0 at equator, t=1 at knot)
  const segB = sampleBezier(
    [R,       0       ],   // P0: equator
    [R,       -H*0.42 ],   // P1: taper down smoothly
    [R*0.14,  bH*0.82 ],   // P2: neck pinch
    [R*0.12,  bH      ],   // P3: base knot
    12,
  );

  const profile = [...segA.slice(0, -1), ...segB].map(([r, y]) => new THREE.Vector2(r, y));

  _balloonGeoTemplate = new THREE.LatheGeometry(profile, 36);
  return _balloonGeoTemplate;
}

function buildBalloon2D(word: string, hexColor: string, isBottomRow: boolean = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  // Extra padding to prevent clipping when the material rotates
  canvas.width = 320;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;
  
  const cx = canvas.width / 2;
  const cy = canvas.height / 2 - 20;
  const rx = 104;
  const ry = 132;

  // Draw knot for bottom row before the main body so it sits behind/below
  if (isBottomRow) {
    ctx.save();
    // Drop shadow for knot
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 8;
    
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + ry - 4);
    ctx.lineTo(cx + 12, cy + ry - 4);
    ctx.lineTo(cx + 20, cy + ry + 22);
    ctx.lineTo(cx - 20, cy + ry + 22);
    ctx.closePath();
    ctx.fillStyle = hexColor;
    ctx.fill();
    ctx.restore();

    // Small highlight on knot
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + ry);
    ctx.lineTo(cx + 8, cy + ry);
    ctx.lineTo(cx + 14, cy + ry + 18);
    ctx.lineTo(cx - 14, cy + ry + 18);
    ctx.closePath();
    const knotGrad = ctx.createLinearGradient(cx, cy + ry, cx, cy + ry + 20);
    knotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    knotGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = knotGrad;
    ctx.fill();
  }

  // Main Balloon Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 14;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = hexColor;
  ctx.fill();
  ctx.restore();
  
  // Base color (clip to bounds)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = hexColor;
  ctx.fill();

  // Soft highlight (top left)
  const grad = ctx.createRadialGradient(cx - 30, cy - 40, 10, cx - 10, cy - 10, 140);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Edge darkening for volume
  const edgeGrad = ctx.createRadialGradient(cx, cy, rx * 0.4, cx, cy, ry * 1.05);
  edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
  edgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = edgeGrad;
  ctx.fill();
  ctx.restore();

  // Draw Text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.font = '500 28px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Fake letter spacing
  const chars = word.split('');
  const spacing = 12;
  const totalW = ctx.measureText(word).width + (chars.length - 1) * spacing;
  let currentX = cx - totalW / 2;
  for (const char of chars) {
    const cw = ctx.measureText(char).width;
    ctx.fillText(char, currentX + cw / 2, cy + 2);
    currentX += cw + spacing;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Increase filtering quality
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 16;
  
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  
  // Scale to fit the 3D dimensions (width 76, height approx 100), accounting for the new padding
  sprite.scale.set(76 * (320/208), 100 * (420/264), 1);
  return sprite;
}

// ── Scene initialisation ───────────────────────────────────────────────────────

export function initRenderer(container: HTMLElement, w: number, h: number): void {
  // ── WebGL renderer ────────────────────────────────────────────────────────
  glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  glRenderer.setSize(w, h);
  glRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  glRenderer.shadowMap.enabled = true;
  glRenderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  glRenderer.toneMapping       = THREE.ACESFilmicToneMapping;
  glRenderer.toneMappingExposure = 1.18;
  glRenderer.outputColorSpace  = THREE.SRGBColorSpace;
  Object.assign(glRenderer.domElement.style, {
    position: 'absolute', top: '0', left: '0',
  });
  container.appendChild(glRenderer.domElement);

  // ── Camera ────────────────────────────────────────────────────────────────
  const FOV = 45;
  camera = new THREE.PerspectiveCamera(FOV, w / h, 1, 6000);
  
  const requiredVisibleHeight = BH;
  const requiredVisibleWidth  = BW;
  
  // Calculate Z required for height
  const zHeight = requiredVisibleHeight / (2 * Math.tan((FOV * Math.PI) / 360));
  // Calculate Z required for width
  const zWidth = requiredVisibleWidth / (2 * Math.tan((FOV * Math.PI) / 360) * (w / h));
  
  cameraBaseZ = Math.max(zHeight, zWidth);
  camera.position.set(0, 0, cameraBaseZ);
  camera.lookAt(0, 0, 0);

  // ── Scene & fog ──────────────────────────────────────────────────────────
  scene     = new THREE.Scene();
  raycaster = new THREE.Raycaster();
  scene.fog = new THREE.FogExp2(0xe8e4db, 0.000045);


  // ── Lighting ──────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0x9fb7c8, 0xb77a38, 0.62));

  const sun = new THREE.DirectionalLight(0xffb24a, 5.4);
  sun.position.set(520, 360, 620);
  sun.target.position.set(-90, -60, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.near = 50; sc.far = 3000;
  sc.left = sc.bottom = -840; sc.right = sc.top = 840;
  sun.shadow.radius = 5.0;
  sun.shadow.bias   = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  // Cool fill kept weak so the sunset key light can shape the forms.
  const fill = new THREE.DirectionalLight(0x6686a8, 0.42);
  fill.position.set(-420, 180, 260);
  scene.add(fill);

  // Warm back-rim (simulates sand-bounce behind camera)
  const rim = new THREE.DirectionalLight(0xff8a32, 0.38);
  rim.position.set(-80, -80, -520);
  scene.add(rim);




  // ── HUD canvas overlay (2D: crosshair, gauge, score, particles) ───────────
  hudCanvas = document.createElement('canvas');
  hudCanvas.width  = w;
  hudCanvas.height = h;
  Object.assign(hudCanvas.style, {
    position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
  });
  container.appendChild(hudCanvas);
  hud = hudCanvas.getContext('2d')!;
}

// ── Ensure balloon meshes exist (lazy, first render) ──────────────────────────

function ensureBalloons(balloons: BalloonState[]): void {
  for (const b of balloons) {
    if (balloonMap.has(b.id)) continue;

    // Use top color as the hex color for the 2D sprite
    const sprite = buildBalloon2D(b.word, b.colorTop, b.row === 0);
    const BZ = 14;
    sprite.position.set(b.x, -b.y, BZ);
    sprite.material.rotation = b.rotation;
    scene.add(sprite);

    balloonMap.set(b.id, { sprite });
  }
}

// ── Main render (called every frame) ─────────────────────────────────────────

export function render(
  _ctx: CanvasRenderingContext2D | null,
  width: number,
  height: number,
  state: RenderState,
): void {
  if (!glRenderer) return;

  // ── Camera zoom + pan toward aim point ────────────────────────────────────
  camera.position.set(state.camOffsetX, state.camOffsetY, cameraBaseZ / state.zoomScale);
  camera.lookAt(state.camOffsetX, state.camOffsetY, 0);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // ── Sync balloon visibility ────────────────────────────────────────────────
  ensureBalloons(state.balloons);
  for (const b of state.balloons) {
    const objs = balloonMap.get(b.id);
    if (!objs) continue;
    objs.sprite.visible = b.alive;
  }

  // ── Tick animated sea uniforms ────────────────────────────────────────────
  if (seaUnifsRef) seaUnifsRef.uTime.value = state.time * 0.001;
  if (skyUnifsRef) skyUnifsRef.uTime.value = state.time * 0.001;
  if (groundUnifsRef) groundUnifsRef.uTime.value = state.time * 0.001;

  // ── Render 3D scene ────────────────────────────────────────────────────────
  glRenderer.render(scene, camera);

  // ── HUD (2D canvas overlay) ────────────────────────────────────────────────
  hud.clearRect(0, 0, width, height);
  
  const windDX = state.aimX - state.mouseX;
  const windDY = state.aimY - state.mouseY;
  drawWindGlyphs(hud, width, height, state.time, windDX, windDY, state.gustIntensity);

  // Particles
  for (const p of state.particles) {
    const a = Math.max(0, 1 - p.life / p.maxLife);
    hud.globalAlpha = a;
    hud.fillStyle   = p.color;
    hud.beginPath();
    hud.arc(p.x, p.y, 4, 0, Math.PI * 2);
    hud.fill();
  }
  hud.globalAlpha = 1;

  drawCrosshair(hud, state.aimX, state.aimY, state.mouseX, state.mouseY, state.shotGustFlash);
  // drawWindGauge(hud, width, height, state.aimX - state.mouseX, state.aimY - state.mouseY, state.gustIntensity, state.gustActive);
}

// ── 3D raycaster hit detection ─────────────────────────────────────────────────

export function testHit3D(
  aimScreenX: number,
  aimScreenY: number,
  width: number,
  height: number,
  balloons: BalloonState[],
): BalloonState | null {
  if (!glRenderer) return null;
  const ndc = new THREE.Vector2(
    (aimScreenX / width)  *  2 - 1,
    (aimScreenY / height) * -2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);

  const targets: THREE.Object3D[] = [];
  for (const b of balloons) {
    if (!b.alive) continue;
    const objs = balloonMap.get(b.id);
    if (objs) targets.push(objs.sprite);
  }

  const hits = raycaster.intersectObjects(targets);
  if (!hits.length) return null;

  for (const hit of hits) {
    if (!hit.uv) continue;
    const hitMesh = hit.object;
    
    // UV coordinates: 0 to 1. Map to -0.5 to +0.5
    const u = hit.uv.x - 0.5;
    // Sprite UVs typically have v=1 at the top, v=0 at the bottom.
    // Our canvas cy is 190 (420/2 - 20). So from the top it's 190, from the bottom it's 230.
    // Thus the center of the ellipse in UV space is v = 230 / 420 = 0.547.
    const v = hit.uv.y - 0.547;
    
    // The ellipse rx is 104 in a 320 width canvas -> rx_uv = 104/320
    // The ellipse ry is 132 in a 420 height canvas -> ry_uv = 132/420
    const rx = 104 / 320;
    const ry = 132 / 420;
    
    // Check if the intersection is inside the actual balloon oval
    if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1.05) {
      for (const b of balloons) {
        const objs = balloonMap.get(b.id);
        if (objs?.sprite === hitMesh) return b;
      }
    }
  }
  
  return null;
}

// ── Project balloon world position → HUD screen coords ────────────────────────

export function projectBalloonToScreen(
  b: BalloonState,
  width: number,
  height: number,
): { x: number; y: number } {
  const v = new THREE.Vector3(b.x, -b.y, 0);
  v.project(camera);
  return {
    x: (v.x + 1) / 2 * width,
    y: (1 - v.y) / 2 * height,
  };
}

// ── Resize ─────────────────────────────────────────────────────────────────────

export function onResize(w: number, h: number): void {
  if (!glRenderer) return;
  glRenderer.setSize(w, h);
  camera.aspect = w / h;
  
  const requiredVisibleHeight = BH + 120;
  const requiredVisibleWidth  = BW + 120;
  const zHeight = requiredVisibleHeight / (2 * Math.tan((45 * Math.PI) / 360));
  const zWidth  = requiredVisibleWidth / (2 * Math.tan((45 * Math.PI) / 360) * (w / h));
  cameraBaseZ = Math.max(zHeight, zWidth);
  
  camera.updateProjectionMatrix();
  if (hudCanvas) { hudCanvas.width = w; hudCanvas.height = h; }
}

// ── HUD drawing functions (Canvas 2D) ─────────────────────────────────────────

function wrap(value: number, limit: number): number {
  return ((value % limit) + limit) % limit;
}

function hash01(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

function drawWindGlyphs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  windDX: number,
  windDY: number,
  gustIntensity: number,
): void {
  const strength = Math.min(1, Math.sqrt(windDX * windDX + windDY * windDY) / 240);
  if (strength < 0.035) return;

  const len = Math.max(1, Math.sqrt(windDX * windDX + windDY * windDY));
  const dirX = windDX / len;
  const dirY = windDY / len;
  const count = Math.round(8 + strength * 9 + gustIntensity * 5);
  const speed = 16 + strength * 58 + gustIntensity * 36;
  const margin = 160;
  const bandTop = h * 0.18;
  const bandH = h * 0.56;
  const perpX = -dirY;
  const perpY = dirX;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const sx = hash01(i * 2 + 0.31);
    const sy = hash01(i * 2 + 1.79);
    const side = sx < 0.5 ? 0 : 1;
    const sideT = side === 0 ? sx * 2 : (sx - 0.5) * 2;
    const sideW = Math.max(120, w * 0.23);
    const baseX = side === 0
      ? -margin + sideT * (sideW + margin)
      : w - sideW + sideT * (sideW + margin);
    const drift = time * 0.001 * speed * (0.78 + hash01(i * 5 + 0.9) * 0.45);
    const x = side === 0
      ? -margin + wrap(baseX + dirX * drift + margin, sideW + margin)
      : w - sideW + wrap(baseX + dirX * drift - (w - sideW), sideW + margin);
    const y = bandTop + sy * bandH + dirY * drift * 0.12 + Math.sin(time * 0.001 + i) * 3;
    const glyphLen = 42 + strength * 46 + gustIntensity * 30 + hash01(i * 7 + 0.4) * 24;
    const curve = (hash01(i * 11 + 0.2) - 0.5) * (22 + strength * 18);
    const alpha = 0.09 + strength * 0.18 + gustIntensity * 0.16;
    const width = 1.6 + strength * 1.15 + gustIntensity * 0.85;

    ctx.strokeStyle = `rgba(125,205,238,${alpha})`;
    ctx.lineWidth = width;
    for (let j = 0; j < 3; j++) {
      const offset = (j - 1) * (8 + strength * 5);
      const tailX = x - dirX * glyphLen + perpX * offset;
      const tailY = y - dirY * glyphLen + perpY * offset;
      const midX = x - dirX * glyphLen * 0.52 + perpX * (curve + offset * 0.72);
      const midY = y - dirY * glyphLen * 0.52 + perpY * (curve + offset * 0.72);
      const tipX = x + perpX * offset * 0.35;
      const tipY = y + perpY * offset * 0.35;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vg = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.22, w / 2, h * 0.46, h * 0.68);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawFocusVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoomScale: number,
  aimX: number,
  aimY: number,
): void {
  const z = Math.max(0, Math.min(1, (zoomScale - ZOOM_OUT_SCALE) / (ZOOM_IN_SCALE - ZOOM_OUT_SCALE)));
  if (z < 0.04) return;

  const ease = z * z * (3 - 2 * z);
  ctx.save();

  const outer = Math.max(w, h) * 0.78;
  const inner = Math.min(w, h) * (0.20 - ease * 0.035);
  const grad = ctx.createRadialGradient(aimX, aimY, inner, aimX, aimY, outer);
  grad.addColorStop(0.00, 'rgba(0,0,0,0)');
  grad.addColorStop(0.42, `rgba(0,0,0,${0.12 * ease})`);
  grad.addColorStop(0.74, `rgba(0,0,0,${0.58 * ease})`);
  grad.addColorStop(1.00, `rgba(0,0,0,${0.90 * ease})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = ease;
  ctx.strokeStyle = 'rgba(8,8,8,0.82)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(aimX, aimY, inner * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,195,105,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(aimX, aimY, inner * 0.82 + 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  aimX: number, aimY: number,
  mouseX: number, mouseY: number,
  shotGustFlash: boolean,
): void {
  const sz  = 18;
  const gap = 5;
  const col = shotGustFlash ? 'rgba(255,80,60,0.95)' : 'rgba(235,195,110,0.90)';
  ctx.strokeStyle = col;
  ctx.lineWidth   = shotGustFlash ? 2.0 : 1.5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(aimX - sz, aimY); ctx.lineTo(aimX - gap, aimY);
  ctx.moveTo(aimX + gap, aimY); ctx.lineTo(aimX + sz, aimY);
  ctx.moveTo(aimX, aimY - sz); ctx.lineTo(aimX, aimY - gap);
  ctx.moveTo(aimX, aimY + gap); ctx.lineTo(aimX, aimY + sz);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(aimX, aimY, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawWindGauge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  windDX: number,
  windDY: number,
  gustIntensity: number,
  gustActive: boolean,
): void {
  const cx = 84;
  const cy = height - 100;
  const R  = 38;

  const dist     = Math.sqrt(windDX * windDX + windDY * windDY);
  const strength = Math.min(1, dist / 240);
  const angle    = Math.atan2(windDY, windDX);

  const arcAlpha = 0.88;
  const arcColor = strength < 0.25
    ? `rgba(60,200,100,${arcAlpha})`
    : strength < 0.55
      ? `rgba(240,175,35,${arcAlpha})`
      : `rgba(225,55,35,${arcAlpha})`;

  ctx.save();

  ctx.fillStyle = '#1c0e03';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 13, 0, Math.PI * 2);
  ctx.fill();

  const rimGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rimGrad.addColorStop(0,   '#c07830');
  rimGrad.addColorStop(0.45,'#7a4810');
  rimGrad.addColorStop(1,   '#3a1c06');
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth   = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,220,120,0.28)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 13, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();

  for (const ra of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const rx = cx + Math.cos(ra) * (R + 10);
    const ry = cy + Math.sin(ra) * (R + 10);
    ctx.fillStyle = '#5a3c08';
    ctx.beginPath(); ctx.arc(rx, ry, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,80,0.52)';
    ctx.beginPath(); ctx.arc(rx - 1.2, ry - 1.2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx - 3, ry); ctx.lineTo(rx + 3, ry);
    ctx.moveTo(rx, ry - 3); ctx.lineTo(rx, ry + 3);
    ctx.stroke();
  }

  const faceGrad = ctx.createRadialGradient(cx - 8, cy - 8, 0, cx, cy, R);
  faceGrad.addColorStop(0, 'rgba(28,42,26,0.97)');
  faceGrad.addColorStop(1, 'rgba(8,12,8,0.99)');
  ctx.fillStyle = faceGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  if (strength > 0.02) {
    ctx.strokeStyle = arcColor;
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'butt';
    ctx.beginPath();
    ctx.arc(cx, cy, R - 7, -Math.PI / 2, -Math.PI / 2 + strength * Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 8; i++) {
    const a      = (i / 8) * Math.PI * 2;
    const isMaj  = i % 2 === 0;
    ctx.strokeStyle = `rgba(160,130,60,${isMaj ? 0.70 : 0.38})`;
    ctx.lineWidth   = isMaj ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - (isMaj ? 12 : 16)), cy + Math.sin(a) * (R - (isMaj ? 12 : 16)));
    ctx.lineTo(cx + Math.cos(a) * (R - 4),                  cy + Math.sin(a) * (R - 4));
    ctx.stroke();
  }

  if (dist > 8) {
    const nFront = R - 13;
    const nx = cx + Math.cos(angle) * nFront;
    const ny = cy + Math.sin(angle) * nFront;
    const bx2 = cx - Math.cos(angle) * 10;
    const by2 = cy - Math.sin(angle) * 10;
    if (gustActive && gustIntensity > 0.15) {
      ctx.shadowColor = arcColor; ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = arcColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx2, by2); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nx, ny); ctx.lineTo(nx - 9 * Math.cos(angle - 0.48), ny - 9 * Math.sin(angle - 0.48));
    ctx.moveTo(nx, ny); ctx.lineTo(nx - 9 * Math.cos(angle + 0.48), ny - 9 * Math.sin(angle + 0.48));
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }

  ctx.fillStyle = 'rgba(180,145,60,0.70)';
  ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(195,160,70,0.82)';
  ctx.font      = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', cx, cy + R + 24);

  ctx.restore();
}
