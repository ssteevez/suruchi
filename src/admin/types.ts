export type ProjectStatus =
  | 'blocked'
  | 'waiting-for-content'
  | 'active'
  | 'review'
  | 'approved'
  | 'published';

export type ProjectOwner = 'Suruchi' | 'Steevez' | 'Shared';

export type SectionType = 'homepage' | 'poet' | 'painter' | 'pilgrim' | 'other';

export type ChecklistItemType = 'checkbox' | 'text' | 'lockedApproval' | 'grouped' | 'derived';

export interface PilgrimPhoto {
  id: string;
  thumbnailSrc: string;
  sourceSrc: string;
  filename: string;
  title: string;
  caption: string;
  date: string;
  updatedAt: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  owner: ProjectOwner;
  type: ChecklistItemType;
  value: string | boolean;
  dependsOn?: string; // id of another checklist item that must be true/completed
  lockedAfterComplete?: boolean;
  completedAt?: number;
  completedBy?: string;
  activityLogEnabled?: boolean;
  description?: string;
  children?: ChecklistItem[];
}

// Legacy priority preserved for safe migration, not used in new UI
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ReviewMessage {
  id: string;
  author: 'Suruchi' | 'Steevez';
  message: string;
  createdAt: number;
}

export interface MiniPage {
  id: string;
  title: string;
  status: ProjectStatus;
  owner: ProjectOwner;
  contentReceived: boolean;
  built: boolean;
  reviewed: boolean;
  approved: boolean;
  notes: string;
  fileLink: string;
  updatedAt: number;
  approvedAt?: number;
}

export interface PoetMiniPage {
  id: string;
  title: string;
  structureBuilt: boolean;
  structureApproved: boolean;
  finalApproval?: boolean;
  approvedAt?: number;
  reviewThread: ReviewMessage[];
  status: ProjectStatus;
  updatedAt: number;
}

export type EuphemismStructure = PoetMiniPage;

export interface EuphemismRequest {
  id: string;
  title: string;
  driveLink: string;
  text: string;
  interactionSystem: string;
  seenBySteevez: boolean;
  building: boolean;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityLogEntry {
  date: number; // Unix timestamp
  message: string;
}

export interface PainterArtwork {
  id: string;
  seriesId: string;
  thumbnailSrc: string;
  sourceSrc: string;
  filename: string;
  title: string;
  caption: string;
  medium: string;
  dimension: string;
  year: string;
  metadataComplete: boolean;
  updatedAt: number;
}

export interface PainterSeries {
  id: string;
  title: string;
  driveLink: string;
  imagesOptimised: boolean;
  structureBuilt: boolean;
  builtOriginal: boolean;
  structureApproved: boolean;
  finalApproval: boolean;
  approvedAt?: number;
  reviewThread: ReviewMessage[];
  artworks: PainterArtwork[];
  status: ProjectStatus;
  updatedAt: number;
}

export interface Project {
  id: string; // Unique identifier
  schemaVersion: number;
  sectionType: SectionType;
  
  title: string;
  slug: string;
  category: string;
  year: string;
  medium: string;
  dimensions: string;
  shortDescription: string;
  longDescription: string;
  credits: string;
  notesFromSuruchi: string;
  internalBuildNotes: string;
  driveLinks: string;
  
  owner: ProjectOwner;
  status: ProjectStatus;
  
  checklist: ChecklistItem[];
  activity: ActivityLogEntry[];
  
  reviewThread?: ReviewMessage[];
  miniPages?: MiniPage[];
  pilgrimPhotos?: PilgrimPhoto[];
  poetPages?: PoetMiniPage[];
  euphemismStructures?: EuphemismStructure[];
  newEuphemismRequests?: EuphemismRequest[];
  painterSeries?: PainterSeries[];
  
  createdAt: number; // Unix timestamp
  lastUpdated: number; // Unix timestamp
  
  // Legacy fields
  priority?: ProjectPriority;
  legacyChecklist?: any;
}
