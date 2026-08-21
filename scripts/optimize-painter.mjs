import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

const INPUT = 'public/images/painter';
const OUTPUT = 'public/images/painter-opt';

mkdirSync(OUTPUT, { recursive: true });

const files = readdirSync(INPUT).filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('._'));
files.sort();

for (let i = 0; i < files.length; i += 1) {
  const src = join(INPUT, files[i]);
  const dest = join(OUTPUT, `painter-${i + 1}.jpg`);
  await sharp(src)
    .resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(dest);
  console.log(`✓ ${files[i]} → ${dest}`);
}
console.log(`Done. ${files.length} images optimised.`);
