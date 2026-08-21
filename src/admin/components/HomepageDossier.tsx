import React, { useState } from 'react';
import type { Project, ChecklistItem, ReviewMessage, MiniPage } from '../types';
import { isChecklistItemEnabled } from '../templates';
import { ProjectStore } from '../store';

interface HomepageDossierProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

type TabKey = 'production' | 'review' | 'mp_bio' | 'mp_tearsheets' | 'mp_contact' | 'mp_enquiry';

export function HomepageDossier({ project, onSave, onCancel }: HomepageDossierProps) {
  const [formData, setFormData] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<TabKey>('production');
  const [newMessage, setNewMessage] = useState('');
  const [messageAuthor, setMessageAuthor] = useState<'Suruchi' | 'Steevez'>('Suruchi');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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

  // --- Helpers for MiniPages ---
  const handleMiniPageChange = (mpId: string, field: keyof MiniPage, value: any) => {
    setFormData(prev => {
      const nextState = {
        ...prev,
        miniPages: prev.miniPages?.map(mp => {
          if (mp.id !== mpId) return mp;
          
          // Locked approval logic for minipage
          if (field === 'approved') {
            if (mp.approved === true) return mp; // locked
            if (!window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
              return mp;
            }
            return { ...mp, approved: true, approvedAt: Date.now(), updatedAt: Date.now() };
          }
          
          return { ...mp, [field]: value, updatedAt: Date.now() };
        })
      };
      
      // Auto-save irreversible approvals
      if (field === 'approved') {
        ProjectStore.saveProject(nextState);
      }
      return nextState;
    });
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

  const firstIncompleteId = getFirstIncompleteItemId(formData.checklist);

  const renderReadOnlyChecklist = (items: ChecklistItem[], depth = 0) => {
    return items.map(item => {
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

  const renderEditableChecklist = (items: ChecklistItem[], depth = 0) => {
    return items.map(item => {
      const isEnabled = isChecklistItemEnabled(item, formData.checklist);
      const style = { marginLeft: `${depth * 1.5}rem`, marginBottom: '1rem', opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' as const : 'none' as const };
      
      if (item.type === 'grouped') {
        return (
          <div key={item.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ ...style, marginBottom: '0.5rem' }}>
              <div className="section-title" style={{ marginTop: 0, marginBottom: '0.5rem', border: 'none', color: 'var(--admin-fg)' }}>
                {item.label}
              </div>
              {item.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-fg-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  {item.description}
                </div>
              )}
            </div>
            {item.children && renderEditableChecklist(item.children, depth + 1)}
          </div>
        );
      }

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
                <input type="text" className="form-control" value={item.value as string} onChange={e => handleTextChange(item, e.target.value)} disabled={!isEnabled} />
              </div>
            )}
          </div>
          {!isEnabled && item.dependsOn && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-error)', marginLeft: item.type === 'text' ? '0' : '1.5rem', marginTop: '0.25rem' }}>
              Waiting for previous requirement
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
          {renderEditableChecklist(formData.checklist)}
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

    // Mini pages
    const mp = formData.miniPages?.find(p => p.id === activeTab);
    if (mp) {
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Sub-section: {mp.title}</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={mp.status} onChange={e => handleMiniPageChange(mp.id, 'status', e.target.value)}>
                <option value="blocked">Blocked</option>
                <option value="waiting-for-content">Waiting for Content</option>
                <option value="active">Active</option>
                <option value="review">Ready for Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="form-group">
              <label>Owner</label>
              <select className="form-control" value={mp.owner} onChange={e => handleMiniPageChange(mp.id, 'owner', e.target.value)}>
                <option value="Suruchi">Suruchi</option>
                <option value="Steevez">Steevez</option>
                <option value="Shared">Shared</option>
              </select>
            </div>
          </div>

          <div className="approval-panel">
            <div className="section-title" style={{ marginTop: 0 }}>Progress</div>
            
            <div className="check-item">
              <input type="checkbox" id={`mp_c_${mp.id}`} checked={mp.contentReceived} onChange={() => handleMiniPageChange(mp.id, 'contentReceived', !mp.contentReceived)} />
              <label htmlFor={`mp_c_${mp.id}`}>Content Received</label>
            </div>
            
            <div className="check-item">
              <input type="checkbox" id={`mp_b_${mp.id}`} checked={mp.built} onChange={() => handleMiniPageChange(mp.id, 'built', !mp.built)} />
              <label htmlFor={`mp_b_${mp.id}`}>Built</label>
            </div>

            <div className="check-item">
              <input type="checkbox" id={`mp_r_${mp.id}`} checked={mp.reviewed} onChange={() => handleMiniPageChange(mp.id, 'reviewed', !mp.reviewed)} />
              <label htmlFor={`mp_r_${mp.id}`}>Reviewed</label>
            </div>

            <div className="check-item">
              <input 
                type="checkbox" 
                id={`mp_a_${mp.id}`} 
                checked={mp.approved} 
                onChange={() => handleMiniPageChange(mp.id, 'approved', !mp.approved)} 
                disabled={mp.approved}
                style={{ borderColor: mp.approved ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: mp.approved ? 'var(--admin-success)' : 'transparent' }}
              />
              <label htmlFor={`mp_a_${mp.id}`} style={{ color: mp.approved ? 'var(--admin-success)' : 'inherit' }}>Approved by Suruchi</label>
            </div>
            {mp.approved && mp.approvedAt && (
              <div className="approval-note is-approved">
                Locked approval recorded on {new Date(mp.approvedAt).toLocaleString()}
              </div>
            )}
            {!mp.approved && (
              <div className="approval-note">
                Approval is irreversible once checked and saved to the dossier.
              </div>
            )}
          </div>

          <div className="form-group">
            <label>File / Drive Link</label>
            <input type="text" className="form-control" value={mp.fileLink} onChange={e => handleMiniPageChange(mp.id, 'fileLink', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" rows={5} value={mp.notes} onChange={e => handleMiniPageChange(mp.id, 'notes', e.target.value)} />
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="dossier-container">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          Homepage Dossier
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
              <button className={`btn-text ${activeTab === 'production' ? 'active' : ''}`} onClick={() => setActiveTab('production')} style={{ color: activeTab === 'production' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'production' ? 600 : 400 }}>Homepage Production</button>
            </li>
            <li style={{ marginBottom: '1.5rem' }}>
              <button className={`btn-text ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')} style={{ color: activeTab === 'review' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'review' ? 600 : 400 }}>Review Thread</button>
            </li>
            <div className="section-title" style={{ border: 'none', padding: '0 0 0.5rem 0', margin: '0 0 0.5rem 0', fontSize: '0.75rem', textDecoration: 'underline' }}>Mini Pages</div>
            {formData.miniPages?.map(mp => (
              <li key={mp.id} style={{ marginBottom: '0.5rem' }}>
                <button className={`btn-text ${activeTab === mp.id ? 'active' : ''}`} onClick={() => setActiveTab(mp.id as TabKey)} style={{ color: activeTab === mp.id ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === mp.id ? 600 : 400 }}>
                  {mp.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="dossier-main">
          {renderActiveTabContent()}
        </div>

        <div className="dossier-sidebar">
          <div className="section-title" style={{ marginTop: 0 }}>Requirements Mirror</div>
          <div className="read-only-panel" style={{ padding: '1rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
            {renderReadOnlyChecklist(formData.checklist)}
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--admin-border)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.85rem' }}>Mini Pages Progress</div>
              {formData.miniPages?.map(mp => {
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
          </div>
        </div>

      </div>
    </div>
  );
}
