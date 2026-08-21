import { useEffect, useMemo, useState } from 'react';
import type { ChecklistItem, Project, ProjectOwner, SectionType } from '../types';
import { getIncompleteItemsByOwner } from '../templates';

interface TodayProps {
  projects: Project[];
  onEdit: (id: string) => void;
}

const SECTIONS: SectionType[] = ['homepage', 'pilgrim', 'poet', 'painter', 'other'];

export function Today({ projects, onEdit }: TodayProps) {
  type TaskEntry = {
    project: Project;
    item: ChecklistItem;
  };

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'approved' && p.status !== 'published'),
    [projects]
  );

  const getOwnerTasks = (owner: ProjectOwner): TaskEntry[] => {
    return activeProjects.flatMap(p =>
      getIncompleteItemsByOwner(p, owner).map(item => ({ project: p, item }))
    );
  };

  const sectionLabels: Record<SectionType, string> = {
    homepage: 'Homepage',
    pilgrim: 'Pilgrim',
    poet: 'Poet',
    painter: 'Painter',
    other: 'Other'
  };

  const getTaskLabel = (task: TaskEntry) => {
    const hasPrefix = task.item.label.includes(':');
    return hasPrefix ? task.item.label : task.item.label;
  };

  const renderTaskList = (tasks: TaskEntry[], emptyLabel: string) => {
    if (tasks.length === 0) {
      return <div className="empty-state">{emptyLabel}</div>;
    }

    return (
      <ul className="today-list">
        {tasks.map(t => (
          <li key={`${t.project.id}-${t.item.id}`}>
            <button onClick={() => onEdit(t.project.id)}>{getTaskLabel(t)}</button>
          </li>
        ))}
      </ul>
    );
  };

  const renderQueueMetric = (title: string, count: number, emptyLabel = 'Clear') => {
    const hasItems = count > 0;

    return (
      <div className={`today-column action-lane ${hasItems ? 'has-items' : 'is-clear'}`}>
        <div className="action-lane-header">
          <h3>{title}</h3>
          <span className="action-count">{count}</span>
        </div>
        <div className="queue-metric-note">{hasItems ? 'Actionable handoffs below' : emptyLabel}</div>
      </div>
    );
  };

  const suruchiTasks = getOwnerTasks('Suruchi');
  const steevezTasks = getOwnerTasks('Steevez');
  const reviewReady = projects.filter(p => p.status === 'review');
  const recent = [...projects].sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, 3);
  const sectionSummaries = useMemo(() => {
    return SECTIONS.map(section => {
      const sectionProjects = activeProjects
        .filter(project => project.sectionType === section)
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
      const suruchiCount = sectionProjects.reduce(
        (sum, project) => sum + getIncompleteItemsByOwner(project, 'Suruchi').length,
        0
      );
      const studioCount = sectionProjects.reduce(
        (sum, project) => sum + getIncompleteItemsByOwner(project, 'Steevez').length,
        0
      );

      return {
        section,
        projects: sectionProjects,
        suruchiCount,
        studioCount,
        totalOpen: suruchiCount + studioCount
      };
    });
  }, [activeProjects]);

  const firstOpenSection = sectionSummaries.find(summary => summary.projects.length > 0)?.section ?? 'homepage';
  const [activeSection, setActiveSection] = useState<SectionType>(firstOpenSection);
  const activeSummary = sectionSummaries.find(summary => summary.section === activeSection)
    ?? sectionSummaries.find(summary => summary.projects.length > 0)
    ?? sectionSummaries[0]!;

  useEffect(() => {
    const currentSummary = sectionSummaries.find(summary => summary.section === activeSection);
    if (currentSummary && currentSummary.projects.length > 0) return;
    setActiveSection(firstOpenSection);
  }, [activeSection, firstOpenSection, sectionSummaries]);

  return (
    <div className="today-section">
      <div className="section-title" style={{ fontSize: '1rem', color: 'var(--admin-fg)' }}>Control Register</div>
      <div className="today-grid">
        {renderQueueMetric('Suruchi Queue', suruchiTasks.length)}
        {renderQueueMetric('Studio Queue', steevezTasks.length)}
        {renderQueueMetric('Review Shelf', reviewReady.length, 'No dossiers waiting for review')}
        {renderQueueMetric('Recent Movement', recent.length, 'No recent movement')}
      </div>

      <div className="context-queue">
        <div className="context-section-picker" role="tablist" aria-label="Section context">
          {sectionSummaries.map(summary => (
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === summary.section}
              className={activeSection === summary.section ? 'active' : ''}
              key={summary.section}
              onClick={() => setActiveSection(summary.section)}
            >
              <span>{sectionLabels[summary.section]}</span>
              <strong>{summary.totalOpen}</strong>
            </button>
          ))}
        </div>

        {activeSummary && (
          <section className="context-section">
            <div className="context-section-header">
              <div>
                <h3>{sectionLabels[activeSummary.section]} Context</h3>
                <span>{activeSummary.projects.length} active dossier{activeSummary.projects.length === 1 ? '' : 's'}</span>
              </div>
              <div className="context-section-counts">
                <span>{activeSummary.suruchiCount} Suruchi</span>
                <span>{activeSummary.studioCount} Studio</span>
              </div>
            </div>

            {activeSummary.projects.length > 0 ? (
              <div className="context-projects">
                {activeSummary.projects.map(project => {
                    const projectSuruchiTasks = getIncompleteItemsByOwner(project, 'Suruchi').map(item => ({ project, item }));
                    const projectSteevezTasks = getIncompleteItemsByOwner(project, 'Steevez').map(item => ({ project, item }));
                    const hasTasks = projectSuruchiTasks.length > 0 || projectSteevezTasks.length > 0;

                    return (
                      <article className="context-project" key={project.id}>
                        <div className="context-project-header">
                          <button type="button" onClick={() => onEdit(project.id)}>
                            {project.title}
                          </button>
                          <span className={`badge ${project.status}`}>{project.status.replace(/-/g, ' ')}</span>
                        </div>

                        {hasTasks ? (
                          <div className="context-task-grid">
                            <div>
                              <div className="context-owner-label">Suruchi</div>
                              {renderTaskList(projectSuruchiTasks, 'No Suruchi items')}
                            </div>
                            <div>
                              <div className="context-owner-label">Studio</div>
                              {renderTaskList(projectSteevezTasks, 'No studio items')}
                            </div>
                          </div>
                        ) : (
                          <div className="empty-state">No open production items in this dossier.</div>
                        )}
                      </article>
                    );
                  })}
              </div>
            ) : (
              <div className="context-empty-panel">No active dossiers in this section.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
