import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addAction,
  blockersForScope,
  commentsForThread,
  createEmptySubtask,
  createEmptyTask,
  createId,
  approvalTargets,
  isApproved,
  isComplete,
  isValidLink,
  nowIso,
  pageProgress,
  pageTasks,
  paymentLabel,
  recomputeStatuses,
  taskLockReason,
  withAutoCompletion,
} from "./logic";
import { loadState, resetState, saveState } from "./storage";
import type {
  ControlPanelState,
  EntityType,
  Page,
  PaymentMilestone,
  Person,
  ContentField,
  ReviewComment,
  ReviewThread,
  SubPage,
  SubTask,
  Task,
  UserRole,
} from "./types";

type Selection = { pageId: string; subpageId?: string };
type TaskField = "title" | "description" | "assignedTo";

const people: Person[] = ["Steevez", "Suruchi"];

export function App() {
  const [state, setState] = useState<ControlPanelState>(() => loadState());
  const [currentPerson, setCurrentPerson] = useState<Person>("Steevez");
  const [role, setRole] = useState<UserRole>("viewer");
  const [adminPassword, setAdminPassword] = useState("");
  const [selection, setSelection] = useState<Selection>(() => ({ pageId: "overview" }));
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>(undefined);
  const isAdmin = role === "admin";

  const liveState = useMemo(() => recomputeStatuses(withAutoCompletion(state), isAdmin), [state, isAdmin]);
  const selectedPage = liveState.pages.find((page) => page.id === selection.pageId);
  const selectedSubpage = liveState.subpages.find((subpage) => subpage.id === selection.subpageId);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateState = (next: ControlPanelState, message?: string) => {
    const logged = message ? addAction(next, currentPerson, message) : next;
    setState(recomputeStatuses(withAutoCompletion(logged), isAdmin));
  };

  const loginAdmin = () => {
    if (adminPassword.trim().toLowerCase() === "steevez") {
      setRole("admin");
      setCurrentPerson("Steevez");
      setAdminPassword("");
    }
  };

  const activeTasks = selectedPage ? pageTasks(liveState, selectedPage, selectedSubpage) : [];
  const activeThreadId = selectedSubpage?.reviewThreadId ?? selectedPage?.reviewThreadId ?? "";
  const selectScope = (nextSelection: Selection, nextFocusTaskId?: string) => {
    setSelection(nextSelection);
    setFocusTaskId(nextFocusTaskId);
  };

  return (
    <div className="app-shell">
      <Sidebar
        state={liveState}
        selection={selection}
        onSelect={selectScope}
        currentPerson={currentPerson}
        setCurrentPerson={setCurrentPerson}
        role={role}
        setRole={setRole}
        adminPassword={adminPassword}
        setAdminPassword={setAdminPassword}
        loginAdmin={loginAdmin}
      />
      <main className="main-panel">
        {selection.pageId === "overview" ? (
          <MainControlPanel
            state={liveState}
            currentPerson={currentPerson}
            isAdmin={isAdmin}
            onSelect={selectScope}
            updateState={updateState}
          />
        ) : selectedPage ? (
          <PageDashboard
            state={liveState}
            page={selectedPage}
            subpage={selectedSubpage}
            tasks={activeTasks}
            currentPerson={currentPerson}
            isAdmin={isAdmin}
            activeThreadId={activeThreadId}
            focusTaskId={focusTaskId}
            onFocusHandled={() => setFocusTaskId(undefined)}
            updateState={updateState}
          />
        ) : null}
      </main>
    </div>
  );
}

