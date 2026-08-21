export function extractDominantColor(
  img: HTMLImageElement,
): [number, number, number] {
  const SIZE = 48;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [60, 40, 40];

  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum >= 28 && lum <= 228) {
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
    }
  }

  if (count === 0) return [60, 40, 40];
  return [Math.round(sumR / count), Math.round(sumG / count), Math.round(sumB / count)];
}
