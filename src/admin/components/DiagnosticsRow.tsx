import { useEffect, useState } from 'react';
import {
  getSyncStatus,
  onSyncStatus,
  getLastSyncAt,
  getRealtimeState,
  onRealtimeState,
  type SyncStatus,
  type RealtimeState,
} from '../cloudSync';

interface DiagnosticsRowProps {
  email: string;
  role: string;
}

/**
 * Admin-only Supabase diagnostic status row.
 * Rendered by App.tsx only when the signed-in role is 'admin'.
 */
export function DiagnosticsRow({ email, role }: DiagnosticsRowProps) {
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  const [realtime, setRealtime] = useState<RealtimeState>(getRealtimeState());
  const [lastSync, setLastSync] = useState<number | null>(getLastSyncAt());

  useEffect(() => {
    const offSync = onSyncStatus((s) => {
      setSync(s);
      setLastSync(getLastSyncAt());
    });
    const offRealtime = onRealtimeState(setRealtime);
    // Keep "last sync" fresh even when nothing changes.
    const tick = window.setInterval(() => setLastSync(getLastSyncAt()), 30000);
    return () => {
      offSync();
      offRealtime();
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div className="diagnostics-row" aria-label="Supabase connection diagnostics">
      <span className="diag-item diag-strong">Supabase connected</span>
      <span className="diag-item">{email}</span>
      <span className="diag-item">role: {role}</span>
      <span className="diag-item">
        sync: {sync === 'offline' ? 'offline / local backup' : sync}
      </span>
      <span className="diag-item">
        last sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : '—'}
      </span>
      <span className={`diag-item diag-rt-${realtime}`}>
        realtime: {realtime}
      </span>
    </div>
  );
}
