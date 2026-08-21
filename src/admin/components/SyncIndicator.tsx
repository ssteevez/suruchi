import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../cloudSync';

const LABELS: Record<SyncStatus, string> = {
  synced: 'Synced',
  saving: 'Saving…',
  offline: 'Offline / local backup',
};

/** Small live chip in the admin header showing cloud sync state. */
export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => onSyncStatus(setStatus), []);

  return (
    <span
      className={`sync-indicator sync-${status}`}
      title={
        status === 'offline'
          ? 'Changes are kept locally and retried automatically.'
          : 'Live Supabase sync'
      }
    >
      <span className="sync-dot" />
      {LABELS[status]}
    </span>
  );
}
