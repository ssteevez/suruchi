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
  body: THREE.Mesh;
  knot: THREE.Mesh;
  wordLabel: THREE.Sprite;
  stub: THREE.Mesh;
}
const balloonMap = new Map<number, BalloonSet>();

// ── Board dimensions (match balloon grid) ──────────────────────────────────────
const BW = (COLS - 1) * SPACING_X + BALLOON_WIDTH  + 82;
const BH = (ROWS - 1) * SPACING_Y + BALLOON_HEIGHT + 62;
const FW = 15;

// ── Balloon geometry factory ───────────────────────────────────────────────────

// Sample a cubic bezier at n+1 evenly-spaced t values → [r, y] pairs
function sampleBezier(
  P0: [number,number], P1: [number,number],
  P2: [number,number], P3: [number,number],
  n: number,
): [number,number][] {
  const out: [number,number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u*u*u*P0[0] + 3*u*u*t*P1[0] + 3*u*t*t*P2[0] + t*t*t*P3[0],
      u*u*u*P0[1] + 3*u*u*t*P1[1] + 3*u*t*t*P2[1] + t*t*t*P3[1],
    ]);
  }
  return out;
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
    [R,       0           ],   // P0: equator
    [R,       -H*0.22     ],   // P1: hold width just below equator
    [R*0.28,  bH + H*0.06 ],   // P2: taper aggressively
    [0,       bH          ],   // P3: knot tip
    12,
  );

  // Build profile from knot (bottom) → top for LatheGeometry:
  // reversed segB (knot→equator) + reversed segA minus the duplicate equator (equator→top)
  const profile: THREE.Vector2[] = [];
  for (let i = segB.length - 1; i >= 0; i--) {
    profile.push(new THREE.Vector2(Math.max(0, segB[i]![0]), segB[i]![1]));
  }
  for (let i = segA.length - 2; i >= 0; i--) {   // -2 to skip equator duplicate
    profile.push(new THREE.Vector2(Math.max(0, segA[i]![0]), segA[i]![1]));
  }

  _balloonGeoTemplate = new THREE.LatheGeometry(profile, 36);
  return _balloonGeoTemplate;
}

function buildBalloonMesh(colorTop: string, colorBottom: string): THREE.Mesh {
  const geo  = getBalloonGeoTemplate().clone();
  const cTop = new THREE.Color(colorTop);
  const cBot = new THREE.Color(colorBottom);
  const pos  = geo.attributes['position']!;
  const arr  = new Float32Array(pos.count * 3);
  const H    = BALLOON_HEIGHT / 2;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, y / H * 0.5 + 0.5));
    const c = cBot.clone().lerp(cTop, t);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  // Saturate vertex colors — boost chroma before storing
  const saturated = new Float32Array(arr.length);
  for (let i = 0; i < pos.count; i++) {
    const r = arr[i*3], g = arr[i*3+1], b = arr[i*3+2];
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    const boost = 1.45;
    saturated[i*3]   = Math.min(1, lum + (r - lum) * boost);
    saturated[i*3+1] = Math.min(1, lum + (g - lum) * boost);
    saturated[i*3+2] = Math.min(1, lum + (b - lum) * boost);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(saturated, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness:    0.62,
    metalness:    0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// ── Helper: add a shadow-casting box ─────────────────────────────────────────

function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

function buildWordLabel(word: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,244,220,0.95)';
  ctx.fillRect(10, 10, 236, 76);
  ctx.strokeStyle = 'rgba(80,35,15,0.40)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 76);
  ctx.fillStyle = 'rgba(35,18,8,0.95)';
  ctx.font = word.length > 5 ? 'bold 44px monospace' : 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, 128, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  }));
  label.scale.set(70, 28, 1);
  return label;
}

// ── Scene initialisation ───────────────────────────────────────────────────────

