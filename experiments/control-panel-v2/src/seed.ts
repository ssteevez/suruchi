import type {
  Asset,
  ControlPanelState,
  LinkField,
  Page,
  PaymentMilestone,
  Person,
  ReviewThread,
  SubPage,
  Task,
} from "./types";

const seedTime = "2026-06-12T00:00:00.000Z";

const thread = (id: string, relatedToType: ReviewThread["relatedToType"], relatedToId: string, title: string): ReviewThread => ({
  id,
  relatedToType,
  relatedToId,
  title,
  commentIds: [],
});

const approvalFor = (required: Task["approval"]["required"]): Task["approval"] => ({
  required,
  approvedBy: [],
  finalApproved: false,
});

const makeTask = (
  id: string,
  pageId: string,
  title: string,
  assignedTo: Person,
  approvalRequired: Task["approval"]["required"],
  description: string,
  options: {
    subpageId?: string;
    dependencyIds?: string[];
    paymentDependencyId?: string;
    linkFields?: LinkField[];
    contentLabels?: string[];
    type?: Task["type"];
    euphemismText?: string;
    interactionIntended?: string;
    notes?: string;
  } = {},
): Task => ({
  id,
  pageId,
  subpageId: options.subpageId,
  type: options.type ?? "task",
  title,
  description,
  assignedTo,
  completedBy: [],
  approvedBy: [],
  approval: approvalFor(approvalRequired),
  status: "not-started",
  locked: false,
  dependencyIds: options.dependencyIds ?? [],
  paymentDependencyId: options.paymentDependencyId,
  reviewThreadId: `thread-${id}`,
  createdAt: seedTime,
  updatedAt: seedTime,
  subtasks: [],
  linkFields: options.linkFields ?? [],
  contentFields: (options.contentLabels ?? []).map((label, index) => ({
    id: `${id}-content-${index + 1}`,
    label,
    value: "",
    required: true,
    autoCompletesTaskId: id,
  })),
  euphemismText: options.euphemismText,
  interactionIntended: options.interactionIntended,
  notes: options.notes,
});

const makeSubPage = (
  id: string,
  pageId: string,
  title: string,
  description: string,
  taskIds: string[],
  options: {
    assetIds?: string[];
    linkFields?: LinkField[];
    contentFields?: SubPage["contentFields"];
  } = {},
): SubPage => ({
  id,
  parentId: pageId,
  pageId,
  subpageId: id,
  type: "subpage",
  title,
  description,
  netlifyPreviewLink: "",
  reviewThreadId: `thread-${id}`,
  taskIds,
  assetIds: options.assetIds ?? [],
  linkFields: options.linkFields ?? [],
  contentFields: options.contentFields ?? [],
  createdAt: seedTime,
  updatedAt: seedTime,
});

const makePage = (id: string, title: string, description: string, taskIds: string[], subpageIds: string[], assetIds: string[] = []): Page => ({
  id,
  pageId: id,
  type: "page",
  title,
  description,
  netlifyPreviewLink: "",
  statusSummary: "Local experiment seeded and ready for production tracking.",
  reviewThreadId: `thread-${id}`,
  taskIds,
  subpageIds,
  assetIds,
  createdAt: seedTime,
  updatedAt: seedTime,
});

const makePayment = (
  id: string,
  title: string,
  state: PaymentMilestone["state"],
  satisfied: boolean,
  dependencyIds: string[],
): PaymentMilestone => ({
  id,
  type: "payment",
  title,
  description: "Editable placeholder milestone. Amount can be filled later.",
  amount: "",
  state,
  satisfied,
  paidAt: satisfied ? seedTime : undefined,
  dependencyIds,
  reviewThreadId: `thread-${id}`,
  createdAt: seedTime,
  updatedAt: seedTime,
});

