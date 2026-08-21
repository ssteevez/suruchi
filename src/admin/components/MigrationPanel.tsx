import { useMemo, useState } from 'react';
import type { Project } from '../types';
import { loadLocalProjects, migrateProject } from '../store';
import { supabase } from '../supabaseClient';
import { collectReviewMessages, fetchAllProjectData } from '../cloudSync';

/**
 * One-time migration of the localStorage admin data into Supabase.
 *
 * Shown by App.tsx only when the cloud `projects` table is empty AND a local
 * backup exists. Runs as the signed-in (allowlisted) user — no service role
 * key is involved anywhere.
 *
 * Steps: forced JSON backup download → insert projects (complete JSONB) →
 * backfill activity_logs + review_messages streams → re-fetch from cloud →
 * verify counts side by side → only then the caller switches to live data.
 */

interface Counts {
  projects: number;
  miniPages: number;
  pilgrimPhotos: number;
  poetPages: number;
  euphemismStructures: number;
  euphemismRequests: number;
  painterSeries: number;
  painterArtworks: number;
  reviewMessages: number;
  activityEntries: number;
}

const countAll = (projects: Project[]): Counts => ({
  projects: projects.length,
  miniPages: projects.reduce((n, p) => n + (p.miniPages?.length ?? 0), 0),
  pilgrimPhotos: projects.reduce((n, p) => n + (p.pilgrimPhotos?.length ?? 0), 0),
  poetPages: projects.reduce((n, p) => n + (p.poetPages?.length ?? 0), 0),
  euphemismStructures: projects.reduce((n, p) => n + (p.euphemismStructures?.length ?? 0), 0),
  euphemismRequests: projects.reduce((n, p) => n + (p.newEuphemismRequests?.length ?? 0), 0),
  painterSeries: projects.reduce((n, p) => n + (p.painterSeries?.length ?? 0), 0),
  painterArtworks: projects.reduce(
    (n, p) => n + (p.painterSeries?.reduce((m, s) => m + (s.artworks?.length ?? 0), 0) ?? 0),
    0,
  ),
  reviewMessages: projects.reduce((n, p) => n + collectReviewMessages(p).length, 0),
  activityEntries: projects.reduce((n, p) => n + (p.activity?.length ?? 0), 0),
});

const COUNT_LABELS: Record<keyof Counts, string> = {
  projects: 'Projects',
  miniPages: 'Homepage mini pages',
  pilgrimPhotos: 'Pilgrim photos',
  poetPages: 'Poet pages',
  euphemismStructures: 'Euphemism structures',
  euphemismRequests: 'Euphemism requests',
  painterSeries: 'Painter series',
  painterArtworks: 'Painter artworks',
  reviewMessages: 'Review messages',
  activityEntries: 'Activity log entries',
};

interface MigrationPanelProps {
  onComplete: () => void;
  onLogout: () => void;
}

export function MigrationPanel({ onComplete, onLogout }: MigrationPanelProps) {
  const localProjects = useMemo(() => loadLocalProjects() ?? [], []);
  const localCounts = useMemo(() => countAll(localProjects), [localProjects]);

  const [phase, setPhase] = useState<'ready' | 'running' | 'verify' | 'failed'>('ready');
  const [progress, setProgress] = useState('');
  const [cloudCounts, setCloudCounts] = useState<Counts | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(localProjects, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suruchi-pre-supabase-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runMigration = async () => {
    if (!supabase) return;
    setPhase('running');
    setErrorMsg('');

    // Step 0 — forced local backup before anything touches the cloud.
    downloadBackup();

    try {
      for (let i = 0; i < localProjects.length; i++) {
        const p = localProjects[i]!;
        setProgress(`Uploading project ${i + 1} of ${localProjects.length}: ${p.title}`);

        const { error: projError } = await supabase.from('projects').upsert({
          id: p.id,
          title: p.title,
          section_type: p.sectionType,
          project_data: p as unknown as Record<string, unknown>,
          schema_version: Math.floor(p.schemaVersion),
          updated_at: new Date().toISOString(),
        });
        if (projError) throw new Error(`projects upsert (${p.title}): ${projError.message}`);

        // Backfill the append-only audit streams.
        if (p.activity.length > 0) {
          const { error } = await supabase.from('activity_logs').insert(
            p.activity.map((a) => ({
              project_id: p.id,
              message: a.message,
              actor: 'migration',
              created_at: new Date(a.date).toISOString(),
            })),
          );
          if (error) throw new Error(`activity_logs (${p.title}): ${error.message}`);
        }
        const messages = collectReviewMessages(p);
        if (messages.length > 0) {
          const { error } = await supabase.from('review_messages').insert(
            messages.map((m) => ({
              project_id: p.id,
              context_type: m.contextType,
              context_id: m.contextId,
              author: m.message.author,
              message: m.message.message,
              created_at: new Date(m.message.createdAt).toISOString(),
            })),
          );
          if (error) throw new Error(`review_messages (${p.title}): ${error.message}`);
        }
      }

      // Verification — read everything back from the cloud and recount.
      setProgress('Verifying…');
      const raws = await fetchAllProjectData();
      setCloudCounts(countAll(raws.map(migrateProject)));
      setPhase('verify');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('failed');
    }
  };

  const allMatch =
    cloudCounts !== null &&
    (Object.keys(localCounts) as (keyof Counts)[]).every(
      (k) => localCounts[k] === cloudCounts[k],
    );

  return (
    <div className="migration-wrapper">
      <div className="migration-panel">
        <h2>Migrate Local Data to Supabase</h2>

        {phase === 'ready' && (
          <>
            <p>
              The cloud database is empty, but this browser holds existing admin
              data. Migrate it now so it becomes the shared live dataset. A JSON
              backup downloads automatically before anything is uploaded.
            </p>
            <table className="migration-counts">
              <tbody>
                {(Object.keys(localCounts) as (keyof Counts)[]).map((k) => (
                  <tr key={k}>
                    <td>{COUNT_LABELS[k]}</td>
                    <td>{localCounts[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="migration-actions">
              <button onClick={() => void runMigration()}>
                Back up &amp; migrate to Supabase
              </button>
              <button className="btn-text" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}

        {phase === 'running' && <p className="migration-progress">{progress}</p>}

        {phase === 'verify' && cloudCounts && (
          <>
            <p>{allMatch ? 'All counts match.' : '⚠️ Counts differ — review before continuing.'}</p>
            <table className="migration-counts">
              <thead>
                <tr><th></th><th>Local</th><th>Cloud</th></tr>
              </thead>
              <tbody>
                {(Object.keys(localCounts) as (keyof Counts)[]).map((k) => (
                  <tr key={k} className={localCounts[k] === cloudCounts[k] ? '' : 'count-mismatch'}>
                    <td>{COUNT_LABELS[k]}</td>
                    <td>{localCounts[k]}</td>
                    <td>{cloudCounts[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="migration-actions">
              <button onClick={onComplete} disabled={!allMatch}>
                Switch to live shared data
              </button>
              {!allMatch && (
                <button className="btn-text" onClick={() => void runMigration()}>
                  Retry migration
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'failed' && (
          <>
            <p className="login-error">Migration failed: {errorMsg}</p>
            <p>
              Your local data is untouched and a JSON backup was downloaded.
              Fix the issue (schema run? allowlist row present?) and retry.
            </p>
            <div className="migration-actions">
              <button onClick={() => void runMigration()}>Retry</button>
              <button className="btn-text" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
