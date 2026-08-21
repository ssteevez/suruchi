import React, { useState } from 'react';
import type { Project, ChecklistItem, ReviewMessage, PilgrimPhoto } from '../types';
import { isChecklistItemEnabled } from '../templates';
import { ProjectStore } from '../store';

interface PilgrimDossierProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

type TabKey = 'production' | 'inventory' | 'review' | 'activity';

export function PilgrimDossier({ project, onSave, onCancel }: PilgrimDossierProps) {
  const [formData, setFormData] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<TabKey>('production');
  const [newMessage, setNewMessage] = useState('');
  const [messageAuthor, setMessageAuthor] = useState<'Suruchi' | 'Steevez'>('Suruchi');

  const isMetadataComplete = (photos: PilgrimPhoto[]) => {
    return photos.length > 0 && photos.every(p => p.title.trim() && p.caption.trim() && p.date.trim());
  };

  const getMissingMetadataCount = (photos: PilgrimPhoto[]) => {
    return photos.filter(p => !p.title.trim() || !p.caption.trim() || !p.date.trim()).length;
  };

  // Keep derived statuses updated based on form data
  const derivedChecklist = formData.checklist.map(item => {
    if (item.id === 'pil_photo_metadata') {
      return { ...item, value: isMetadataComplete(formData.pilgrimPhotos || []) };
    }
    if (item.id === 'pil_review_active') {
      return { ...item, value: (formData.reviewThread?.length || 0) > 0 };
    }
    return item;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, checklist: derivedChecklist });
  };

  // --- Helpers for Checklists ---
  const updateItemInList = (list: ChecklistItem[], targetId: string, updater: (item: ChecklistItem) => ChecklistItem): ChecklistItem[] => {
    return list.map(item => {
      if (item.id === targetId) return updater({ ...item });
      if (item.children) return { ...item, children: updateItemInList(item.children, targetId, updater) };
      return item;
    });
  };

  const handleCheckboxToggle = (item: ChecklistItem) => {
    setFormData(prev => ({
      ...prev,
      checklist: updateItemInList(prev.checklist, item.id, (i) => ({ ...i, value: !i.value }))
    }));
  };

  const handleTextChange = (item: ChecklistItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      checklist: updateItemInList(prev.checklist, item.id, (i) => ({ ...i, value }))
    }));
  };

  const handleLockedApproval = (item: ChecklistItem) => {
    if (item.value === true) return; 
    if (window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
      setFormData(prev => {
        const nextState = {
          ...prev,
          checklist: updateItemInList(prev.checklist, item.id, (i) => ({ ...i, value: true, completedAt: Date.now() }))
        };
        ProjectStore.saveProject(nextState);
        return nextState;
      });
    }
  };

  // --- Helpers for Pilgrim Photos ---
  const handlePhotoChange = (photoId: string, field: keyof PilgrimPhoto, value: string) => {
    setFormData(prev => ({
      ...prev,
      pilgrimPhotos: prev.pilgrimPhotos?.map(p => {
        if (p.id !== photoId) return p;
        return { ...p, [field]: value, updatedAt: Date.now() };
      })
    }));
  };

  // --- Helpers for Review Thread ---
  const handleAddReview = () => {
    if (!newMessage.trim()) return;
    const msg: ReviewMessage = {
      id: `msg-${Date.now()}`,
      author: messageAuthor,
      message: newMessage,
      createdAt: Date.now()
    };
    setFormData(prev => {
      const nextState = {
        ...prev,
        reviewThread: [msg, ...(prev.reviewThread || [])]
      };
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setNewMessage('');
  };

  const getFirstIncompleteItemId = (items: ChecklistItem[]): string | null => {
    for (const item of items) {
      if (item.type === 'grouped' && item.children) {
        const childId = getFirstIncompleteItemId(item.children);
        if (childId) return childId;
      } else {
        const isComplete = item.type === 'text' ? (typeof item.value === 'string' && item.value.trim().length > 0) : item.value === true;
        if (!isComplete) return item.id;
      }
    }
    return null;
  };

  const firstIncompleteId = getFirstIncompleteItemId(derivedChecklist);

  const renderReadOnlyChecklist = (items: ChecklistItem[], depth = 0) => {
    return items.map(item => {
      if (item.id === 'pil_review_active') return null; // We render review thread separately
      
      const isComplete = item.type === 'text' ? (typeof item.value === 'string' && item.value.trim().length > 0) : item.value === true;
      const isNextInLine = item.id === firstIncompleteId;
      
      return (
        <div key={item.id} className={`checklist-item ${isComplete ? 'received' : 'missing'}`} style={{ marginLeft: `${depth}rem`, marginBottom: '0.25rem', fontSize: '0.8rem', opacity: (!isComplete && !isNextInLine) ? 0.6 : 1 }}>
          {item.type === 'text' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>{item.label}</span>
              {isComplete ? (
                <a href={item.value as string} target="_blank" rel="noreferrer" style={{ color: 'var(--admin-fg)', wordBreak: 'break-all' }}>[Provided Link]</a>
              ) : isNextInLine ? (
                <span style={{ color: 'var(--admin-error)', fontStyle: 'italic', fontWeight: 600 }}>ATTN: {item.owner} - Pending</span>
              ) : (
                <span style={{ color: 'var(--admin-fg-muted)', fontStyle: 'italic' }}>Pending</span>
              )}
            </div>
          ) : (
            <>
              {isComplete ? '☑' : '☐'} {item.label}
              {isNextInLine && <span style={{ color: 'var(--admin-error)', fontStyle: 'italic', fontWeight: 600, marginLeft: '0.5rem' }}>(ATTN: {item.owner})</span>}
            </>
          )}
          {item.children && <div style={{ marginTop: '0.25rem' }}>{renderReadOnlyChecklist(item.children, depth + 1)}</div>}
        </div>
      );
    });
  };

  const isFinalApprovalEnabled = () => {
    const structBuilt = derivedChecklist.find(i => i.id === 'pil_structure_rebuilt')?.value === true;
    const metaComplete = derivedChecklist.find(i => i.id === 'pil_photo_metadata')?.value === true;
    const structApproved = derivedChecklist.find(i => i.id === 'pil_structure_approved')?.value === true;
    return structBuilt && metaComplete && structApproved;
  };

  const renderEditableChecklist = (items: ChecklistItem[], depth = 0) => {
    return items.map(item => {
      if (item.type === 'derived') return null; // Don't render derived items in the edit form
      
      let isEnabled = isChecklistItemEnabled(item, derivedChecklist);
      if (item.id === 'pil_final_approval') {
        isEnabled = isFinalApprovalEnabled();
      }

      const style = { marginLeft: `${depth * 1.5}rem`, marginBottom: '1rem', opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' as const : 'none' as const };
      
      return (
        <div key={item.id} style={style}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {item.type === 'checkbox' && (
              <div className="check-item" style={{ marginBottom: 0 }}>
                <input type="checkbox" id={`edit-${item.id}`} checked={Boolean(item.value)} onChange={() => handleCheckboxToggle(item)} disabled={!isEnabled} />
                <label htmlFor={`edit-${item.id}`}>{item.label}</label>
              </div>
            )}
            {item.type === 'lockedApproval' && (
              <div className="check-item" style={{ marginBottom: 0 }}>
                <input type="checkbox" id={`edit-${item.id}`} checked={Boolean(item.value)} onChange={() => handleLockedApproval(item)} disabled={!isEnabled || item.value === true} style={{ borderColor: item.value ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: item.value ? 'var(--admin-success)' : 'transparent' }} />
                <label htmlFor={`edit-${item.id}`} style={{ color: item.value ? 'var(--admin-success)' : 'inherit' }}>{item.label}</label>
              </div>
            )}
            {item.type === 'text' && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{item.label}</label>
                <input type="text" className="form-control" value={item.value as string} onChange={e => handleTextChange(item, e.target.value)} disabled={!isEnabled} placeholder={item.id === 'pil_highres_images' ? 'Paste Google Drive link to high-res Pilgrim images' : ''} />
              </div>
            )}
          </div>
          {!isEnabled && item.dependsOn && item.id !== 'pil_final_approval' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-error)', marginLeft: item.type === 'text' ? '0' : '1.5rem', marginTop: '0.25rem' }}>
              Waiting for previous requirement
            </div>
          )}
          {!isEnabled && item.id === 'pil_final_approval' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-error)', marginLeft: '1.5rem', marginTop: '0.25rem' }}>
              Waiting for: Structure rebuilt, Photo metadata completed, Structure approved
            </div>
          )}
          {item.description && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-fg-muted)', marginLeft: '1.5rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
              {item.description}
            </div>
          )}
          {item.type === 'lockedApproval' && item.value === true && item.completedAt && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-success)', marginLeft: '1.5rem', marginTop: '0.25rem' }}>
              Approved by Suruchi on {new Date(item.completedAt).toLocaleString()}
            </div>
          )}
        </div>
      );
    });
  };

  const renderActiveTabContent = () => {
    if (activeTab === 'production') {
      return (
        <div className="dossier-tab-content">
          <div className="form-group">
            <label>Notes from Suruchi</label>
            <textarea className="form-control" rows={4} value={formData.notesFromSuruchi} onChange={e => setFormData(p => ({ ...p, notesFromSuruchi: e.target.value }))} />
          </div>

          <div className="section-title" style={{ marginTop: '3rem' }}>Requirements Edit</div>
          {renderEditableChecklist(derivedChecklist)}
        </div>
      );
    }

    if (activeTab === 'inventory') {
      const photos = formData.pilgrimPhotos || [];
      const missingCount = getMissingMetadataCount(photos);
      
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Photo Inventory</div>
          
          <div className="inventory-summary">
            <div className="inventory-summary-item">
              <span className="inventory-summary-label">Total Photos</span>
              <strong className="inventory-summary-value">{photos.length}</strong>
            </div>
            <div className="inventory-summary-item">
              <span className="inventory-summary-label">Complete Metadata</span>
              <strong className="inventory-summary-value" style={{ color: 'var(--admin-success)' }}>{photos.length - missingCount}</strong>
            </div>
            <div className="inventory-summary-item">
              <span className="inventory-summary-label">Missing Metadata</span>
              <strong className="inventory-summary-value" style={{ color: missingCount > 0 ? 'var(--admin-error)' : 'var(--admin-success)' }}>{missingCount}</strong>
            </div>
          </div>

          <div className="inventory-list">
            {photos.map((photo, idx) => {
              const missing = [];
              if (!photo.title.trim()) missing.push('Title');
              if (!photo.caption.trim()) missing.push('Caption');
              if (!photo.date.trim()) missing.push('Date');
              
              return (
                <div key={photo.id} className="inventory-card">
                  <div className="inventory-thumb">
                    <img src={photo.thumbnailSrc} alt={photo.filename} />
                    <div className="inventory-thumb-caption">
                      {photo.filename}
                    </div>
                  </div>
                  <div className="inventory-card-body">
                    <div className="inventory-card-header">
                      <strong className="inventory-card-title">Photo {String(idx + 1).padStart(2, '0')}</strong>
                      {missing.length > 0 ? (
                        <span className="badge status-missing">
                          Missing: {missing.join(', ')}
                        </span>
                      ) : (
                        <span className="badge status-complete">Complete</span>
                      )}
                    </div>
                    
                    <div className="inventory-fields">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input type="text" className="form-control" placeholder="Title" value={photo.title} onChange={e => handlePhotoChange(photo.id, 'title', e.target.value)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <textarea className="form-control" placeholder="Caption" rows={2} value={photo.caption} onChange={e => handlePhotoChange(photo.id, 'caption', e.target.value)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input type="text" className="form-control" placeholder="Date (e.g. 2023)" value={photo.date} onChange={e => handlePhotoChange(photo.id, 'date', e.target.value)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} />
                    </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'review') {
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Review Thread</div>
          <div className="review-composer">
            <select className="form-control" value={messageAuthor} onChange={e => setMessageAuthor(e.target.value as 'Suruchi' | 'Steevez')} aria-label="Review note author">
              <option value="Suruchi">Suruchi</option>
              <option value="Steevez">Steevez</option>
            </select>
            <textarea className="form-control" rows={3} placeholder="Add a review note or decision..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <button type="button" className="btn primary" onClick={handleAddReview}>Post</button>
          </div>
          
          <div className="review-thread">
            {formData.reviewThread?.length === 0 && <div className="empty-state">No review messages recorded yet.</div>}
            {formData.reviewThread?.map(msg => (
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
      );
    }
    
    if (activeTab === 'activity') {
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Activity Log</div>
          {formData.activity && formData.activity.length > 0 ? (
            <div className="activity-log">
              {formData.activity.map((log, idx) => (
                <div key={idx} className="activity-item" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--admin-border-hover)' }}>
                  <div className="activity-date" style={{ fontSize: '0.8rem', color: 'var(--admin-fg-muted)' }}>{new Date(log.date).toLocaleString()}</div>
                  <div className="activity-msg" style={{ fontSize: '0.9rem' }}>{log.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="missing-text">No activity recorded.</div>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="dossier-container">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          Pilgrim Dossier
        </div>
        <div>
          <button type="button" className="btn" onClick={onCancel} style={{ marginRight: '1rem' }}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSubmit}>Save Changes</button>
        </div>
      </div>

      <div className="dossier-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 300px', gap: '2rem', marginTop: '2rem' }}>
        
        <div className="dossier-nav">
          <div className="section-title" style={{ marginTop: 0 }}>Navigation</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className={`btn-text ${activeTab === 'production' ? 'active' : ''}`} onClick={() => setActiveTab('production')} style={{ color: activeTab === 'production' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'production' ? 600 : 400 }}>Pilgrim Production</button>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className={`btn-text ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')} style={{ color: activeTab === 'inventory' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'inventory' ? 600 : 400 }}>Photo Inventory</button>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className={`btn-text ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')} style={{ color: activeTab === 'review' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'review' ? 600 : 400 }}>Review Thread</button>
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className={`btn-text ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')} style={{ color: activeTab === 'activity' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'activity' ? 600 : 400 }}>Activity Log</button>
            </li>
          </ul>
        </div>

        <div className="dossier-main">
          {renderActiveTabContent()}
        </div>

        <div className="dossier-sidebar">
          <div className="section-title" style={{ marginTop: 0 }}>Requirements Mirror</div>
          <div className="read-only-panel" style={{ padding: '1rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
            {renderReadOnlyChecklist(derivedChecklist)}
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--admin-border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem' }}>Review Thread</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-fg-muted)' }}>
                {formData.reviewThread && formData.reviewThread.length > 0 
                  ? `${formData.reviewThread.length} message(s)` 
                  : 'No review messages yet'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
