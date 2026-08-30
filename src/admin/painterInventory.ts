import type { PainterSeries, PainterArtwork } from './types';

// Replace or regenerate this when Painter site artworks change.
// The inventory is based only on actual artwork references found in the code.

const createArtwork = (seriesId: string, id: string, filename: string, sourceSrc: string, thumbnailSrc: string): PainterArtwork => ({
  id,
  seriesId,
  filename,
  sourceSrc,
  thumbnailSrc,
  title: '',
  caption: '',
  medium: '',
  dimension: '',
  year: '',
  metadataComplete: false,
  updatedAt: Date.now()
});

export const SEED_PAINTER_SERIES: PainterSeries[] = [
  {
    id: 'painter-zero-plus',
    title: 'Zero Plus...',
    driveLink: '',
    imagesOptimised: false,
    structureBuilt: true, // Structure already exists in code
    builtOriginal: false,
    structureApproved: false,
    finalApproval: false,
    reviewThread: [],
    status: 'review',
    updatedAt: Date.now(),
    artworks: [
      createArtwork('painter-zero-plus', 'zp-1', 'IMG_0695.jpg', '/images/painter/zero-plus/IMG_0695.jpg', '/images/painter/zero-plus/IMG_0695.jpg'),
      createArtwork('painter-zero-plus', 'zp-2', 'IMG_0696.jpg', '/images/painter/zero-plus/IMG_0696.jpg', '/images/painter/zero-plus/IMG_0696.jpg'),
      createArtwork('painter-zero-plus', 'zp-3', 'IMG_0697.jpg', '/images/painter/zero-plus/IMG_0697.jpg', '/images/painter/zero-plus/IMG_0697.jpg'),
      createArtwork('painter-zero-plus', 'zp-4', 'IMG_0698.jpg', '/images/painter/zero-plus/IMG_0698.jpg', '/images/painter/zero-plus/IMG_0698.jpg'),
      createArtwork('painter-zero-plus', 'zp-5', 'IMG_3067.jpg', '/images/painter/zero-plus/IMG_3067.jpg', '/images/painter/zero-plus/IMG_3067.jpg'),
      createArtwork('painter-zero-plus', 'zp-6', 'IMG_5028.jpg', '/images/painter/zero-plus/IMG_5028.jpg', '/images/painter/zero-plus/IMG_5028.jpg')
    ]
  },
  {
    id: 'painter-afterburn',
    title: 'Afterburn',
    driveLink: '',
    imagesOptimised: false,
    structureBuilt: true, // Structure already exists in code
    builtOriginal: false,
    structureApproved: false,
    finalApproval: false,
    reviewThread: [],
    status: 'review',
    updatedAt: Date.now(),
    artworks: [
      createArtwork('painter-afterburn', 'pg-1', '6O8B9657.jpg', '/images/painter/afterburn/6O8B9657.jpg', '/images/painter/afterburn/6O8B9657.jpg'),
      createArtwork('painter-afterburn', 'pg-2', '6O8B9658.jpg', '/images/painter/afterburn/6O8B9658.jpg', '/images/painter/afterburn/6O8B9658.jpg'),
      createArtwork('painter-afterburn', 'pg-3', 'IMG_8711.jpg', '/images/painter/afterburn/IMG_8711.jpg', '/images/painter/afterburn/IMG_8711.jpg'),
      createArtwork('painter-afterburn', 'pg-4', 'IMG_8712.jpg', '/images/painter/afterburn/IMG_8712.jpg', '/images/painter/afterburn/IMG_8712.jpg'),
      createArtwork('painter-afterburn', 'pg-5', 'IMG_8713.jpg', '/images/painter/afterburn/IMG_8713.jpg', '/images/painter/afterburn/IMG_8713.jpg'),
      createArtwork('painter-afterburn', 'pg-6', 'canvas.jpg', '/images/painter/afterburn/canvas.jpg', '/images/painter/afterburn/canvas.jpg')
    ]
  }
];
