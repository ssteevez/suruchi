type Project = {
  title: string;
  subtitle: string;
  url: string;
};

const ZERO_PLUS_IMAGES = [
  '/images/painter/zero-plus/IMG_0695.jpg',
  '/images/painter/zero-plus/IMG_0696.jpg',
  '/images/painter/zero-plus/IMG_0697.jpg',
  '/images/painter/zero-plus/IMG_0698.jpg',
  '/images/painter/zero-plus/IMG_3067.jpg',
  '/images/painter/zero-plus/IMG_5028.jpg'
];

const PROJECTS: Project[] = [
  { title: 'Zero Plus Anything is a World', subtitle: 'Active system', url: '#' },
  { title: 'Afterburn', subtitle: 'Approved experiment awaiting production rebuild', url: '/experiments/afterburn/' },
  { title: 'Project 03', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 04', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 05', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 06', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 07', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 08', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 09', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 10', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 11', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 12', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 13', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 14', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 15', subtitle: 'Coming soon', url: '#' },
  { title: 'Project 16', subtitle: 'Coming soon', url: '#' },
];

const CARD_W = 180;
const CARD_H = 240;
const SPHERE_RADIUS = 340;
const AUTO_ROTATE_SPEED = 14;
const DRAG_SENSITIVITY = 0.38;
const RESUME_DELAY_MS = 1600;
const MAX_PITCH = 38;

type CardMeta = {
  el: HTMLElement;
  baseYaw: number;
  basePitch: number;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export function initSphere(): void {
  const ring = document.getElementById('sphere-ring') as HTMLElement | null;
  if (!ring) return;

  const N = PROJECTS.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const cardMeta: CardMeta[] = [];
  let currentRadius = SPHERE_RADIUS;

  const applyCardTransforms = (): void => {
    for (const meta of cardMeta) {
      meta.el.style.transform =
        `rotateY(${meta.baseYaw}deg) rotateX(${meta.basePitch}deg) translateZ(${currentRadius}px)`;
    }
  };

  PROJECTS.forEach((proj, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const rxy = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * rxy;
    const z = Math.sin(theta) * rxy;

    const baseYaw = Math.atan2(x, z) * (180 / Math.PI);
    const basePitch = -Math.asin(y) * (180 / Math.PI);

    const card = document.createElement('div');
    card.className = 'sphere-card';
    card.style.width = `${CARD_W}px`;
    card.style.height = `${CARD_H}px`;
    card.style.transform =
      `rotateY(${baseYaw}deg) rotateX(${basePitch}deg) translateZ(${currentRadius}px)`;

    const thumbSrc = ZERO_PLUS_IMAGES[i % ZERO_PLUS_IMAGES.length] || '';
    card.innerHTML = `
      <img class="sphere-card-media" src="${thumbSrc}" alt="${proj.title}" loading="lazy" decoding="async" />
      <div class="sphere-card-overlay">
        <div class="sphere-card-inner">
          <span class="sphere-card-title">${proj.title}</span>
          <span class="sphere-card-sub">${proj.subtitle}</span>
        </div>
      </div>`;

    if (proj.url !== '#') {
      card.addEventListener('click', () => { window.location.href = proj.url; });
      card.style.cursor = 'pointer';
    }

    ring.appendChild(card);
    cardMeta.push({ el: card, baseYaw, basePitch });
  });

  let yaw = 0;
  let pitch = -8;
  let isDragging = false;
  let lastPX = 0;
  let lastPY = 0;
  let resumeAutoAt = 0;
  let lastTime = performance.now();

  const updateRadiusForViewport = (): void => {
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    currentRadius = clamp(Math.round(vmin * 0.34), 220, SPHERE_RADIUS);
    applyCardTransforms();
  };

  ring.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    ring.setPointerCapture(e.pointerId);
  });

  ring.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPX;
    const dy = e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
    yaw += dx * DRAG_SENSITIVITY;
    pitch = clamp(pitch + dy * DRAG_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  });

  const endDrag = (): void => {
    if (!isDragging) return;
    isDragging = false;
    resumeAutoAt = performance.now() + RESUME_DELAY_MS;
  };

  ring.addEventListener('pointerup', endDrag);
  ring.addEventListener('pointercancel', endDrag);

  const onResize = (): void => {
    updateRadiusForViewport();
  };
  window.addEventListener('resize', onResize);
  updateRadiusForViewport();

  const tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!isDragging && now > resumeAutoAt) {
      yaw += AUTO_ROTATE_SPEED * dt;
    }

    ring.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;

    for (const { el, baseYaw, basePitch } of cardMeta) {
      const ty = ((yaw + baseYaw) * Math.PI) / 180;
      const tp = ((pitch + basePitch) * Math.PI) / 180;
      const frontness = Math.cos(ty) * Math.cos(tp);
      const frontT = (frontness + 1) / 2;
      const bri = 0.30 + frontT * 0.70;
      const sat = 0.45 + frontT * 0.55;
      const opa = 0.36 + frontT * 0.64;
      el.style.filter = `brightness(${bri.toFixed(3)}) saturate(${sat.toFixed(3)})`;
      el.style.opacity = opa.toFixed(3);
      el.style.zIndex = `${Math.round(frontT * 1000)}`;
      el.style.pointerEvents = frontness > 0 ? 'auto' : 'none';
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
