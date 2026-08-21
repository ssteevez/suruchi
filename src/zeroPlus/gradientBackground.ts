export interface GradientBackground {
  update(
    colorA: [number, number, number],
    colorB: [number, number, number],
    dt: number,
  ): void;
}

export function initGradientBackground(): GradientBackground {
  const blobA = document.getElementById('blob-a') as HTMLElement | null;
  const blobB = document.getElementById('blob-b') as HTMLElement | null;
  if (!blobA || !blobB) return { update: () => { /* no-op */ } };

  const curA: [number, number, number] = [30, 30, 30];
  const curB: [number, number, number] = [30, 30, 30];

  function applyBlob(el: HTMLElement, r: number, g: number, b: number): void {
    el.style.background =
      `radial-gradient(circle, rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)}) 0%, transparent 68%)`;
  }

  return {
    update(targetA, targetB, dt) {
      const f = 1 - Math.pow(0.018, dt * 60);
      for (let c = 0; c < 3; c += 1) {
        curA[c] = (curA[c] ?? 30) + ((targetA[c] ?? 30) - (curA[c] ?? 30)) * f;
        curB[c] = (curB[c] ?? 30) + ((targetB[c] ?? 30) - (curB[c] ?? 30)) * f;
      }
      applyBlob(blobA, curA[0] ?? 30, curA[1] ?? 30, curA[2] ?? 30);
      applyBlob(blobB, curB[0] ?? 30, curB[1] ?? 30, curB[2] ?? 30);
    },
  };
}
