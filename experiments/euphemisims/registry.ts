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
    title: 'Issued Inthe Public Intrest',
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


// ── SESSION-BASED RANDOMIZATION ──
// We want the order to be randomized per session, but consistent across page loads
// so that the 'Next' button matches the hub's grid order.
function applySessionShuffle(works: WorkEntry[]) {
  const SESSION_KEY = 'euphemisms_shuffle_order';
  
  // Try to load existing order from session storage
  let savedOrder: string[] = [];
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) savedOrder = JSON.parse(stored);
  } catch (e) {
    // Ignore storage errors
  }

  if (savedOrder && savedOrder.length === works.length) {
    // Sort array based on the saved slug order
    works.sort((a, b) => savedOrder.indexOf(a.slug) - savedOrder.indexOf(b.slug));
  } else {
    // Perform a Fisher-Yates shuffle
    for (let i = works.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [works[i], works[j]] = [works[j]!, works[i]!];
    }
    // Save the new order to session storage
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(works.map(w => w.slug)));
    } catch (e) {
      // Ignore
    }
  }
}

// Apply it immediately so any file importing WORKS gets the shuffled array
applySessionShuffle(WORKS);

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
