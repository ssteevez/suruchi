import type { ChecklistItem, SectionType, Project, ProjectOwner } from './types';

export const getHomepageTemplate = (): ChecklistItem[] => [
  {
    id: 'hp_structure_placeholder',
    label: 'Structure built with placeholder visual',
    owner: 'Steevez',
    type: 'checkbox',
    value: true,
  },
  {
    id: 'hp_structure_approved',
    label: 'Structure approved',
    owner: 'Suruchi',
    type: 'lockedApproval',
    value: false,
    dependsOn: 'hp_structure_placeholder',
  },
  {
    id: 'hp_highres_video',
    label: 'Link to high-res video',
    owner: 'Suruchi',
    type: 'text',
    value: '',
  },
  {
    id: 'hp_videos_edited',
    label: 'Videos edited and resized',
    owner: 'Steevez',
    type: 'checkbox',
    value: false,
    dependsOn: 'hp_highres_video',
  },
  {
    id: 'hp_structure_resized',
    label: 'Structure built with resized original material',
    owner: 'Steevez',
    type: 'checkbox',
    value: false,
    dependsOn: 'hp_videos_edited',
  },
  {
    id: 'hp_click_behavior',
    label: 'Homepage click behavior decided',
    owner: 'Shared',
    type: 'grouped',
    value: false,
    description: 'Decision: Can bio, tearsheets, contact, and enquiry open when one clicks on Suruchi on the homepage alone?',
    children: [
      { id: 'hp_click_steevez', label: 'Steevez agreement', owner: 'Steevez', type: 'checkbox', value: false },
      { id: 'hp_click_suruchi', label: 'Suruchi agreement', owner: 'Suruchi', type: 'lockedApproval', value: false },
    ]
  },
  {
    id: 'hp_final_approval',
    label: 'Final approval',
    owner: 'Suruchi',
    type: 'lockedApproval',
    value: false,
    dependsOn: 'hp_structure_resized',
  },
];

export const getPilgrimTemplate = (): ChecklistItem[] => [
  {
    id: 'pil_structure',
    label: 'Structure built with placeholder visuals',
    owner: 'Steevez',
    type: 'checkbox',
    value: true,
  },
  {
    id: 'pil_structure_approved',
    label: 'Structure approved',
    owner: 'Suruchi',
    type: 'lockedApproval',
    value: false,
    dependsOn: 'pil_structure',
  },
  {
    id: 'pil_photo_metadata',
    label: 'Photo metadata completed',
    owner: 'Suruchi',
    type: 'derived',
    value: false,
  },
  {
    id: 'pil_highres_images',
    label: 'Link to high-res images',
    owner: 'Suruchi',
    type: 'text',
    value: '',
  },
  {
    id: 'pil_images_optimised',
    label: 'Images optimised for web',
    owner: 'Steevez',
    type: 'checkbox',
    value: false,
    dependsOn: 'pil_highres_images',
  },
  {
    id: 'pil_structure_rebuilt',
    label: 'Structure rebuilt with original artworks',
    owner: 'Steevez',
    type: 'checkbox',
    value: false,
    dependsOn: 'pil_images_optimised',
  },
  {
    id: 'pil_review_active',
    label: 'Review thread active',
    owner: 'Shared',
    type: 'derived',
    value: false,
  },
  {
    id: 'pil_final_approval',
    label: 'Final approval',
    owner: 'Suruchi',
    type: 'lockedApproval',
    value: false,
    dependsOn: 'pil_structure_rebuilt',
  },
];

export const getPoetTemplate = (): ChecklistItem[] => [];

export const getOtherTemplate = (): ChecklistItem[] => [
  { id: 'text', label: 'Text', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'images', label: 'Images', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'captions', label: 'Captions', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'dates', label: 'Dates', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'dimensions', label: 'Dimensions', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'credits', label: 'Credits', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'video', label: 'Video', owner: 'Suruchi', type: 'checkbox', value: false },
  { id: 'finalApproval', label: 'Final Approval', owner: 'Suruchi', type: 'lockedApproval', value: false, dependsOn: 'video' },
];

export const getChecklistTemplate = (sectionType: SectionType): ChecklistItem[] => {
  switch (sectionType) {
    case 'homepage': return getHomepageTemplate();
    case 'poet': return getPoetTemplate();
    case 'painter': return [];
    case 'pilgrim': return getPilgrimTemplate();
    default: return getOtherTemplate();
  }
};

