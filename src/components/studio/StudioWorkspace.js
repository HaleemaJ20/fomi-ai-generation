'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioContext } from '@/context/studio/StudioContext';
import useModalScrollLock from '@/hooks/useModalScrollLock';

const UI_STORAGE_KEY = 'fomi-studio-ui:v1';
const DEFAULT_UI = { inspectorOpen: true, lineageHeight: 190 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function StudioWorkspace() {
  const { state, dispatch } = useStudioContext();
  const [uiState, setUiState] = useState(DEFAULT_UI);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState('none');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(false);
  const layoutRef = useRef(null);
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const inspectorOpen = uiState.inspectorOpen;
  const lineageOpen = uiState.lineageHeight > 0;

  const activeProject = useMemo(
    () => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0] ?? null,
    [state.projects, state.activeProjectId],
  );

  const projectIndex = useMemo(
    () => (activeProject ? state.projects.findIndex((project) => project.id === activeProject.id) : 0),
    [activeProject, state.projects],
  );

  const saveStatusText =
    state.saveStatus === 'saving' ? 'Saving' : state.saveStatus === 'error' ? 'Error' : 'Saved';

  useModalScrollLock(sheet !== 'none');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateViewport = () => {
      setIsCompactMobile(window.innerWidth < 450);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    try {
      const raw = window.localStorage.getItem(UI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setUiState({
            inspectorOpen: parsed.inspectorOpen ?? true,
            lineageHeight: clamp(Number(parsed.lineageHeight ?? 190), 120, 480),
          });
        }
      }
    } catch {
      setUiState(DEFAULT_UI);
    }

    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || loading) {
      return undefined;
    }

    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        inspectorOpen: uiState.inspectorOpen,
        lineageHeight: uiState.lineageHeight,
      }),
    );

    return undefined;
  }, [loading, uiState]);

  useEffect(() => {
    setHasError(!state.projects.length || state.saveStatus === 'error');
  }, [state.projects.length, state.saveStatus]);

  useEffect(() => {
    if (sheet === 'none') {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const focusable = Array.from(
      sheetRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
    );

    const first = focusable[0] ?? sheetRef.current;
    if (first && typeof first.focus === 'function') {
      first.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSheet('none');
        return;
      }

      if (event.key === 'Tab' && sheetRef.current) {
        const nextFocusable = Array.from(
          sheetRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        );

        if (!nextFocusable.length) {
          event.preventDefault();
          return;
        }

        const firstItem = nextFocusable[0];
        const lastItem = nextFocusable[nextFocusable.length - 1];
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
  }, [sheet]);

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }

    const onPointerMove = (event) => {
      if (!lineageOpen || !layoutRef.current) {
        return;
      }

      const bounds = layoutRef.current.getBoundingClientRect();
      const nextHeight = clamp(bounds.bottom - event.clientY, 120, Math.max(120, bounds.height * 0.4));
      setUiState((current) => ({ ...current, lineageHeight: nextHeight }));
    };

    const onPointerUp = () => setDragging(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, lineageOpen]);

  const switchProject = () => {
    if (!state.projects.length) {
      return;
    }

    const nextIndex = (projectIndex + 1) % state.projects.length;
    const nextProject = state.projects[nextIndex];
    if (!nextProject) {
      return;
    }

    dispatch({
      type: 'SELECT_NODE',
      payload: {
        projectId: nextProject.id,
        nodeId: nextProject.currentNodeId ?? nextProject.rootNodeId,
      },
    });
  };

  const syncPanelState = (nextState) => {
    dispatch({ type: 'TOGGLE_PANEL', payload: nextState });
  };

  const toggleInspector = () => {
    const nextOpen = !inspectorOpen;
    setUiState((current) => ({ ...current, inspectorOpen: nextOpen }));
    syncPanelState({ inspectorOpen: nextOpen });
  };

  const toggleLineage = () => {
    const nextHeight = lineageOpen ? 0 : 190;
    setUiState((current) => ({
      ...current,
      lineageHeight: nextHeight,
    }));
    syncPanelState({ lineageHeight: nextHeight });
  };

  const openSheet = (nextSheet) => {
    const nextValue = sheet === nextSheet ? 'none' : nextSheet;
    setSheet(nextValue);
    syncPanelState({ sheet: nextValue });
  };

  const handleResizeKeyDown = (event) => {
    if (!lineageOpen || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const step = event.shiftKey ? 24 : 12;
    setUiState((current) => {
      const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? step : -step;
      const next = clamp(current.lineageHeight + delta, 120, 480);
      return { ...current, lineageHeight: next };
    });
  };

  const retryLoad = () => {
    setHasError(false);
    setLoading(true);
    dispatch({ type: 'RESET_SAMPLE_PROJECTS' });
    window.setTimeout(() => setLoading(false), 220);
  };

  const bottomActions = isCompactMobile ? ['Lineage', 'Knobs', 'Compare', 'More'] : ['Lineage', 'More'];
  const workspaceStyle = !isCompactMobile
    ? {
        gridTemplateColumns: inspectorOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)',
        gridTemplateRows: lineageOpen ? `minmax(0, 1fr) ${Math.max(uiState.lineageHeight, 120)}px` : 'minmax(0, 1fr)',
      }
    : undefined;
  const desktopToolPanel = !isCompactMobile && sheet !== 'none' && (sheet === 'knobs' || sheet === 'compare');
  const toolPanelTitle = sheet === 'knobs' ? 'Knobs' : sheet === 'compare' ? 'Compare' : 'Studio';

  if (loading) {
    return (
      <div className="flex h-full w-full animate-pulse items-center justify-center bg-slate-950/90 p-6 text-slate-300">
        <div className="w-full max-w-4xl space-y-4">
          <div className="h-12 rounded-xl bg-slate-800/80" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="h-[58vh] rounded-2xl bg-slate-800/80" />
            <div className="h-[58vh] rounded-2xl bg-slate-800/80" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError || !activeProject) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950/90 p-6 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Studio unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold">The workspace could not load.</h1>
          <p className="mt-2 text-sm text-slate-300">Retry the Studio sample data and reopen the workspace.</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-5 rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sheetTitles = {
    knobs: 'Knobs',
    lineage: 'Lineage',
    compare: 'Compare',
    more: 'More',
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <a href="#studio-stage" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-sky-500 focus:px-3 focus:py-2 focus:text-slate-950 focus:outline-none">
        Skip to stage
      </a>

      <header className="studio-project-bar flex h-auto min-h-[56px] shrink-0 flex-col gap-2 border-b border-slate-800 bg-slate-950/85 px-3 py-2 text-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4" data-region="project-bar">
        <div className="studio-project-bar__left flex min-w-0 w-full items-center gap-2 sm:w-auto sm:flex-1 sm:gap-3">
          <Link href="/" className="shrink-0 rounded-full border border-slate-700 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:px-3 sm:text-xs">
            Back to Fomi
          </Link>
          <button
            type="button"
            onClick={switchProject}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:px-3 sm:text-xs"
            aria-label="Switch project"
          >
            Project switcher
          </button>
          <div className="studio-project-bar__meta min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.22em] text-slate-400 sm:text-[10px]">Project</p>
            <p className="truncate text-sm font-medium text-white">{activeProject.name}</p>
          </div>
        </div>

        <div className="studio-project-bar__right flex min-w-0 w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-[10px]">
            {saveStatusText}
          </span>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!state.history?.past?.length}
              className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-xs"
              aria-label="Undo last change"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!state.history?.future?.length}
              className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-xs"
              aria-label="Redo last change"
            >
              Redo
            </button>
            {!isCompactMobile ? (
              <>
                <button
                  type="button"
                  onClick={() => openSheet('knobs')}
                  className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-xs"
                  aria-label="Open knobs panel"
                >
                  Knobs
                </button>
                <button
                  type="button"
                  onClick={() => openSheet('compare')}
                  className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-xs"
                  aria-label="Open compare panel"
                >
                  Compare
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen((current) => !current)}
              className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-2 text-[9px] font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-xs"
              aria-expanded={commandPaletteOpen}
              aria-label="Open command palette"
            >
              Command palette
            </button>
          </div>
        </div>
      </header>

      {commandPaletteOpen ? (
        <div className="absolute left-4 top-20 z-40 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Projects</p>
          <div className="space-y-2">
            {state.projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  dispatch({
                    type: 'SELECT_NODE',
                    payload: {
                      projectId: project.id,
                      nodeId: project.currentNodeId ?? project.rootNodeId,
                    },
                  });
                  setCommandPaletteOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <span>{project.name}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{project.familyId}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={layoutRef} className="studio-workspace-grid relative flex-1 min-h-0 overflow-hidden" style={workspaceStyle}>
        <main
          id="studio-stage"
          className="studio-stage relative min-h-0 overflow-hidden border-b border-slate-800 bg-slate-950 lg:border-b-0 lg:border-r lg:border-slate-800"
          data-region="stage"
        >
          <div className="flex h-full items-center justify-center p-6">
            <div className="h-full w-full rounded-3xl border border-dashed border-slate-700 bg-slate-900/40" aria-label="Studio stage placeholder" />
          </div>
        </main>

        <aside
          className={`studio-inspector ${inspectorOpen ? 'is-open' : 'is-closed'}`}
          data-region="inspector"
          aria-label="Studio inspector"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Inspector</h2>
            <button
              type="button"
              onClick={toggleInspector}
              className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-expanded={inspectorOpen}
            >
              {inspectorOpen ? 'Collapse' : 'Open'}
            </button>
          </div>
          <div className="flex-1 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30" aria-label="Inspector placeholder" />
        </aside>

        {!inspectorOpen ? (
          <button
            type="button"
            onClick={toggleInspector}
            aria-label="Open inspector"
            className="studio-inspector-toggle"
          >
            Inspector
          </button>
        ) : null}

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize lineage panel"
          tabIndex={0}
          onPointerDown={() => setDragging(true)}
          onKeyDown={handleResizeKeyDown}
          className="studio-lineage-resizer hidden h-3 cursor-row-resize border-t border-slate-800 bg-slate-900/80 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 lg:block"
          data-region="lineage-resizer"
        />

        <section
          className={`studio-lineage ${lineageOpen ? 'is-open' : 'is-closed'}`}
          data-region="lineage"
          style={{ height: `${Math.max(uiState.lineageHeight, 0)}px` }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Lineage</h2>
              <button
                type="button"
                onClick={toggleLineage}
                className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-expanded={lineageOpen}
              >
                {lineageOpen ? 'Collapse' : 'Open'}
              </button>
            </div>
            <div className="flex-1 rounded-b-2xl border border-dashed border-slate-700 bg-slate-900/30 m-3" aria-label="Lineage placeholder" />
          </div>
        </section>

        {!lineageOpen ? (
          <button
            type="button"
            onClick={toggleLineage}
            aria-label="Open lineage"
            className="studio-lineage-toggle"
          >
            Lineage
          </button>
        ) : null}

        {desktopToolPanel ? (
          <aside className="studio-tool-panel" aria-label={`${toolPanelTitle} panel`} data-region={sheet}>
            <div className="studio-tool-panel__header">
              <h2>{toolPanelTitle}</h2>
              <button
                type="button"
                onClick={() => openSheet(sheet)}
                className="studio-tool-panel__close"
                aria-label={`Close ${toolPanelTitle}`}
              >
                Close
              </button>
            </div>
            <div className="studio-tool-panel__body" aria-label={`${toolPanelTitle} content`}>
              <div className="studio-tool-panel__placeholder" />
            </div>
          </aside>
        ) : null}
      </div>

      <nav className="studio-bottom-bar relative border-t border-slate-800 bg-slate-950/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:hidden" data-region="bottom-bar" aria-label="Studio quick actions">
        {state.armedKnob ? (
          <div className="absolute inset-x-0 top-0 flex -translate-y-12 justify-center pb-2">
            <button
              type="button"
              onClick={() => setSheet('knobs')}
              className="rounded-full border border-sky-400 bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              Fork {state.armedKnob.value}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          {bottomActions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (item === 'Lineage') {
                  openSheet('lineage');
                  return;
                }
                if (item === 'Knobs') {
                  openSheet('knobs');
                  return;
                }
                if (item === 'Compare') {
                  openSheet('compare');
                  return;
                }
                openSheet('more');
              }}
              className="studio-mobile-action rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label={`Open ${item} sheet`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>

      {sheet !== 'none' ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center bg-slate-950/80 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-sm md:hidden" data-region="sheet">
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="studio-sheet-title" className="w-full max-w-md rounded-t-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-600" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSheet('none');
                  syncPanelState({ sheet: 'none' });
                }}
                className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Close sheet"
              >
                Close
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h2 id="studio-sheet-title" className="text-base font-semibold text-white">{sheetTitles[sheet] ?? 'Studio'}</h2>
            </div>
            <div className="h-44 rounded-2xl border border-dashed border-slate-700 bg-slate-800/50" aria-label="Sheet placeholder" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
