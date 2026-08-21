import { supabase } from './supabaseClient';
import type { Project, ReviewMessage, ActivityLogEntry } from './types';

/**
 * Cloud sync engine for the admin store.
 *
 * Writes are optimistic: the in-memory cache and the localStorage backup are
 * updated synchronously by store.ts, then the change is queued here and
 * pushed to Supabase in the background. The queue keeps only the latest
 * version per project (last write wins — fine for two users).
 *
 * projects.project_data holds the COMPLETE project object (source of truth).
 * activity_logs / review_messages receive append-only copies of new entries
 * for audit, querying and granular realtime.
 */

export type SyncStatus = 'synced' | 'saving' | 'offline';

export interface NewReviewMessageRow {
  contextType: 'project' | 'poetPage' | 'euphemismStructure' | 'painterSeries';
  contextId: string;
  message: ReviewMessage;
}

interface QueuedUpsert {
  project: Project;
  newActivity: ActivityLogEntry[];
  newMessages: NewReviewMessageRow[];
}

// ── Status events ───────────────────────────────────────────────────────────

let status: SyncStatus = 'synced';
let lastSyncAt: number | null = null;
const statusListeners = new Set<(s: SyncStatus) => void>();

const setStatus = (s: SyncStatus): void => {
  if (s === 'synced') lastSyncAt = Date.now();
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l(s));
};

export const getSyncStatus = (): SyncStatus => status;
export const getLastSyncAt = (): number | null => lastSyncAt;

export const onSyncStatus = (cb: (s: SyncStatus) => void): (() => void) => {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
};

// ── Realtime connection state ───────────────────────────────────────────────

export type RealtimeState = 'connected' | 'connecting' | 'disconnected';

let realtimeState: RealtimeState = 'disconnected';
const realtimeListeners = new Set<(s: RealtimeState) => void>();

const setRealtimeState = (s: RealtimeState): void => {
  if (realtimeState === s) return;
  realtimeState = s;
  realtimeListeners.forEach((l) => l(s));
};

export const getRealtimeState = (): RealtimeState => realtimeState;

export const onRealtimeState = (cb: (s: RealtimeState) => void): (() => void) => {
  realtimeListeners.add(cb);
  return () => realtimeListeners.delete(cb);
};

// ── Actor (signed-in user email, for activity_logs.actor) ──────────────────

let actorEmail = '';
export const setActor = (email: string): void => {
  actorEmail = email;
};

// ── Push queue ──────────────────────────────────────────────────────────────

const upsertQueue = new Map<string, QueuedUpsert>();
const deleteQueue = new Set<string>();
/** Project ids with an in-flight or queued local write — realtime echoes for
 *  these are skipped so our own optimistic state is not clobbered. */
export const pendingIds = new Set<string>();

let flushing = false;
let retryTimer = 0;

const projectToRow = (p: Project) => ({
  id: p.id,
  title: p.title,
  section_type: p.sectionType,
  project_data: p as unknown as Record<string, unknown>,
  schema_version: Math.floor(p.schemaVersion),
  updated_at: new Date().toISOString(),
});

const flush = async (): Promise<void> => {
  if (!supabase || flushing) return;
  if (upsertQueue.size === 0 && deleteQueue.size === 0) {
    setStatus('synced');
    return;
  }
  flushing = true;
  setStatus('saving');

  try {
    while (upsertQueue.size > 0 || deleteQueue.size > 0) {
      const nextUpsert = upsertQueue.entries().next();
      if (!nextUpsert.done) {
        const [id, item] = nextUpsert.value;
        upsertQueue.delete(id);

        const { error } = await supabase
          .from('projects')
          .upsert(projectToRow(item.project));
        if (error) throw error;

        // Append-only audit streams. Failures here must not block the
        // primary write — project_data already holds everything.
        if (item.newActivity.length > 0) {
          await supabase.from('activity_logs').insert(
            item.newActivity.map((a) => ({
              project_id: item.project.id,
              message: a.message,
              actor: actorEmail,
              created_at: new Date(a.date).toISOString(),
            })),
          );
        }
        if (item.newMessages.length > 0) {
          await supabase.from('review_messages').insert(
            item.newMessages.map((m) => ({
              project_id: item.project.id,
              context_type: m.contextType,
              context_id: m.contextId,
              author: m.message.author,
              message: m.message.message,
              created_at: new Date(m.message.createdAt).toISOString(),
            })),
          );
        }
        if (!upsertQueue.has(id)) pendingIds.delete(id);
        continue;
      }

      const nextDelete = deleteQueue.values().next();
      if (!nextDelete.done) {
        const id = nextDelete.value;
        deleteQueue.delete(id);
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        pendingIds.delete(id);
      }
    }
    setStatus('synced');
  } catch (e) {
    console.error('Cloud sync push failed; will retry', e);
    setStatus('offline');
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => void flush(), 5000);
  } finally {
    flushing = false;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
}

