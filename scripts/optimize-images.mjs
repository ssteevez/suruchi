import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'fs';
import { join, parse, relative } from 'path';

const RAW_DIR = 'raw-images';
const PUBLIC_IMG_DIR = 'public/images';

// Recursively find all files in a directory
function walkSync(dir, filelist = []) {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('._') || file.startsWith('.DS_Store')) continue;
      
      const filepath = join(dir, file);
      if (statSync(filepath).isDirectory()) {
        filelist = walkSync(filepath, filelist);
      } else {
        filelist.push(filepath);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Error reading ${dir}:`, err);
  }
  return filelist;
}

async function processAllImages() {
  console.log(`Scanning ${RAW_DIR} for images...`);
  const allFiles = walkSync(RAW_DIR);
  const imageFiles = allFiles.filter(f => /\.(jpe?g|png|tiff?)$/i.test(f));
  
  if (imageFiles.length === 0) {
    console.log('No images found to process.');
    return;
  }

  console.log(`Found ${imageFiles.length} images. Processing...`);

  // To preserve painter-1, painter-2 logic from before, we will implement a counter per folder.
  // Wait, if it's recursive, do we want to rename zero-plus images to painter-1.jpg?
  // The user says "preserve filenames predictably and ensure all existing website image references remain valid".
  // Since the old script renamed them to painter-1.jpg, if we change the logic, we must rename the source files OR just let the script output the original names and refactor the code to use the original names!
  // Actually, wait, it's easier to just use the original names and we will refactor the code to point to them!
  // Let's NOT rename sequence. The prompt said: "Preserve filenames predictably". Original filenames are predictable.

  for (const src of imageFiles) {
    const relPath = relative(RAW_DIR, src);
    const parsed = parse(relPath);
    
    const outDir = join(PUBLIC_IMG_DIR, parsed.dir);
    mkdirSync(outDir, { recursive: true });

    const destWebp1200 = join(outDir, `${parsed.name}.webp`);
    const destJpg1200 = join(outDir, `${parsed.name}.jpg`);
    
    const destWebp2400 = join(outDir, `${parsed.name}-2400.webp`);
    const destJpg2400 = join(outDir, `${parsed.name}-2400.jpg`);

    try {
      const image = sharp(src);
      
      const basePipeline = image.rotate().toColorspace('srgb');
      
      // 1200px Interaction Quality
      const pipeline1200 = basePipeline.clone()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true });
      
      await pipeline1200.clone().webp({ quality: 80 }).toFile(destWebp1200);
      await pipeline1200.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(destJpg1200);

      // 2400px Resting Quality
      const pipeline2400 = basePipeline.clone()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true });
      
      await pipeline2400.clone().webp({ quality: 85 }).toFile(destWebp2400);
      await pipeline2400.clone().jpeg({ quality: 85, mozjpeg: true }).toFile(destJpg2400);

      console.log(`✓ ${relPath} → [1200px & 2400px] .webp / .jpg`);
    } catch (err) {
      console.error(`✗ Failed to process ${relPath}:`, err);
    }
  }
}

async function main() {
  console.log('Starting universal recursive image pipeline...');
  await processAllImages();
  console.log('\nDone.');
}

main().catch(console.error);
