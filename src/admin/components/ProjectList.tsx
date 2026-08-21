import React, { useState } from 'react';
import type { Project, ChecklistItem } from '../types';
import { calculateChecklistProgress, isChecklistItemComplete } from '../templates';

interface ProjectListProps {
  projects: Project[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function ProjectList({ projects, onEdit, onDelete, onDuplicate }: ProjectListProps) {
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(filter.toLowerCase()) || 
    p.category.toLowerCase().includes(filter.toLowerCase()) ||
    p.status.toLowerCase().includes(filter.toLowerCase()) ||
    p.owner.toLowerCase().includes(filter.toLowerCase()) ||
    p.sectionType.toLowerCase().includes(filter.toLowerCase())
  );

  const getMissingMaterialsString = (checklist: ChecklistItem[]) => {
    const missing: string[] = [];
    
    const scan = (items: ChecklistItem[]) => {
      items.forEach(item => {
        if (!isChecklistItemComplete(item)) {
          if (item.type !== 'grouped') {
            missing.push(item.label);
          } else if (item.children) {
            scan(item.children);
          }
        }
      });
    };
    
    scan(checklist);
    return missing.length > 0 ? missing.join(', ') : 'None';
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderReadOnlyChecklist = (items: ChecklistItem[], depth = 0) => {
    return items.map(item => {
      const isComplete = isChecklistItemComplete(item);
      const isGroup = item.type === 'grouped';
      
      return (
        <React.Fragment key={item.id}>
          <div 
            className={`checklist-item ${isComplete ? 'received' : 'missing'}`} 
            style={{ marginLeft: `${depth * 1.5}rem`, marginBottom: isGroup ? '0.2rem' : '0' }}
          >
            {isGroup ? (
              <strong>{item.label}</strong>
            ) : (
              <>
                {isComplete ? '☑' : '☐'} {item.label}
              </>
            )}
          </div>
          {isGroup && item.children && renderReadOnlyChecklist(item.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="project-list">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Project Index</div>
        <input 
          type="text" 
          placeholder="Filter by title, owner, status..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="form-control"
          style={{ width: '300px', padding: '0.5rem' }}
        />
      </div>
      
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Template</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Missing Materials</th>
              <th>Progress</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(project => {
              const getProjectProgress = (p: Project) => {
                if (p.sectionType === 'poet') {
                  let total = 0; let completed = 0;
                  const bandra = p.poetPages?.find(x => x.id === 'poet-bandra');
                  if (bandra) {
                    total += 3;
                    if (bandra.structureBuilt) completed++;
                    if (bandra.structureApproved) completed++;
                    if (bandra.finalApproval) completed++;
                  }
                  if (p.euphemismStructures) {
                    p.euphemismStructures.forEach(e => {
                      total += 3;
                      if (e.structureBuilt) completed++;
                      if (e.structureApproved) completed++;
                      if (e.finalApproval) completed++;
                    });
                  }
                  if (p.newEuphemismRequests) {
                    p.newEuphemismRequests.forEach(r => {
                      total += 2;
                      if (r.seenBySteevez) completed++;
                      if (r.building) completed++;
                    });
                  }
                  return total === 0 ? 0 : Math.round((completed / total) * 100);
                }
                if (p.sectionType === 'painter') {
                  let total = 0; let completed = 0;
                  if (p.painterSeries) {
                    p.painterSeries.forEach(series => {
                      total += 2; // structure built, approved
                      if (series.structureBuilt) completed++;
                      if (series.structureApproved) completed++;
                      
                      total += 4; // driveLink, imagesOptimised, builtOriginal, finalApproval
                      if (series.driveLink?.trim().length > 0) completed++;
                      if (series.imagesOptimised) completed++;
                      if (series.builtOriginal) completed++;
                      if (series.finalApproval) completed++;
                      
                      total += series.artworks.length;
                      completed += series.artworks.filter(a => a.metadataComplete).length;
                    });
                  }
                  
                  return total === 0 ? 0 : Math.round((completed / total) * 100);
                }
                return calculateChecklistProgress(p.checklist);
              };

              const missingStr = project.sectionType === 'poet' || project.sectionType === 'painter' ? 'See dossier' : getMissingMaterialsString(project.checklist);
              const progress = getProjectProgress(project);
              const isExpanded = expandedId === project.id;
              
              return (
                <React.Fragment key={project.id}>
                  <tr className="main-row">
                    <td>
                      <button className="btn-text" onClick={() => toggleExpand(project.id)} style={{ fontWeight: 500, color: 'var(--admin-fg)', fontSize: '0.9rem', textTransform: 'none', letterSpacing: 0 }}>
                        {isExpanded ? '▼' : '▶'} {project.title}
                      </button>
                    </td>
                    <td>
                      <span className="badge" style={{ borderColor: 'transparent', background: 'var(--admin-card-hover)' }}>{project.sectionType}</span>
                    </td>
                    <td>{project.owner}</td>
                    <td>
                      <span className={`badge ${project.status}`}>{project.status.replace(/-/g, ' ')}</span>
                    </td>
                    <td>
                      <span className={`missing-text ${missingStr !== 'None' ? 'alert' : ''}`}>
                        {missingStr}
                      </span>
                    </td>
                    <td>
                      <div className="progress-container">
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="progress-text">{progress}%</span>
                      </div>
                    </td>
                    <td><span className="progress-text">{new Date(project.lastUpdated).toLocaleDateString()}</span></td>
                    <td>
                      <button className="btn" onClick={() => onEdit(project.id)} style={{ marginRight: '0.5rem' }}>Edit</button>
                      <button className="btn" onClick={() => onDuplicate(project.id)} style={{ marginRight: '0.5rem' }}>Copy</button>
                      <button className="btn danger" onClick={() => {
                        if (window.confirm(`Delete "${project.title}" forever?`)) {
                          onDelete(project.id);
                        }
                      }}>Del</button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="expanded-row">
                      <td colSpan={8}>
                        <div className="expanded-content">
                          <div>
                            <div className="section-title" style={{ marginTop: 0 }}>Materials Checklist</div>
                            <div className="read-only-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {project.sectionType === 'poet' ? (
                                <div>
                                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-fg)' }}>Celebrating Bandra</div>
                                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--admin-fg-muted)', marginBottom: '1rem' }}>
                                    <span>Built: {project.poetPages?.find(p => p.id === 'poet-bandra')?.structureBuilt ? '✅' : '❌'}</span>
                                    <span>Approved: {project.poetPages?.find(p => p.id === 'poet-bandra')?.structureApproved ? '✅' : '❌'}</span>
                                    <span>Final: {project.poetPages?.find(p => p.id === 'poet-bandra')?.finalApproval ? '✅' : '❌'}</span>
                                  </div>
                                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-fg)' }}>Euphemisms</div>
                                  {project.euphemismStructures?.map(e => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--admin-fg-muted)', marginBottom: '0.25rem' }}>
                                      <span>{e.title}</span>
                                      <div style={{ display: 'flex', gap: '1rem' }}>
                                        <span>Built: {e.structureBuilt ? '✅' : '❌'}</span>
                                        <span>App: {e.structureApproved ? '✅' : '❌'}</span>
                                        <span>Fin: {e.finalApproval ? '✅' : '❌'}</span>
                                      </div>
                                    </div>
                                  ))}
                                  {(!project.euphemismStructures || project.euphemismStructures.length === 0) && (
                                    <div style={{ fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.6 }}>No euphemisms built yet.</div>
                                  )}
                                </div>
                              ) : project.sectionType === 'painter' ? (
                                <div>
                                  {project.painterSeries?.map(series => {
                                    const total = series.artworks.length;
                                    const complete = series.artworks.filter(a => a.metadataComplete).length;
                                    return (
                                      <div key={series.id} style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--admin-fg)' }}>{series.title}</div>
                                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--admin-fg-muted)' }}>
                                          <span>Built: {series.structureBuilt ? '✅' : '❌'}</span>
                                          <span>Approved: {series.structureApproved ? '✅' : '❌'}</span>
                                          <span>Metadata: {complete}/{total} Complete</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                renderReadOnlyChecklist(project.checklist)
                              )}
                            </div>
                            {project.miniPages && project.miniPages.length > 0 && (
                              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--admin-border)' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem' }}>Mini Pages Progress</div>
                                {project.miniPages.map(mp => {
                                  const total = 4;
                                  const completed = [mp.contentReceived, mp.built, mp.reviewed, mp.approved].filter(Boolean).length;
                                  return (
                                    <div key={mp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                      <span>{mp.title}</span>
                                      <span style={{ color: completed === total ? 'var(--admin-success)' : 'var(--admin-fg-muted)' }}>{completed} / {total}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="section-title" style={{ marginTop: 0 }}>Activity History</div>
                            {project.activity && project.activity.length > 0 ? (
                              <div className="activity-log" style={{ marginTop: 0 }}>
                                {project.activity.slice(0, 5).map((log, idx) => (
                                  <div key={idx} className="activity-item">
                                    <div className="activity-date">{new Date(log.date).toLocaleString()}</div>
                                    <div className="activity-msg">{log.message}</div>
                                  </div>
                                ))}
                                {project.activity.length > 5 && (
                                  <div className="activity-item">
                                    <div className="activity-msg" style={{ color: 'var(--admin-fg-muted)' }}>...and {project.activity.length - 5} older events</div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="missing-text">No activity recorded.</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No projects found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
