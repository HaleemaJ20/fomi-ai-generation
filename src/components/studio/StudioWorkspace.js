'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GitBranch, MoreHorizontal, Redo2, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useStudioContext } from '@/context/studio/StudioContext';
import { findImage, formatValue } from '@/lib/studio/knobs.js';
import { createNode, createProject, ratioLabel } from '@/lib/studio/models.js';
import StudioPanelSheet from './StudioPanelSheet.js';
import StudioForkPanel from './StudioForkPanel.js';
import StageImageBox from './StageImageBox.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const studioUiStorageKey = 'fomi-studio-ui:v1';
const defaultPanelSettings = {
  desktop: { inspectorOpen: true, lineageOpen: true },
  tablet: { inspectorOpen: false, lineageOpen: true },
  phone: { sheet: null },
};

const getStudioLayout = (width) => {
  if (width >= 1024) {
    return 'desktop';
  }

  return width >= 768 ? 'tablet' : 'phone';
};

const mergePanelSettings = (savedSettings) => ({
  desktop: { ...defaultPanelSettings.desktop, ...(savedSettings?.desktop ?? {}) },
  tablet: { ...defaultPanelSettings.tablet, ...(savedSettings?.tablet ?? {}) },
  phone: {
    ...defaultPanelSettings.phone,
    ...(savedSettings?.phone ?? {}),
    sheet: ['inspector', 'lineage', 'more'].includes(savedSettings?.phone?.sheet) ? savedSettings.phone.sheet : null,
  },
});

const makeId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const copyPromptWithTextarea = (prompt) => {
  const previousFocus = document.activeElement;
  const textArea = document.createElement('textarea');
  textArea.value = prompt;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';

  try {
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard copy was not permitted.');
    }
  } finally {
    textArea.remove();
    previousFocus?.focus?.();
  }
};

const createProjectObject = (family) => {
  const projectId = makeId('project');
  const rootNodeId = makeId('node');
  const rootNode = createNode({
    id: rootNodeId,
    projectId,
    parentId: null,
    imageId: family.base.id,
    prompt: `A ${family.title.toLowerCase()} scene in natural light`,
    settings: { model: 'Fomi Studio', ratio: ratioLabel(family.base.width, family.base.height), seed: 1000 },
    knobs: {},
    changedKnob: null,
    notes: 'Project started with the original source image.',
    modified: false,
    createdAt: new Date().toISOString(),
  });

  return createProject({
    id: projectId,
    name: `${family.title} Project`,
    familyId: family.id,
    rootNodeId: rootNode.id,
    currentNodeId: rootNode.id,
    promotedNodeId: null,
    updatedAt: new Date().toISOString(),
    nodes: [rootNode],
  });
};

const getNodeLabel = (node) => {
  if (!node) {
    return 'Original';
  }

  if (!node.changedKnob) {
    return 'Original';
  }

  const knob = formatValue(node.changedKnob.knob);
  const value = formatValue(node.changedKnob.value);
  return `${knob}: ${value}`;
};

const getProjectPath = (project, nodeId) => {
  if (!project || !nodeId) {
    return [];
  }

  const path = [];
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  let current = nodeMap.get(nodeId) ?? null;

  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) ?? null : null;
  }

  return path;
};

const StudioInspectorContent = ({ node, image, forkPanel }) => {
  const [footerPortalTarget, setFooterPortalTarget] = useState(null);

  return (
    <div ref={setFooterPortalTarget} className="studio-inspector__content">
      {cloneElement(forkPanel, { footerPortalTarget })}
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Prompt</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{node.prompt}</p>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Settings</p>
        <dl className="mt-2 space-y-2 text-sm text-slate-200">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Model</dt>
            <dd>{node.settings?.model ?? 'Fomi Studio'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Ratio</dt>
            <dd>{ratioLabel(image.width, image.height)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Seed</dt>
            <dd>{node.settings?.seed ?? 0}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Notes</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{node.notes || 'No notes for this variation.'}</p>
      </div>
    </div>
  );
};

const StudioLineageNodes = ({ path, currentNodeId, projectId, dispatch }) => {
  const selectedIndex = path.findIndex((node) => node.id === currentNodeId);

  return path.map((node, index) => {
    const isCurrent = node.id === currentNodeId;
    const isBelowCurrent = index > selectedIndex;
    const label = getNodeLabel(node);

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => dispatch({ type: 'SELECT_NODE', payload: { projectId, nodeId: node.id } })}
        aria-current={isCurrent ? 'page' : undefined}
        className={`rounded-full border px-2.5 py-1 text-xs transition ${
          isCurrent
            ? 'border-sky-400 bg-sky-500/10 text-sky-100'
            : isBelowCurrent
              ? 'border-slate-800 bg-slate-950 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
        }`}
      >
        {label}
      </button>
    );
  });
};

