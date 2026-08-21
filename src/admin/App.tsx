import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Login } from './components/Login';
import { Today } from './components/Today';
import { Overview } from './components/Overview';
import { ProjectList } from './components/ProjectList';
import { ProjectForm } from './components/ProjectForm';
import { SyncIndicator } from './components/SyncIndicator';
import { MigrationPanel } from './components/MigrationPanel';
import { DiagnosticsRow } from './components/DiagnosticsRow';
import { UnlockPanel } from './components/UnlockPanel';
import {
  ProjectStore,
  subscribeToStore,
  hydrateFromCloud,
  applyCloudUpsert,
  applyCloudDelete,
} from './store';
import {
  setActor,
  fetchRole,
  fetchProjectData,
  subscribeRealtime,
} from './cloudSync';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Project } from './types';

/** App lifecycle:
 *  loading → signedOut → (sign in) → checking role/hydration →
 *  needsMigration | ready | denied
 */
type Phase = 'loading' | 'signedOut' | 'checking' | 'needsMigration' | 'ready' | 'denied' | 'error';

export function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('');
  const [roleError, setRoleError] = useState<string>('');
  const [hydrateError, setHydrateError] = useState<string>('');
  const [sessionDropped, setSessionDropped] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'edit'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Timestamp of the most recent successful sign-in — used to detect a
  // session that drops immediately afterwards (clock skew / blocked refresh).
  const lastSignInAt = useRef(0);
  // Hidden gesture: 5 quick clicks on the header title (admin only).
  const titleClicks = useRef<number[]>([]);

  const handleTitleClick = () => {
    if (role !== 'admin') return;
    const now = Date.now();
    titleClicks.current = [...titleClicks.current.filter(t => now - t < 2500), now];
    if (titleClicks.current.length >= 5) {
      titleClicks.current = [];
      setShowUnlock(true);
    }
  };

  const loadData = useCallback(() => {
    setProjects([...ProjectStore.getProjects()]);
  }, []);

  // ── Auth session tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setPhase('signedOut'); // Login renders the setup notice
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setPhase('signedOut');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        lastSignInAt.current = Date.now();
        setSessionDropped(false);
      } else {
        // Session vanished within 15s of signing in → almost always a
        // client-environment problem (blocked supabase.co or wrong clock).
        // Surface it instead of silently showing the login form again.
        if (lastSignInAt.current && Date.now() - lastSignInAt.current < 15000) {
          setSessionDropped(true);
        }
        setPhase('signedOut');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Role check + hydration after sign-in ───────────────────────────────
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const boot = async () => {
      setPhase('checking');

      const roleResult = await fetchRole();
      if (cancelled) return;
      if (!roleResult.role) {
        setRoleError(roleResult.error ?? '');
        setPhase('denied');
        return;
      }
      setRoleError('');
      setRole(roleResult.role);
      setActor(session.user.email ?? '');

      const result = await hydrateFromCloud();
      if (cancelled) return;
      if (result === 'needs-migration') setPhase('needsMigration');
      else if (result === 'error') {
        setHydrateError('Data load from Supabase failed — see browser console for detail.');
        setPhase('error');
      }
      else {
        loadData();
        setPhase('ready');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [session, loadData]);

  // ── Store subscription + realtime (active while ready) ─────────────────
  useEffect(() => {
    if (phase !== 'ready') return;

    const unsubStore = subscribeToStore(loadData);
    const unsubRealtime = subscribeRealtime({
      onProjectUpsert: applyCloudUpsert,
      onProjectDelete: applyCloudDelete,
      onAuxInsert: (projectId) => {
        // Another user appended a message/log — refetch that project.
        void fetchProjectData(projectId).then((raw) => {
          if (raw) applyCloudUpsert(raw);
        });
      },
    });
    return () => {
      unsubStore();
      unsubRealtime();
    };
  }, [phase, loadData]);

  // ── Handlers (unchanged data flows) ────────────────────────────────────

  const handleLogout = () => {
    if (supabase) void supabase.auth.signOut();
    setProjects([]);
    setCurrentView('dashboard');
    setEditingProject(null);
  };

  const handleEdit = (id: string) => {
    const proj = ProjectStore.getProjects().find(p => p.id === id);
    if (proj) {
      setEditingProject(proj);
      setCurrentView('edit');
    }
  };

  const handleDuplicate = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj) {
      const duplicated = {
        ...proj,
        id: `proj-${Date.now()}`,
        title: `${proj.title} (Copy)`,
        activity: [{ date: Date.now(), message: 'Duplicated' }],
        lastUpdated: Date.now()
      };
      ProjectStore.saveProject(duplicated);
      loadData();
    }
  };

  const handleDelete = (id: string) => {
    ProjectStore.deleteProject(id);
    loadData();
  };

  const handleSave = (project: Project) => {
    ProjectStore.saveProject(project);
    loadData();
    setCurrentView('dashboard');
    setEditingProject(null);
  };

  const handleCancelEdit = () => {
    setCurrentView('dashboard');
    setEditingProject(null);
  };

  const handleExport = () => {
    const json = ProjectStore.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suruchi-projects-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        void ProjectStore.importData(content).then((ok) => {
          if (ok) {
            alert('Data imported successfully!');
            loadData();
          } else {
            alert('Failed to import data. Invalid JSON format.');
          }
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Render per phase ───────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'checking') {
    return <div className="admin-phase-screen">Loading…</div>;
  }

  if (phase === 'signedOut') {
    return (
      <Login
        notice={sessionDropped
          ? 'Signed in successfully, but the session was dropped immediately. ' +
            'This usually means a privacy filter or network is blocking supabase.co, ' +
            'or the device clock is wrong. Check the connectivity line below.'
          : ''}
      />
    );
  }

  if (phase === 'denied') {
    return (
      <div className="admin-phase-screen">
        {roleError ? (
          <>
            <p>Signed in, but the authorization check could not be reached.</p>
            <p className="phase-detail">({roleError})</p>
            <p className="phase-detail">
              This is usually a network filter blocking supabase.co on this device.
            </p>
          </>
        ) : (
          <p>This account is not authorized for the admin panel.</p>
        )}
        <button className="btn-text" onClick={handleLogout}>Sign out</button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="admin-phase-screen">
        <p>Could not load data from Supabase. Check the connection and the schema setup.</p>
        {hydrateError && <p className="phase-detail">({hydrateError})</p>}
        <button className="btn-text" onClick={() => window.location.reload()}>Retry</button>
        <button className="btn-text" onClick={handleLogout}>Sign out</button>
      </div>
    );
  }

  if (phase === 'needsMigration') {
    return (
      <MigrationPanel
        onComplete={() => {
          void hydrateFromCloud().then((r) => {
            if (r === 'ok') {
              loadData();
              setPhase('ready');
            } else {
              setPhase('error');
            }
          });
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="admin-container">
      {showUnlock && role === 'admin' && (
        <UnlockPanel onClose={() => setShowUnlock(false)} />
      )}
      <header className="admin-header">
        <h1 onClick={handleTitleClick}>Suruchi Production Register</h1>
        <nav>
          <SyncIndicator />
          <button
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            Control Room
          </button>
        </nav>
      </header>

      <main>
        {currentView === 'dashboard' ? (
          <>
            {role === 'admin' && (
              <DiagnosticsRow email={session?.user.email ?? ''} role={role} />
            )}
            <ProjectList
              projects={projects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
            <Today projects={projects} onEdit={handleEdit} />
            <Overview projects={projects} />
            <footer className="admin-footer">
              <button onClick={handleExport} className="btn-text">Export JSON</button>
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleImport}
              />
              <button onClick={() => fileInputRef.current?.click()} className="btn-text">Import JSON</button>
              <button onClick={handleLogout} className="btn-text danger">Logout</button>
            </footer>
          </>
        ) : (
          editingProject && (
            <ProjectForm
              project={editingProject}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          )
        )}
      </main>
    </div>
  );
}
