import type { Project } from '../types';
import { isWaitingOnSuruchi, isWaitingOnSteevez } from '../store';

interface OverviewProps {
  projects: Project[];
}

export function Overview({ projects }: OverviewProps) {
  const waitingSuruchi = projects.filter(isWaitingOnSuruchi).length;
  const waitingSteevez = projects.filter(isWaitingOnSteevez).length;
  const reviewReady = projects.filter(p => p.status === 'review').length;
  const approved = projects.filter(p => p.status === 'approved' || p.status === 'published').length;
  const blocked = projects.filter(p => p.status === 'blocked').length;

  return (
    <div className="overview-panel">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{waitingSuruchi}</div>
          <div className="stat-label">Dossiers Need Suruchi</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{waitingSteevez}</div>
          <div className="stat-label">Dossiers Need Studio</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{reviewReady}</div>
          <div className="stat-label">Review</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        {blocked > 0 && (
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--admin-error)' }}>{blocked}</div>
            <div className="stat-label">Blocked</div>
          </div>
        )}
      </div>
    </div>
  );
}