export const queueUpsert = (
  project: Project,
  newActivity: ActivityLogEntry[],
  newMessages: NewReviewMessageRow[],
): void => {
  const existing = upsertQueue.get(project.id);
  upsertQueue.set(project.id, {
    project,
    // Coalesce: keep aux rows from a not-yet-flushed previous save.
    newActivity: [...(existing?.newActivity ?? []), ...newActivity],
    newMessages: [...(existing?.newMessages ?? []), ...newMessages],
  });
  deleteQueue.delete(project.id);
  pendingIds.add(project.id);
  void flush();
};

export const queueDelete = (id: string): void => {
  upsertQueue.delete(id);
  deleteQueue.add(id);
  pendingIds.add(id);
  void flush();
};

// ── Hydration ───────────────────────────────────────────────────────────────

/** Fetch every project's raw project_data from the cloud. */
export const fetchAllProjectData = async (): Promise<unknown[]> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('projects')
    .select('project_data')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.project_data);
};

export const fetchProjectData = async (id: string): Promise<unknown | null> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('projects')
    .select('project_data')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data?.project_data ?? null;
};

// ── Role check ──────────────────────────────────────────────────────────────

export interface RoleResult {
  /** 'admin' | 'client' | null — null means not allowlisted OR the check failed. */
  role: string | null;
  /** Set when the RPC itself failed (network/blocked) — distinguishes
   *  "not authorized" from "could not even ask". */
  error: string | null;
}

export const fetchRole = async (): Promise<RoleResult> => {
  if (!supabase) return { role: null, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.rpc('admin_role');
    if (error) {
      console.error('Role check failed', error);
      return { role: null, error: error.message };
    }
    return { role: (data as string | null) ?? null, error: null };
  } catch (e) {
    // fetch-level failure (network blocked, DNS, offline)
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Role check unreachable', e);
    return { role: null, error: msg };
  }
};

// ── Admin approval unlock ───────────────────────────────────────────────────

/**
 * Withdraw one locked approval via the audited server-side RPC.
 * Admin role only (enforced server-side). Throws on failure.
 * The caller should refetch the project afterwards.
 */
export const adminUnlockApproval = async (
  projectId: string,
  kind: string,
  itemId: string,
): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.rpc('admin_unlock_approval', {
    p_project_id: projectId,
    p_kind: kind,
    p_item_id: itemId,
  });
  if (error) throw error;
};

// ── Realtime ────────────────────────────────────────────────────────────────

export interface RealtimeHandlers {
  onProjectUpsert: (raw: unknown) => void;
  onProjectDelete: (id: string) => void;
  /** Fired for aux-table inserts from the other user — store refetches. */
  onAuxInsert: (projectId: string) => void;
}

export const subscribeRealtime = (handlers: RealtimeHandlers): (() => void) => {
  if (!supabase) return () => undefined;
  const client = supabase;
  setRealtimeState('connecting');

  const channel = client
    .channel('admin-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { id?: string };
          if (oldRow.id && !pendingIds.has(oldRow.id)) {
            handlers.onProjectDelete(oldRow.id);
          }
          return;
        }
        const row = payload.new as { id?: string; project_data?: unknown };
        if (row.id && row.project_data && !pendingIds.has(row.id)) {
          handlers.onProjectUpsert(row.project_data);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'review_messages' },
      (payload) => {
        const row = payload.new as { project_id?: string };
        if (row.project_id && !pendingIds.has(row.project_id)) {
          handlers.onAuxInsert(row.project_id);
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_logs' },
      (payload) => {
        const row = payload.new as { project_id?: string };
        if (row.project_id && !pendingIds.has(row.project_id)) {
          handlers.onAuxInsert(row.project_id);
        }
      },
    )
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') setRealtimeState('connected');
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setRealtimeState('disconnected');
      }
    });

  return () => {
    setRealtimeState('disconnected');
    void client.removeChannel(channel);
  };
};

// ── Review-message collection (for diffing in store.ts) ────────────────────

/** Flatten every review message in a project with its context. */
export const collectReviewMessages = (p: Project): NewReviewMessageRow[] => {
  const out: NewReviewMessageRow[] = [];
  for (const m of p.reviewThread ?? []) {
    out.push({ contextType: 'project', contextId: '', message: m });
  }
  for (const pp of p.poetPages ?? []) {
    for (const m of pp.reviewThread ?? []) {
      out.push({ contextType: 'poetPage', contextId: pp.id, message: m });
    }
  }
  for (const es of p.euphemismStructures ?? []) {
    for (const m of es.reviewThread ?? []) {
      out.push({ contextType: 'euphemismStructure', contextId: es.id, message: m });
    }
  }
  for (const ps of p.painterSeries ?? []) {
    for (const m of ps.reviewThread ?? []) {
      out.push({ contextType: 'painterSeries', contextId: ps.id, message: m });
    }
  }
  return out;
};
