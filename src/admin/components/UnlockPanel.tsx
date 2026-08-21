import { useMemo, useState } from 'react';
import type { ChecklistItem, Project } from '../types';
import { ProjectStore, applyCloudUpsert } from '../store';
import { adminUnlockApproval, fetchProjectData } from '../cloudSync';

/**
 * Admin-only panel for withdrawing locked approvals.
 *
 * Opened via a hidden gesture (5 quick clicks on the admin header title —
 * see App.tsx). Every unlock goes through the audited server-side RPC and
 * leaves an activity entry on the project; this panel is intentionally not
 * reachable from any visible navigation.
 */

interface LockedEntry {
  projectId: string;
  projectTitle: string;
  kind: string;
  itemId: string;
  label: string;
}

const collectLocked = (projects: Project[]): LockedEntry[] => {
  const out: LockedEntry[] = [];

  const walkChecklist = (p: Project, items: ChecklistItem[]): void => {
    for (const it of items) {
      if (it.type === 'lockedApproval' && it.value === true) {
        out.push({
          projectId: p.id,
          projectTitle: p.title,
          kind: 'checklist',
          itemId: it.id,
          label: it.label,
        });
      }
      if (it.children) walkChecklist(p, it.children);
    }
  };

  for (const p of projects) {
    walkChecklist(p, p.checklist ?? []);

    for (const mp of p.miniPages ?? []) {
      if (mp.approved) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'miniPage.approved', itemId: mp.id,
          label: `${mp.title} — approved`,
        });
      }
    }
    for (const pp of p.poetPages ?? []) {
      if (pp.structureApproved) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'poetPage.structureApproved', itemId: pp.id,
          label: `${pp.title} — structure approved`,
        });
      }
      if (pp.finalApproval) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'poetPage.finalApproval', itemId: pp.id,
          label: `${pp.title} — final approval`,
        });
      }
    }
    for (const es of p.euphemismStructures ?? []) {
      if (es.structureApproved) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'euphemism.structureApproved', itemId: es.id,
          label: `${es.title} — structure approved`,
        });
      }
      if (es.finalApproval) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'euphemism.finalApproval', itemId: es.id,
          label: `${es.title} — final approval`,
        });
      }
    }
    for (const ps of p.painterSeries ?? []) {
      if (ps.structureApproved) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'painterSeries.structureApproved', itemId: ps.id,
          label: `${ps.title} — structure approved`,
        });
      }
      if (ps.finalApproval) {
        out.push({
          projectId: p.id, projectTitle: p.title,
          kind: 'painterSeries.finalApproval', itemId: ps.id,
          label: `${ps.title} — final approval`,
        });
      }
    }
  }
  return out;
};

interface UnlockPanelProps {
  onClose: () => void;
}

export function UnlockPanel({ onClose }: UnlockPanelProps) {
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const locked = useMemo(
    () => collectLocked(ProjectStore.getProjects()),
    // refreshTick re-collects after each unlock
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTick],
  );

  const handleUnlock = async (entry: LockedEntry) => {
    const key = `${entry.projectId}:${entry.kind}:${entry.itemId}`;
    if (busyKey) return;
    if (!window.confirm(
      `Withdraw this approval?\n\n${entry.projectTitle}: ${entry.label}\n\n` +
      'This is recorded in the project activity log.',
    )) return;

    setBusyKey(key);
    setError('');
    try {
      await adminUnlockApproval(entry.projectId, entry.kind, entry.itemId);
      const raw = await fetchProjectData(entry.projectId);
      if (raw) applyCloudUpsert(raw);
      setRefreshTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="unlock-overlay" onClick={onClose}>
      <div className="unlock-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Locked Approvals</h2>
        <p className="unlock-note">
          Withdrawing an approval is logged in the project activity.
        </p>
        {error && <p className="login-error">{error}</p>}

        {locked.length === 0 ? (
          <p className="unlock-empty">No locked approvals.</p>
        ) : (
          <ul className="unlock-list">
            {locked.map((entry) => {
              const key = `${entry.projectId}:${entry.kind}:${entry.itemId}`;
              return (
                <li key={key}>
                  <span className="unlock-label">
                    <strong>{entry.projectTitle}</strong> · {entry.label}
                  </span>
                  <button
                    className="btn-text danger"
                    disabled={busyKey !== ''}
                    onClick={() => void handleUnlock(entry)}
                  >
                    {busyKey === key ? 'Unlocking…' : 'Unlock'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="migration-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
