import type {
  ApprovalRequirement,
  Asset,
  ControlPanelState,
  EntityType,
  LinkField,
  Page,
  PaymentMilestone,
  Person,
  ReviewComment,
  ReviewThread,
  SubPage,
  SubTask,
  Task,
  TaskStatus,
} from "./types";

let localCounter = 0;

export const nowIso = (): string => new Date().toISOString();

export const createId = (prefix: string): string => {
  localCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${localCounter.toString(36)}`;
};

export const isValidLink = (value: string): boolean => value.trim().startsWith("http");

export const approvalTargets = (required: ApprovalRequirement, assignedTo: Person): Person[] => {
  if (required === "none") return [];
  if (required === "both") return ["Steevez", "Suruchi"];
  if (required === "final") return ["Suruchi"];
  if (required === "steevez") return ["Steevez"];
  if (required === "suruchi") return ["Suruchi"];
  if (assignedTo === "Steevez") return ["Suruchi"];
  if (assignedTo === "Suruchi") return ["Steevez"];
  return ["Steevez", "Suruchi"];
};

export const isComplete = (item: Task | SubTask): boolean => {
  if (item.assignedTo === "Shared") return item.completedBy.length > 0;
  return item.completedBy.includes(item.assignedTo);
};

export const isApproved = (item: Task | SubTask): boolean => {
  const targets = approvalTargets(item.approval.required, item.assignedTo);
  if (targets.length === 0) return isComplete(item);
  return targets.every((person) => item.approvedBy.includes(person));
};

export const statusForTask = (item: Task | SubTask, locked: boolean): TaskStatus => {
  if (locked) return "blocked";
  if (isApproved(item)) return "approved";
  if (isComplete(item)) return "completed";
  if (item.completedBy.length > 0 || item.approvedBy.length > 0) return "in-progress";
  return "not-started";
};

export const findTask = (state: ControlPanelState, id: string): Task | undefined =>
  state.tasks.find((task) => task.id === id);

export const findSubTask = (state: ControlPanelState, id: string): SubTask | undefined => {
  for (const task of state.tasks) {
    const subtask = task.subtasks.find((item) => item.id === id);
    if (subtask) return subtask;
  }
  return undefined;
};

export const finalEditApproved = (state: ControlPanelState, pageId: string, subpageId?: string): boolean =>
  state.tasks.some((task) => {
    const sameScope = task.pageId === pageId && (!subpageId || task.subpageId === subpageId);
    return sameScope && task.title.toLowerCase().includes("final edit") && isApproved(task);
  });

export const assetAdditionLocked = (
  state: ControlPanelState,
  pageId: string,
  subpageId: string | undefined,
  isAdmin: boolean,
): boolean => !isAdmin && finalEditApproved(state, pageId, subpageId);

export const taskLockReason = (
  state: ControlPanelState,
  task: Task | SubTask,
  isAdmin: boolean,
): string | null => {
  if (isAdmin) return null;
  if (task.paymentDependencyId) {
    const payment = state.paymentMilestones.find((item) => item.id === task.paymentDependencyId);
    if (payment && !payment.satisfied) {
      return `Blocked until payment milestone is satisfied: ${payment.title}`;
    }
  }
  const dependencies = task.dependencyIds
    .map((id) => findTask(state, id) ?? findSubTask(state, id))
    .filter((dependency): dependency is Task | SubTask => dependency !== undefined);
  const missingDependency = dependencies.find((dependency) => !isApproved(dependency));
  if (missingDependency) {
    return `Blocked until milestone is approved: ${missingDependency.title}`;
  }
  if (task.locked) return "Locked by manual control.";
  return null;
};

export const pageTasks = (state: ControlPanelState, page: Page, subpage?: SubPage): Task[] => {
  const ids = subpage ? subpage.taskIds : page.taskIds;
  return ids
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task));
};

export const pageProgress = (state: ControlPanelState, page: Page, subpage?: SubPage): number => {
  const tasks = pageTasks(state, page, subpage);
  if (tasks.length === 0) return 0;
  const completeCount = tasks.filter((task) => isApproved(task)).length;
  return Math.round((completeCount / tasks.length) * 100);
};

export const blockersForScope = (state: ControlPanelState, page: Page, subpage?: SubPage): string[] => {
  const lockedTasks = pageTasks(state, page, subpage)
    .map((task) => taskLockReason(state, task, false))
    .filter((reason): reason is string => Boolean(reason));
  return [...new Set(lockedTasks)];
};

export const threadFor = (
  state: ControlPanelState,
  relatedToType: EntityType,
  relatedToId: string,
  title: string,
): ReviewThread => {
  const existing = state.reviewThreads.find(
    (thread) => thread.relatedToType === relatedToType && thread.relatedToId === relatedToId,
  );
  if (existing) return existing;
  return {
    id: createId("thread"),
    relatedToType,
    relatedToId,
    title,
    commentIds: [],
  };
};

export const commentsForThread = (state: ControlPanelState, threadId: string): ReviewComment[] => {
  const thread = state.reviewThreads.find((item) => item.id === threadId);
  if (!thread) return [];
  return thread.commentIds
    .map((id) => state.reviewComments.find((comment) => comment.id === id))
    .filter((comment): comment is ReviewComment => Boolean(comment));
};

export const addAction = (state: ControlPanelState, actor: Person, message: string): ControlPanelState => ({
  ...state,
  actionLog: [
    { id: createId("log"), actor, message, createdAt: nowIso() },
    ...state.actionLog,
  ].slice(0, 24),
});

export const withAutoCompletion = (state: ControlPanelState): ControlPanelState => {
  const tasks = state.tasks.map((task) => {
    const completedBy = new Set(task.completedBy);
    const allFields = [...task.linkFields, ...task.contentFields];
    allFields.forEach((field) => {
      if (field.autoCompletesTaskId === task.id && field.required && field.value.trim() !== "") {
        if ("value" in field && (field.label.toLowerCase().includes("link") || field.label.toLowerCase().includes("drive"))) {
          if (isValidLink(field.value)) completedBy.add(task.assignedTo === "Shared" ? "Steevez" : task.assignedTo);
        } else {
          completedBy.add(task.assignedTo === "Shared" ? "Steevez" : task.assignedTo);
        }
      }
    });
    if (task.id === "home-content-given") {
      const requiredMiniTasks = ["bio-drive-link", "contact-content", "tearsheet-article-1"];
      const miniContentReady = requiredMiniTasks.every((id) => {
        const miniTask = state.tasks.find((candidate) => candidate.id === id);
        return miniTask ? isComplete(miniTask) : false;
      });
      if (miniContentReady) completedBy.add("Suruchi");
    }
    if (task.id === "tearsheet-article-1") {
      const tearsheetSubpage = state.subpages.find((subpage) => subpage.id === "home-tearsheet");
      const countValue = tearsheetSubpage?.contentFields.find((field) => field.id === "tearsheet-article-count")?.value ?? "";
      const approvedBy = tearsheetSubpage?.contentFields.find((field) => field.id === "tearsheet-article-count-approved")?.value ?? "";
      const count = Math.max(0, Number.parseInt(countValue, 10) || 0);
      const allArticlesSaved =
        approvedBy === "Suruchi" &&
        count > 0 &&
        Array.from({ length: count }, (_, index) => index + 1).every((articleIndex) =>
          Boolean(tearsheetSubpage?.contentFields.find((field) => field.id === `tearsheet-article-${articleIndex}-saved`)?.value),
        );
      if (allArticlesSaved) completedBy.add("Suruchi");
    }
    return { ...task, completedBy: [...completedBy], contentFields: task.id === "home-content-given" ? [] : task.contentFields };
  });
  return { ...state, tasks };
};

export const recomputeStatuses = (state: ControlPanelState, isAdmin = false): ControlPanelState => ({
  ...state,
  tasks: state.tasks.map((task) => ({
    ...task,
    status: statusForTask(task, Boolean(taskLockReason(state, task, isAdmin))),
    subtasks: task.subtasks.map((subtask) => ({
      ...subtask,
      status: statusForTask(subtask, Boolean(taskLockReason(state, subtask, isAdmin))),
    })),
  })),
});

export const createEmptyTask = (pageId: string, subpageId?: string): Task => {
  const id = createId("task");
  const reviewThreadId = createId("thread");
  const time = nowIso();
  return {
    id,
    pageId,
    subpageId,
    type: "task",
    title: "New task",
    description: "Describe the production step.",
    assignedTo: "Shared",
    completedBy: [],
    approvedBy: [],
    approval: { required: "both", approvedBy: [], finalApproved: false },
    status: "not-started",
    locked: false,
    dependencyIds: [],
    reviewThreadId,
    createdAt: time,
    updatedAt: time,
    subtasks: [],
    linkFields: [],
    contentFields: [],
  };
};

export const createEmptySubtask = (task: Task): SubTask => {
  const id = createId("subtask");
  const time = nowIso();
  return {
    id,
    parentId: task.id,
    pageId: task.pageId,
    subpageId: task.subpageId,
    taskId: task.id,
    type: "subtask",
    title: "New subtask",
    description: "Describe the smaller step.",
    assignedTo: "Shared",
    completedBy: [],
    approvedBy: [],
    approval: { required: "both", approvedBy: [], finalApproved: false },
    status: "not-started",
    locked: false,
    dependencyIds: [],
    reviewThreadId: createId("thread"),
    createdAt: time,
    updatedAt: time,
  };
};

export const createEmptyAsset = (pageId: string, subpageId: string | undefined, addedBy: Person): Asset => {
  const time = nowIso();
  return {
    id: createId("asset"),
    pageId,
    subpageId,
    type: "asset",
    title: "Untitled asset",
    assetType: "photo",
    sourceLink: "",
    dimension: "",
    year: "",
    medium: "",
    fileFormat: "",
    usageLocation: "",
    status: "missing",
    notes: "",
    addedBy,
    approvedBy: [],
    reviewThreadId: createId("thread"),
    createdAt: time,
    updatedAt: time,
  };
};

export const paymentLabel = (payment: PaymentMilestone): string =>
  `${payment.title}${payment.amount.trim() ? ` - ${payment.amount}` : " - amount TBD"}`;

export const linkFieldComplete = (field: LinkField): boolean => !field.required || isValidLink(field.value);