export function initRenderer(container: HTMLElement, w: number, h: number): void {
  // ── WebGL renderer ────────────────────────────────────────────────────────
  glRenderer = new THREE.WebGLRenderer({ antialias: true });
  glRenderer.setSize(w, h);
  glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const requiredVisibleHeight = Math.max(h, BH + 320); // generous vertical padding
  cameraBaseZ = requiredVisibleHeight / (2 * Math.tan((FOV * Math.PI) / 360));
  camera.position.set(0, 0, cameraBaseZ);
  camera.lookAt(0, 0, 0);

  // ── Scene & fog ──────────────────────────────────────────────────────────
  scene     = new THREE.Scene();
  raycaster = new THREE.Raycaster();
  scene.fog = new THREE.FogExp2(0xd4894a, 0.000045);

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

  // ── Sky (gradient shader plane, no depth write) ────────────────────────────
  const skyUniforms = { uTime: { value: 0 } };
  skyUnifsRef = skyUniforms;
  const skyMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 4500),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv;

        float cloudWave(vec2 p) {
          float n = 0.0;
          n += sin(p.x * 2.10 + sin(p.y * 1.70) * 0.80) * 0.34;
          n += sin(p.y * 3.20 + sin(p.x * 2.40) * 0.70) * 0.25;
          n += sin((p.x + p.y) * 4.70 + sin(p.x * 1.30) * 1.10) * 0.18;
          n += sin((p.x * 0.80 - p.y * 1.70) * 7.10) * 0.10;
          return n;
        }

        float clouds(vec2 uv) {
          vec2 p = uv * vec2(6.6, 3.7);
          p.x -= uTime * 0.018;
          vec2 warp = vec2(
            cloudWave(p * 0.70 + 2.1),
            cloudWave(p * 0.58 - 1.4)
          );
          p += warp * 0.42;
          float n = cloudWave(p);
          n += cloudWave(p * 1.85 + 4.0) * 0.56;
          n += cloudWave(p * 3.30 - 2.0) * 0.30;
          n += cloudWave(p * 5.10 + 7.5) * 0.13;
          return n;
        }

        void main(){
          vec3 c = mix(vec3(.784,.541,.188), vec3(.478,.345,.188), smoothstep(.0,.28,vUv.y));
          c = mix(c, vec3(.165,.333,.467), smoothstep(.22,.58,vUv.y));
          c = mix(c, vec3(.051,.118,.188), smoothstep(.55,.95,vUv.y));
          // sun glow — warm disc upper-right
          float g = exp(-length(vUv - vec2(.76,.44)) * 6.5) * .45;
          c += vec3(1.,.78,.35) * g;
          // sea strip at the horizon — thin aquamarine band
          float seaMask = smoothstep(.16,.22,vUv.y) * (1.0 - smoothstep(.22,.30,vUv.y));
          vec3 seaCol   = vec3(.18,.45,.62);
          c = mix(c, seaCol, seaMask * 0.65);
          // horizon shimmer where sky meets sea
          float shimmer = smoothstep(.19,.21,vUv.y) * (1.0 - smoothstep(.21,.23,vUv.y));
          c = mix(c, vec3(.85,.92,.95), shimmer * 0.55);
          float upperSky = smoothstep(.30,.46,vUv.y);
          float n = clouds(vUv);
          float cloudMask = smoothstep(.24,.58,n) * upperSky * (1.0 - smoothstep(.95,1.0,vUv.y));
          float cloudSoft = smoothstep(.06,.42,n) * upperSky * 0.46;
          vec3 cloudCol = mix(vec3(.94,.88,.76), vec3(1.0,.96,.86), vUv.y);
          c = mix(c, cloudCol, clamp(cloudMask * 0.78 + cloudSoft * 0.34, 0.0, 0.74));
          gl_FragColor = vec4(c, 1.);
        }
      `,
    }),
  );
  skyMesh.position.z = -800;
  skyMesh.renderOrder = -2;
  scene.add(skyMesh);

  // ── Sandy ground (procedural ripples + wet shoreline) ─────────────────────
  const groundUniforms = { uTime: { value: 0 } };
  groundUnifsRef = groundUniforms;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 4000),
    new THREE.ShaderMaterial({
      uniforms: groundUniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vec3 dry = vec3(0.64, 0.39, 0.12);
          vec3 wet = vec3(0.45, 0.31, 0.18);
          float shoreDepth = -vWorldPos.z;
          float damp = smoothstep(155.0, 230.0, shoreDepth) * (1.0 - smoothstep(305.0, 430.0, shoreDepth));
          float broadBand = smoothstep(0.12, 0.90, vUv.y);
          float slowShift = sin(vWorldPos.x * 0.004 + uTime * 0.12) * 0.018;
          vec3 col = mix(dry, vec3(0.72, 0.47, 0.17), broadBand * 0.22);
          col = mix(col, wet, damp * 0.62);
          col += vec3(slowShift);
          col = mix(col, vec3(0.38, 0.40, 0.34), damp * 0.14);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -requiredVisibleHeight * 0.38;
  scene.add(ground);

  // ── Ocean — animated multi-scale wave shader ──────────────────────────────
  // Centered at z=-1100 so it spans z=-200 to z=-2000 (behind board at z=0)
  // After rotation.x=-PI/2: local.y=+900 → world.z=-2000 (far), local.y=-900 → world.z=-200 (near)
  const seaY = ground.position.y + 2;
  const seaUniforms = { uTime: { value: 0 } };
  seaUnifsRef = seaUniforms;
  const seaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 1800, 128, 48),
    new THREE.ShaderMaterial({
      uniforms: seaUniforms,
      vertexShader: /* glsl */`
        uniform float uTime;
        varying vec2  vPos;
        varying float vH;
        varying vec3  vNorm;

        float wv(vec2 p, float t) {
          return sin(p.y*0.008-t*0.16)*1.1
               + sin(p.y*0.013-t*0.22+p.x*0.001)*0.6;
        }

        void main() {
          vPos      = position.xy;
          float hv  = wv(vPos, uTime);
          vH        = hv;
          float e   = 4.0;
          float dx  = (wv(vPos+vec2(e,0.),uTime)-wv(vPos-vec2(e,0.),uTime))/(2.*e);
          float dy  = (wv(vPos+vec2(0.,e),uTime)-wv(vPos-vec2(0.,e),uTime))/(2.*e);
          // World-space normal after rotation.x=-PI/2: localNorm(-dx,-dy,1)→world(-dx,1,dy)
          vNorm     = normalize(vec3(-dx, 1.0, dy));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position+vec3(0.,0.,hv), 1.);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2  vPos;
        varying float vH;
        varying vec3  vNorm;

        void main() {
          vec3 nearSea = vec3(0.025, 0.265, 0.360);
          vec3 midSea  = vec3(0.030, 0.205, 0.335);
          vec3 farSea  = vec3(0.035, 0.115, 0.255);
          float farMix = clamp((vPos.y + 900.0) / 1800.0, 0.0, 1.0);
          vec3 col = mix(nearSea, midSea, smoothstep(0.0, 0.52, farMix));
          col = mix(col, farSea, smoothstep(0.48, 1.0, farMix));

          float longSwell = sin(vPos.y * 0.020 - uTime * 0.22 + sin(vPos.x * 0.0018) * 0.25);
          float secondary = sin(vPos.y * 0.036 - uTime * 0.15 + vPos.x * 0.0012);
          float waveTone = longSwell * 0.5 + secondary * 0.22;
          col += vec3(0.025, 0.055, 0.060) * waveTone;

          float horizonLight = smoothstep(0.50, 1.0, farMix);
          col = mix(col, vec3(0.24, 0.43, 0.54), horizonLight * 0.22);

          float continuousHighlight = smoothstep(0.62, 0.92, 0.5 + 0.5 * longSwell);
          col = mix(col, vec3(0.08, 0.36, 0.43), continuousHighlight * 0.055);

          float distFog = clamp((vPos.y+200.0)/1600.0, 0.0, 0.65);
          col = mix(col, vec3(0.35,0.55,0.72), distFog*0.55);

          gl_FragColor  = vec4(col, 1.0);
        }
      `,
    }),
  );
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(0, seaY, -1100);
  scene.add(seaMesh);

  // Animated foam line where sea meets sand
  const foamMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 80, 64, 1),
    new THREE.ShaderMaterial({
      uniforms: seaUniforms,   // reuse same uTime
      transparent: true,
      depthWrite:  false,
      vertexShader: /* glsl */`
        varying vec2 vFP;
        void main() { vFP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vFP;
        void main() {
          float n = 0.72 + sin(vFP.x*0.010+uTime*0.22)*0.08;
          // vFP.y: -40=near shore, +40=into sea → fade toward sea
          float fade = clamp(1.0-(vFP.y+40.0)/80.0, 0.0, 1.0);
          gl_FragColor = vec4(0.82, 0.92, 0.94, n*fade*0.42);
        }
      `,
    }),
  );
  foamMesh.rotation.x = -Math.PI / 2;
  foamMesh.position.set(0, seaY + 1, -200);
  scene.add(foamMesh);

  // ── Materials ─────────────────────────────────────────────────────────────
  const woodMat  = new THREE.MeshStandardMaterial({ color: 0x4a2c0e, roughness: 0.88 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xc07030, roughness: 0.60, metalness: 0.12 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x172718, roughness: 0.96, metalness: 0.02 });
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x5a3c08, roughness: 0.50, metalness: 0.35 });

  // ── Board face ────────────────────────────────────────────────────────────
  box(BW, BH, 20, boardMat, 0, 0, 0);

  // Frame strips (4 edges)
  box(BW, FW, 26, frameMat,  0,           BH / 2 - FW / 2,  0);
  box(BW, FW, 26, frameMat,  0,          -BH / 2 + FW / 2,  0);
  box(FW, BH, 26, frameMat, -BW / 2 + FW / 2, 0,            0);
  box(FW, BH, 26, frameMat,  BW / 2 - FW / 2, 0,            0);

  // Corner rivets
  for (const rx of [-BW / 2 + FW / 2, BW / 2 - FW / 2]) {
    for (const ry of [-BH / 2 + FW / 2, BH / 2 - FW / 2]) {
      const rv = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 12), rivetMat);
      rv.rotation.x = Math.PI / 2;
      rv.position.set(rx, ry, 17);
      rv.castShadow = true;
      scene.add(rv);
      // Highlight pip
      const pip = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd060, roughness: 0.3, metalness: 0.6 }),
      );
      pip.rotation.x = Math.PI / 2;
      pip.position.set(rx - 1.5, ry - 1.5, 18);
      scene.add(pip);
    }
  }

  // Wooden posts (left & right)
  const postH = BH + 260;
  for (const px of [-BW / 2 - 44, BW / 2 + 44]) {
    box(28, postH, 30, woodMat, px, 0, -10);
  }

  // Horizontal beam
  box(BW + 140, 18, 30, woodMat, 0, BH / 2 + 9, -10);

  // ── Awning (striped shader — no depth write needed, casts shadow) ──────────
  const awningMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BW + 160, 72),
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
      `,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        void main(){
          float s = step(.5, fract(vUv.x * 10.));
          vec3 c  = mix(vec3(.72,.12,.13), vec3(.94,.92,.88), s);
          c *= .80 + .20 * vUv.y;  // darken toward bottom (underside)
          gl_FragColor = vec4(c, 1.);
        }
      `,
    }),
  );
  awningMesh.position.set(0, BH / 2 + 46, 10);
  awningMesh.rotation.x = 0.18;
  awningMesh.castShadow = awningMesh.receiveShadow = true;
  scene.add(awningMesh);

  // Awning valance (the scalloped fringe strip)
  const valance = new THREE.Mesh(
    new THREE.BoxGeometry(BW + 160, 16, 4),
    new THREE.MeshStandardMaterial({ color: 0xb81e22, roughness: 0.8 }),
  );
  valance.position.set(0, BH / 2 + 12, 25);
  valance.castShadow = true;
  scene.add(valance);

  // ── Foreground counter (close to camera) ──────────────────────────────────
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x54300f, roughness: 0.92 });
  const counterY   = -requiredVisibleHeight * 0.42;
  box(w * 2, 72, 130, counterMat, 0, counterY, 290);          // face
  box(w * 2, 22, 130, new THREE.MeshStandardMaterial({ color: 0x8a5620, roughness: 0.70 }),
    0, counterY + 47, 290);  // top surface (lighter)

  // Rifle barrel resting on counter
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.4, metalness: 0.7 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 60, 16), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, counterY + 38, 240);
  barrel.castShadow = true;
  scene.add(barrel);
  // Bore (inner dark tube)
  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 65, 12),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
  );
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, counterY + 38, 240);
  scene.add(bore);

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
  const H = BALLOON_HEIGHT / 2;
  for (const b of balloons) {
    if (balloonMap.has(b.id)) continue;

    // Body
    const body = buildBalloonMesh(b.colorTop, b.colorBottom);
    const BZ = 14;  // z offset — in front of board face (board front at z≈10)
    body.position.set(b.x, -b.y, BZ);
    scene.add(body);

    const wordLabel = buildWordLabel(b.word);
    wordLabel.position.set(b.x, -b.y + 2, BZ + 46);
    scene.add(wordLabel);

    // Knot (small sphere below tip)
    const knotGeo = new THREE.SphereGeometry(9.5, 10, 10);
    knotGeo.scale(1, 1.15, 1);
    const knot = new THREE.Mesh(
      knotGeo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.colorBottom),
        roughness: 0.85,
      }),
    );
    knot.position.set(b.x, -b.y - H * 0.96 - 10, BZ);
    knot.castShadow = true;
    scene.add(knot);

    // Stub peg (shown when popped)
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 32, 8),
      new THREE.MeshStandardMaterial({ color: 0x484848, roughness: 0.7 }),
    );
    stub.position.set(b.x, -b.y, BZ + 4);
    stub.visible = false;
    scene.add(stub);

    // Torn rubber nub below stub
    const nub = new THREE.Mesh(
      new THREE.SphereGeometry(9.5, 6, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(b.colorBottom), roughness: 0.9 }),
    );
    nub.scale.set(1, 0.55, 1);
    nub.position.set(b.x, -b.y - 7, BZ + 4);
    nub.visible = false;
    scene.add(nub);

    balloonMap.set(b.id, { body, knot, wordLabel, stub });
    // Store nub on stub for later toggle
    (stub as THREE.Mesh & { nub?: THREE.Mesh }).nub = nub;
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
    objs.body.visible = b.alive;
    objs.knot.visible = b.alive;
    objs.wordLabel.visible = b.alive;
    const stubTyped = objs.stub as THREE.Mesh & { nub?: THREE.Mesh };
    objs.stub.visible = !b.alive;
    if (stubTyped.nub) stubTyped.nub.visible = !b.alive;
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
  drawVignette(hud, width, height);
  drawFocusVignette(hud, width, height, state.zoomScale, state.aimX, state.aimY);

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
  drawWindGauge(hud, width, height, state.aimX - state.mouseX, state.aimY - state.mouseY, state.gustIntensity, state.gustActive);
  drawShotWords(hud, width, height, state.shotWords);
}

function drawShotWords(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  words: string[],
): void {
  const panelW = Math.min(620, width - 48);
  const panelH = 58;
  const x = (width - panelW) / 2;
  const y = height - panelH - 22;
  const slotGap = 8;
  const slotW = (panelW - 28 - slotGap * 6) / 7;

  ctx.save();
  ctx.fillStyle = 'rgba(16,8,3,0.66)';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = 'rgba(216,170,84,0.34)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

  for (let i = 0; i < 7; i++) {
    const sx = x + 14 + i * (slotW + slotGap);
    ctx.fillStyle = i < words.length ? 'rgba(238,205,134,0.88)' : 'rgba(255,240,190,0.10)';
    ctx.fillRect(sx, y + 13, slotW, 32);
    ctx.strokeStyle = 'rgba(75,34,12,0.35)';
    ctx.strokeRect(sx + 0.5, y + 13.5, slotW - 1, 31);
    if (words[i]) {
      ctx.fillStyle = 'rgba(35,18,8,0.92)';
      ctx.font = words[i]!.length > 5 ? 'bold 13px monospace' : 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(words[i]!, sx + slotW / 2, y + 30);
    }
  }
  ctx.restore();
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
    if (objs) targets.push(objs.body);
  }

  const hits = raycaster.intersectObjects(targets);
  if (!hits.length) return null;

  const hitMesh = hits[0]!.object;
  for (const b of balloons) {
    const objs = balloonMap.get(b.id);
    if (objs?.body === hitMesh) return b;
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
  const requiredVisibleHeight = Math.max(h, BH + 320);
  cameraBaseZ = requiredVisibleHeight / (2 * Math.tan((45 * Math.PI) / 360));
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
  const cx = width - 84;
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