const homepageTasks = [
  makeTask("home-structure-built", "homepage", "Structure built", "Steevez", "suruchi", "Build the Homepage structure."),
  makeTask("home-structure-approved", "homepage", "Structure approved", "Suruchi", "steevez", "Approve structure and require Steevez acknowledgement.", {
    dependencyIds: ["home-structure-built"],
  }),
  makeTask("home-video-link", "homepage", "High-res link to video", "Suruchi", "steevez", "Auto-completes when a valid high-res video link is logged.", {
    dependencyIds: ["home-structure-approved"],
    linkFields: [{ id: "home-video-drive-link", label: "Google Drive video link", value: "", required: true, autoCompletesTaskId: "home-video-link" }],
  }),
  makeTask("home-content-given", "homepage", "Content given for bio, contact, tearsheet", "Suruchi", "steevez", "Auto-completes when required content/link fields are provided.", {
    dependencyIds: ["home-structure-approved"],
  }),
  makeTask("home-final-video-count", "homepage", "Final number of videos edited", "Shared", "both", "Agree the final video count before optimization."),
  makeTask("home-resizing", "homepage", "Resizing / optimising", "Steevez", "suruchi", "Resize, optimize, and prepare final media.", {
    dependencyIds: ["home-video-link", "home-final-video-count"],
  }),
  makeTask("home-final-build", "homepage", "Final Build", "Steevez", "suruchi", "Build the final Homepage implementation.", {
    dependencyIds: ["home-resizing", "home-content-given"],
    paymentDependencyId: "payment-final-build",
  }),
  makeTask("home-review", "homepage", "Review", "Shared", "both", "Shared review round for final Homepage."),
  makeTask("home-final-approval", "homepage", "Final Approval", "Suruchi", "final", "Final Homepage approval.", {
    dependencyIds: ["home-final-build", "home-review"],
    paymentDependencyId: "payment-final-approval",
  }),
];

const bioTask = makeTask("bio-drive-link", "homepage", "Bio PDF linked", "Suruchi", "steevez", "Auto-completes when the Google Drive bio.pdf link is entered.", {
  subpageId: "home-bio",
  linkFields: [{ id: "bio-pdf-link", label: "Google Drive link to bio.pdf", value: "", required: true, autoCompletesTaskId: "bio-drive-link" }],
});

const contactTask = makeTask("contact-content", "homepage", "Contact / enquiry details collected", "Suruchi", "steevez", "Collect public contact, enquiry, and social details.", {
  subpageId: "home-contact",
  contentLabels: ["Mobile", "Email", "Sales enquiry contact", "Gallery contact"],
  linkFields: [
    { id: "contact-facebook", label: "Facebook", value: "", required: false },
    { id: "contact-instagram", label: "Instagram", value: "", required: false },
    { id: "contact-x", label: "X", value: "", required: false },
    { id: "contact-youtube", label: "YouTube", value: "", required: false },
  ],
});

const tearsheetTask = makeTask("tearsheet-article-1", "homepage", "Tearsheet article 1", "Suruchi", "steevez", "Track article title, screenshot, and web link.", {
  subpageId: "home-tearsheet",
  linkFields: [
    { id: "tearsheet-screenshot-1", label: "Screenshot Google Drive link", value: "", required: true, autoCompletesTaskId: "tearsheet-article-1" },
    { id: "tearsheet-web-1", label: "Web link", value: "", required: false },
  ],
  contentLabels: ["Article title"],
});

const poetTopTasks = [
  makeTask("poet-bandra-structure-built", "poet", "Bandra structure built", "Steevez", "suruchi", "Build the structure for Celebrating Bandra."),
  makeTask("poet-bandra-structure-approved", "poet", "Bandra structure approved", "Suruchi", "steevez", "Approve the Celebrating Bandra structure.", {
    dependencyIds: ["poet-bandra-structure-built"],
  }),
  makeTask("poet-euphemisms-structure-built", "poet", "Euphemisms structure built", "Steevez", "suruchi", "Build the structure for Euphemisms."),
  makeTask("poet-euphemisms-structure-approved", "poet", "Euphemisms structure approved", "Suruchi", "steevez", "Approve the Euphemisms structure.", {
    dependencyIds: ["poet-euphemisms-structure-built"],
  }),
  makeTask("poet-euphemism-total-decided", "poet", "Total number of Euphemisms decided", "Shared", "both", "Agree the final number of Euphemism works."),
  makeTask("poet-bandra-visual-language", "poet", "Bandra visual language approved", "Shared", "both", "Approve the Bandra visual language."),
  makeTask("poet-bandra-final-build", "poet", "Bandra final build", "Steevez", "suruchi", "Final build for Celebrating Bandra."),
  makeTask("poet-euphemisms-final-build", "poet", "Euphemisms final build", "Steevez", "suruchi", "Final build for Euphemisms."),
  makeTask("poet-review", "poet", "Poet review", "Shared", "both", "Shared review for the Poet page."),
  makeTask("poet-bandra-final-approval", "poet", "Bandra final approval", "Suruchi", "final", "Final approval for Celebrating Bandra.", {
    dependencyIds: ["poet-bandra-final-build", "poet-review"],
  }),
  makeTask("poet-euphemisms-final-approval", "poet", "Euphemisms final approval", "Suruchi", "final", "Final approval for Euphemisms.", {
    dependencyIds: ["poet-euphemisms-final-build", "poet-review"],
  }),
];

