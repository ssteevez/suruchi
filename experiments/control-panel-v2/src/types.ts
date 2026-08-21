export type Person = "Steevez" | "Suruchi" | "Shared";
export type UserRole = "viewer" | "admin";
export type TaskStatus = "not-started" | "in-progress" | "completed" | "approved" | "blocked";
export type ApprovalRequirement = "none" | "steevez" | "suruchi" | "both" | "final";
export type EntityType =
  | "page"
  | "subpage"
  | "task"
  | "subtask"
  | "asset"
  | "payment"
  | "euphemism"
  | "link"
  | "content";

export interface Approval {
  required: ApprovalRequirement;
  approvedBy: Person[];
  finalApproved: boolean;
}

export interface ReviewThread {
  id: string;
  relatedToType: EntityType;
  relatedToId: string;
  title: string;
  commentIds: string[];
}

export interface ReviewComment {
  id: string;
  author: Person;
  message: string;
  relatedToType: EntityType;
  relatedToId: string;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: Person;
  resolvedAt?: string;
}

export interface LinkField {
  id: string;
  label: string;
  value: string;
  required: boolean;
  autoCompletesTaskId?: string;
}

export interface ContentField {
  id: string;
  label: string;
  value: string;
  required: boolean;
  autoCompletesTaskId?: string;
}

export interface SubTask {
  id: string;
  parentId: string;
  pageId: string;
  subpageId?: string;
  taskId: string;
  type: "subtask";
  title: string;
  description: string;
  assignedTo: Person;
  completedBy: Person[];
  approvedBy: Person[];
  approval: Approval;
  status: TaskStatus;
  locked: boolean;
  dependencyIds: string[];
  paymentDependencyId?: string;
  reviewThreadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  parentId?: string;
  pageId: string;
  subpageId?: string;
  taskId?: string;
  type: "task" | "euphemism";
  title: string;
  description: string;
  assignedTo: Person;
  completedBy: Person[];
  approvedBy: Person[];
  approval: Approval;
  status: TaskStatus;
  locked: boolean;
  dependencyIds: string[];
  paymentDependencyId?: string;
  reviewThreadId: string;
  createdAt: string;
  updatedAt: string;
  subtasks: SubTask[];
  linkFields: LinkField[];
  contentFields: ContentField[];
  euphemismText?: string;
  interactionIntended?: string;
  notes?: string;
}

export interface Asset {
  id: string;
  parentId?: string;
  pageId: string;
  subpageId?: string;
  taskId?: string;
  type: "asset";
  title: string;
  assetType: "photo" | "video" | "document" | "audio" | "other";
  sourceLink: string;
  dimension: string;
  year: string;
  medium: string;
  fileFormat: string;
  usageLocation: string;
  status: "missing" | "linked" | "downloaded" | "optimized" | "approved";
  notes: string;
  addedBy: Person;
  approvedBy: Person[];
  reviewThreadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubPage {
  id: string;
  parentId: string;
  pageId: string;
  subpageId: string;
  type: "subpage";
  title: string;
  description: string;
  netlifyPreviewLink: string;
  reviewThreadId: string;
  taskIds: string[];
  assetIds: string[];
  linkFields: LinkField[];
  contentFields: ContentField[];
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  parentId?: string;
  pageId: string;
  subpageId?: string;
  type: "page";
  title: string;
  description: string;
  netlifyPreviewLink: string;
  statusSummary: string;
  reviewThreadId: string;
  taskIds: string[];
  subpageIds: string[];
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMilestone {
  id: string;
  parentId?: string;
  pageId?: string;
  subpageId?: string;
  taskId?: string;
  type: "payment";
  title: string;
  description: string;
  amount: string;
  state: "advance" | "structure" | "final-build" | "final-approval";
  satisfied: boolean;
  paidAt?: string;
  dependencyIds: string[];
  reviewThreadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionLogEntry {
  id: string;
  actor: Person;
  message: string;
  createdAt: string;
}

export interface ControlPanelState {
  pages: Page[];
  subpages: SubPage[];
  tasks: Task[];
  assets: Asset[];
  paymentMilestones: PaymentMilestone[];
  reviewThreads: ReviewThread[];
  reviewComments: ReviewComment[];
  actionLog: ActionLogEntry[];
}
