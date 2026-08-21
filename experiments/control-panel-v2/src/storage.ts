import { seedState } from "./seed";
import type { ControlPanelState } from "./types";

const STORAGE_KEY = "suruchi-control-panel-v2-experiment";

const mergeById = <T extends { id: string }>(stored: T[], seeded: T[]): T[] => {
  const storedIds = new Set(stored.map((item) => item.id));
  return [...stored, ...seeded.filter((item) => !storedIds.has(item.id))];
};

const migrateState = (stored: ControlPanelState): ControlPanelState => {
  const tasks = mergeById(stored.tasks, seedState.tasks);
  const reviewThreads = mergeById(stored.reviewThreads, seedState.reviewThreads);
  const pages = mergeById(stored.pages, seedState.pages).map((page) => {
    const seedPage = seedState.pages.find((candidate) => candidate.id === page.id);
    return seedPage && page.id === "poet" ? { ...page, taskIds: seedPage.taskIds } : page;
  });
  const subpages = mergeById(stored.subpages, seedState.subpages).map((subpage) => {
    const seedSubpage = seedState.subpages.find((candidate) => candidate.id === subpage.id);
    return seedSubpage && subpage.id === "poet-euphemisms" ? { ...subpage, taskIds: seedSubpage.taskIds } : subpage;
  });
  return {
    ...stored,
    pages,
    subpages,
    tasks,
    reviewThreads,
    paymentMilestones: mergeById(stored.paymentMilestones, seedState.paymentMilestones),
  };
};

export const loadState = (): ControlPanelState => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedState;
  try {
    return migrateState(JSON.parse(stored) as ControlPanelState);
  } catch {
    return seedState;
  }
};

export const saveState = (state: ControlPanelState): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const resetState = (): ControlPanelState => {
  window.localStorage.removeItem(STORAGE_KEY);
  return seedState;
};
