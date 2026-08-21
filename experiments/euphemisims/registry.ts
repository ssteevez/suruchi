import type { WorkEntry } from './types.js';

export const WORKS: WorkEntry[] = [
  {
    slug: 'magic',
    title: 'Magic',
    load: () => import('./works/magic.js'),
  },
  {
    slug: 'plainness',
    title: 'Plainness',
    load: () => import('./works/plainness.js'),
  },
  {
    slug: 'just-so',
    title: 'Just So',
    load: () => import('./works/just-so.js'),
  },
  {
    slug: 'somewhere-something',
    title: 'Somewhere Something',
    load: () => import('./works/somewhere-something.js'),
  },
  {
    slug: 'issued-in-public-interest',
    title: 'Issued in Public Interest',
    load: () => import('./works/issued-in-public-interest.js'),
  },
  {
    slug: 'self',
    title: 'SELF',
    load: () => import('./works/self.js'),
  },
  {
    slug: 'born-die',
    title: 'born/die',
    load: () => import('./works/born-die.js'),
  },
  {
    slug: 'fact-fiction',
    title: 'Fact Fiction',
    load: () => import('./works/fact-fiction.js'),
  },
  {
    slug: 'the-thing-to-do',
    title: 'The Thing To Do',
    load: () => import('./works/the-thing-to-do.js'),
  },
];

export function getWorkEntry(slug: string): WorkEntry | undefined {
  return WORKS.find((w) => w.slug === slug);
}

export function getAdjacentWorks(slug: string): {
  prev: WorkEntry | null;
  next: WorkEntry | null;
} {
  const currentIndex = WORKS.findIndex((w) => w.slug === slug);
  if (currentIndex === -1) return { prev: null, next: null };
  const prev = currentIndex > 0 ? WORKS[currentIndex - 1]! : null;
  const next = currentIndex < WORKS.length - 1 ? WORKS[currentIndex + 1]! : null;
  return { prev, next };
}
