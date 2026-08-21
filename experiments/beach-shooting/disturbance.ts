export interface DisturbanceState {
  seaBreeze: {
    phaseX: number;
    phaseY: number;
    phaseMod: number;
    freqX: number;
    freqY: number;
    ampX: number;
    ampY: number;
  };
  gust: {
    active: boolean;
    // Amplitude of the oscillation (always positive)
    amplitude: number;
    amplitudeY: number;
    // Direction of first swing: +1 or -1
    dir: number;
    // How many full cycles happen across the gust duration
    cycleFreq: number;
    progress: number;
    duration: number;
    nextGustAt: number;
    envelope: number;
  };
}

export function initDisturbance(now: number): DisturbanceState {
  return {
    seaBreeze: {
      phaseX:   Math.random() * Math.PI * 2,
      phaseY:   Math.random() * Math.PI * 2,
      phaseMod: Math.random() * Math.PI * 2,
      freqX: 0.55,
      freqY: 0.42,
      ampX:  29,   // reduced from 58
      ampY:  13,   // reduced from 26
    },
    gust: {
      active:     false,
      amplitude:  0,
      amplitudeY: 0,
      dir:        1,
      cycleFreq:  0,
      progress:   0,
      duration:   0,
      nextGustAt: now + 600 + Math.random() * 800,
      envelope:   0,
    },
  };
}

export function updateDisturbance(
  state: DisturbanceState,
  dt: number,
  now: number,
): {
  dx: number;
  dy: number;
  gustActive: boolean;
  gustDX: number;        // current instantaneous X displacement (oscillates ± during gust)
  gustIntensity: number; // envelope 0–1 (overall gust strength regardless of direction)
  seaBreezeX: number;
} {
  // ── Sea breeze: slow, smooth sine-wave drift ──────────────────────────────
  const sb = state.seaBreeze;
  sb.phaseMod += (dt / 1000) * (Math.PI * 2 / 16);
  sb.phaseX   += (dt / 1000) * sb.freqX * Math.PI * 2;
  sb.phaseY   += (dt / 1000) * sb.freqY * Math.PI * 2;
  const mod = 0.70 + 0.30 * Math.sin(sb.phaseMod);
  const sbX = Math.sin(sb.phaseX) * sb.ampX * mod;
  const sbY = Math.cos(sb.phaseY) * sb.ampY * mod;

  // ── Wind gust: cyclic oscillation, direction-changing ─────────────────────
  const g = state.gust;
  let gustX = 0;
  let gustY = 0;

  if (g.active) {
    g.progress += dt;

    if (g.progress >= g.duration) {
      g.active   = false;
      g.envelope = 0;
      g.nextGustAt = now + 200 + Math.random() * 600;   // 0.2–0.8 s gap: wind is nearly continuous
    } else {
      const t = g.progress / g.duration;

      // Smooth bell envelope: sin²(πt) — rises and falls cleanly, no hard edges
      g.envelope = Math.sin(t * Math.PI) * Math.sin(t * Math.PI);

      // Cyclic oscillation within the envelope — direction changes g.cycleFreq times
      const cycle = t * g.cycleFreq * Math.PI * 2;
      gustX = g.amplitude  * g.envelope * Math.sin(cycle) * g.dir;
      // Y oscillates at a different frequency + phase offset — feels turbulent
      gustY = g.amplitudeY * g.envelope * Math.sin(cycle * 0.73 + 1.1);
    }
  } else if (now > g.nextGustAt) {
    g.active     = true;
    g.progress   = 0;
    g.envelope   = 0;
    g.duration   = 6000 + Math.random() * 6000;        // 6–12 s: long, sustained wind
    g.amplitude  = 90 + Math.random() * 40;            // reduced from 180 + Math.random() * 80
    g.amplitudeY = 12.5 + Math.random() * 17.5;        // reduced from 25 + Math.random() * 35
    g.dir        = Math.random() > 0.5 ? 1 : -1;       // first swing direction
    g.cycleFreq  = 1.0 + Math.random() * 1.0;          // 1–2 full cycles per gust (slow, graceful sweeps)
  }

  return {
    dx:            sbX + gustX,
    dy:            sbY + gustY,
    gustActive:    g.active,
    gustDX:        gustX,           // current instantaneous value — oscillates ±
    gustIntensity: g.envelope,
    seaBreezeX:    sbX,
  };
}