const bandraTasks = [
  makeTask("bandra-visual-language", "poet", "Visual language approved?", "Shared", "both", "Approve the visual language.", { subpageId: "poet-celebrating-bandra" }),
  makeTask("bandra-artwork-description", "poet", "Artwork description", "Suruchi", "steevez", "Provide and approve artwork description.", { subpageId: "poet-celebrating-bandra" }),
  makeTask("bandra-interaction-instruction", "poet", "Instruction to interact", "Suruchi", "steevez", "Provide the instruction copy for the interaction.", { subpageId: "poet-celebrating-bandra" }),
  makeTask("bandra-final-build", "poet", "Final build", "Steevez", "suruchi", "Final build for Celebrating Bandra.", {
    subpageId: "poet-celebrating-bandra",
    paymentDependencyId: "payment-final-build",
  }),
  makeTask("bandra-review", "poet", "Review", "Shared", "both", "Shared review for Celebrating Bandra.", { subpageId: "poet-celebrating-bandra" }),
  makeTask("bandra-final-approval", "poet", "Final approval", "Suruchi", "final", "Final approval for Celebrating Bandra.", {
    subpageId: "poet-celebrating-bandra",
    dependencyIds: ["bandra-final-build", "bandra-review"],
    paymentDependencyId: "payment-final-approval",
  }),
];

const euphemismTask = (slug: string, title: string, text: string): Task => {
  const parent = makeTask(`euphemism-${slug}`, "poet", title, "Shared", "both", "Euphemism system entry with its own subtask ladder.", {
    subpageId: "poet-euphemisms",
    type: "euphemism",
    euphemismText: text,
    interactionIntended: "",
    notes: "",
    linkFields: [{ id: `euphemism-${slug}-drive`, label: "Google Drive link", value: "", required: false }],
  });
  parent.subtasks = [
    "Title approved?",
    "Interaction approved?",
    "Final build",
    "Review",
    "Approved",
  ].map((titleText, index) => ({
    id: `${parent.id}-subtask-${index + 1}`,
    parentId: parent.id,
    pageId: "poet",
    subpageId: "poet-euphemisms",
    taskId: parent.id,
    type: "subtask",
    title: titleText,
    description: `Subtask for ${title}.`,
    assignedTo: index === 2 ? "Steevez" : index === 4 ? "Suruchi" : "Shared",
    completedBy: [],
    approvedBy: [],
    approval: approvalFor(index === 2 || index === 4 ? "suruchi" : "both"),
    status: "not-started",
    locked: false,
    dependencyIds: [],
    reviewThreadId: `thread-${parent.id}-subtask-${index + 1}`,
    createdAt: seedTime,
    updatedAt: seedTime,
  }));
  return parent;
};

const euphemismTasks = [
  euphemismTask("magic", "Magic", "Magic"),
  euphemismTask("plainness", "Plainness", "Plainness"),
  euphemismTask("just-so", "Just So", "Just So"),
  euphemismTask("somewhere-something", "Somewhere Something", "Somewhere Something"),
  euphemismTask("issued-in-public-interest", "Issued in Public Interest", "Issued in Public Interest"),
  euphemismTask("self", "SELF", "SELF"),
  euphemismTask("born-die", "born/die", "born/die"),
  euphemismTask("fact-fiction", "Fact Fiction", "Fact Fiction"),
];