function Sidebar(props: {
  state: ControlPanelState;
  selection: Selection;
  onSelect: (selection: Selection, focusTaskId?: string) => void;
  currentPerson: Person;
  setCurrentPerson: (person: Person) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  loginAdmin: () => void;
}) {
  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">Local experiment</p>
        <h1>Control Panel V2</h1>
        <p className="subtle">Quiet page-by-page tracker for the Suruchi website build.</p>
      </div>
      <div className="switcher">
        <label>View as</label>
        <div className="segmented">
          {people.map((person) => (
            <button
              key={person}
              className={props.currentPerson === person ? "active" : ""}
              onClick={() => props.setCurrentPerson(person)}
            >
              {person}
            </button>
          ))}
        </div>
        <details className="admin-tools">
          <summary>
            <span className={props.role === "admin" ? "admin-badge on" : "admin-badge"}>{props.role === "admin" ? "Admin: local-only" : "Normal mode"}</span>
          </summary>
          <div className="admin-login">
            <input
              value={props.adminPassword}
              onChange={(event) => props.setAdminPassword(event.target.value)}
              placeholder="Admin password"
              type="password"
            />
            <button onClick={props.loginAdmin}>Login</button>
          </div>
          {props.role === "admin" ? <button onClick={() => props.setRole("viewer")}>Exit admin</button> : null}
        </details>
      </div>
      <nav className="page-nav">
        <button className={props.selection.pageId === "overview" ? "active nav-button overview-button" : "nav-button overview-button"} onClick={() => props.onSelect({ pageId: "overview" })}>
          <span>Main control panel</span>
        </button>
        {props.state.pages.map((page) => (
          <div key={page.id} className="page-nav-group">
            <button className={props.selection.pageId === page.id && !props.selection.subpageId ? "active nav-button" : "nav-button"} onClick={() => props.onSelect({ pageId: page.id })}>
              <span>{page.title}</span>
              <small>{pageProgress(props.state, page)}%</small>
            </button>
            {page.subpageIds.map((subpageId) => {
              const subpage = props.state.subpages.find((item) => item.id === subpageId);
              if (!subpage) return null;
              return (
                <div key={subpage.id} className="subpage-nav-block">
                <button
                  className={props.selection.subpageId === subpage.id ? "active subnav-button" : "subnav-button"}
                  onClick={() => props.onSelect({ pageId: page.id, subpageId: subpage.id })}
                >
                  {subpage.title}
                </button>
                {subpage.id === "poet-euphemisms" && props.selection.subpageId === subpage.id ? (
                  <div className="euphemism-nav-list">
                    {subpage.taskIds.map((taskId) => {
                      const task = props.state.tasks.find((candidate) => candidate.id === taskId);
                      if (!task) return null;
                      return (
                        <button
                          key={task.id}
                          className="euphemism-nav-item"
                          onClick={() => props.onSelect({ pageId: page.id, subpageId: subpage.id }, task.id)}
                        >
                          {task.title}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function MainControlPanel(props: {
  state: ControlPanelState;
  currentPerson: Person;
  isAdmin: boolean;
  onSelect: (selection: Selection, focusTaskId?: string) => void;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  const [flowPageId, setFlowPageId] = useState(props.state.pages[0]?.id ?? "homepage");
  const allTasks = props.state.pages.flatMap((page) => pageTasks(props.state, page));
  const totalTasks = allTasks.length;
  const approvedTasks = allTasks.filter((task) => isApproved(task)).length;
  const overallProgress = totalTasks === 0 ? 0 : Math.round((approvedTasks / totalTasks) * 100);
  const openPayments = props.state.paymentMilestones.filter((payment) => !payment.satisfied).length;
  const flowPage = props.state.pages.find((page) => page.id === flowPageId) ?? props.state.pages[0];
  const flowTasks = flowPage ? pageTasks(props.state, flowPage) : [];

  return (
    <section className="dashboard">
      <header className="summary overview-summary">
        <div>
          <p className="eyebrow">Main control panel</p>
          <h2>Website progress</h2>
          <p>One place to see page progress, next production movement, open blockers, and payment stage.</p>
          <div className="overview-metrics">
            <Metric label="Pages" value={props.state.pages.length.toString()} />
            <Metric label="Approved" value={`${approvedTasks}/${totalTasks}`} />
            <Metric label="Payments open" value={openPayments.toString()} />
          </div>
        </div>
        <div className="progress-box">
          <div className="progress-ring" style={{ "--progress": `${overallProgress * 3.6}deg` } as CSSProperties}>
            <strong>{overallProgress}%</strong>
          </div>
          <small>overall page task approval</small>
        </div>
      </header>
      <section className="page-progress-grid">
        {props.state.pages.map((page) => {
          const progress = pageProgress(props.state, page);
          const tasks = pageTasks(props.state, page);
          const nextTask = tasks.find((task) => !isApproved(task) && !taskLockReason(props.state, task, props.isAdmin));
          const blockers = blockersForScope(props.state, page);
          return (
            <button key={page.id} className="page-progress-card" onClick={() => props.onSelect({ pageId: page.id })}>
              <span className="page-card-topline">
                <strong>{page.title}</strong>
                <small>{progress}%</small>
              </span>
              <span className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </span>
              <span className="page-card-next">{nextTask ? `Next: ${nextTask.title}` : "No open task waiting"}</span>
              <small>{blockers.length} blockers</small>
            </button>
          );
        })}
      </section>
      {flowPage ? (
        <section className="flow-panel overview-flow-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Natural production flow</p>
              <h3>{flowPage.title}</h3>
            </div>
            <div className="flow-page-switcher">
              {props.state.pages.map((page) => (
                <button key={page.id} className={page.id === flowPage.id ? "active" : ""} onClick={() => setFlowPageId(page.id)}>
                  {page.title}
                </button>
              ))}
            </div>
          </div>
          <TaskFlow
            tasks={flowTasks}
            state={props.state}
            isAdmin={props.isAdmin}
            onTaskSelect={(task) => props.onSelect({ pageId: task.pageId, subpageId: task.subpageId }, task.id)}
          />
        </section>
      ) : null}
      <PaymentTracker state={props.state} currentPerson={props.currentPerson} isAdmin={props.isAdmin} updateState={props.updateState} />
    </section>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

function PageDashboard(props: {
  state: ControlPanelState;
  page: Page;
  subpage?: SubPage;
  tasks: Task[];
  currentPerson: Person;
  isAdmin: boolean;
  activeThreadId: string;
  focusTaskId?: string;
  onFocusHandled: () => void;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  const scopeTitle = props.subpage ? `${props.page.title} / ${props.subpage.title}` : props.page.title;
  const blockers = blockersForScope(props.state, props.page, props.subpage);
  const progress = pageProgress(props.state, props.page, props.subpage);
  const isTearsheet = props.subpage?.id === "home-tearsheet";
  const nextTask = props.tasks.find((task) => !isApproved(task) && !taskLockReason(props.state, task, props.isAdmin));
  const defaultStart = nextTask ? Math.max(0, props.tasks.findIndex((task) => task.id === nextTask.id)) : Math.max(0, props.tasks.length - 3);
  const [queueStart, setQueueStart] = useState(defaultStart);
  const visibleTasks = props.tasks.slice(queueStart, queueStart + 3);
  const canGoBack = queueStart > 0;
  const canGoForward = queueStart + 3 < props.tasks.length;

  useEffect(() => {
    if (!props.focusTaskId) return;
    const focusIndex = props.tasks.findIndex((task) => task.id === props.focusTaskId);
    if (focusIndex < 0) return;
    setQueueStart(focusIndex);
    window.setTimeout(() => {
      document.getElementById(`task-${props.focusTaskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      props.onFocusHandled();
    }, 50);
  }, [props.focusTaskId, props.onFocusHandled, props.tasks]);

  const addTask = () => {
    const task = createEmptyTask(props.page.id, props.subpage?.id);
    const thread: ReviewThread = {
      id: task.reviewThreadId,
      relatedToType: "task",
      relatedToId: task.id,
      title: task.title,
      commentIds: [],
    };
    const next = {
      ...props.state,
      tasks: [...props.state.tasks, task],
      reviewThreads: [...props.state.reviewThreads, thread],
      pages: props.state.pages.map((page) =>
        page.id === props.page.id && !props.subpage ? { ...page, taskIds: [...page.taskIds, task.id] } : page,
      ),
      subpages: props.state.subpages.map((subpage) =>
        subpage.id === props.subpage?.id ? { ...subpage, taskIds: [...subpage.taskIds, task.id] } : subpage,
      ),
    };
    props.updateState(next, `Added task "${task.title}" to ${scopeTitle}.`);
  };

  const addEuphemism = () => {
    const task = createEmptyTask(props.page.id, props.subpage?.id);
    const euphemism: Task = {
      ...task,
      type: "euphemism",
      title: "New Euphemism",
      description: "Euphemism system entry.",
      euphemismText: "",
      interactionIntended: "",
      linkFields: [{ id: createId("link"), label: "Google Drive link", value: "", required: false }],
    };
    const next = {
      ...props.state,
      tasks: [...props.state.tasks, euphemism],
      reviewThreads: [
        ...props.state.reviewThreads,
        { id: euphemism.reviewThreadId, relatedToType: "euphemism" as EntityType, relatedToId: euphemism.id, title: euphemism.title, commentIds: [] },
      ],
      subpages: props.state.subpages.map((subpage) =>
        subpage.id === props.subpage?.id ? { ...subpage, taskIds: [...subpage.taskIds, euphemism.id] } : subpage,
      ),
    };
    props.updateState(next, "Added new Euphemism entry.");
  };

  return (
    <section className="dashboard">
      <ProgressSummary
        title={scopeTitle}
        description={props.subpage?.description ?? props.page.description}
        progress={progress}
        blockerCount={blockers.length}
        tasks={props.tasks}
        nextTask={isTearsheet ? undefined : nextTask}
        nextOverride={isTearsheet ? { title: "Set and approve article count", detail: "Suruchi locks the number before article fields appear." } : undefined}
        state={props.state}
        isAdmin={props.isAdmin}
      />
      {props.subpage?.id === "poet-euphemisms" ? (
        <div className="system-count">Current euphemisms: {props.tasks.filter((task) => task.type === "euphemism").length}</div>
      ) : null}
      <div className="dashboard-actions">
        {props.isAdmin ? <button onClick={addTask}>Add task</button> : null}
        {props.isAdmin && props.subpage?.id === "poet-euphemisms" ? <button onClick={addEuphemism}>Add new Euphemism</button> : null}
      </div>
      {isTearsheet ? (
        <TearsheetManager
          state={props.state}
          subpage={props.subpage as SubPage}
          currentPerson={props.currentPerson}
          isAdmin={props.isAdmin}
          updateState={props.updateState}
        />
      ) : null}
      {!isTearsheet ? (
        <>
          <TaskList {...props} tasks={visibleTasks} nextTaskId={nextTask?.id} />
          <div className="queue-nav">
            <button disabled={!canGoBack} onClick={() => setQueueStart(Math.max(0, queueStart - 3))}>Back 3</button>
            <span>
              Showing {queueStart + 1}-{Math.min(queueStart + 3, props.tasks.length)} of {props.tasks.length}
            </span>
            <button disabled={!canGoForward} onClick={() => setQueueStart(Math.min(props.tasks.length - 1, queueStart + 3))}>Next 3</button>
          </div>
        </>
      ) : null}
      <div className="support-grid">
        <NetlifyLinkField page={props.page} subpage={props.subpage} state={props.state} updateState={props.updateState} />
        <ReviewThreadPanel state={props.state} threadId={props.activeThreadId} currentPerson={props.currentPerson} updateState={props.updateState} />
        <HistoryLog state={props.state} isAdmin={props.isAdmin} updateState={props.updateState} />
      </div>
    </section>
  );
}

function ProgressSummary(props: {
  title: string;
  description: string;
  progress: number;
  blockerCount: number;
  tasks: Task[];
  nextTask?: Task;
  nextOverride?: { title: string; detail: string };
  state: ControlPanelState;
  isAdmin: boolean;
}) {
  const completeCount = props.tasks.filter((task) => isApproved(task)).length;
  const blockedCount = props.tasks.filter((task) => taskLockReason(props.state, task, props.isAdmin)).length;
  return (
    <header className="summary">
      <div>
        <p className="eyebrow">Selected scope</p>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
        {props.nextOverride ? (
          <div className="next-action">
            <span>Next</span>
            <strong>{props.nextOverride.title}</strong>
            <small>{props.nextOverride.detail}</small>
          </div>
        ) : props.nextTask ? (
          <div className="next-action">
            <span>Next</span>
            <strong>{props.nextTask.title}</strong>
            <small>{props.nextTask.assignedTo} owns this step</small>
          </div>
        ) : (
          <div className="next-action complete">
            <span>Next</span>
            <strong>Nothing waiting in this scope</strong>
            <small>All visible stages are approved or locked.</small>
          </div>
        )}
      </div>
      <div className="progress-box">
        <div className="progress-ring" style={{ "--progress": `${props.progress * 3.6}deg` } as CSSProperties}>
          <strong>{props.progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${props.progress}%` }} />
        </div>
        <small>{completeCount}/{props.tasks.length} approved · {props.blockerCount || blockedCount} blocked</small>
      </div>
    </header>
  );
}

function TaskFlow(props: { tasks: Task[]; state: ControlPanelState; isAdmin: boolean; onTaskSelect?: (task: Task) => void }) {
  return (
    <div className="flow-line">
      {props.tasks.map((task, index) => {
        const approved = isApproved(task);
        const firstOpenIndex = props.tasks.findIndex((candidate) => !isApproved(candidate));
        const active = index === firstOpenIndex;
        const upcoming = !approved && !active;
        return (
          <button
            key={task.id}
            className={approved ? "flow-step done" : active ? "flow-step active" : upcoming ? "flow-step upcoming" : "flow-step"}
            onClick={() => props.onTaskSelect?.(task)}
          >
            <span>{index + 1}</span>
            <small>{task.title}</small>
          </button>
        );
      })}
    </div>
  );
}

function TaskList(props: {
  state: ControlPanelState;
  page: Page;
  subpage?: SubPage;
  tasks: Task[];
  nextTaskId?: string;
  currentPerson: Person;
  isAdmin: boolean;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  return (
    <div className="task-list">
      {props.tasks.map((task) => (
        <TaskCard key={task.id} {...props} task={task} isNext={task.id === props.nextTaskId} />
      ))}
    </div>
  );
}

function TaskCard(props: {
  state: ControlPanelState;
  task: Task;
  isNext: boolean;
  currentPerson: Person;
  isAdmin: boolean;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  const lockReason = taskLockReason(props.state, props.task, props.isAdmin);
  const disabled = Boolean(lockReason) && !props.isAdmin;
  const targetApprovers = approvalTargets(props.task.approval.required, props.task.assignedTo);

  const updateTask = (patch: Partial<Task>, message?: string) => {
    props.updateState(
      {
        ...props.state,
        tasks: props.state.tasks.map((task) => (task.id === props.task.id ? { ...task, ...patch, updatedAt: nowIso() } : task)),
      },
      message,
    );
  };

  const toggleComplete = () => {
    if (disabled) return;
    const completedBy = props.task.completedBy.includes(props.currentPerson)
      ? props.task.completedBy.filter((person) => person !== props.currentPerson)
      : [...props.task.completedBy, props.currentPerson];
    updateTask({ completedBy }, `${props.currentPerson} toggled completion for "${props.task.title}".`);
  };

  const deleteTask = () => {
    if (!props.isAdmin) return;
    props.updateState(
      {
        ...props.state,
        tasks: props.state.tasks.filter((task) => task.id !== props.task.id),
        pages: props.state.pages.map((page) => ({ ...page, taskIds: page.taskIds.filter((id) => id !== props.task.id) })),
        subpages: props.state.subpages.map((subpage) => ({ ...subpage, taskIds: subpage.taskIds.filter((id) => id !== props.task.id) })),
      },
      `Deleted task "${props.task.title}".`,
    );
  };

  const addSubtask = () => {
    const subtask = createEmptySubtask(props.task);
    updateTask({ subtasks: [...props.task.subtasks, subtask] }, `Added subtask to "${props.task.title}".`);
  };

  const updateField = (field: TaskField, value: string) => {
    if (!props.isAdmin && field !== "description") return;
    updateTask({ [field]: value } as Partial<Task>);
  };

  return (
    <article className={disabled ? "task-card locked" : props.isNext ? "task-card next" : "task-card"}>
      <div className="task-topline">
        <label className="check-row">
          <input type="checkbox" checked={isComplete(props.task)} disabled={disabled} onChange={toggleComplete} />
          <span>{props.task.title}</span>
        </label>
        <div className="pills">
          <span className="pill">{props.task.assignedTo}</span>
          <span className={`pill status-${props.task.status}`}>{props.task.status}</span>
        </div>
      </div>
      {lockReason ? <LockedNotice reason={lockReason} /> : null}
      {props.task.type === "euphemism" ? <EuphemismFields state={props.state} task={props.task} updateTask={updateTask} /> : null}
      <FieldList task={props.task} updateTask={updateTask} disabled={disabled} />
      <ApprovalControl task={props.task} currentPerson={props.currentPerson} isAdmin={props.isAdmin} disabled={disabled} updateTask={updateTask} />
      <div className="approval-note">Approval required: {targetApprovers.join(" + ") || "none"}</div>
      <SubTaskList task={props.task} state={props.state} currentPerson={props.currentPerson} isAdmin={props.isAdmin} updateTask={updateTask} />
      <details className="task-details">
        <summary>Notes, thread, and admin controls</summary>
        {props.isAdmin ? (
          <div className="edit-grid">
            <input value={props.task.title} onChange={(event) => updateField("title", event.target.value)} />
            <select value={props.task.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)}>
              <option>Steevez</option>
              <option>Suruchi</option>
              <option>Shared</option>
            </select>
          </div>
        ) : null}
        <textarea value={props.task.description} disabled={!props.isAdmin} onChange={(event) => updateField("description", event.target.value)} />
        <ReviewThreadPanel state={props.state} threadId={props.task.reviewThreadId} currentPerson={props.currentPerson} updateState={props.updateState} compact />
        <div className="task-actions">
          {props.isAdmin ? <button onClick={addSubtask}>Add subtask</button> : null}
          {props.isAdmin ? <button className="danger" onClick={deleteTask}>Delete task</button> : null}
        </div>
      </details>
    </article>
  );
}

function EuphemismFields(props: { state: ControlPanelState; task: Task; updateTask: (patch: Partial<Task>, message?: string) => void }) {
  return (
    <div className="euphemism-fields">
      <label>
        Text
        <textarea value={props.task.euphemismText ?? ""} onChange={(event) => props.updateTask({ euphemismText: event.target.value })} />
      </label>
      <label>
        Interaction intended
        <input value={props.task.interactionIntended ?? ""} onChange={(event) => props.updateTask({ interactionIntended: event.target.value })} />
      </label>
      <label>
        Notes
        <input value={props.task.notes ?? ""} onChange={(event) => props.updateTask({ notes: event.target.value })} />
      </label>
    </div>
  );
}

function FieldList(props: { task: Task; updateTask: (patch: Partial<Task>, message?: string) => void; disabled: boolean }) {
  const updateLink = (id: string, value: string) => {
    const linkFields = props.task.linkFields.map((field) => (field.id === id ? { ...field, value } : field));
    props.updateTask({ linkFields }, `Updated link field on "${props.task.title}".`);
  };
  const updateContent = (id: string, value: string) => {
    const contentFields = props.task.contentFields.map((field) => (field.id === id ? { ...field, value } : field));
    props.updateTask({ contentFields }, `Updated content field on "${props.task.title}".`);
  };
  if (props.task.linkFields.length === 0 && props.task.contentFields.length === 0) return null;
  return (
    <div className="field-list">
      {props.task.linkFields.map((field) => (
        <label key={field.id}>
          {field.label}
          <span className="registered-field">
            <input className={field.required && field.value && !isValidLink(field.value) ? "invalid" : ""} value={field.value} disabled={props.disabled} onChange={(event) => updateLink(field.id, event.target.value)} />
            {field.autoCompletesTaskId ? (
              <button disabled={props.disabled || !isValidLink(field.value)} onClick={() => props.updateTask({}, `Registered link for "${props.task.title}".`)}>
                Register link
              </button>
            ) : null}
          </span>
        </label>
      ))}
      {props.task.contentFields.map((field) => (
        <label key={field.id}>
          {field.label}
          <input value={field.value} disabled={props.disabled} onChange={(event) => updateContent(field.id, event.target.value)} />
        </label>
      ))}
    </div>
  );
}

function ApprovalControl(props: {
  task: Task | SubTask;
  currentPerson: Person;
  isAdmin: boolean;
  disabled: boolean;
  updateTask: (patch: Partial<Task>, message?: string) => void;
}) {
  const targets = approvalTargets(props.task.approval.required, props.task.assignedTo);
  const toggleApproval = (person: Person) => {
    if (props.disabled || !isComplete(props.task)) return;
    const approvedBy = props.task.approvedBy.includes(person)
      ? props.task.approvedBy.filter((approvedPerson) => approvedPerson !== person)
      : [...props.task.approvedBy, person];
    props.updateTask({ approvedBy } as Partial<Task>, `${person} approval toggled for "${props.task.title}".`);
  };
  return (
    <div className="approval-control">
      <div className="approval-buttons">
        {targets.length === 0 ? <span>No approval required</span> : null}
        {targets.map((person) => (
          <button
            key={person}
            className={props.task.approvedBy.includes(person) ? "approved-button" : ""}
            disabled={props.disabled || !isComplete(props.task) || (!props.isAdmin && props.currentPerson !== person)}
            onClick={() => toggleApproval(person)}
          >
            {props.task.approvedBy.includes(person) ? `${person} approved` : `${person} approve`}
          </button>
        ))}
      </div>
      <span>{isApproved(props.task) ? "Fully approved" : `Approved by: ${props.task.approvedBy.join(", ") || "none"}`}</span>
    </div>
  );
}

function SubTaskList(props: {
  task: Task;
  state: ControlPanelState;
  currentPerson: Person;
  isAdmin: boolean;
  updateTask: (patch: Partial<Task>, message?: string) => void;
}) {
  const updateSubtask = (subtask: SubTask, patch: Partial<SubTask>) => {
    props.updateTask({ subtasks: props.task.subtasks.map((item) => (item.id === subtask.id ? { ...item, ...patch, updatedAt: nowIso() } : item)) });
  };
  if (props.task.subtasks.length === 0) return null;
  return (
    <div className="subtask-list">
      {props.task.subtasks.map((subtask) => {
        const lockReason = taskLockReason(props.state, subtask, props.isAdmin);
        const disabled = Boolean(lockReason) && !props.isAdmin;
        return (
          <div key={subtask.id} className={disabled ? "subtask locked" : "subtask"}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={isComplete(subtask)}
                disabled={disabled}
                onChange={() => {
                  const completedBy = subtask.completedBy.includes(props.currentPerson)
                    ? subtask.completedBy.filter((person) => person !== props.currentPerson)
                    : [...subtask.completedBy, props.currentPerson];
                  updateSubtask(subtask, { completedBy });
                }}
              />
              <span>{subtask.title}</span>
            </label>
            <span className="pill">{subtask.assignedTo}</span>
          </div>
        );
      })}
    </div>
  );
}

function PaymentTracker(props: {
  state: ControlPanelState;
  currentPerson: Person;
  isAdmin: boolean;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  const updatePayment = (payment: PaymentMilestone, patch: Partial<PaymentMilestone>) => {
    props.updateState(
      {
        ...props.state,
        paymentMilestones: props.state.paymentMilestones.map((item) => (item.id === payment.id ? { ...item, ...patch, updatedAt: nowIso() } : item)),
      },
      `Updated payment milestone "${payment.title}".`,
    );
  };
  return (
    <section className="side-section payment-panel">
      <h3>Payment milestones</h3>
      <div className="payment-rail" aria-hidden="true">
        {props.state.paymentMilestones.map((payment) => (
          <span key={payment.id} className={payment.satisfied ? "paid" : ""} />
        ))}
      </div>
      {props.state.paymentMilestones.map((payment) => (
        <div key={payment.id} className="payment-row">
          <label className="check-row">
            <input
              type="checkbox"
              checked={payment.satisfied}
              disabled={!props.isAdmin}
              onChange={() => updatePayment(payment, { satisfied: !payment.satisfied, paidAt: !payment.satisfied ? nowIso() : undefined })}
            />
            <span>{paymentLabel(payment)}</span>
          </label>
          <input value={payment.amount} disabled={!props.isAdmin} placeholder="Amount TBD" onChange={(event) => updatePayment(payment, { amount: event.target.value })} />
        </div>
      ))}
    </section>
  );
}

function NetlifyLinkField(props: { page: Page; subpage?: SubPage; state: ControlPanelState; updateState: (state: ControlPanelState, message?: string) => void }) {
  const value = props.subpage?.netlifyPreviewLink ?? props.page.netlifyPreviewLink;
  const generatedUrl = `https://suruchi-preview--${props.subpage?.id ?? props.page.id}.netlify.app/`;
  const update = (nextValue: string) => {
    props.updateState(
      {
        ...props.state,
        pages: props.state.pages.map((page) => (page.id === props.page.id && !props.subpage ? { ...page, netlifyPreviewLink: nextValue } : page)),
        subpages: props.state.subpages.map((subpage) => (subpage.id === props.subpage?.id ? { ...subpage, netlifyPreviewLink: nextValue } : subpage)),
      },
      "Updated Netlify preview link.",
    );
  };
  return (
    <section className="side-section">
      <h3>Netlify preview</h3>
      <div className="generated-link-row">
        <input value={value} placeholder={generatedUrl} onChange={(event) => update(event.target.value)} />
        <button onClick={() => update(generatedUrl)}>Generate</button>
      </div>
      <small>Local deterministic placeholder. Real auto-generation needs Netlify deploy/API wiring later.</small>
    </section>
  );
}

function TearsheetManager(props: {
  state: ControlPanelState;
  subpage: SubPage;
  currentPerson: Person;
  isAdmin: boolean;
  updateState: (state: ControlPanelState, message?: string) => void;
}) {
  const getFieldValue = (id: string): string => props.subpage.contentFields.find((field) => field.id === id)?.value ?? "";
  const countValue = getFieldValue("tearsheet-article-count");
  const approvedBy = getFieldValue("tearsheet-article-count-approved");
  const approved = approvedBy === "Suruchi";
  const count = approved ? Math.max(0, Number.parseInt(countValue, 10) || 0) : 0;

  const setField = (id: string, label: string, value: string) => {
    const existing = props.subpage.contentFields.some((field) => field.id === id);
    const nextField: ContentField = { id, label, value, required: false };
    const contentFields = existing
      ? props.subpage.contentFields.map((field) => (field.id === id ? { ...field, value } : field))
      : [...props.subpage.contentFields, nextField];
    props.updateState({
      ...props.state,
      subpages: props.state.subpages.map((subpage) =>
        subpage.id === props.subpage.id ? { ...subpage, contentFields, updatedAt: nowIso() } : subpage,
      ),
    });
  };

  const approveCount = () => {
    if (!countValue.trim()) return;
    setField("tearsheet-article-count-approved", "Article count approved by", "Suruchi");
  };

  const saveArticle = (index: number) => {
    setField(`tearsheet-article-${index}-saved`, `Article ${index} saved`, nowIso());
  };

  return (
    <section className="tearsheet-manager">
      <div>
        <p className="eyebrow">Tearsheet setup</p>
        <h3>Article count</h3>
      </div>
      <div className="article-count-row">
        <input
          type="number"
          min="0"
          value={countValue}
          disabled={approved && !props.isAdmin}
          placeholder="Number of articles"
          onChange={(event) => setField("tearsheet-article-count", "Number of articles", event.target.value)}
        />
        <button disabled={approved || (!props.isAdmin && props.currentPerson !== "Suruchi") || !countValue.trim()} onClick={approveCount}>
          {approved ? "Approved by Suruchi" : "Suruchi approve count"}
        </button>
      </div>
      {approved ? (
        <div className="article-grid">
          {Array.from({ length: count }, (_, itemIndex) => {
            const index = itemIndex + 1;
            return (
              <article key={index} className="article-card">
                <h4>Article {index}</h4>
                <input value={getFieldValue(`tearsheet-article-${index}-title`)} placeholder="Title" onChange={(event) => setField(`tearsheet-article-${index}-title`, `Article ${index} title`, event.target.value)} />
                <input value={getFieldValue(`tearsheet-article-${index}-screenshot`)} placeholder="Screenshot Google Drive link" onChange={(event) => setField(`tearsheet-article-${index}-screenshot`, `Article ${index} screenshot`, event.target.value)} />
                <input value={getFieldValue(`tearsheet-article-${index}-web`)} placeholder="Web link" onChange={(event) => setField(`tearsheet-article-${index}-web`, `Article ${index} web link`, event.target.value)} />
                <textarea value={getFieldValue(`tearsheet-article-${index}-notes`)} placeholder="Notes" onChange={(event) => setField(`tearsheet-article-${index}-notes`, `Article ${index} notes`, event.target.value)} />
                <button onClick={() => saveArticle(index)}>
                  {getFieldValue(`tearsheet-article-${index}-saved`) ? "Saved" : "Save article"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ReviewThreadPanel(props: {
  state: ControlPanelState;
  threadId: string;
  currentPerson: Person;
  updateState: (state: ControlPanelState, message?: string) => void;
  compact?: boolean;
}) {
  const [message, setMessage] = useState("");
  const thread = props.state.reviewThreads.find((item) => item.id === props.threadId);
  const comments = commentsForThread(props.state, props.threadId);
  if (!thread) return null;
  const addComment = () => {
    if (!message.trim()) return;
    const comment: ReviewComment = {
      id: createId("comment"),
      author: props.currentPerson,
      message: message.trim(),
      relatedToType: thread.relatedToType,
      relatedToId: thread.relatedToId,
      createdAt: nowIso(),
      resolved: false,
    };
    props.updateState(
      {
        ...props.state,
        reviewComments: [...props.state.reviewComments, comment],
        reviewThreads: props.state.reviewThreads.map((item) =>
          item.id === thread.id ? { ...item, commentIds: [...item.commentIds, comment.id] } : item,
        ),
      },
      `Added review comment to "${thread.title}".`,
    );
    setMessage("");
  };
  const resolveComment = (comment: ReviewComment) => {
    props.updateState({
      ...props.state,
      reviewComments: props.state.reviewComments.map((item) =>
        item.id === comment.id
          ? { ...item, resolved: !item.resolved, resolvedBy: props.currentPerson, resolvedAt: !item.resolved ? nowIso() : undefined }
          : item,
      ),
    });
  };
  return (
    <section className={props.compact ? "review-thread compact" : "side-section review-thread"}>
      <h3>{props.compact ? "Thread" : `Review thread: ${thread.title}`}</h3>
      <div className="comment-list">
        {comments.map((comment) => (
          <div key={comment.id} className={comment.resolved ? "comment resolved" : "comment"}>
            <strong>{comment.author}</strong>
            <p>{comment.message}</p>
            <button onClick={() => resolveComment(comment)}>{comment.resolved ? "Reopen" : "Resolve"}</button>
          </div>
        ))}
      </div>
      <div className="comment-compose">
        <input value={message} placeholder="Add review comment" onChange={(event) => setMessage(event.target.value)} />
        <button onClick={addComment}>Add</button>
      </div>
    </section>
  );
}

function HistoryLog(props: { state: ControlPanelState; isAdmin: boolean; updateState: (state: ControlPanelState, message?: string) => void }) {
  return (
    <section className="side-section">
      <h3>Major action log</h3>
      {props.state.actionLog.slice(0, 8).map((entry) => (
        <p key={entry.id} className="log-entry">
          <strong>{entry.actor}</strong> {entry.message}
        </p>
      ))}
      {props.isAdmin ? <button onClick={() => props.updateState(resetState(), "Reset local V2 experiment seed.")}>Reset local seed</button> : null}
    </section>
  );
}

function LockedNotice(props: { reason: string }) {
  return <p className="locked-notice">Locked: {props.reason}</p>;
}
