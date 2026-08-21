export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export function spawnBurst(x: number, y: number, colorTop: string, colorBottom: string): Particle[] {
  const particles: Particle[] = [];
  const count = 12 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 150;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? colorTop : colorBottom,
      life: 0,
      maxLife: 300 + Math.random() * 200,
    });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number) {
  const s = dt / 1000;
  const gravity = 400;
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    
    p.x += p.vx * s;
    p.vy += gravity * s;
    p.y += p.vy * s;
  }
}