const assets: Asset[] = [
  {
    id: "asset-home-video",
    pageId: "homepage",
    type: "asset",
    title: "Homepage hero video",
    assetType: "video",
    sourceLink: "",
    dimension: "",
    year: "",
    medium: "",
    fileFormat: "",
    usageLocation: "Homepage hero",
    status: "missing",
    notes: "Awaiting high-res Drive link.",
    addedBy: "Steevez",
    approvedBy: [],
    reviewThreadId: "thread-asset-home-video",
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "asset-bandra-visual",
    pageId: "poet",
    subpageId: "poet-celebrating-bandra",
    type: "asset",
    title: "Celebrating Bandra visual source",
    assetType: "photo",
    sourceLink: "",
    dimension: "",
    year: "",
    medium: "",
    fileFormat: "",
    usageLocation: "Celebrating Bandra",
    status: "missing",
    notes: "",
    addedBy: "Steevez",
    approvedBy: [],
    reviewThreadId: "thread-asset-bandra-visual",
    createdAt: seedTime,
    updatedAt: seedTime,
  },
];

const tasks = [...homepageTasks, bioTask, contactTask, tearsheetTask, ...poetTopTasks, ...bandraTasks, ...euphemismTasks];

const pages = [
  makePage(
    "homepage",
    "Homepage",
    "Homepage production tracker with Bio, Contact / Enquiry, and Tearsheet mini pages.",
    homepageTasks.map((task) => task.id),
    ["home-bio", "home-contact", "home-tearsheet"],
    ["asset-home-video"],
  ),
  makePage(
    "poet",
    "Poet",
    "Poet page tracker for Celebrating Bandra and Euphemisms.",
    poetTopTasks.map((task) => task.id),
    ["poet-celebrating-bandra", "poet-euphemisms"],
  ),
];

const subpages = [
  makeSubPage("home-bio", "homepage", "Bio", "Bio mini page with PDF Drive link and notes.", [bioTask.id], {
    linkFields: [{ id: "bio-page-drive-link", label: "Google Drive link to bio.pdf", value: "", required: true, autoCompletesTaskId: bioTask.id }],
    contentFields: [{ id: "bio-notes", label: "Notes", value: "", required: false }],
  }),
  makeSubPage("home-contact", "homepage", "Contact / Enquiry", "Public contact and enquiry details.", [contactTask.id]),
  makeSubPage("home-tearsheet", "homepage", "Tearsheet", "Article inventory with screenshot and web links.", [tearsheetTask.id]),
  makeSubPage("poet-celebrating-bandra", "poet", "Celebrating Bandra", "Poet mini page for Celebrating Bandra.", bandraTasks.map((task) => task.id), {
    assetIds: ["asset-bandra-visual"],
  }),
  makeSubPage("poet-euphemisms", "poet", "Euphemisms", "System list of Euphemism entries.", euphemismTasks.map((task) => task.id)),
];

const payments = [
  makePayment("payment-advance", "Advance", "advance", true, []),
  makePayment("payment-structure", "After all structure approved", "structure", false, ["home-structure-approved", "poet-celebrate-structure", "poet-euphemism-structure"]),
  makePayment("payment-final-build", "After final build", "final-build", false, ["home-final-build", "bandra-final-build"]),
  makePayment("payment-final-approval", "After final approval", "final-approval", false, ["home-final-approval", "bandra-final-approval"]),
];

const allThreads = [
  ...pages.map((page) => thread(page.reviewThreadId, "page", page.id, page.title)),
  ...subpages.map((subpage) => thread(subpage.reviewThreadId, "subpage", subpage.id, subpage.title)),
  ...tasks.flatMap((task) => [
    thread(task.reviewThreadId, task.type, task.id, task.title),
    ...task.subtasks.map((subtask) => thread(subtask.reviewThreadId, "subtask", subtask.id, subtask.title)),
  ]),
  ...assets.map((asset) => thread(asset.reviewThreadId, "asset", asset.id, asset.title)),
  ...payments.map((payment) => thread(payment.reviewThreadId, "payment", payment.id, payment.title)),
];

export const seedState: ControlPanelState = {
  pages,
  subpages,
  tasks,
  assets,
  paymentMilestones: payments,
  reviewThreads: allThreads,
  reviewComments: [],
  actionLog: [
    {
      id: "log-seed",
      actor: "Steevez",
      message: "Control Panel V2 local experiment seeded.",
      createdAt: seedTime,
    },
  ],
};
