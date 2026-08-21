import React, { useState } from 'react';
import type { Project, ReviewMessage, PoetMiniPage, EuphemismStructure, EuphemismRequest } from '../types';
import { ProjectStore } from '../store';
import { getIncompleteItemsByOwner } from '../templates';

interface PoetDossierProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

type TabKey = 'overview' | 'bandra' | 'add-euphemism' | `euph-${string}`;

export function PoetDossier({ project, onSave, onCancel }: PoetDossierProps) {
  const [formData, setFormData] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [newMessage, setNewMessage] = useState('');
  const [messageAuthor, setMessageAuthor] = useState<'Suruchi' | 'Steevez'>('Suruchi');

  const appendActivity = (project: Project, message: string): Project => {
    return {
      ...project,
      activity: [{ date: Date.now(), message }, ...(project.activity || [])]
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // --- Handlers for Celebrating Bandra ---
  const handleBandraChange = (field: keyof PoetMiniPage, value: any) => {
    setFormData(prev => {
      const pages = prev.poetPages ? [...prev.poetPages] : [];
      const idx = pages.findIndex(p => p.id === 'poet-bandra');
      if (idx === -1) return prev;
      
      const page = { ...pages[idx] } as PoetMiniPage;
      
      let nextState: Project = { ...prev, poetPages: pages };
      
      if (field === 'structureBuilt') {
        page.structureBuilt = value;
        nextState = appendActivity(nextState, `Celebrating Bandra: Structure built marked as ${value ? 'complete' : 'incomplete'}`);
      }
      
      if (field === 'structureApproved') {
        if (page.structureApproved === true) return prev; // locked
        if (!window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
          return prev;
        }
        page.structureApproved = true;
        page.approvedAt = Date.now();
        nextState = appendActivity(nextState, `Celebrating Bandra: Structure approved by Suruchi`);
      }

      if (field === 'finalApproval') {
        if (page.finalApproval === true) return prev;
        page.finalApproval = true;
        nextState = appendActivity(nextState, `Celebrating Bandra: Final approval given by Suruchi`);
      }

      page.updatedAt = Date.now();
      pages[idx] = page;
      
      // Auto-save irreversible approvals and status changes
      if (field === 'structureApproved' || field === 'finalApproval') {
        ProjectStore.saveProject(nextState);
      }
      return nextState;
    });
  };

  const handleAddBandraReview = () => {
    if (!newMessage.trim()) return;
    setFormData(prev => {
      const pages = prev.poetPages ? [...prev.poetPages] : [];
      const idx = pages.findIndex(p => p.id === 'poet-bandra');
      if (idx === -1) return prev;
      
      const page = { ...pages[idx] } as PoetMiniPage;
      const msg: ReviewMessage = { id: `msg-${Date.now()}`, author: messageAuthor, message: newMessage, createdAt: Date.now() };
      page.reviewThread = [msg, ...(page.reviewThread || [])];
      pages[idx] = page;
      
      let nextState: Project = { ...prev, poetPages: pages };
      nextState = appendActivity(nextState, `Celebrating Bandra: Review message added by ${messageAuthor}`);
      
      // Auto-save review messages to localStorage without closing the dossier
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setNewMessage('');
  };

  // --- Handlers for Euphemisms ---
  const handleEuphChange = (structId: string, field: keyof EuphemismStructure, value: any) => {
    setFormData(prev => {
      const structs = prev.euphemismStructures ? [...prev.euphemismStructures] : [];
      const idx = structs.findIndex(s => s.id === structId);
      if (idx === -1) return prev;
      
      const struct = { ...structs[idx] } as EuphemismStructure;
      
      let nextState: Project = { ...prev, euphemismStructures: structs };
      
      if (field === 'structureBuilt') {
        struct.structureBuilt = value;
        nextState = appendActivity(nextState, `Euphemisms / ${struct.title}: Structure built marked as ${value ? 'complete' : 'incomplete'}`);
      }
      
      if (field === 'structureApproved') {
        if (struct.structureApproved === true) return prev;
        if (!window.confirm('This approval cannot be withdrawn once confirmed. The approval will be logged with date and time. Confirm?')) {
          return prev;
        }
        struct.structureApproved = true;
        struct.approvedAt = Date.now();
        nextState = appendActivity(nextState, `Euphemisms / ${struct.title}: Structure approved by Suruchi`);
      }

      struct.updatedAt = Date.now();
      structs[idx] = struct;
      
      // Auto-save irreversible approvals
      if (field === 'structureApproved' || field === 'finalApproval') {
        ProjectStore.saveProject(nextState);
      }
      return nextState;
    });
  };

  const handleAddEuphReview = (structId: string) => {
    if (!newMessage.trim()) return;
    setFormData(prev => {
      const structs = prev.euphemismStructures ? [...prev.euphemismStructures] : [];
      const idx = structs.findIndex(s => s.id === structId);
      if (idx === -1) return prev;
      
      const struct = { ...structs[idx] } as EuphemismStructure;
      const msg: ReviewMessage = { id: `msg-${Date.now()}`, author: messageAuthor, message: newMessage, createdAt: Date.now() };
      struct.reviewThread = [msg, ...(struct.reviewThread || [])];
      structs[idx] = struct;
      
      let nextState: Project = { ...prev, euphemismStructures: structs };
      nextState = appendActivity(nextState, `Euphemisms / ${struct.title}: Review message added by ${messageAuthor}`);
      
      // Auto-save review messages to localStorage without closing the dossier
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setNewMessage('');
  };

  // --- Handlers for New Euphemism Requests ---
  const handleAddNewEuphemism = () => {
    const newReqId = `req-${Date.now()}`;
    setFormData(prev => {
      const reqs = prev.newEuphemismRequests ? [...prev.newEuphemismRequests] : [];
      const newReq: EuphemismRequest = {
        id: newReqId,
        title: '',
        driveLink: '',
        text: '',
        interactionSystem: '',
        seenBySteevez: false,
        building: false,
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      let nextState: Project = { ...prev, newEuphemismRequests: [...reqs, newReq] };
      nextState = appendActivity(nextState, `New Euphemism request created`);
      
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setActiveTab(newReqId as any);
  };

  const handleEuphRequestChange = (reqId: string, field: keyof EuphemismRequest, value: any) => {
    setFormData(prev => {
      const reqs = prev.newEuphemismRequests ? [...prev.newEuphemismRequests] : [];
      const idx = reqs.findIndex(r => r.id === reqId);
      if (idx === -1) return prev;
      
      const req = { ...reqs[idx] } as EuphemismRequest;
      req[field] = value as never;
      req.updatedAt = Date.now();
      reqs[idx] = req;
      
      let nextState: Project = { ...prev, newEuphemismRequests: reqs };
      
      if (field === 'title') nextState = appendActivity(nextState, `New Euphemism: Title updated`);
      if (field === 'driveLink') nextState = appendActivity(nextState, `New Euphemism: Drive link updated`);
      if (field === 'text') nextState = appendActivity(nextState, `New Euphemism: Text updated`);
      if (field === 'interactionSystem') nextState = appendActivity(nextState, `New Euphemism: Interaction system updated`);
      if (field === 'seenBySteevez' && value) nextState = appendActivity(nextState, `New Euphemism: Marked as seen by Steevez`);
      if (field === 'building' && value) nextState = appendActivity(nextState, `New Euphemism: Building started`);
      
      if (field === 'done' && value) {
        const newStructId = `euphemism-${Date.now()}`;
        const newStruct: EuphemismStructure = {
          id: newStructId,
          title: req.title || 'Untitled Euphemism',
          structureBuilt: true,
          structureApproved: false,
          reviewThread: [],
          status: 'active',
          updatedAt: Date.now()
        };
        const updatedReqs = reqs.filter(r => r.id !== reqId);
        let nextStateDone: Project = { 
          ...prev, 
          newEuphemismRequests: updatedReqs,
          euphemismStructures: [...(prev.euphemismStructures || []), newStruct]
        };
        nextStateDone = appendActivity(nextStateDone, `New Euphemism: ${req.title || 'Untitled'} completed and moved to Euphemisms Directory`);
        
        ProjectStore.saveProject(nextStateDone);
        setTimeout(() => setActiveTab(newStructId as any), 0);
        return nextStateDone;
      }
      
      ProjectStore.saveProject(nextState);
      return nextState;
    });
  };

  const handleDeleteRequest = (reqId: string) => {
    if (!window.confirm('Are you sure you want to delete this request? This cannot be undone.')) return;
    setFormData(prev => {
      const updatedReqs = (prev.newEuphemismRequests || []).filter(r => r.id !== reqId);
      let nextState: Project = { ...prev, newEuphemismRequests: updatedReqs };
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setActiveTab('overview');
  };

  const handleDeleteEuphemism = (structId: string) => {
    if (!window.confirm('Are you sure you want to completely delete this Euphemism? This cannot be undone.')) return;
    setFormData(prev => {
      const updatedStructs = (prev.euphemismStructures || []).filter(s => s.id !== structId);
      const nextState = { ...prev, euphemismStructures: updatedStructs };
      ProjectStore.saveProject(nextState);
      return nextState;
    });
    setActiveTab('overview');
  };

  const renderActiveTabContent = () => {
    if (activeTab === 'overview') {
      const bandra = formData.poetPages?.find(p => p.id === 'poet-bandra');
      const euphs = formData.euphemismStructures || [];
      const reqs = formData.newEuphemismRequests || [];
      
      const bandraStatus = bandra?.structureApproved ? 'Approved' : (bandra?.structureBuilt ? 'Pending Approval' : 'Pending Build');
      const pendingEuphs = euphs.filter(e => e.structureBuilt && !e.structureApproved).length;
      
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Poet Overview</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
            <div className="read-only-panel" style={{ padding: '1.5rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--admin-fg-muted)', marginBottom: '0.5rem' }}>Celebrating Bandra</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: bandra?.structureApproved ? 'var(--admin-success)' : 'var(--admin-fg)' }}>
                {bandraStatus}
              </div>
            </div>
            
            <div className="read-only-panel" style={{ padding: '1.5rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--admin-fg-muted)', marginBottom: '0.5rem' }}>Euphemisms Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {euphs.length} Structures
              </div>
              <div style={{ fontSize: '0.85rem', color: pendingEuphs > 0 ? 'var(--admin-error)' : 'var(--admin-success)', marginTop: '0.5rem' }}>
                {pendingEuphs} Pending Approvals
              </div>
            </div>

            <div className="read-only-panel" style={{ padding: '1.5rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--admin-fg-muted)', marginBottom: '0.5rem' }}>New Euphemisms</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {reqs.length} Requests
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--admin-fg-muted)', marginTop: '0.5rem' }}>
                Pending Builds
              </div>
            </div>
          </div>

          <div className="section-title">Pending Approvals & Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="read-only-panel" style={{ padding: '1.5rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--admin-fg)' }}>Waiting on Steevez</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--admin-fg-muted)' }}>
                {getIncompleteItemsByOwner(formData, 'Steevez').length === 0 ? (
                  <li style={{ listStyle: 'none', marginLeft: '-1.25rem', fontStyle: 'italic', opacity: 0.6 }}>Nothing pending.</li>
                ) : (
                  getIncompleteItemsByOwner(formData, 'Steevez').map(item => {
                    const isBandra = item.id.includes('poet-bandra');
                    const isEuph = item.id.startsWith('euph_');
                    const isLink = isBandra || isEuph;
                    return (
                      <li key={item.id} style={{ marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="check-item" style={{ marginBottom: 0, paddingBottom: 0 }}>
                          <input type="checkbox" id={`ov_${item.id}`} checked={false} readOnly style={{ cursor: 'default' }} />
                          <label htmlFor={`ov_${item.id}`} style={{ display: 'none' }}>{item.label}</label>
                        </div>
                        {isLink ? (
                          <button 
                            className="btn-text" 
                            style={{ textAlign: 'left', textDecoration: 'underline', color: 'var(--admin-fg)', lineHeight: 1.2 }} 
                            onClick={() => {
                              if (isBandra) setActiveTab('bandra');
                              else {
                                const structId = item.id.replace('euph_bld_', '').replace('euph_app_', '').replace('euph_fin_', '');
                                setActiveTab(structId as any);
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        ) : (
                          <span style={{ lineHeight: 1.2 }}>{item.label}</span>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
            
            <div className="read-only-panel" style={{ padding: '1.5rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--admin-fg)' }}>Waiting on Suruchi</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--admin-fg-muted)' }}>
                {getIncompleteItemsByOwner(formData, 'Suruchi').length === 0 ? (
                  <li style={{ listStyle: 'none', marginLeft: '-1.25rem', fontStyle: 'italic', opacity: 0.6 }}>Nothing pending.</li>
                ) : (
                  getIncompleteItemsByOwner(formData, 'Suruchi').map(item => {
                    const isBandra = item.id.includes('poet-bandra');
                    const isEuph = item.id.startsWith('euph_');
                    const isLink = isBandra || isEuph;
                    return (
                      <li key={item.id} style={{ marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="check-item" style={{ marginBottom: 0, paddingBottom: 0 }}>
                          <input type="checkbox" id={`ov_${item.id}`} checked={false} readOnly style={{ cursor: 'default' }} />
                          <label htmlFor={`ov_${item.id}`} style={{ display: 'none' }}>{item.label}</label>
                        </div>
                        {isLink ? (
                          <button 
                            className="btn-text" 
                            style={{ textAlign: 'left', textDecoration: 'underline', color: 'var(--admin-fg)', lineHeight: 1.2 }} 
                            onClick={() => {
                              if (isBandra) setActiveTab('bandra');
                              else {
                                const structId = item.id.replace('euph_bld_', '').replace('euph_app_', '').replace('euph_fin_', '');
                                setActiveTab(structId as any);
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        ) : (
                          <span style={{ lineHeight: 1.2 }}>{item.label}</span>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'bandra') {
      const bandra = formData.poetPages?.find(p => p.id === 'poet-bandra');
      if (!bandra) return null;
      
      return (
        <div className="dossier-tab-content">
          <div className="section-title">Celebrating Bandra Production</div>
          
          <div className={`approval-panel ${bandra.finalApproval ? 'is-approved' : ''}`} style={{ marginBottom: '3rem' }}>
            <div className="check-item-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input type="checkbox" id="b_build" checked={bandra.structureBuilt} onChange={e => handleBandraChange('structureBuilt', e.target.checked)} />
                  <label htmlFor="b_build">Structure built</label>
                </div>
                <span className="badge">Steevez</span>
              </div>
            </div>

            <div className="check-item-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input 
                    type="checkbox" 
                    id="b_app" 
                    checked={bandra.structureApproved} 
                    onChange={() => {
                      if (window.confirm('Approving this structure is irreversible. Are you sure?')) {
                        handleBandraChange('structureApproved', true)
                      }
                    }} 
                    disabled={bandra.structureApproved || !bandra.structureBuilt}
                    style={{ borderColor: bandra.structureApproved ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: bandra.structureApproved ? 'var(--admin-success)' : 'transparent' }}
                  />
                  <label htmlFor="b_app">Structure Approved</label>
                </div>
                <span className="badge">Suruchi</span>
              </div>
            </div>

            <div className="check-item-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input 
                    type="checkbox" 
                    id="b_fin_bandra" 
                    checked={bandra.finalApproval} 
                    disabled={bandra.finalApproval || !bandra.structureApproved}
                    onChange={e => {
                      if (e.target.checked) {
                        if (window.confirm('Final Approval is irreversible. Are you sure?')) {
                          handleBandraChange('finalApproval', true);
                        }
                      }
                    }} 
                  />
                  <label htmlFor="b_fin_bandra">Final Approval / Complete</label>
                </div>
                <span className="badge">Suruchi</span>
              </div>
              {bandra.structureApproved && bandra.approvedAt && (
                <div className="approval-note is-approved">
                  Structure approval locked on {new Date(bandra.approvedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className={`approval-note ${bandra.finalApproval ? 'is-approved' : ''}`}>
              {bandra.finalApproval
                ? 'Final approval is locked and cannot be withdrawn.'
                : 'Final approval is irreversible and unlocks only after structure approval.'}
            </div>
          </div>

          <div className="section-title">Review Thread</div>
          <div className="review-composer">
            <select className="form-control" value={messageAuthor} onChange={e => setMessageAuthor(e.target.value as 'Suruchi' | 'Steevez')} aria-label="Review note author">
              <option value="Suruchi">Suruchi</option>
              <option value="Steevez">Steevez</option>
            </select>
            <textarea className="form-control" rows={3} placeholder="Add feedback specific to Celebrating Bandra..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <button type="button" className="btn primary" onClick={handleAddBandraReview}>Post</button>
          </div>
          
          <div className="review-thread">
            {bandra.reviewThread?.length === 0 && <div className="empty-state">No review messages recorded yet.</div>}
            {bandra.reviewThread?.map(msg => (
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

    if (activeTab.startsWith('req-')) {
      const reqs = formData.newEuphemismRequests || [];
      const reqIndex = reqs.findIndex(r => r.id === activeTab);
      const req = reqs[reqIndex];
      if (!req) return null;

      const isReadyForSteevez = req.title?.trim().length > 0 && req.driveLink?.trim().length > 0 && req.text?.trim().length > 0 && req.interactionSystem?.trim().length > 0;
      
      return (
        <div className="dossier-tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Request: {req.title || `New Request ${reqIndex + 1}`}</div>
            <button type="button" className="btn" onClick={() => handleDeleteRequest(req.id)} style={{ color: 'var(--admin-error)', borderColor: 'var(--admin-error)' }}>Delete Request</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Title <span className="badge">Suruchi</span></label>
              <input type="text" className="form-control" placeholder="Euphemism title" value={req.title || ''} onChange={e => handleEuphRequestChange(req.id, 'title', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Media Link (Drive) <span className="badge">Suruchi</span></label>
              <input type="text" className="form-control" placeholder="Google Drive link for media" value={req.driveLink || ''} onChange={e => handleEuphRequestChange(req.id, 'driveLink', e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Text <span className="badge">Suruchi</span></label>
            <textarea className="form-control" rows={3} placeholder="The poetic text or a link to the text document" value={req.text || ''} onChange={e => handleEuphRequestChange(req.id, 'text', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Interaction System <span className="badge">Suruchi</span></label>
            <textarea className="form-control" rows={3} placeholder="Describe how the interaction should work (e.g. scroll reveals, click interactions)" value={req.interactionSystem || ''} onChange={e => handleEuphRequestChange(req.id, 'interactionSystem', e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--admin-border-hover)' }}>
            <div className="check-item-container" style={{ opacity: isReadyForSteevez ? 1 : 0.5, pointerEvents: isReadyForSteevez ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input type="checkbox" id={`req_seen_${req.id}`} checked={req.seenBySteevez} onChange={e => handleEuphRequestChange(req.id, 'seenBySteevez', e.target.checked)} disabled={!isReadyForSteevez} />
                  <label htmlFor={`req_seen_${req.id}`}>Seen by Steevez</label>
                </div>
                <span className="badge">Steevez</span>
              </div>
            </div>

            <div className="check-item-container" style={{ opacity: req.seenBySteevez ? 1 : 0.5, pointerEvents: req.seenBySteevez ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input type="checkbox" id={`req_bld_${req.id}`} checked={req.building} onChange={e => handleEuphRequestChange(req.id, 'building', e.target.checked)} disabled={!req.seenBySteevez} />
                  <label htmlFor={`req_bld_${req.id}`}>Building</label>
                </div>
                <span className="badge">Steevez</span>
              </div>
            </div>

            <div className="check-item-container" style={{ opacity: req.building ? 1 : 0.5, pointerEvents: req.building ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input type="checkbox" id={`req_done_${req.id}`} checked={req.done} onChange={e => handleEuphRequestChange(req.id, 'done', e.target.checked)} disabled={!req.building} />
                  <label htmlFor={`req_done_${req.id}`}>Done</label>
                </div>
                <span className="badge">Steevez</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab.startsWith('euphemism-') || activeTab.startsWith('euph-')) {
      const struct = formData.euphemismStructures?.find(s => s.id === activeTab);
      if (!struct) return null;

      return (
        <div className="dossier-tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Euphemism: {struct.title}</div>
            <button type="button" className="btn" onClick={() => handleDeleteEuphemism(struct.id)} style={{ color: 'var(--admin-error)', borderColor: 'var(--admin-error)', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Delete Structure</button>
          </div>
          
          <div className={`approval-panel ${struct.structureApproved ? 'is-approved' : ''}`} style={{ marginBottom: '3rem' }}>
            <div className="check-item-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input type="checkbox" id={`e_bld_${struct.id}`} checked={struct.structureBuilt} onChange={e => handleEuphChange(struct.id, 'structureBuilt', e.target.checked)} />
                  <label htmlFor={`e_bld_${struct.id}`}>Structure built</label>
                </div>
                <span className="badge">Steevez</span>
              </div>
            </div>

            <div className="check-item-container" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="check-item" style={{ marginBottom: 0 }}>
                  <input 
                    type="checkbox" 
                    id={`e_app_${struct.id}`} 
                    checked={struct.structureApproved} 
                    onChange={() => handleEuphChange(struct.id, 'structureApproved', true)} 
                    disabled={struct.structureApproved}
                    style={{ borderColor: struct.structureApproved ? 'var(--admin-success)' : 'var(--admin-border-hover)', backgroundColor: struct.structureApproved ? 'var(--admin-success)' : 'transparent' }}
                  />
                  <label htmlFor={`e_app_${struct.id}`} style={{ color: struct.structureApproved ? 'var(--admin-success)' : 'inherit' }}>Structure approved</label>
                </div>
                <span className="badge">Suruchi</span>
              </div>
              {struct.structureApproved && struct.approvedAt && (
                <div className="approval-note is-approved">
                  Structure approval locked on {new Date(struct.approvedAt).toLocaleString()}
                </div>
              )}
            </div>
            {!struct.structureApproved && (
              <div className="approval-note">
                Structure approval is irreversible once confirmed.
              </div>
            )}
          </div>

          <div className="section-title">Review Thread ({struct.title})</div>
          <div className="review-composer">
            <select className="form-control" value={messageAuthor} onChange={e => setMessageAuthor(e.target.value as 'Suruchi' | 'Steevez')} aria-label="Review note author">
              <option value="Suruchi">Suruchi</option>
              <option value="Steevez">Steevez</option>
            </select>
            <textarea className="form-control" rows={3} placeholder={`Add feedback specific to ${struct.title}...`} value={newMessage} onChange={e => setNewMessage(e.target.value)} />
            <button type="button" className="btn primary" onClick={() => handleAddEuphReview(struct.id)}>Post</button>
          </div>
          
          <div className="review-thread">
            {struct.reviewThread?.length === 0 && <div className="empty-state">No review messages recorded yet.</div>}
            {struct.reviewThread?.map(msg => (
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
    
    return null;
  };

  return (
    <div className="dossier-container">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          Poet Dossier
        </div>
        <div>
          <button type="button" className="btn" onClick={onCancel} style={{ marginRight: '1rem' }}>Cancel</button>
          <button type="button" className="btn primary" onClick={handleSubmit}>Save Changes</button>
        </div>
      </div>

      <div className="dossier-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '3rem', marginTop: '2rem' }}>
        
        <div className="dossier-nav">
          <div className="section-title" style={{ marginTop: 0 }}>Navigation</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className={`btn-text ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={{ color: activeTab === 'overview' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'overview' ? 600 : 400 }}>Poet Overview</button>
            </li>
            <li style={{ marginBottom: '1.5rem' }}>
              <button className={`btn-text ${activeTab === 'bandra' ? 'active' : ''}`} onClick={() => { setActiveTab('bandra'); setNewMessage(''); }} style={{ color: activeTab === 'bandra' ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === 'bandra' ? 600 : 400 }}>Celebrating Bandra</button>
            </li>
            
            <div className="section-title" style={{ border: 'none', padding: '0 0 0.5rem 0', margin: '0 0 0.5rem 0', fontSize: '0.75rem', textDecoration: 'underline' }}>Active Euphemisms</div>
            {formData.euphemismStructures?.filter(s => !s.structureApproved).map(struct => (
              <li key={struct.id} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                <button className={`btn-text ${activeTab === struct.id ? 'active' : ''}`} onClick={() => { setActiveTab(struct.id as TabKey); setNewMessage(''); }} style={{ color: activeTab === struct.id ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === struct.id ? 600 : 400, textAlign: 'left' }}>
                  {struct.title}
                </button>
              </li>
            ))}

            <div className="section-title" style={{ border: 'none', padding: '0 0 0.5rem 0', margin: '1.5rem 0 0.5rem 0', fontSize: '0.75rem', textDecoration: 'underline' }}>Pending Requests</div>
            <li style={{ marginBottom: '0.5rem' }}>
              <button className="btn-text" onClick={handleAddNewEuphemism} style={{ color: 'var(--admin-fg-muted)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Add New Request
              </button>
            </li>
            
            {formData.newEuphemismRequests?.map((req, idx) => (
              <li key={req.id} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                <button className={`btn-text ${activeTab === req.id ? 'active' : ''}`} onClick={() => { setActiveTab(req.id as any); setNewMessage(''); }} style={{ color: activeTab === req.id ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === req.id ? 600 : 400, textAlign: 'left', fontStyle: 'italic' }}>
                  {req.title ? `Req: ${req.title}` : `Req: (Untitled ${idx + 1})`}
                </button>
              </li>
            ))}

            {(formData.euphemismStructures?.filter(s => s.structureApproved).length || 0) > 0 && (
              <>
                <div className="section-title" style={{ border: 'none', padding: '0 0 0.5rem 0', margin: '1.5rem 0 0.5rem 0', fontSize: '0.75rem', textDecoration: 'underline', color: 'var(--admin-fg-muted)' }}>
                  Completed ({formData.euphemismStructures!.filter(s => s.structureApproved).length})
                </div>
                {formData.euphemismStructures?.filter(s => s.structureApproved).map(struct => (
                  <li key={struct.id} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                    <button className={`btn-text ${activeTab === struct.id ? 'active' : ''}`} onClick={() => { setActiveTab(struct.id as TabKey); setNewMessage(''); }} style={{ color: activeTab === struct.id ? 'var(--admin-fg)' : 'var(--admin-fg-muted)', fontWeight: activeTab === struct.id ? 600 : 400, textAlign: 'left', opacity: 0.6 }}>
                      {struct.title}
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>

        <div className="dossier-main">
          {renderActiveTabContent()}
        </div>

      </div>
    </div>
  );
}