export default function StudioWorkspace() {
  const { state, dispatch, families } = useStudioContext();
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState('desktop');
  const [panelSettings, setPanelSettings] = useState(defaultPanelSettings);
  const [panelSettingsLoaded, setPanelSettingsLoaded] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [renameProjectId, setRenameProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [toast, setToast] = useState(null);
  const [lineageHeight, setLineageHeight] = useState(180);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [previewPortalTarget, setPreviewPortalTarget] = useState(null);

  const stageRef = useRef(null);
  const previewRef = useRef(null);
  const projectSwitcherRef = useRef(null);
  const phoneProjectSwitcherRef = useRef(null);
  const projectMenuRef = useRef(null);
  const projectOptionsRef = useRef(null);
  const renameHandledRef = useRef(false);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const toastTimerRef = useRef(null);
  const previousFocusRef = useRef(null);

  const inspectorOpen = layout === 'desktop'
    ? panelSettings.desktop.inspectorOpen
    : layout === 'tablet'
      ? panelSettings.tablet.inspectorOpen
      : panelSettings.phone.sheet === 'inspector';
  const lineageOpen = layout === 'phone'
    ? panelSettings.phone.sheet === 'lineage'
    : panelSettings[layout].lineageOpen;

  const updatePanelSetting = (targetLayout, key, value) => {
    setPanelSettings((current) => ({
      ...current,
      [targetLayout]: { ...current[targetLayout], [key]: value },
    }));
  };

  const setPhoneSheet = (sheet) => updatePanelSetting('phone', 'sheet', sheet);
  const getProjectSwitcherTrigger = useCallback(
    () => (layout === 'phone' ? phoneProjectSwitcherRef.current : projectSwitcherRef.current),
    [layout],
  );

  const closePanelSheet = () => {
    if (layout === 'tablet') {
      updatePanelSetting('tablet', 'inspectorOpen', false);
    } else if (layout === 'phone') {
      setPhoneSheet(null);
    }
  };

  useEffect(() => {
    const updateLayout = () => setLayout(getStudioLayout(window.innerWidth));
    updateLayout();
    window.addEventListener('resize', updateLayout);

    try {
      const savedSettings = window.localStorage.getItem(studioUiStorageKey);
      if (savedSettings) {
        setPanelSettings(mergePanelSettings(JSON.parse(savedSettings)));
      }
    } catch {
      setPanelSettings(defaultPanelSettings);
    }
    setPanelSettingsLoaded(true);

    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (!panelSettingsLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(studioUiStorageKey, JSON.stringify(panelSettings));
    } catch {
      return;
    }
  }, [panelSettings, panelSettingsLoaded]);

  const activeProject = useMemo(() => {
    return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0] ?? null;
  }, [state.activeProjectId, state.projects]);

  const currentNode = useMemo(() => {
    if (!activeProject) {
      return null;
    }

    return activeProject.nodes.find((node) => node.id === activeProject.currentNodeId) ?? activeProject.nodes[0] ?? null;
  }, [activeProject]);
  const activeProjectId = activeProject?.id;
  const currentNodeId = currentNode?.id;

  const activeFamily = useMemo(() => {
    if (!activeProject) {
      return families[0] ?? null;
    }

    return families.find((family) => family.id === activeProject.familyId) ?? families[0] ?? null;
  }, [activeProject, families]);

  const selectedImage = useMemo(() => {
    if (!activeFamily || !currentNode) {
      return null;
    }

    return findImage(activeFamily, currentNode.imageId) ?? activeFamily.base ?? null;
  }, [activeFamily, currentNode]);

  const trailLeafId = activeProject?.nodes.some((node) => node.id === state.trailLeafIds?.[activeProject.id])
    ? state.trailLeafIds[activeProject.id]
    : currentNode?.id;

  const trailNodePath = useMemo(() => {
    if (!activeProject || !trailLeafId) {
      return [];
    }

    return getProjectPath(activeProject, trailLeafId);
  }, [activeProject, trailLeafId]);

  const saveStatusText =
    state.saveStatus === 'saving' ? 'Saving' : state.saveStatus === 'error' ? 'Save failed' : 'Saved';

  const showToast = (message, canUndo = false) => {
    setToast({ message, canUndo });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const applyTransform = useCallback((scale, x, y, updateZoom = true) => {
    const nextScale = clamp(scale, 0.5, 4);
    const nextX = clamp(x, -300, 300);
    const nextY = clamp(y, -220, 220);

    transformRef.current = { scale: nextScale, x: nextX, y: nextY };

    if (stageRef.current) {
      stageRef.current.style.setProperty('--stage-scale', String(nextScale));
      stageRef.current.style.setProperty('--stage-pan-x', `${nextX}px`);
      stageRef.current.style.setProperty('--stage-pan-y', `${nextY}px`);
    }

    if (updateZoom) {
      setZoomPercent(Math.round(nextScale * 100));
    }
  }, []);

  const resetTransform = useCallback(() => {
    applyTransform(1, 0, 0);
  }, [applyTransform]);

  const zoomStage = useCallback((direction) => {
    const factor = direction > 0 ? 1.2 : 0.8;
    const nextScale = clamp(transformRef.current.scale * factor, 0.5, 4);
    applyTransform(nextScale, transformRef.current.x, transformRef.current.y);
  }, [applyTransform]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!stageRef.current) {
      return undefined;
    }

    const stage = stageRef.current;
    const handleWheel = (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      zoomStage(direction);
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel, { passive: false });
  }, [zoomStage]);

  useEffect(() => {
    if (!activeProjectId || !currentNodeId) {
      return undefined;
    }

    resetTransform();
    return undefined;
  }, [activeProjectId, currentNodeId, resetTransform]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragRef.current) {
        return;
      }

      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      applyTransform(transformRef.current.scale, dragRef.current.originX + dx, dragRef.current.originY + dy, false);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTransform]);

  useEffect(() => {
    if (!deleteProjectId) {
      return undefined;
    }

    previousFocusRef.current = getProjectSwitcherTrigger();
    const dialog = document.getElementById('studio-delete-dialog');
    const focusable = dialog ? Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) : [];
    const first = focusable[0] ?? dialog;
    if (first && typeof first.focus === 'function') {
      first.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDeleteProjectId(null);
      }

      if (event.key === 'Tab' && dialog) {
        const items = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!items.length) {
          event.preventDefault();
          return;
        }

        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [deleteProjectId, getProjectSwitcherTrigger]);

  useEffect(() => {
    if (!projectMenuOpen) {
      return undefined;
    }

    projectMenuRef.current?.querySelector('button:not([disabled]), input')?.focus();

    const handlePointerDown = (event) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(event.target) &&
        !projectSwitcherRef.current?.contains(event.target) &&
        !phoneProjectSwitcherRef.current?.contains(event.target)
      ) {
        setProjectMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setProjectMenuOpen(false);
        getProjectSwitcherTrigger()?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [getProjectSwitcherTrigger, projectMenuOpen]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  const closeProjectMenu = () => {
    setProjectMenuOpen(false);
    getProjectSwitcherTrigger()?.focus();
  };

  const beginRename = (project) => {
    renameHandledRef.current = false;
    setRenameProjectId(project.id);
    setRenameValue(project.name);
  };

  const finishRename = (project) => {
    if (renameHandledRef.current) {
      return;
    }

    renameHandledRef.current = true;
    const cleanName = renameValue.trim();
    if (cleanName && cleanName !== project.name) {
      dispatch({ type: 'RENAME_PROJECT', payload: { projectId: project.id, name: cleanName } });
    }
    setRenameProjectId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    renameHandledRef.current = true;
    setRenameProjectId(null);
    setRenameValue('');
  };

  const handleProjectListKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const options = Array.from(projectOptionsRef.current?.querySelectorAll('[role="option"]') ?? []);
    if (!options.length) {
      return;
    }

    event.preventDefault();
    const currentIndex = options.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    } else if (event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1 + options.length) % options.length;
    } else {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    }

    options[nextIndex].focus();
  };

  const handleStagePointerDown = (event) => {
    if (event.button !== 0 || event.pointerType === 'touch') {
      return;
    }

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
  };

  const handleStageDoubleClick = () => {
    const nextScale = transformRef.current.scale > 1.5 ? 1 : 2.5;
    applyTransform(nextScale, 0, 0);
  };

  const handleStageTouchStart = (event) => {
    if (event.touches.length === 2) {
      const [first, second] = Array.from(event.touches);
      pinchRef.current = {
        distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
        scale: transformRef.current.scale,
      };
      return;
    }

    const touch = event.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
  };

  const handleStageTouchMove = (event) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const [first, second] = Array.from(event.touches);
      const nextDistance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      const scaleFactor = nextDistance / pinchRef.current.distance;
      applyTransform(pinchRef.current.scale * scaleFactor, transformRef.current.x, transformRef.current.y, false);
      return;
    }

    if (event.touches.length === 1 && dragRef.current) {
      const touch = event.touches[0];
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      applyTransform(transformRef.current.scale, dragRef.current.originX + dx, dragRef.current.originY + dy, false);
    }
  };

  const handleStageTouchEnd = () => {
    dragRef.current = null;
    pinchRef.current = null;
    setZoomPercent(Math.round(transformRef.current.scale * 100));
  };

  const handleStageKeyDown = (event) => {
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        zoomStage(1);
        break;
      case '-':
        event.preventDefault();
        zoomStage(-1);
        break;
      case '0':
        event.preventDefault();
        resetTransform();
        break;
      case 'ArrowUp':
        event.preventDefault();
        applyTransform(transformRef.current.scale, transformRef.current.x, transformRef.current.y - 24, false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        applyTransform(transformRef.current.scale, transformRef.current.x, transformRef.current.y + 24, false);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        applyTransform(transformRef.current.scale, transformRef.current.x - 24, transformRef.current.y, false);
        break;
      case 'ArrowRight':
        event.preventDefault();
        applyTransform(transformRef.current.scale, transformRef.current.x + 24, transformRef.current.y, false);
        break;
      default:
        break;
    }
  };

  const handleCopyPrompt = async () => {
    if (!currentNode?.prompt) {
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(currentNode.prompt);
        } catch {
          copyPromptWithTextarea(currentNode.prompt);
        }
      } else {
        copyPromptWithTextarea(currentNode.prompt);
      }
      showToast('Prompt copied to clipboard.');
    } catch {
      showToast('Copy failed. Please try again.');
    }
  };

  const toggleDirection = () => {
    if (!activeProject || !currentNode) {
      return;
    }

    const isDirection = activeProject.promotedNodeId === currentNode.id;
    dispatch({
      type: 'PROMOTE',
      payload: { projectId: activeProject.id, nodeId: isDirection ? null : currentNode.id },
    });
  };

  const isPromoted = activeProject ? activeProject.promotedNodeId === currentNode?.id : false;

  if (!loading && state.projects.length === 0) {
    return (
      <div className="studio-workspace-state flex h-full w-full flex-col items-center justify-center overflow-auto bg-slate-950 p-6 text-slate-100">
        <div className="w-full max-w-3xl rounded-[28px] border border-slate-700 bg-slate-900 p-7 text-center shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Studio projects</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Create a project to get started</h1>
          <p className="mt-2 text-sm text-slate-300">Choose a family for your first project.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {families.map((family) => (
              <button
                key={family.id}
                type="button"
                onClick={() => dispatch({ type: 'CREATE_PROJECT', payload: createProjectObject(family) })}
                className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-left transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <Image
                  src={family.base.url}
                  alt=""
                  width={family.base.width}
                  height={family.base.height}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="h-28 w-full rounded-lg object-cover"
                />
                <span className="mt-2 block text-sm font-medium text-white">{family.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="studio-workspace-state flex h-full w-full items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div className="w-full max-w-5xl animate-pulse space-y-4">
          <div className="h-12 rounded-2xl bg-slate-800/80" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-[62vh] rounded-[28px] bg-slate-800/80" />
            <div className="h-[62vh] rounded-[28px] bg-slate-800/80" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeProject || !activeFamily || !currentNode || !selectedImage) {
    return (
      <div className="studio-workspace-state flex min-h-[60vh] w-full items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-lg rounded-[28px] border border-slate-700 bg-slate-900 p-7 text-center shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Studio unavailable</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">The studio could not load.</h1>
          <p className="mt-2 text-sm text-slate-300">Retry the sample workspace to continue.</p>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'RESET_SAMPLE_PROJECTS' });
              setLoading(true);
              window.setTimeout(() => setLoading(false), 220);
            }}
            className="mt-5 rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="studio-workspace bg-slate-950 text-slate-100"
      data-studio-layout={layout}
      style={{
        '--lineage-height': `${lineageOpen ? lineageHeight : 48}px`,
        '--inspector-width': layout === 'desktop' && inspectorOpen ? 'var(--studio-inspector-width)' : '0px',
      }}
    >
      <header className="studio-project-bar flex min-h-[64px] min-w-0 flex-col gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:px-4">
        <div className="studio-project-bar__left flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link href="/" aria-label="Back to Fomi" className="studio-back-link shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-[10px]">
            <ArrowLeft className="studio-back-link__icon" aria-hidden="true" size={18} />
            <span className="studio-back-link__text">Back to Fomi</span>
          </Link>
          <button
            ref={projectSwitcherRef}
            type="button"
            onClick={() => setProjectMenuOpen((current) => !current)}
            aria-haspopup="dialog"
            aria-expanded={projectMenuOpen}
            aria-controls="studio-project-switcher"
            className="studio-project-switcher-label shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-[10px]"
          >
            Project switcher
          </button>
          <button
            ref={phoneProjectSwitcherRef}
            type="button"
            onClick={() => setProjectMenuOpen((current) => !current)}
            aria-haspopup="dialog"
            aria-expanded={projectMenuOpen}
            aria-controls="studio-project-switcher"
            aria-label={`Switch project. ${activeProject.name}`}
            className="studio-phone-project-switcher min-w-0 flex-1 truncate text-left text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {activeProject.name}
          </button>
          <div className="studio-project-bar__meta min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400">Project</p>
            <p className="truncate text-sm font-medium text-white">{activeProject.name}</p>
          </div>
        </div>

        <div className="studio-project-bar__right flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          <span role={state.saveStatus === 'error' ? 'alert' : 'status'} aria-live="polite" className="studio-save-status rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            {saveStatusText}
          </span>
          <span className={`studio-save-dot ${state.saveStatus === 'error' ? 'is-error' : ''}`} role={state.saveStatus === 'error' ? 'alert' : 'status'} aria-label={saveStatusText} />
          <button
            type="button"
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!state.history?.past?.length}
            className="studio-history-button rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-[10px]"
            aria-label="Undo the previous action"
          >
            <Undo2 className="studio-history-icon" aria-hidden="true" size={18} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!state.history?.future?.length}
            className="studio-history-button rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-[10px]"
            aria-label="Redo the previous action"
          >
            <Redo2 className="studio-history-icon" aria-hidden="true" size={18} />
            <span>Redo</span>
          </button>
          {layout !== 'phone' ? (
            <button
              type="button"
              onClick={() =>
                updatePanelSetting(layout, 'inspectorOpen', !inspectorOpen)
              }
              aria-expanded={inspectorOpen}
              aria-controls={layout === 'tablet' ? 'studio-panel-sheet' : 'studio-inspector-content'}
              className="studio-inspector-project-toggle rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              Inspector
            </button>
          ) : null}
        </div>
      </header>

      <div className="studio-breadcrumb flex min-h-[52px] items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2">
        <nav aria-label="Selected image breadcrumb" className="studio-breadcrumb__nav flex min-w-0 flex-wrap items-center gap-2 overflow-hidden text-xs text-slate-300">
                {trailNodePath.map((node) => {
                  const isCurrent = node.id === currentNode.id;
                  const isBelowCurrent = trailNodePath.findIndex((pathNode) => pathNode.id === node.id) >
                    trailNodePath.findIndex((pathNode) => pathNode.id === currentNode.id);
                  const label = getNodeLabel(node);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => dispatch({ type: 'SELECT_NODE', payload: { projectId: activeProject.id, nodeId: node.id } })}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`truncate rounded-full border px-2.5 py-1 text-[11px] transition ${
                        isCurrent
                          ? 'border-sky-400 bg-sky-500/10 text-sky-100'
                          : isBelowCurrent
                            ? 'border-slate-800 bg-slate-950 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
        </nav>
      </div>

      <main className="studio-stage-region min-h-0 overflow-hidden border-b border-slate-800 bg-slate-950 p-3 md:p-4">
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1">{zoomPercent}%</span>
                      {isPromoted ? <span className="rounded-full border border-amber-300 bg-amber-400 px-2 py-1 text-slate-950">Direction</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => zoomStage(-1)} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Zoom out the selected image">
                        −
                      </button>
                      <button type="button" onClick={() => zoomStage(1)} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Zoom in the selected image">
                        +
                      </button>
                      <button type="button" onClick={resetTransform} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400" aria-label="Reset the selected image position">
                        Reset
                      </button>
                    </div>
                  </div>

                  <div
                    ref={stageRef}
                    className="studio-stage relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-slate-700 bg-slate-950"
                    tabIndex={0}
                    onPointerDown={handleStagePointerDown}
                    onDoubleClick={handleStageDoubleClick}
                    onTouchStart={handleStageTouchStart}
                    onTouchMove={handleStageTouchMove}
                    onTouchEnd={handleStageTouchEnd}
                    onKeyDown={handleStageKeyDown}
                    aria-label={`Image stage for ${activeProject.name}`}
                  >
                    <StageImageBox
                      image={selectedImage}
                      prompt={currentNode.prompt}
                      family={activeFamily}
                      previewRef={previewRef}
                      onPreviewTarget={setPreviewPortalTarget}
                    />

                    {isPromoted ? (
                      <div className="studio-promoted-badge absolute bottom-4 left-4 rounded-full border border-amber-300 bg-amber-400/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-lg">
                        Direction
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
                    <a
                      href={selectedImage.url}
                      download={`${activeProject.id}.${selectedImage.url.split('.').pop() || 'webp'}`}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      aria-label="Download the selected image"
                    >
                      Download
                    </a>
                    <button type="button" onClick={handleCopyPrompt} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
                      Copy prompt
                    </button>
                    <button
                      type="button"
                      onClick={toggleDirection}
                      aria-pressed={isPromoted}
                      className={`rounded-full border px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] transition focus:outline-none focus:ring-2 ${
                        isPromoted ? 'border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300 focus:ring-amber-200' : 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:ring-sky-400'
                      }`}
                    >
                      {isPromoted ? 'Direction on' : 'Promote as direction'}
                    </button>
                  </div>
                </div>
      </main>

      {layout === 'desktop' ? (
        <aside
          id="studio-inspector-content"
          className="studio-inspector rounded-[28px] border border-slate-800 bg-slate-900 p-4"
          aria-label="Studio inspector"
          hidden={!inspectorOpen}
        >
          <StudioInspectorContent
            node={currentNode}
            image={selectedImage}
            forkPanel={
              <StudioForkPanel
                project={activeProject}
                parent={currentNode}
                family={activeFamily}
                previewRef={previewRef}
                previewPortalTarget={previewPortalTarget}
                dispatch={dispatch}
                onMessage={(message) => message && showToast(message)}
              />
            }
          />
        </aside>
      ) : null}

      {layout !== 'phone' ? (
        <section className={`studio-lineage border-t border-slate-800 bg-slate-950 ${lineageOpen ? 'is-open' : 'is-closed'}`} aria-label="Lineage">
          <div className="studio-lineage__header flex items-center justify-between gap-3 px-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Lineage</h2>
            <button
              type="button"
              onClick={() => updatePanelSetting(layout, 'lineageOpen', !lineageOpen)}
              className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-expanded={lineageOpen}
            >
              {lineageOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {lineageOpen ? (
            <div className="studio-lineage__content flex min-h-0 flex-wrap items-start gap-2 overflow-y-auto p-3">
              <StudioLineageNodes
                path={trailNodePath}
                currentNodeId={currentNode.id}
                projectId={activeProject.id}
                dispatch={dispatch}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {layout === 'phone' ? (
        <nav className="studio-phone-bottom-bar" aria-label="Studio panels">
          {[
            { id: 'inspector', label: 'Knobs', Icon: SlidersHorizontal },
            { id: 'lineage', label: 'Lineage', Icon: GitBranch },
            { id: 'more', label: 'More', Icon: MoreHorizontal },
          ].map(({ id, label, Icon }) => {
            const isOpen = panelSettings.phone.sheet === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPhoneSheet(isOpen ? null : id)}
                aria-expanded={isOpen}
                aria-controls="studio-panel-sheet"
                className={`studio-phone-bottom-bar__button ${isOpen ? 'is-active' : ''}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}

      <StudioPanelSheet
        open={layout === 'tablet' ? inspectorOpen : layout === 'phone' ? Boolean(panelSettings.phone.sheet) : false}
        title={layout === 'tablet' ? 'Inspector' : panelSettings.phone.sheet === 'inspector' ? 'Knobs' : panelSettings.phone.sheet === 'lineage' ? 'Lineage' : 'More'}
        onClose={closePanelSheet}
        isDrawer={layout === 'tablet'}
      >
        {layout === 'tablet' || panelSettings.phone.sheet === 'inspector' ? (
          <StudioInspectorContent
            node={currentNode}
            image={selectedImage}
            forkPanel={
              <StudioForkPanel
                project={activeProject}
                parent={currentNode}
                family={activeFamily}
                previewRef={previewRef}
                previewPortalTarget={previewPortalTarget}
                dispatch={dispatch}
                onMessage={(message) => message && showToast(message)}
              />
            }
          />
        ) : layout === 'phone' && !panelSettings.phone.sheet ? (
          <StudioInspectorContent
            node={currentNode}
            image={selectedImage}
            forkPanel={
              <StudioForkPanel
                project={activeProject}
                parent={currentNode}
                family={activeFamily}
                previewRef={previewRef}
                previewPortalTarget={previewPortalTarget}
                dispatch={dispatch}
                onMessage={(message) => message && showToast(message)}
              />
            }
          />
        ) : panelSettings.phone.sheet === 'lineage' ? (
          <div className="studio-sheet-lineage">
            <StudioLineageNodes
              path={trailNodePath}
              currentNodeId={currentNode.id}
              projectId={activeProject.id}
              dispatch={dispatch}
            />
          </div>
        ) : (
          <div className="studio-more-actions">
            <button
              type="button"
              onClick={() => {
                closePanelSheet();
                setProjectMenuOpen(true);
              }}
            >
              Project switcher
            </button>
            <button type="button" onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.history?.past?.length}>
              Undo
            </button>
            <button type="button" onClick={() => dispatch({ type: 'REDO' })} disabled={!state.history?.future?.length}>
              Redo
            </button>
            <button type="button" onClick={() => dispatch({ type: 'RESET_SAMPLE_PROJECTS' })}>
              Reset sample projects
            </button>
            <Link href="/" onClick={closePanelSheet}>Back to Fomi</Link>
          </div>
        )}
      </StudioPanelSheet>

      {projectMenuOpen ? (
        <section
          ref={projectMenuRef}
          id="studio-project-switcher"
          role="dialog"
          aria-modal="false"
          aria-labelledby="studio-project-switcher-title"
          className="studio-project-menu"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Project switcher</p>
              <h2 id="studio-project-switcher-title" className="mt-1 text-lg font-semibold text-white">Studio projects</h2>
            </div>
            <button type="button" onClick={closeProjectMenu} className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
              Close
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setCreateProjectOpen((current) => !current)} className="rounded-full border border-sky-400 bg-sky-500 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-950 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300">
              New project
            </button>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{state.projects.length} projects</span>
          </div>

          {createProjectOpen ? (
            <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Choose a family</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {families.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => {
                      const nextProject = createProjectObject(family);
                      dispatch({ type: 'CREATE_PROJECT', payload: nextProject });
                      closeProjectMenu();
                      setCreateProjectOpen(false);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-left transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <div className="h-16 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                      <Image src={family.base.url} alt={family.title} width={family.base.width} height={family.base.height} sizes="(max-width: 640px) 100vw, 33vw" className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{family.title}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div ref={projectOptionsRef} role="listbox" aria-label="Studio project list" onKeyDown={handleProjectListKeyDown} className="space-y-2">
            {state.projects.map((project) => {
              const projectFamily = families.find((family) => family.id === project.familyId) ?? families[0];
              const rootNode = project.nodes.find((node) => node.id === project.rootNodeId) ?? project.nodes[0] ?? null;
              const rootImage = rootNode ? findImage(projectFamily, rootNode.imageId) ?? projectFamily.base : projectFamily.base;
              const isSelected = project.id === activeProject.id;

              return (
                <button
                  key={project.id}
                  type="button"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => {
                    dispatch({ type: 'SELECT_NODE', payload: { projectId: project.id, nodeId: project.currentNodeId ?? project.rootNodeId } });
                    closeProjectMenu();
                  }}
                  role="option"
                  aria-selected={isSelected}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${isSelected ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-800/90 hover:bg-slate-800'}`}
                >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                      <Image src={rootImage.url} alt="" width={rootImage.width} height={rootImage.height} sizes="56px" className="h-full w-full object-cover" />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{project.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        <span>{projectFamily.title}</span>
                        {project.promotedNodeId ? <span className="rounded-full border border-amber-300 bg-amber-400/90 px-1.5 py-0.5 text-[9px] text-slate-950">Direction</span> : null}
                      </span>
                    </span>
                </button>
              );
            })}
          </div>

          <div role="group" className="mt-3 rounded-xl border border-slate-700 bg-slate-950/80 p-3" aria-label={`${activeProject.name} project actions`}>
            {renameProjectId === activeProject.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => finishRename(activeProject)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    finishRename(activeProject);
                  }

                  if (event.key === 'Escape') {
                    cancelRename();
                  }
                }}
                className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-sky-400"
                aria-label={`Rename ${activeProject.name}`}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => beginRename(activeProject)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
                Rename selected
              </button>
              <button type="button" onClick={() => { dispatch({ type: 'DUPLICATE_PROJECT', payload: { projectId: activeProject.id } }); closeProjectMenu(); }} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
                Duplicate selected
              </button>
              <button type="button" onClick={() => { setProjectMenuOpen(false); setDeleteProjectId(activeProject.id); }} className="rounded-lg border border-red-500/60 bg-red-500/10 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400">
                Delete selected
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {deleteProjectId ? (
        <div className="studio-dialog-backdrop">
          <div id="studio-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="studio-delete-dialog w-full max-w-md rounded-[26px] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 id="delete-project-title" className="text-xl font-semibold text-white">Delete project?</h3>
            <p className="mt-2 text-sm text-slate-300">This removes the project from the workspace. You can undo it from the toast.</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeleteProjectId(null)} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = state.projects.find((project) => project.id === deleteProjectId);
                  if (!target) {
                    setDeleteProjectId(null);
                    return;
                  }

                  dispatch({ type: 'DELETE_PROJECT', payload: { projectId: target.id } });
                  showToast(`Deleted ${target.name}.`, true);
                  setDeleteProjectId(null);
                  setProjectMenuOpen(false);
                }}
                className="rounded-full border border-red-500 bg-red-500 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white transition hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" className="studio-toast flex max-w-sm items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur-sm">
          <span className="flex-1">{toast.message}</span>
          {toast.canUndo ? (
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'UNDO' });
                setToast(null);
              }}
              className="rounded-full border border-sky-400 bg-sky-500 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-950 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