export const isChecklistItemComplete = (item: ChecklistItem): boolean => {
  if (item.type === 'derived') {
    return item.value === true;
  }
  if (item.type === 'text') {
    return typeof item.value === 'string' && item.value.trim().length > 0;
  }
  if (item.type === 'grouped') {
    if (!item.children || item.children.length === 0) return true;
    return item.children.every(isChecklistItemComplete);
  }
  return item.value === true;
};

export const isChecklistItemEnabled = (item: ChecklistItem, checklist: ChecklistItem[]): boolean => {
  const approvalPrerequisites: Record<string, string[]> = {
    hp_structure_approved: ['hp_structure_placeholder'],
    hp_final_approval: ['hp_structure_approved', 'hp_structure_resized', 'hp_click_behavior'],
    pil_structure_approved: ['pil_structure'],
    pil_final_approval: ['pil_structure_approved', 'pil_photo_metadata', 'pil_structure_rebuilt'],
    finalApproval: ['text', 'images', 'captions', 'dates', 'dimensions', 'credits', 'video'],
  };

  // Find dependency in flat or nested structure
  const findItem = (list: ChecklistItem[], id: string): ChecklistItem | undefined => {
    for (const i of list) {
      if (i.id === id) return i;
      if (i.children) {
        const found = findItem(i.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const implicitDeps = approvalPrerequisites[item.id];
  if (implicitDeps) {
    return implicitDeps.every(depId => {
      const dep = findItem(checklist, depId);
      return dep ? isChecklistItemComplete(dep) : true;
    });
  }

  const findPreviousSiblings = (list: ChecklistItem[], id: string): ChecklistItem[] | undefined => {
    for (let index = 0; index < list.length; index += 1) {
      const current = list[index];
      if (!current) continue;
      if (current.id === id) return list.slice(0, index);
      if (current.children) {
        const found = findPreviousSiblings(current.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  if (!item.dependsOn) {
    if (item.type !== 'lockedApproval') return true;
    const previousSiblings = findPreviousSiblings(checklist, item.id);
    if (!previousSiblings || previousSiblings.length === 0) return true;
    return previousSiblings.every(isChecklistItemComplete);
  }
  
  const dep = findItem(checklist, item.dependsOn);
  if (!dep) return true; // If dependency missing, don't block
  
  return isChecklistItemComplete(dep);
};

export const calculateChecklistProgress = (checklist: ChecklistItem[]): number => {
  let total = 0;
  let completed = 0;

  const countItems = (items: ChecklistItem[]) => {
    items.forEach(item => {
      if (item.type === 'grouped' && item.children) {
        countItems(item.children);
      } else if (item.type !== 'grouped') {
        total++;
        if (isChecklistItemComplete(item)) {
          completed++;
        }
      }
    });
  };

  countItems(checklist);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

export const getIncompleteItemsByOwner = (project: Project, targetOwner: ProjectOwner): ChecklistItem[] => {
  const incomplete: ChecklistItem[] = [];
  
  // 1. Scan Checklist Items
  const scan = (items: ChecklistItem[]) => {
    items.forEach(item => {
      // Don't generate tasks directly from derived items, let them be handled by custom logic below
      if (item.type === 'derived') return;
      
      if ((item.owner === targetOwner || item.owner === 'Shared') && !isChecklistItemComplete(item)) {
        if (isChecklistItemEnabled(item, project.checklist)) {
          if (item.type === 'grouped' && item.children) {
            scan(item.children);
          } else {
            // Prepend section title for clarity if it's Pilgrim
            const modifiedItem = project.sectionType === 'pilgrim' ? { ...item, label: `Pilgrim: ${item.label}` } : item;
            incomplete.push(modifiedItem);
          }
        }
      } else if (item.type === 'grouped' && item.children) {
        scan(item.children);
      }
    });
  };

  scan(project.checklist);

  // 2. Scan MiniPages (only add tasks if project is active or waiting)
  if (project.miniPages) {
    project.miniPages.forEach(page => {
      if (page.status === 'published' || page.status === 'approved') return;

      // Approval Pending
      if (targetOwner === 'Suruchi' && page.reviewed && !page.approved) {
        incomplete.push({
          id: `mp_app_${page.id}`,
          label: `${page.title}: Approval pending`,
          owner: 'Suruchi',
          type: 'lockedApproval',
          value: false
        });
      }

      // Build Pending
      if ((targetOwner === 'Steevez' || targetOwner === 'Shared') && page.contentReceived && !page.built) {
        incomplete.push({
          id: `mp_bld_${page.id}`,
          label: `${page.title}: Build pending`,
          owner: 'Steevez',
          type: 'checkbox',
          value: false
        });
      }

      // Content Pending
      if (targetOwner === 'Suruchi' && !page.contentReceived) {
        incomplete.push({
          id: `mp_cnt_${page.id}`,
          label: `${page.title}: Content pending`,
          owner: 'Suruchi',
          type: 'checkbox',
          value: false
        });
      }
      
      // Review Pending
      if ((targetOwner === 'Suruchi' || targetOwner === 'Shared') && page.built && !page.reviewed) {
        incomplete.push({
          id: `mp_rev_${page.id}`,
          label: `${page.title}: Review pending`,
          owner: 'Shared',
          type: 'checkbox',
          value: false
        });
      }
    });
  }

  // 3. Scan Review Thread (if review is pending)
  if (project.sectionType === 'homepage' && project.status === 'review' && (targetOwner === 'Suruchi' || targetOwner === 'Shared')) {
    incomplete.push({
      id: `rev_thread`,
      label: `Review Thread: Feedback pending`,
      owner: 'Shared',
      type: 'checkbox',
      value: false
    });
  }

  // 4. Scan Pilgrim Photos
  if (project.sectionType === 'pilgrim' && project.pilgrimPhotos && targetOwner === 'Suruchi') {
    project.pilgrimPhotos.forEach((photo, idx) => {
      const missing = [];
      if (!photo.title.trim()) missing.push('title');
      if (!photo.caption.trim()) missing.push('caption');
      if (!photo.date.trim()) missing.push('date');
      
      if (missing.length > 0) {
        incomplete.push({
          id: `pil_meta_${photo.id}`,
          label: `Pilgrim: Photo ${String(idx + 1).padStart(2, '0')} missing ${missing.join(', ')}`,
          owner: 'Suruchi',
          type: 'checkbox',
          value: false
        });
      }
    });
  }

  // 5. Scan Poet pages
  if (project.sectionType === 'poet') {
    if (project.poetPages) {
      project.poetPages.forEach(page => {
        if (targetOwner === 'Steevez' && !page.structureBuilt) {
          incomplete.push({ id: `poet_bld_${page.id}`, label: `${page.title}: Structure built pending`, owner: 'Steevez', type: 'checkbox', value: false });
        }
        if (targetOwner === 'Suruchi' && page.structureBuilt && !page.structureApproved) {
          incomplete.push({ id: `poet_app_${page.id}`, label: `${page.title}: Structure approval pending`, owner: 'Suruchi', type: 'lockedApproval', value: false });
        }
        if (targetOwner === 'Suruchi' && page.structureApproved && !page.finalApproval) {
          incomplete.push({ id: `poet_fin_${page.id}`, label: `${page.title}: Final approval / complete`, owner: 'Suruchi', type: 'lockedApproval', value: false });
        }
      });
    }
    
    if (project.euphemismStructures) {
      project.euphemismStructures.forEach(struct => {
        if (targetOwner === 'Steevez' && !struct.structureBuilt) {
          incomplete.push({ id: `euph_bld_${struct.id}`, label: `Euphemisms / ${struct.title}: Structure built pending`, owner: 'Steevez', type: 'checkbox', value: false });
        }
        if (targetOwner === 'Suruchi' && struct.structureBuilt && !struct.structureApproved) {
          incomplete.push({ id: `euph_app_${struct.id}`, label: `Euphemisms / ${struct.title}: Structure approval pending`, owner: 'Suruchi', type: 'lockedApproval', value: false });
        }
        if (targetOwner === 'Suruchi' && struct.structureApproved && !struct.finalApproval) {
          incomplete.push({ id: `euph_fin_${struct.id}`, label: `Euphemisms / ${struct.title}: Final approval / complete`, owner: 'Suruchi', type: 'lockedApproval', value: false });
        }
      });
    }

    if (project.newEuphemismRequests) {
      project.newEuphemismRequests.forEach((req, idx) => {
        const idBase = `new_euph_${req.id}`;
        const titleStr = req.title ? ` (${req.title})` : '';
        const indexLabel = `New Euphemism ${idx + 1}${titleStr}`;
        const isReadyForSteevez = req.title?.trim().length > 0 && req.driveLink?.trim().length > 0 && req.text?.trim().length > 0 && req.interactionSystem?.trim().length > 0;
        
        if (targetOwner === 'Suruchi' && !isReadyForSteevez) {
          incomplete.push({ id: `${idBase}_info`, label: `${indexLabel}: Complete all details (Title, Drive, Text, Interaction)`, owner: 'Suruchi', type: 'text', value: '' });
        }
        if (targetOwner === 'Steevez') {
          if (isReadyForSteevez && !req.seenBySteevez) {
            incomplete.push({ id: `${idBase}_seen`, label: `${indexLabel}: Waiting to be seen`, owner: 'Steevez', type: 'checkbox', value: false });
          } else if (req.seenBySteevez && !req.building) {
            incomplete.push({ id: `${idBase}_build`, label: `${indexLabel}: Building pending`, owner: 'Steevez', type: 'checkbox', value: false });
          } else if (req.building && !req.done) {
            incomplete.push({ id: `${idBase}_done`, label: `${indexLabel}: Done pending`, owner: 'Steevez', type: 'checkbox', value: false });
          }
        }
      });
    }
  }

  // 6. Scan Painter pages
  if (project.sectionType === 'painter' && project.painterSeries) {
    project.painterSeries.forEach(series => {
      if (targetOwner === 'Suruchi' && (!series.driveLink || series.driveLink.trim().length === 0)) {
        incomplete.push({ id: `ps-${series.id}-drive`, label: `${series.title}: Provide Google Drive link`, owner: 'Suruchi', type: 'text', value: '' });
      }
      if (targetOwner === 'Steevez' && series.driveLink?.trim().length > 0 && !series.imagesOptimised) {
        incomplete.push({ id: `ps-${series.id}-opt`, label: `${series.title}: Optimise images for web`, owner: 'Steevez', type: 'checkbox', value: false });
      }
      if (targetOwner === 'Steevez' && !series.structureBuilt) {
        incomplete.push({ id: `ps-${series.id}-build`, label: `${series.title}: Structure build pending`, owner: 'Steevez', type: 'checkbox', value: false });
      }
      if (targetOwner === 'Suruchi') {
        if (series.structureBuilt && !series.structureApproved) {
          incomplete.push({ id: `ps-${series.id}-app`, label: `${series.title}: Structure approval pending`, owner: 'Suruchi', type: 'lockedApproval', value: false });
        }
        series.artworks.forEach((art, idx) => {
          if (!art.metadataComplete) {
            const missing = [];
            if (!art.title) missing.push('title');
            if (!art.caption) missing.push('caption');
            if (!art.medium) missing.push('medium');
            if (!art.dimension) missing.push('dimension');
            if (!art.year) missing.push('year');
            if (missing.length > 0) {
              incomplete.push({ id: `ps-${art.id}-meta`, label: `${series.title} / Artwork ${String(idx + 1).padStart(2, '0')}: missing ${missing.join(', ')}`, owner: 'Suruchi', type: 'checkbox', value: false });
            }
          }
        });
      }
      if (targetOwner === 'Steevez' && series.imagesOptimised && !series.builtOriginal) {
        incomplete.push({ id: `ps-${series.id}-rebuild`, label: `${series.title}: Rebuild with original artworks`, owner: 'Steevez', type: 'checkbox', value: false });
      }
      const isReadyForFinal = series.structureBuilt && series.structureApproved && series.builtOriginal && series.imagesOptimised && series.artworks.every(a => a.metadataComplete);
      if (targetOwner === 'Suruchi' && isReadyForFinal && !series.finalApproval) {
        incomplete.push({ id: `ps-${series.id}-final`, label: `${series.title}: Final Approval pending`, owner: 'Suruchi', type: 'lockedApproval', value: false });
      }
    });
  }

  return incomplete;
};
