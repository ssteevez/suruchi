import React, { useState } from 'react';
import type { Project, ReviewMessage, PainterSeries, PainterArtwork } from '../types';
import { ProjectStore } from '../store';

interface PainterDossierProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

type TabKey = 'overview' | `series-${string}`;

export function PainterDossier({ project, onSave, onCancel }: PainterDossierProps) {
  const [formData, setFormData] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [newMessage, setNewMessage] = useState('');
  const [messageAuthor, setMessageAuthor] = useState<'Suruchi' | 'Steevez'>('Suruchi');

  const appendActivity = (p: Project, message: string): Project => {
    return {
      ...p,
      activity: [{ date: Date.now(), message }, ...(p.activity || [])]
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleSeriesChange = (seriesId: string, field: keyof PainterSeries, value: any) => {
    setFormData(prev => {
      const seriesList = prev.painterSeries ? [...prev.painterSeries] : [];
      const idx = seriesList.findIndex(s => s.id === seriesId);
      if (idx === -1) return prev;
      
      const series = { ...seriesList[idx] } as PainterSeries;
      let nextState: Project = { ...prev, painterSeries: seriesList };
      
      if (field === 'structureBuilt') {
        series.structureBuilt = value;
        nextState = appendActivity(nextState, `${series.title}: Structure built marked as ${value ? 'complete' : 'incomplete'}`);
      }
      
      if (field === 'structureApproved') {
        if (series.structureApproved === true) return prev;
        if (!window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
          return prev;
        }
        series.structureApproved = true;
        series.approvedAt = Date.now();
        nextState = appendActivity(nextState, `${series.title}: Structure approved by Suruchi`);
      }

      if (field === 'finalApproval') {
        if (series.finalApproval === true) return prev;
        if (!window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
          return prev;
        }
        series.finalApproval = true;
        nextState = appendActivity(nextState, `${series.title}: Final approval given by Suruchi`);
      }

      if (field === 'imagesOptimised') {
        series.imagesOptimised = value;
        nextState = appendActivity(nextState, `${series.title}: Images optimised marked as ${value ? 'complete' : 'incomplete'}`);
      }

      if (field === 'builtOriginal') {
        series.builtOriginal = value;
        nextState = appendActivity(nextState, `${series.title}: Built with original artworks marked as ${value ? 'complete' : 'incomplete'}`);
      }

      if (field === 'driveLink') {
        series.driveLink = value;
      }

      series.updatedAt = Date.now();
      seriesList[idx] = series;
      
      // Auto-save irreversible approvals
      if (field === 'structureApproved' || field === 'finalApproval') {
        ProjectStore.saveProject(nextState);
      }
      return nextState;
    });
  };

  const handleAddReview = (seriesId: string) => {
    if (!newMessage.trim()) return;
    setFormData(prev => {
      const seriesList = prev.painterSeries ? [...prev.painterSeries] : [];
      const idx = seriesList.findIndex(s => s.id === seriesId);
      if (idx === -1) return prev;
      
      const series = { ...seriesList[idx] } as PainterSeries;
      const msg: ReviewMessage = { id: `msg-${Date.now()}`, author: messageAuthor, message: newMessage, createdAt: Date.now() };
      series.reviewThread = [msg, ...(series.reviewThread || [])];
      seriesList[idx] = series;
      
      let nextState: Project = { ...prev, painterSeries: seriesList };
      nextState = appendActivity(nextState, `${series.title}: Review message added by ${messageAuthor}`);
      
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setNewMessage('');
  };

  const handleArtworkChange = (seriesId: string, artworkId: string, field: keyof PainterArtwork, value: string) => {
    setFormData(prev => {
      const seriesList = prev.painterSeries ? [...prev.painterSeries] : [];
      const sIdx = seriesList.findIndex(s => s.id === seriesId);
      if (sIdx === -1) return prev;
      
      const series = { ...seriesList[sIdx] } as PainterSeries;
      const artworks = [...series.artworks];
      const aIdx = artworks.findIndex(a => a.id === artworkId);
      if (aIdx === -1) return prev;

      const art = { ...artworks[aIdx] } as PainterArtwork;
      
      // Check if transitioning from incomplete to complete metadata
      const wasComplete = Boolean(art.title.trim() && art.caption.trim() && art.medium.trim() && art.dimension.trim() && art.year.trim());
      
      (art as any)[field] = value;
      
      const isComplete = Boolean(art.title.trim() && art.caption.trim() && art.medium.trim() && art.dimension.trim() && art.year.trim());
      art.metadataComplete = isComplete;
      art.updatedAt = Date.now();
      
      artworks[aIdx] = art;
      series.artworks = artworks;
      series.updatedAt = Date.now();
      seriesList[sIdx] = series;
      
      let nextState: Project = { ...prev, painterSeries: seriesList };
      
      if (!wasComplete && isComplete) {
        nextState = appendActivity(nextState, `${series.title}: Artwork ${String(aIdx + 1).padStart(2, '0')} metadata completed`);
        
        // Check if all artworks in series are complete
        if (artworks.every(a => a.metadataComplete)) {
          nextState = appendActivity(nextState, `${series.title}: All metadata completed`);
        }
      } else {
        nextState = appendActivity(nextState, `${series.title}: Artwork ${String(aIdx + 1).padStart(2, '0')} ${field} updated`);
      }

      return nextState;
    });
  };

  const renderOverview = () => {
    return (
      <div className="dossier-tab-content">
        <div className="section-title">Painter Overview</div>
        <p style={{ color: 'var(--admin-fg-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Welcome to the Painter Ledger. This dossier tracks artwork inventories for different Painter series.
        </p>

        <div className="series-grid" style={{ marginBottom: '3rem' }}>
          {formData.painterSeries?.map(series => {
            const total = series.artworks.length;
            const complete = series.artworks.filter(a => a.metadataComplete).length;
            
            return (
              <div key={series.id} className="series-card">
                <div className="series-card-title">{series.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--admin-fg-muted)', marginBottom: '1rem' }}>
                  {total} Artworks · {complete === total ? 'All Metadata Complete' : `${total - complete} Missing Metadata`}
                </div>
                
                <div className="ledger-rows">
                  <div className="ledger-row">
                    <span>Structure Built:</span>
                    <span>{series.structureBuilt ? 'Complete' : 'Pending'}</span>
                  </div>
                  <div className="ledger-row">
                    <span>Structure Approved:</span>
                    <span>{series.structureApproved ? 'Locked' : 'Pending'}</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn" onClick={() => setActiveTab(`series-${series.id}`)} style={{ width: '100%' }}>
                    Manage Series
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-title" style={{ marginTop: '3rem' }}>Recent Activity</div>
        <div className="review-thread">
          {formData.activity?.slice(0, 10).map((act, i) => (
            <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--admin-border-hover)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-fg-muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                {new Date(act.date).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--admin-fg)' }}>
                {act.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSeries = (seriesId: string) => {
    const series = formData.painterSeries?.find(s => s.id === seriesId);
    if (!series) return null;

    const total = series.artworks.length;
    const complete = series.artworks.filter(a => a.metadataComplete).length;
    const missing = total - complete;

    const isFinalApprovalEnabled = series.structureBuilt && series.structureApproved && series.builtOriginal && series.imagesOptimised && complete === total;
    const hasDriveLink = series.driveLink?.trim().length > 0;

    return (
      <div className="dossier-tab-content">
        <div className="section-title">{series.title} Inventory</div>
        
        <div className={`approval-panel ${series.finalApproval ? 'is-approved' : ''}`} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Series Requirements Tracker</div>
            {series.finalApproval && (
              <div className="badge status-complete">
                Final Approval Locked
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div className="check-item" style={{ marginBottom: 0 }}>
              <input type="checkbox" id={`build-${series.id}`} checked={series.structureBuilt} onChange={(e) => handleSeriesChange(series.id, 'structureBuilt', e.target.checked)} />
              <label htmlFor={`build-${series.id}`}>Structure built with placeholder visuals</label>
              <span className="badge" style={{ marginLeft: '1rem' }}>Steevez</span>
            </div>

            <div className="check-item" style={{ marginBottom: 0 }}>
              <input type="checkbox" id={`app-${series.id}`} checked={series.structureApproved} onChange={() => handleSeriesChange(series.id, 'structureApproved', true)} disabled={series.structureApproved} style={{ borderColor: series.structureApproved ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: series.structureApproved ? 'var(--admin-success)' : 'transparent' }} />
              <label htmlFor={`app-${series.id}`} style={{ color: series.structureApproved ? 'var(--admin-success)' : 'inherit' }}>Structure Approved</label>
              <span className="badge" style={{ marginLeft: '1rem' }}>Suruchi</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>Google Drive Link (High-res source images)</label>
                <input type="text" className="form-control" placeholder="Paste link here..." value={series.driveLink || ''} onChange={e => handleSeriesChange(series.id, 'driveLink', e.target.value)} />
              </div>
              <span className="badge" style={{ marginTop: '1.5rem' }}>Suruchi</span>
            </div>

            <div className="check-item" style={{ marginBottom: 0, opacity: hasDriveLink ? 1 : 0.5, pointerEvents: hasDriveLink ? 'auto' : 'none' }}>
              <input type="checkbox" id={`opt-${series.id}`} checked={series.imagesOptimised} onChange={(e) => handleSeriesChange(series.id, 'imagesOptimised', e.target.checked)} disabled={!hasDriveLink} />
              <label htmlFor={`opt-${series.id}`}>Images optimised for web</label>
              <span className="badge" style={{ marginLeft: '1rem' }}>Steevez</span>
            </div>

            <div className="check-item" style={{ marginBottom: 0, opacity: series.imagesOptimised ? 1 : 0.5, pointerEvents: series.imagesOptimised ? 'auto' : 'none' }}>
              <input type="checkbox" id={`rebuild-${series.id}`} checked={series.builtOriginal} onChange={(e) => handleSeriesChange(series.id, 'builtOriginal', e.target.checked)} disabled={!series.imagesOptimised} />
              <label htmlFor={`rebuild-${series.id}`}>Structure rebuilt with original artworks</label>
              <span className="badge" style={{ marginLeft: '1rem' }}>Steevez</span>
            </div>
            
            <div className="check-item" style={{ marginBottom: 0, opacity: isFinalApprovalEnabled || series.finalApproval ? 1 : 0.5, pointerEvents: isFinalApprovalEnabled || series.finalApproval ? 'auto' : 'none' }}>
              <input type="checkbox" id={`final-${series.id}`} checked={series.finalApproval} onChange={() => handleSeriesChange(series.id, 'finalApproval', true)} disabled={series.finalApproval || !isFinalApprovalEnabled} style={{ borderColor: series.finalApproval ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: series.finalApproval ? 'var(--admin-success)' : 'transparent' }} />
              <label htmlFor={`final-${series.id}`} style={{ color: series.finalApproval ? 'var(--admin-success)' : 'inherit' }}>Final Approval</label>
              <span className="badge" style={{ marginLeft: '1rem' }}>Suruchi</span>
            </div>
            <div className={`approval-note ${series.finalApproval ? 'is-approved' : ''}`}>
              {series.finalApproval
                ? 'This series approval is locked and cannot be withdrawn.'
                : 'Final approval is irreversible and only unlocks after build, source-image, optimisation, and metadata requirements are complete.'}
            </div>

          </div>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <div className="section-title">Review Thread</div>
          <div className="review-composer">
            <select className="form-control" value={messageAuthor} onChange={e => setMessageAuthor(e.target.value as 'Suruchi' | 'Steevez')} aria-label="Review note author">
              <option value="Suruchi">Suruchi</option>
              <option value="Steevez">Steevez</option>
            </select>
            <textarea className="form-control" rows={3} placeholder="Add a review note..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <button type="button" className="btn primary" onClick={() => handleAddReview(series.id)}>Post</button>
          </div>
          <div className="review-thread">
            {series.reviewThread?.length === 0 && <div className="empty-state">No review messages recorded yet.</div>}
            {series.reviewThread?.map(msg => (
              <div key={msg.id} className="review-message">
                <div className="review-message-header">
                  <strong className="badge">{msg.author}</strong>
                  <span className="review-message-time">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <div className="review-message-body">{msg.message}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-title">Artwork Inventory</div>
        <div className="inventory-summary">
          <div className="inventory-summary-item">
            <span className="inventory-summary-label">Total Artworks</span>
            <strong className="inventory-summary-value">{total}</strong>
          </div>
          <div className="inventory-summary-item">
            <span className="inventory-summary-label">Complete Metadata</span>
            <strong className="inventory-summary-value" style={{ color: complete === total ? 'var(--admin-success)' : 'var(--admin-fg)' }}>{complete}</strong>
          </div>
          <div className="inventory-summary-item">
            <span className="inventory-summary-label">Missing Metadata</span>
            <strong className="inventory-summary-value" style={{ color: missing > 0 ? 'var(--admin-error)' : 'var(--admin-success)' }}>{missing}</strong>
          </div>
        </div>

        <div className="inventory-list">
          {series.artworks.map((art, idx) => {
            const missingFields = [];
            if (!art.title.trim()) missingFields.push('Title');
            if (!art.caption.trim()) missingFields.push('Caption');
            if (!art.medium.trim()) missingFields.push('Medium');
            if (!art.dimension.trim()) missingFields.push('Dimension');
            if (!art.year.trim()) missingFields.push('Year');
            
            return (
              <div key={art.id} className="inventory-card">
                <div className="inventory-thumb">
                  <img 
                    src={art.thumbnailSrc} 
                    alt={`Artwork ${idx + 1}`} 
                  />
                  <div className="inventory-thumb-caption">
                    {art.filename}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="badge">{String(idx + 1).padStart(2, '0')}</span>
                  </div>
                  
                  {missingFields.length > 0 ? (
                    <div className="badge status-missing" style={{ marginTop: '1rem' }}>
                      Missing: {missingFields.join(', ')}
                    </div>
                  ) : (
                    <div className="badge status-complete" style={{ marginTop: '1rem' }}>
                      Complete
                    </div>
                  )}
                </div>
                
                <div className="inventory-card-body">
                  <div className="inventory-fields">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Title</label>
                    <input type="text" className="form-control" value={art.title} onChange={e => handleArtworkChange(series.id, art.id, 'title', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Caption</label>
                    <textarea className="form-control" rows={3} value={art.caption} onChange={e => handleArtworkChange(series.id, art.id, 'caption', e.target.value)} />
                  </div>
                  <div className="inventory-fields compact">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Medium</label>
                      <input type="text" className="form-control" value={art.medium} onChange={e => handleArtworkChange(series.id, art.id, 'medium', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Dimension</label>
                      <input type="text" className="form-control" value={art.dimension} onChange={e => handleArtworkChange(series.id, art.id, 'dimension', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Year</label>
                      <input type="text" className="form-control" value={art.year} onChange={e => handleArtworkChange(series.id, art.id, 'year', e.target.value)} />
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="dossier-container">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          {project.title} Dossier
        </div>
        <div>
          <button type="button" className="btn" onClick={onCancel} style={{ marginRight: '1rem' }}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSubmit}>Save Changes</button>
        </div>
      </div>

      <div className="dossier-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        <div className="dossier-nav">
          <div className="section-title" style={{ marginTop: 0 }}>Navigation</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <button 
                className={`btn-text ${activeTab === 'overview' ? 'active' : ''}`} 
                onClick={() => setActiveTab('overview')} 
                style={{ color: activeTab === 'overview' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'overview' ? 600 : 400 }}
              >
                Painter Overview
              </button>
            </li>
            
            <div style={{ margin: '1.5rem 0 0.5rem 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-fg-muted)' }}>
              Series
            </div>
            
            {formData.painterSeries?.map(series => {
              const isActive = activeTab === `series-${series.id}`;
              return (
                <li key={series.id} style={{ marginBottom: '0.5rem' }}>
                  <button 
                    className={`btn-text ${isActive ? 'active' : ''}`} 
                    onClick={() => setActiveTab(`series-${series.id}`)} 
                    style={{ 
                      color: isActive ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', 
                      fontWeight: isActive ? 600 : 400,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series.title}</span>
                    {series.artworks.some(a => !a.metadataComplete) && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--admin-error)', flexShrink: 0, marginLeft: '0.5rem' }}></span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="dossier-main">
          {activeTab === 'overview' ? renderOverview() : renderSeries(activeTab.replace('series-', ''))}
        </div>
      </div>
    </div>
  );
}
