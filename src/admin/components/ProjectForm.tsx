import { useState } from 'react';
import type { Project, ChecklistItem, SectionType } from '../types';
import { isChecklistItemEnabled, getChecklistTemplate } from '../templates';
import { HomepageDossier } from './HomepageDossier';
import { PilgrimDossier } from './PilgrimDossier';
import { PoetDossier } from './PoetDossier';
import { PainterDossier } from './PainterDossier';

interface ProjectFormProps {
  project: Project;
  onSave: (project: Project) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, onSave, onCancel }: ProjectFormProps) {
  if (project.sectionType === 'homepage') {
    return <HomepageDossier project={project} onSave={onSave} onCancel={onCancel} />;
  }
  if (project.sectionType === 'pilgrim') {
    return <PilgrimDossier project={project} onSave={onSave} onCancel={onCancel} />;
  }
  if (project.sectionType === 'poet') {
    return <PoetDossier project={project} onSave={onSave} onCancel={onCancel} />;
  }
  if (project.sectionType === 'painter') {
    return <PainterDossier project={project} onSave={onSave} onCancel={onCancel} />;
  }

  const [formData, setFormData] = useState<Project>(project);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSectionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSection = e.target.value as SectionType;
    if (window.confirm('Changing the template will reset the checklist to defaults for that section. Continue?')) {
      setFormData(prev => ({
        ...prev,
        sectionType: newSection,
        checklist: getChecklistTemplate(newSection)
      }));
    }
  };

  const updateItemInList = (list: ChecklistItem[], targetId: string, updater: (item: ChecklistItem) => ChecklistItem): ChecklistItem[] => {
    return list.map(item => {
      if (item.id === targetId) {
        return updater({ ...item });
      }
      if (item.children) {
        return { ...item, children: updateItemInList(item.children, targetId, updater) };
      }
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
    if (item.value === true) return; // already locked
    
    if (window.confirm('Final approval cannot be changed once confirmed. This action will be logged with date and time. Confirm?')) {
      setFormData(prev => ({
        ...prev,
        checklist: updateItemInList(prev.checklist, item.id, (i) => ({ 
          ...i, 
          value: true,
          completedAt: Date.now() 
        }))
      }));
    }
  };

  const renderChecklistItem = (item: ChecklistItem, depth = 0) => {
    const isEnabled = isChecklistItemEnabled(item, formData.checklist);
    const style = { 
      marginLeft: `${depth * 1.5}rem`, 
      marginBottom: '1rem',
      opacity: isEnabled ? 1 : 0.5,
      pointerEvents: isEnabled ? 'auto' as const : 'none' as const
    };

    if (item.type === 'grouped') {
      return (
        <div key={item.id} style={{ marginBottom: '1.5rem' }}>
          <div style={{ ...style, marginBottom: '0.5rem' }}>
            <div className="section-title" style={{ marginTop: 0, marginBottom: '0.5rem', border: 'none', color: 'var(--admin-fg)' }}>
              {item.label} <span className="badge">{item.owner}</span>
            </div>
          </div>
          {item.children?.map(child => renderChecklistItem(child, depth + 1))}
        </div>
      );
    }

    return (
      <div className="check-item-container" key={item.id} style={style}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          
          {item.type === 'checkbox' && (
            <div className="check-item" style={{ marginBottom: 0 }}>
              <input 
                type="checkbox" 
                id={`check-${item.id}`}
                checked={item.value as boolean}
                onChange={() => handleCheckboxToggle(item)}
                disabled={!isEnabled}
              />
              <label htmlFor={`check-${item.id}`}>{item.label}</label>
            </div>
          )}

          {item.type === 'lockedApproval' && (
            <div className="check-item" style={{ marginBottom: 0 }}>
              <input 
                type="checkbox" 
                id={`check-${item.id}`}
                checked={item.value as boolean}
                onChange={() => handleLockedApproval(item)}
                disabled={!isEnabled || item.value === true}
                style={{ 
                  borderColor: item.value ? 'var(--admin-success)' : 'var(--admin-border-hover)',
                  backgroundColor: item.value ? 'var(--admin-success)' : 'transparent'
                }}
              />
              <label htmlFor={`check-${item.id}`} style={{ color: item.value ? 'var(--admin-success)' : 'inherit' }}>
                {item.label}
              </label>
            </div>
          )}

          {item.type === 'text' && (
            <div style={{ flex: 1 }}>
              <label htmlFor={`text-${item.id}`} style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                {item.label}
              </label>
              <input 
                type="text" 
                id={`text-${item.id}`}
                value={item.value as string}
                onChange={(e) => handleTextChange(item, e.target.value)}
                disabled={!isEnabled}
                className="form-control"
                placeholder="Paste Google Drive link or text"
                style={{ width: '100%' }}
              />
            </div>
          )}

          {item.type !== 'text' && <span className="badge">{item.owner}</span>}
        </div>
        
        {item.type === 'text' && <span className="badge" style={{ marginTop: '0.25rem', display: 'inline-block' }}>{item.owner}</span>}

        {item.description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-fg-muted)', marginLeft: item.type === 'text' ? '0' : '1.5rem', marginTop: '0.25rem' }}>
            {item.description}
          </div>
        )}

        {!isEnabled && item.dependsOn && (
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-error)', marginLeft: item.type === 'text' ? '0' : '1.5rem', marginTop: '0.25rem' }}>
            Waiting for previous requirement
          </div>
        )}

        {item.type === 'lockedApproval' && item.value === true && item.completedAt && (
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-success)', marginLeft: '1.5rem', marginTop: '0.25rem' }}>
            Final approval locked on {new Date(item.completedAt).toLocaleString()}
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isHomepage = formData.sectionType === 'homepage';

  return (
    <div className="project-form-container">
      <div className="actions-bar">
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          {project.id.startsWith('proj-') && project.title === 'New Project' ? 'Create New Project' : `Editing: ${project.title}`}
        </div>
        <div>
          <button className="btn" onClick={onCancel} style={{ marginRight: '1rem' }}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit}>Save Changes</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-left-col">
          <div className="form-group">
            <label>Title</label>
            <input name="title" value={formData.title} onChange={handleChange} className="form-control" required />
          </div>
          
          <div className="form-group">
            <label>Slug</label>
            <input name="slug" value={formData.slug} onChange={handleChange} className="form-control" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Category / Section</label>
              <input name="category" value={formData.category} onChange={handleChange} className="form-control" />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input name="year" value={formData.year} onChange={handleChange} className="form-control" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Medium</label>
              <input name="medium" value={formData.medium} onChange={handleChange} className="form-control" />
            </div>
            <div className="form-group">
              <label>Dimensions</label>
              <input name="dimensions" value={formData.dimensions} onChange={handleChange} className="form-control" />
            </div>
          </div>

          <div className="form-group">
            <label>Short Description</label>
            <textarea name="shortDescription" value={formData.shortDescription} onChange={handleChange} className="form-control" rows={3} />
          </div>

          <div className="form-group">
            <label>Long Description</label>
            <textarea name="longDescription" value={formData.longDescription} onChange={handleChange} className="form-control" rows={6} />
          </div>

          <div className="form-group">
            <label>Credits</label>
            <input name="credits" value={formData.credits} onChange={handleChange} className="form-control" />
          </div>
          
          <div className="form-group">
            <label>Google Drive / File Links</label>
            <input name="driveLinks" value={formData.driveLinks} onChange={handleChange} className="form-control" />
          </div>

          <div className="form-group">
            <label>Notes from Suruchi</label>
            <textarea name="notesFromSuruchi" value={formData.notesFromSuruchi} onChange={handleChange} className="form-control" rows={4} />
          </div>

          <div className="form-group">
            <label>Internal Build Notes</label>
            <textarea name="internalBuildNotes" value={formData.internalBuildNotes} onChange={handleChange} className="form-control" rows={4} />
          </div>
        </div>

        <div className="form-right-col">
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Section Template</label>
              <select name="sectionType" value={formData.sectionType} onChange={handleSectionTypeChange} className="form-control">
                <option value="homepage">Homepage</option>
                <option value="poet">Poet</option>
                <option value="painter">Painter</option>
                <option value="pilgrim">Pilgrim</option>
                <option value="other">Other / Default</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Owner</label>
              <select name="owner" value={formData.owner} onChange={handleChange} className="form-control">
                <option value="Suruchi">Suruchi</option>
                <option value="Steevez">Steevez</option>
                <option value="Shared">Shared</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Workflow State</label>
            <select name="status" value={formData.status} onChange={handleChange} className="form-control">
              <option value="blocked">Blocked</option>
              <option value="waiting-for-content">Waiting for Content</option>
              <option value="active">Active</option>
              <option value="review">Ready for Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="checklist" style={{ background: isHomepage ? 'var(--admin-card)' : 'transparent' }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              {isHomepage ? 'Homepage Production Requirements' : 'Materials Checklist'}
            </div>
            
            {formData.checklist.map(item => renderChecklistItem(item, 0))}
          </div>

          <div className="activity-container" style={{ marginTop: '3rem' }}>
            <div className="section-title">Activity History</div>
            {formData.activity && formData.activity.length > 0 ? (
              <div className="activity-log" style={{ borderLeft: '1px solid var(--admin-border)', paddingLeft: '1rem' }}>
                {formData.activity.map((log, idx) => (
                  <div key={idx} className="activity-item" style={{ position: 'relative', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    <div style={{ position: 'absolute', left: '-1.35rem', top: '0.35rem', width: '6px', height: '6px', background: 'var(--admin-border-hover)', borderRadius: '50%' }}></div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--admin-fg-muted)', marginBottom: '0.2rem' }}>
                      {new Date(log.date).toLocaleString()}
                    </div>
                    <div style={{ color: 'var(--admin-fg)' }}>{log.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="missing-text" style={{ color: 'var(--admin-fg-muted)', fontSize: '0.85rem' }}>No activity recorded yet.</div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
