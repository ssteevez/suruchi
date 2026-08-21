import type { Project, ChecklistItem, SectionType, MiniPage } from './types';
import { getChecklistTemplate, getIncompleteItemsByOwner } from './templates';
import { INITIAL_PILGRIM_INVENTORY } from './pilgrimInventory';
import { INITIAL_EUPHEMISM_STRUCTURES } from './poetInventory';
import { SEED_PAINTER_SERIES } from './painterInventory';
import {
  queueUpsert,
  queueDelete,
  collectReviewMessages,
  fetchAllProjectData,
} from './cloudSync';

const STORAGE_KEY = 'suruchi_admin_projects';
const CURRENT_SCHEMA_VERSION = 3.6;

// --------------------------------------------------------
// STORAGE MODEL (Supabase-primary, localStorage backup):
// - Supabase `projects.project_data` is the source of truth.
// - An in-memory cache serves all synchronous reads; the dossier
//   components keep calling ProjectStore synchronously.
// - Every write updates cache + localStorage immediately
//   (optimistic), then is pushed to Supabase via cloudSync.
// - localStorage is a backup/fallback mirror only — it is never
//   treated as live shared state.
// --------------------------------------------------------

let cache: Project[] | null = null;
const storeListeners = new Set<() => void>();

const notifyStore = (): void => {
  storeListeners.forEach((l) => l());
};

/** Components/App subscribe to re-render on cache changes (realtime etc.). */
export const subscribeToStore = (cb: () => void): (() => void) => {
  storeListeners.add(cb);
  return () => {
    storeListeners.delete(cb);
  };
};

/** Local-only persistence (backup mirror). Never touches the cloud. */
const persistLocal = (projects: Project[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('localStorage backup write failed', e);
  }
};

const createInitialSeed = (): Project[] => {
  const seedNames = [
    'Homepage',
    'Books mini-site',
  ];

  return seedNames.map((title, index) => {
    const isHome = title.includes('Homepage');
    const sectionType: SectionType = isHome ? 'homepage' : 'other';
    
    const miniPages: MiniPage[] = isHome ? [
      { id: 'mp_bio', title: 'Bio', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
      { id: 'mp_tearsheets', title: 'Tearsheets', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
      { id: 'mp_contact', title: 'Contact', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
      { id: 'mp_enquiry', title: 'Contact / Enquiry', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() }
    ] : [];

    return {
      id: `seed-${index}-${Date.now()}`,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sectionType,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category: title.includes('site') || title.includes('layer') ? 'Infrastructure' : 'Content',
      year: new Date().getFullYear().toString(),
      medium: '',
      dimensions: '',
      shortDescription: '',
      longDescription: '',
      credits: '',
      notesFromSuruchi: '',
      internalBuildNotes: '',
      driveLinks: '',
      
      owner: isHome || title.includes('Security') ? 'Steevez' : 'Suruchi',
      status: isHome ? 'active' : 'waiting-for-content',
      checklist: getChecklistTemplate(sectionType),
      activity: [{ date: Date.now() - index * 100000, message: 'Created' }],
      
      reviewThread: [],
      miniPages,
      createdAt: Date.now() - index * 100000,
      lastUpdated: Date.now() - index * 100000,
    };
  });
};

export const migrateProject = (p: any): Project => {
  let migrated = { ...p };

  // Defensive guards for imported or hand-edited JSON: these two fields are
  // assumed present by the migrations below and by importData/components.
  // Without them a malformed backup import can persist broken projects.
  if (typeof migrated.title !== 'string') {
    migrated.title = 'Untitled';
  }
  if (!Array.isArray(migrated.activity)) {
    migrated.activity = [];
  }

  if (!migrated.schemaVersion) {
    migrated.schemaVersion = 1;
  }

  // Schema V1 -> V2 Migration (Dynamic Checklists)
  if (migrated.schemaVersion < 2) {
    if (!migrated.sectionType) {
      migrated.sectionType = migrated.title.toLowerCase().includes('homepage') ? 'homepage' : 'other';
    }

    if (migrated.checklist && !Array.isArray(migrated.checklist)) {
      migrated.legacyChecklist = migrated.checklist; 
      
      if (migrated.sectionType === 'homepage') {
        migrated.checklist = getChecklistTemplate('homepage');
      } else {
        const oldChecklist = migrated.checklist;
        const newChecklist = getChecklistTemplate('other');
        
        migrated.checklist = newChecklist.map(item => {
          const oldKey = item.id + 'Received'; 
          let oldVal = oldChecklist[oldKey];
          if (item.id === 'finalApproval') {
            oldVal = oldChecklist.finalApprovalReceived;
          }
          
          if (oldVal === true) {
            return { ...item, value: true, completedAt: migrated.lastUpdated || Date.now() };
          }
          return item;
        });
      }
    } else if (!migrated.checklist) {
      migrated.checklist = getChecklistTemplate(migrated.sectionType);
    }
    migrated.schemaVersion = 2;
  }

  // Schema V2 -> V3 Migration (Dossier, ReviewThread, MiniPages)
  if (migrated.schemaVersion < 3) {
    if (!migrated.reviewThread) {
      migrated.reviewThread = [];
    }
    
    if (!migrated.miniPages) {
      if (migrated.sectionType === 'homepage') {
        migrated.miniPages = [
          { id: 'mp_bio', title: 'Bio', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
          { id: 'mp_tearsheets', title: 'Tearsheets', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
          { id: 'mp_contact', title: 'Contact', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() },
          { id: 'mp_enquiry', title: 'Contact / Enquiry', status: 'waiting-for-content', owner: 'Steevez', contentReceived: false, built: false, reviewed: false, approved: false, notes: '', fileLink: '', updatedAt: Date.now() }
        ];
      } else {
        migrated.miniPages = [];
      }
    }

    if (Array.isArray(migrated.checklist)) {
      const reviewItem = migrated.checklist.find((i: any) => i.id === 'hp_review');
      if (reviewItem && reviewItem.value === true) {
        migrated.activity.unshift({ date: Date.now(), message: 'Legacy review checklist item was completed before V3 migration' });
      }
      migrated.checklist = migrated.checklist.filter((i: any) => i.id !== 'hp_review' && i.id !== 'hp_linked_sections');

      const clickIdx = migrated.checklist.findIndex((i: any) => i.id === 'hp_click_behavior');
      if (clickIdx >= 0 && migrated.checklist[clickIdx].type !== 'grouped') {
        const newTemplate = getChecklistTemplate('homepage');
        const newClick = newTemplate.find(t => t.id === 'hp_click_behavior');
        if (newClick) {
          migrated.checklist[clickIdx] = newClick;
        }
      }
    }
    
    migrated.schemaVersion = 3;
  }

  // Schema V3.1 Migration (Pilgrim Dossier)
  if (migrated.schemaVersion < 3.1) {
    if (migrated.sectionType === 'pilgrim') {
      if (!migrated.pilgrimPhotos) {
        migrated.pilgrimPhotos = INITIAL_PILGRIM_INVENTORY;
      }
      if (!migrated.reviewThread) {
        migrated.reviewThread = [];
      }
      // Guarantee the Pilgrim template items
      const hasPilgrimItems = migrated.checklist && migrated.checklist.some((i: any) => i.id === 'pil_structure');
      if (!hasPilgrimItems) {
        migrated.checklist = getChecklistTemplate('pilgrim');
      }
    }
    migrated.schemaVersion = 3.1;
  }

  // Schema V3.2 Migration (Remove obsolete generic seed projects)
  if (migrated.schemaVersion < 3.2) {
    migrated.schemaVersion = 3.2;
  }

  // Schema V3.3 Migration (Poet Dossier)
  if (migrated.schemaVersion < 3.3) {
    if (migrated.title === 'Poet') {
      migrated.sectionType = 'poet';
    }
    if (migrated.sectionType === 'poet') {
      if (!migrated.poetPages || migrated.poetPages.length === 0) {
        migrated.poetPages = [{
          id: 'poet-bandra',
          title: 'Celebrating Bandra',
          structureBuilt: false,
          structureApproved: false,
          reviewThread: [],
          status: 'waiting-for-content',
          updatedAt: Date.now()
        }];
      }
      if (!migrated.euphemismStructures) {
        migrated.euphemismStructures = INITIAL_EUPHEMISM_STRUCTURES;
      }
      if (!migrated.newEuphemismRequests) {
        migrated.newEuphemismRequests = [];
      }
      migrated.checklist = getChecklistTemplate('poet');
    }
    migrated.schemaVersion = 3.3;
  }

  // Schema V3.4 Migration (Painter Dossier)
  if (migrated.schemaVersion < 3.4) {
    if (migrated.title === 'Painter') {
      migrated.sectionType = 'painter';
    }
    if (migrated.sectionType === 'painter') {
      if (!migrated.painterSeries || migrated.painterSeries.length === 0) {
        migrated.painterSeries = SEED_PAINTER_SERIES;
      }
      migrated.checklist = getChecklistTemplate('painter');
    }
    migrated.schemaVersion = 3.4;
  }

  // Schema V3.5 Migration (Painter Checklist Fix)
  if (migrated.schemaVersion < 3.5) {
    if (migrated.sectionType === 'painter') {
      if (!migrated.checklist || migrated.checklist.length === 0) {
        migrated.checklist = getChecklistTemplate('painter');
      }
    }
    migrated.schemaVersion = 3.5;
  }

  // Schema V3.6 Migration (Painter Per-Series Checklist fields)
  if (migrated.schemaVersion < 3.6) {
    if (migrated.sectionType === 'painter') {
      if (migrated.painterSeries) {
        migrated.painterSeries.forEach((s: any) => {
          if (typeof s.driveLink === 'undefined') s.driveLink = '';
          if (typeof s.imagesOptimised === 'undefined') s.imagesOptimised = false;
          if (typeof s.builtOriginal === 'undefined') s.builtOriginal = false;
          if (typeof s.finalApproval === 'undefined') s.finalApproval = false;
        });
      }
      // Remove global painter template
      migrated.checklist = [];
    }
    migrated.schemaVersion = 3.6;
  }

  if (!migrated.owner) migrated.owner = 'Shared';
  if (!migrated.activity) migrated.activity = [{ date: migrated.lastUpdated || Date.now(), message: 'Created (Legacy Data)' }];
  
  if (migrated.priority && !migrated.legacyPriority) {
    migrated.legacyPriority = migrated.priority;
    const oldStatuses = ['not-started', 'content-received', 'in-design', 'in-build', 'ready-for-review', 'changes-requested'];
    if (oldStatuses.includes(migrated.status)) {
      if (migrated.status === 'ready-for-review') migrated.status = 'review';
      else if (migrated.status === 'in-build' || migrated.status === 'in-design' || migrated.status === 'content-received') migrated.status = 'active';
      else if (migrated.priority === 'urgent' || migrated.priority === 'high') migrated.status = 'active';
      else migrated.status = 'waiting-for-content';
    }
  }
  
  return migrated as Project;
};

/**
 * Read + migrate + normalize projects from the localStorage backup.
 * Local-only: never touches the cloud. Returns null when nothing usable
 * is stored. Also used by hydrateFromCloud to normalize cloud data (it
 * writes the migrated cloud rows to localStorage first, then re-reads
 * through this single normalization path).
 */
export const loadLocalProjects = (): Project[] | null => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }
    try {
      const parsed = JSON.parse(data);
      let migrated = parsed.map(migrateProject);
      
      // Remove obsolete legacy seed projects
      const obsoleteTitles = [
        'Selected Works', 
        'About / Biography', 
        'Contact / Studio', 
        'Security / access layer'
      ];
      migrated = migrated.filter((p: Project) => !obsoleteTitles.includes(p.title));
      
      // Ensure Pilgrim project exists
      if (!migrated.some((p: Project) => p.sectionType === 'pilgrim')) {
        const pilgrimProject: Project = {
          id: 'pilgrim-project',
          schemaVersion: 3.1,
          sectionType: 'pilgrim',
          title: 'Pilgrim',
          slug: 'pilgrim',
          category: 'Archive',
          year: '',
          medium: '',
          dimensions: '',
          shortDescription: '',
          longDescription: '',
          credits: '',
          internalBuildNotes: '',
          notesFromSuruchi: '',
          driveLinks: '',
          owner: 'Shared',
          status: 'active',
          checklist: getChecklistTemplate('pilgrim'),
          activity: [{ date: Date.now(), message: 'Pilgrim project automatically seeded' }],
          reviewThread: [],
          pilgrimPhotos: INITIAL_PILGRIM_INVENTORY,
          createdAt: Date.now(),
          lastUpdated: Date.now()
        };
        migrated.push(pilgrimProject);
        persistLocal(migrated);
      }

      // Ensure Poet project exists
      if (!migrated.some((p: Project) => p.sectionType === 'poet')) {
        const poetProject: Project = {
          id: 'poet-project',
          schemaVersion: 3.3,
          sectionType: 'poet',
          title: 'Poet',
          slug: 'poet',
          category: 'Content',
          year: '',
          medium: '',
          dimensions: '',
          shortDescription: '',
          longDescription: '',
          credits: '',
          internalBuildNotes: '',
          notesFromSuruchi: '',
          driveLinks: '',
          owner: 'Shared',
          status: 'active',
          checklist: getChecklistTemplate('poet'),
          activity: [{ date: Date.now(), message: 'Poet project automatically seeded' }],
          reviewThread: [],
          poetPages: [{
            id: 'poet-bandra',
            title: 'Celebrating Bandra',
            structureBuilt: false,
            structureApproved: false,
            reviewThread: [],
            status: 'waiting-for-content',
            updatedAt: Date.now()
          }],
          euphemismStructures: INITIAL_EUPHEMISM_STRUCTURES,
          newEuphemismRequests: [],
          createdAt: Date.now(),
          lastUpdated: Date.now()
        };
        migrated.push(poetProject);
        persistLocal(migrated);
      }

      // Ensure Painter project exists
      if (!migrated.some((p: Project) => p.sectionType === 'painter')) {
        const painterProject: Project = {
          id: 'painter-project',
          schemaVersion: 3.6,
          sectionType: 'painter',
          title: 'Painter',
          slug: 'painter',
          category: 'Archive',
          year: '',
          medium: '',
          dimensions: '',
          shortDescription: '',
          longDescription: '',
          credits: '',
          internalBuildNotes: '',
          notesFromSuruchi: '',
          driveLinks: '',
          owner: 'Shared',
          status: 'active',
          checklist: getChecklistTemplate('painter'),
          activity: [{ date: Date.now(), message: 'Painter project automatically seeded' }],
          reviewThread: [],
          painterSeries: SEED_PAINTER_SERIES,
          createdAt: Date.now(),
          lastUpdated: Date.now()
        };
        migrated.push(painterProject);
        persistLocal(migrated);
      }

      return migrated;
    } catch (e) {
      console.error('Failed to parse projects from local storage', e);
      return null;
    }
};

export type HydrationResult = 'ok' | 'needs-migration' | 'error';

/**
 * Load all projects from Supabase into the in-memory cache.
 * Called once after sign-in (and again after migration completes).
 * - Cloud has data  → cache it (normalized through loadLocalProjects).
 * - Cloud empty but localStorage has projects → 'needs-migration'
 *   (App shows the one-time MigrationPanel; nothing is auto-pushed).
 * - Cloud empty and no local data → first ever run: seed and push.
 */
export const hydrateFromCloud = async (): Promise<HydrationResult> => {
  try {
    const raws = await fetchAllProjectData();

    if (raws.length === 0) {
      const local = loadLocalProjects();
      if (local && local.length > 0) {
        return 'needs-migration';
      }
      // First ever run anywhere: seed, normalize, push everything.
      persistLocal(createInitialSeed());
      const seeded = loadLocalProjects() ?? [];
      cache = seeded;
      persistLocal(seeded);
      for (const p of seeded) {
        queueUpsert(p, p.activity, collectReviewMessages(p));
      }
      notifyStore();
      return 'ok';
    }

    const cloudIds = new Set<string>();
    const migrated = raws.map((r) => {
      const m = migrateProject(r);
      cloudIds.add(m.id);
      return m;
    });
    // Normalize through the single local path (obsolete-title filter +
    // ensure Pilgrim/Poet/Painter exist), then adopt as cache.
    persistLocal(migrated);
    const normalized = loadLocalProjects() ?? migrated;
    cache = normalized;
    persistLocal(normalized);
    // Push only projects normalization ADDED (auto-seeded sections);
    // schema-migrated existing rows sync on their next natural save.
    for (const p of normalized) {
      if (!cloudIds.has(p.id)) {
        queueUpsert(p, p.activity, collectReviewMessages(p));
      }
    }
    notifyStore();
    return 'ok';
  } catch (e) {
    console.error('Cloud hydration failed', e);
    return 'error';
  }
};

/** Applied by realtime when the other user changes a project. */
export const applyCloudUpsert = (raw: unknown): void => {
  const incoming = migrateProject(raw);
  const list = cache ? [...cache] : [];
  const idx = list.findIndex((p) => p.id === incoming.id);
  if (idx >= 0) list[idx] = incoming;
  else list.push(incoming);
  cache = list;
  persistLocal(list);
  notifyStore();
};

/** Applied by realtime when the other user deletes a project. */
export const applyCloudDelete = (id: string): void => {
  if (!cache) return;
  cache = cache.filter((p) => p.id !== id);
  persistLocal(cache);
  notifyStore();
};

export const ProjectStore = {
  /** Synchronous read of the hydrated cache. Empty until hydration. */
  getProjects: (): Project[] => {
    return cache ?? [];
  },

  /**
   * Replace the full project list in cache + localStorage backup.
   * Does NOT push to the cloud by itself — callers that change data
   * (saveProject / deleteProject / importData / migration) queue their
   * own cloud writes.
   */
  saveProjects: (projects: Project[]): void => {
    cache = projects;
    persistLocal(projects);
    notifyStore();
  },

  saveProject: (project: Project): void => {
    const projects = [...ProjectStore.getProjects()];
    const index = projects.findIndex(p => p.id === project.id);

    const baseActivityLen = (project.activity || []).length;
    let previousProject: Project | undefined;
    const newActivity = [...(project.activity || [])];
    let hasChanges = false;

    if (index >= 0) {
      const oldProject = projects[index] as Project;
      previousProject = oldProject;
      
      if (oldProject.status !== project.status) {
        newActivity.unshift({ date: Date.now(), message: `Status changed to ${project.status}` });
        hasChanges = true;
      }
      
      if (oldProject.owner !== project.owner) {
        newActivity.unshift({ date: Date.now(), message: `Owner changed to ${project.owner}` });
        hasChanges = true;
      }
      
      // Activity for ReviewThread
      if (project.reviewThread && oldProject.reviewThread && project.reviewThread.length > oldProject.reviewThread.length) {
        newActivity.unshift({ date: Date.now(), message: `New review message added by ${project.reviewThread[project.reviewThread.length - 1]?.author}` });
        hasChanges = true;
      }

      // Activity for MiniPages
      if (project.miniPages && oldProject.miniPages) {
        project.miniPages.forEach(newPage => {
          const oldPage = oldProject.miniPages?.find(p => p.id === newPage.id);
          if (!oldPage) return;

          if (oldPage.status !== newPage.status) {
            newActivity.unshift({ date: Date.now(), message: `[${newPage.title}] Status changed to ${newPage.status}` });
            hasChanges = true;
          }
          if (oldPage.approved === false && newPage.approved === true) {
            newActivity.unshift({ date: Date.now(), message: `[${newPage.title}] Approved by Suruchi` });
            hasChanges = true;
          }
          if (oldPage.fileLink !== newPage.fileLink) {
            newActivity.unshift({ date: Date.now(), message: `[${newPage.title}] File link updated` });
            hasChanges = true;
          }
        });
      }

      // Activity for Pilgrim Photos
      if (project.pilgrimPhotos && oldProject.pilgrimPhotos) {
        project.pilgrimPhotos.forEach(newPhoto => {
          const oldPhoto = oldProject.pilgrimPhotos?.find(p => p.id === newPhoto.id);
          if (!oldPhoto) return;

          if (oldPhoto.title !== newPhoto.title && newPhoto.title) {
            newActivity.unshift({ date: Date.now(), message: `Pilgrim: Photo ${newPhoto.filename} title added` });
            hasChanges = true;
          }
          if (oldPhoto.caption !== newPhoto.caption && newPhoto.caption) {
            newActivity.unshift({ date: Date.now(), message: `Pilgrim: Photo ${newPhoto.filename} caption added` });
            hasChanges = true;
          }
          if (oldPhoto.date !== newPhoto.date && newPhoto.date) {
            newActivity.unshift({ date: Date.now(), message: `Pilgrim: Photo ${newPhoto.filename} date added` });
            hasChanges = true;
          }
        });
      }

      const checkDifferences = (oldItems: ChecklistItem[], newItems: ChecklistItem[]) => {
        newItems.forEach((newItem) => {
          const oldItem = oldItems.find(x => x.id === newItem.id);
          if (!oldItem) return;
          
          if (newItem.type === 'checkbox' || newItem.type === 'lockedApproval') {
            if (oldItem.value === false && newItem.value === true) {
              newActivity.unshift({ date: Date.now(), message: `"${newItem.label}" marked complete` });
              hasChanges = true;
            } else if (oldItem.value === true && newItem.value === false) {
              newActivity.unshift({ date: Date.now(), message: `"${newItem.label}" unchecked` });
              hasChanges = true;
            }
          }
          
          if (newItem.type === 'text') {
            if (oldItem.value !== newItem.value) {
              if (newItem.value) {
                newActivity.unshift({ date: Date.now(), message: `"${newItem.label}" updated` });
              } else {
                newActivity.unshift({ date: Date.now(), message: `"${newItem.label}" removed` });
              }
              hasChanges = true;
            }
          }
          
          if (newItem.type === 'lockedApproval' && newItem.value === true && oldItem.value === false) {
             newActivity.unshift({ date: Date.now(), message: `"${newItem.label}" confirmed and locked` });
             hasChanges = true;
          }

          if (newItem.children && oldItem.children) {
            checkDifferences(oldItem.children, newItem.children);
          }
        });
      };

      checkDifferences(oldProject.checklist, project.checklist);
      
      projects[index] = { 
        ...project, 
        activity: newActivity,
        lastUpdated: hasChanges ? Date.now() : project.lastUpdated 
      };
    } else {
      if (!newActivity.find(a => a.message === 'Created')) {
        newActivity.unshift({ date: Date.now(), message: 'Created' });
      }
      projects.push({ ...project, activity: newActivity, lastUpdated: Date.now() });
    }

    ProjectStore.saveProjects(projects);

    // ── Cloud push (optimistic; UI already updated above) ──────────────
    const finalProject = (index >= 0 ? projects[index] : projects[projects.length - 1]) as Project;
    // Entries unshifted during this save = the slice in front of the
    // caller-provided activity array.
    const addedActivity = finalProject.activity.slice(
      0,
      Math.max(0, finalProject.activity.length - baseActivityLen),
    );
    // New review messages (all nested threads), diffed by message id.
    const oldMessageIds = new Set(
      (previousProject ? collectReviewMessages(previousProject) : []).map((m) => m.message.id),
    );
    const newMessages = collectReviewMessages(finalProject).filter(
      (m) => !oldMessageIds.has(m.message.id),
    );
    queueUpsert(finalProject, addedActivity, newMessages);
  },

  deleteProject: (id: string): void => {
    const projects = ProjectStore.getProjects();
    const updated = projects.filter(p => p.id !== id);
    ProjectStore.saveProjects(updated);
    queueDelete(id);
  },

  createEmptyProject: (): Project => ({
    id: `proj-${Date.now()}`,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sectionType: 'other',
    title: 'New Project',
    slug: '',
    category: '',
    year: '',
    medium: '',
    dimensions: '',
    shortDescription: '',
    longDescription: '',
    credits: '',
    notesFromSuruchi: '',
    internalBuildNotes: '',
    driveLinks: '',
    owner: 'Suruchi',
    status: 'waiting-for-content',
    checklist: getChecklistTemplate('other'),
    activity: [],
    reviewThread: [],
    miniPages: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  }),

  exportData: (): string => {
    return JSON.stringify(cache ?? loadLocalProjects() ?? [], null, 2);
  },

  /**
   * Restore from a JSON backup. Replaces cache + localStorage and pushes
   * every project to Supabase (kept as the backup/restore safety net —
   * Supabase is the primary store).
   */
  importData: async (jsonData: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonData) as any[];
      if (!Array.isArray(parsed)) return false;

      const migrated = parsed.map(migrateProject);
      migrated.forEach(p => {
        p.activity.unshift({ date: Date.now(), message: 'Imported from backup' });
      });
      ProjectStore.saveProjects(migrated);
      for (const p of migrated) {
        // Restore: push the full project; no new audit rows.
        queueUpsert(p, [], []);
      }
      return true;
    } catch (e) {
      console.error('Invalid JSON for import', e);
      return false;
    }
  }
};

export const isWaitingOnSuruchi = (project: Project): boolean => {
  if (project.status === 'published' || project.status === 'approved') return false;
  return getIncompleteItemsByOwner(project, 'Suruchi').length > 0;
};

export const isWaitingOnSteevez = (project: Project): boolean => {
  if (project.status === 'published' || project.status === 'approved') return false;
  return getIncompleteItemsByOwner(project, 'Steevez').length > 0;
};
