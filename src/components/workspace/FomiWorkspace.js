'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, Heart, Loader2, RefreshCcw, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import useHistory from '@/hooks/useHistory';
import { useGeneration } from '@/context/GenerationContext';
import useModalScrollLock from '@/hooks/useModalScrollLock';

const defaultPrompt = 'Describe your imagination to be converted to a piece of art ...';
const countOptions = [1, 2, 3, 4, 5, 6, 7, 8];
const aspectOptions = ['1:1', '4:5', '16:9', '9:16', '3:2'];
const videoCountOptions = [1, 2, 3, 4];
const durationOptions = ['5', '8', '10'];
const motionOptions = ['low', 'medium', 'high'];

function getAspectRatioFromDimensions(width, height) {
  if (!width || !height) return '1:1';
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  if (Math.abs(ratio - 1.25) < 0.08) return '4:5';
  if (Math.abs(ratio - 1.7778) < 0.08) return '16:9';
  if (Math.abs(ratio - 0.5625) < 0.08) return '9:16';
  if (Math.abs(ratio - 1.5) < 0.08) return '3:2';
  return '1:1';
}

function Dropdown({ label, value, options, onChange, buttonClassName, menuClassName, disabled = false }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        title={`${label}: ${value}`}
        className={`${buttonClassName} flex min-w-0 w-full items-center justify-between gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-2 text-left text-xs text-[var(--color-ink)] transition hover:bg-[var(--color-control-hover)] focus-ring`}
      >
        <span className="min-w-0 truncate whitespace-nowrap">
          {label}: {value}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div className={`absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-soft ${menuClassName}`} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring ${value === option ? 'bg-[var(--color-panel)]' : ''}`}
            >
              <span>{option}</span>
              {value === option ? <span className="text-[var(--color-accent)]">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FomiWorkspace({ initialMode = 'image' }) {
  const router = useRouter();
  const { history, setHistory, loading, error, reload, restoreSamples } = useHistory();
  const generation = useGeneration();
  const stripRef = useRef(null);
  const touchStartX = useRef(null);
  const lightboxRef = useRef(null);
  const lightboxVideoRef = useRef(null);
  const [results, setResults] = useState([]);
  const generationControllerRef = useRef(null);
  const [selectedGenerationId, setSelectedGenerationId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationHint, setGenerationHint] = useState('');
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const clearDialogRef = useRef(null);
  const viewAllDialogRef = useRef(null);
  const viewAllTriggerRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  const tileVideoRefs = useRef([]);
  const hasGeneratedThisSession = useRef(false);
  useModalScrollLock(viewAllOpen || Boolean(lightbox) || clearConfirmOpen);

  useEffect(() => {
    const video = lightboxVideoRef.current;
    if (!video || lightbox?.entry?.type !== 'video') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, [lightbox]);

  const {
    mode,
    prompt,
    count,
    aspectRatio,
    model,
    selectedStyles,
    advanced,
    advancedOpen,
    stylesOpen,
    models,
    styleOptions,
    dispatch,
  } = generation;

  const historyList = useMemo(() => history, [history]);

  const filteredHistory = useMemo(() => {
    return historyList.filter((entry) => {
      const matchesType = filter === 'all' || entry.type === filter;
      const matchesSearch = !searchTerm || entry.prompt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [filter, historyList, searchTerm]);

  useEffect(() => {
    if (initialMode && initialMode !== mode) {
      dispatch({ type: 'SET_MODE', payload: initialMode });
    }
  }, [dispatch, initialMode, mode]);

  useEffect(() => {
    if (!historyList.length) return;
    const nextDefault = historyList.find((entry) => entry.type === mode) || historyList[0];
    if (!selectedGenerationId && nextDefault) {
      const firstItem = nextDefault.items?.[0];
      setSelectedGenerationId(nextDefault.id);
      setResults(Array.isArray(nextDefault.items) ? nextDefault.items : []);
      dispatch({ type: 'SET_PROMPT', payload: nextDefault.prompt || defaultPrompt });
      dispatch({ type: 'SET_MODEL', payload: nextDefault.model || models[0] });
      dispatch({ type: 'SET_COUNT', payload: Math.min(nextDefault.items?.length || 1, nextDefault.type === 'video' ? 4 : 8) });
      dispatch({ type: 'SET_ASPECT', payload: getAspectRatioFromDimensions(firstItem?.width, firstItem?.height) || '1:1' });
    }
  }, [dispatch, historyList, mode, models, selectedGenerationId]);

  const scrollStrip = (direction) => {
    if (!stripRef.current) return;
    stripRef.current.scrollTo({ left: stripRef.current.scrollLeft + direction * 240, behavior: 'smooth' });
  };

  const handleStripKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
    const currentIndex = buttons.indexOf(document.activeElement);
    const targetIndex = event.key === 'ArrowRight' ? Math.min(currentIndex + 1, buttons.length - 1) : Math.max(currentIndex - 1, 0);
    buttons[targetIndex]?.focus();
  };

  const handleThumbnailClick = (entry) => {
    const firstItem = entry.items?.[0];
    setSelectedGenerationId(entry.id);
    setResults(Array.isArray(entry.items) ? entry.items : []);
    dispatch({ type: 'SET_PROMPT', payload: entry.prompt || defaultPrompt });
    dispatch({ type: 'SET_MODEL', payload: entry.model || models[0] });
    dispatch({ type: 'SET_COUNT', payload: Math.min(entry.items?.length || 1, entry.type === 'video' ? 4 : 8) });
    dispatch({ type: 'SET_ASPECT', payload: getAspectRatioFromDimensions(firstItem?.width, firstItem?.height) || '1:1' });
    dispatch({ type: 'SET_MODE', payload: entry.type || mode });
    setViewAllOpen(false);
    const resultsNode = document.getElementById('generation-results');
    if (resultsNode) resultsNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const [visibleRows, setVisibleRows] = useState(3);

  const handleGenerate = useCallback(async (controllerSignal, pendingRetry = false) => {
    if (!prompt.trim()) return;
    setGenerationError('');
    setGenerationHint('');
    setIsGenerating(true);

    const pendingEntry = {
      id: `pending-${Date.now()}`,
      prompt: prompt.trim(),
      type: mode,
      model,
      createdAt: new Date().toISOString(),
      items: [],
      isPending: true,
    };

    setHistory((current) => [pendingEntry, ...current]);

    try {
      const payload = {
        prompt: prompt.trim(),
        type: mode,
        count,
        aspectRatio,
        model,
        style: selectedStyles[0] || (mode === 'image' ? 'portrait' : 'cinematic'),
        styles: selectedStyles,
        advanced: {
          ...advanced,
          duration: mode === 'video' ? Math.max(5, Number(advanced.duration) || 5) : undefined,
          motion: mode === 'video' ? advanced.motion : undefined,
        },
        retry: Boolean(pendingRetry),
      };

      const response = await apiClient.post('/api/generate', payload, {
        timeout: 30000,
        signal: controllerSignal,
        headers: {
          'Content-Type': 'application/json',
          'x-fomi-session': hasGeneratedThisSession.current ? 'active' : 'first',
        },
      });
      hasGeneratedThisSession.current = true;
      const nextEntry = {
        id: response.id,
        prompt: response.prompt,
        type: response.type,
        model: response.model,
        createdAt: response.createdAt,
        items: response.items,
        settings: response.settings,
        hint: response.hint,
      };

      setSelectedGenerationId(response.id);
      setResults(response.items || []);
      setGenerationHint(response.hint || '');
      setHistory((current) => current.map((entry) => (entry.id === pendingEntry.id ? nextEntry : entry)));
    } catch (requestError) {
      if (requestError?.name === 'AbortError') {
        setHistory((current) => current.filter((entry) => entry.id !== pendingEntry.id));
      } else {
        setHistory((current) => current.filter((entry) => entry.id !== pendingEntry.id));
        setGenerationError(requestError.details?.message || requestError.message || 'Unable to generate results right now.');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [advanced, aspectRatio, count, mode, model, prompt, selectedStyles, setHistory]);

  const handleGenerateAction = (retryGeneration = false) => {
    if (isGenerating) {
      generationControllerRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    generationControllerRef.current = controller;
    handleGenerate(controller.signal, retryGeneration);
  };

  useEffect(() => {
    const controller = new AbortController();
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!isGenerating && prompt.trim()) {
          generationControllerRef.current = controller;
          handleGenerate(controller.signal);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      controller.abort();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleGenerate, isGenerating, prompt]);

  const handleDelete = (id) => {
    const deletedEntry = historyList.find((entry) => entry.id === id);
    if (!deletedEntry) return;
    setHistory((current) => current.filter((entry) => entry.id !== id));
    setToast({ message: `Removed “${deletedEntry.prompt}”`, item: deletedEntry });
    window.setTimeout(() => {
      setToast((current) => (current?.item?.id === id ? null : current));
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (toast?.type === 'clear') {
      setHistory(toast.items || []);
      setToast(null);
      return;
    }
    if (!toast?.item) return;
    setHistory((current) => [toast.item, ...current]);
    setToast(null);
  };

  const handleRetry = () => {
    reload();
  };

  const handleGenerationRetry = (entry) => {
    dispatch({ type: 'SET_PROMPT', payload: entry.prompt });
    dispatch({ type: 'SET_MODE', payload: entry.type });
    handleGenerateAction(true);
  };

  const toggleStyle = (styleId) => {
    dispatch({ type: 'TOGGLE_STYLE', payload: styleId });
  };

  const handleSeedRandomize = () => {
    dispatch({
      type: 'SET_ADVANCED_FIELD',
      payload: { key: 'seed', value: String(Math.floor(Math.random() * 1000000)) },
    });
  };

  const handleCopyPrompt = async (value) => {
    if (!value) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
      setToast({ message: 'Prompt copied.' });
    } catch {
      setToast({ message: 'Copy failed.' });
    }
    window.setTimeout(() => setToast((current) => (current?.message === 'Prompt copied.' || current?.message === 'Copy failed.' ? null : current)), 1800);
  };

  const handleReuseSettings = (entry) => {
    const firstItem = entry.items?.[0] || { width: 900, height: 900 };
    dispatch({ type: 'SET_MODE', payload: entry.type || mode });
    dispatch({ type: 'SET_PROMPT', payload: entry.prompt || defaultPrompt });
    dispatch({ type: 'SET_MODEL', payload: entry.model || models[0] });
    dispatch({ type: 'SET_COUNT', payload: Math.min(entry.items?.length || 1, entry.type === 'video' ? 4 : 8) });
    dispatch({ type: 'SET_ASPECT', payload: getAspectRatioFromDimensions(firstItem.width, firstItem.height) || '1:1' });
    if (entry.settings?.duration) dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'duration', value: entry.settings.duration } });
    if (entry.settings?.motion) {
      const motion = entry.settings.motion <= 3 ? 'low' : entry.settings.motion >= 8 ? 'high' : 'medium';
      dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'motion', value: motion } });
    }
    setViewAllOpen(false);
    const resultsNode = document.getElementById('generation-results');
    if (resultsNode) {
      resultsNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const clearHistory = useCallback(() => {
    const snapshot = historyList;
    setHistory([]);
    setClearConfirmOpen(false);
    setToast({ type: 'clear', message: 'History cleared.', items: snapshot });
    window.setTimeout(() => {
      setToast((current) => (current?.type === 'clear' ? null : current));
    }, 6000);
  }, [historyList, setHistory]);

  useEffect(() => {
    const openConfirm = () => setClearConfirmOpen(true);
    const confirmClear = () => clearHistory();
    window.addEventListener('fomi:open-clear-history', openConfirm);
    window.addEventListener('fomi:clear-history-confirmed', confirmClear);
    return () => {
      window.removeEventListener('fomi:open-clear-history', openConfirm);
      window.removeEventListener('fomi:clear-history-confirmed', confirmClear);
    };
  }, [clearHistory]);

  const handleFavouriteToggle = (entry) => {
    const nextFavourite = !entry.favourite;
    setHistory((current) => current.map((item) => (item.id === entry.id ? { ...item, favourite: nextFavourite } : item)));
    setToast({ message: nextFavourite ? 'Saved to Library.' : 'Removed from Library.' });
    window.setTimeout(() => setToast((current) => (current?.message === 'Removed from Library.' || current?.message === 'Saved to Library.' ? null : current)), 1800);
  };

  const handleDownload = (url, fileName) => {
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'fomi-download';
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleTileOpen = (entry, index) => {
    if (entry?.isPending || entry?.isError) return;
    setLightbox({ entry, index: Number.isInteger(index) ? index : 0 });
  };

  const handleLoadMore = () => {
    setVisibleRows((current) => Math.min(current + 3, historyList.length));
  };

  const handleExamplePrompt = (value) => {
    dispatch({ type: 'SET_PROMPT', payload: value });
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      const end = value.length;
      textarea.setSelectionRange(end, end);
    }
  };

  useEffect(() => {
    if (!viewAllOpen) return;
    viewAllDialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setViewAllOpen(false);
        window.setTimeout(() => viewAllTriggerRef.current?.focus(), 0);
      }
      if (event.key === 'Tab' && viewAllDialogRef.current) {
        const focusable = Array.from(viewAllDialogRef.current.querySelectorAll('button:not([disabled]), input, a[href]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [viewAllOpen]);

  useEffect(() => {
    if (!clearConfirmOpen) return;
    clearDialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setClearConfirmOpen(false);
      }
      if (event.key === 'Tab' && clearDialogRef.current) {
        const buttons = Array.from(clearDialogRef.current.querySelectorAll('button:not([disabled])'));
        if (!buttons.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) {
          event.preventDefault();
          buttons[buttons.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          event.preventDefault();
          buttons[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearConfirmOpen]);

  useEffect(() => {
    if (!lightbox) return;
    lightboxRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Tab' && lightboxRef.current) {
        const focusable = Array.from(lightboxRef.current.querySelectorAll('button:not([disabled]), a[href], video[controls]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === 'Escape') {
        setLightbox(null);
        return;
      }
      if (!lightbox.entry?.items?.length) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLightbox((current) => {
          if (!current) return current;
          const nextIndex = (current.index + 1) % current.entry.items.length;
          return { ...current, index: nextIndex };
        });
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLightbox((current) => {
          if (!current) return current;
          const nextIndex = (current.index - 1 + current.entry.items.length) % current.entry.items.length;
          return { ...current, index: nextIndex };
        });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  const resultRows = useMemo(() => historyList.slice(0, visibleRows), [historyList, visibleRows]);
  const hasMoreRows = historyList.length > visibleRows;

  return (
    <>
      <section className="mb-5">
        <div className="relative overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-end gap-3">
              <h2 className="text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--color-ink)]">History</h2>
              <button ref={viewAllTriggerRef} type="button" onClick={() => setViewAllOpen(true)} className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] transition hover:text-[var(--color-ink)] focus-ring">
                View All
              </button>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button type="button" onClick={() => scrollStrip(-1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)] text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring" aria-label="Scroll history left">
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => scrollStrip(1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)] text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring" aria-label="Scroll history right">
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="md:hidden">
            <button type="button" onClick={() => setMobileCollapsed((current) => !current)} className="mb-3 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] focus-ring">
              {mobileCollapsed ? 'Expand history' : 'Collapse history'}
            </button>
          </div>

          {!mobileCollapsed ? (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--color-surface)] to-transparent" aria-hidden="true" />
              <div
                ref={stripRef}
                className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onKeyDown={handleStripKeyDown}
                onTouchStart={(event) => {
                  touchStartX.current = event.changedTouches[0].clientX;
                }}
                onTouchEnd={(event) => {
                  if (touchStartX.current === null) return;
                  const delta = event.changedTouches[0].clientX - touchStartX.current;
                  if (Math.abs(delta) > 40) scrollStrip(delta > 0 ? -1 : 1);
                  touchStartX.current = null;
                }}
              >
                {loading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <div key={`history-skeleton-${index}`} className="h-[90px] w-[90px] shrink-0 animate-pulse rounded-[18px] bg-[var(--color-panel)]" />
                  ))
                ) : error ? (
                  <div className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    <span>{error}</span>
                    <button type="button" onClick={handleRetry} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white focus-ring">Retry</button>
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="flex w-full items-center justify-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-control)] px-4 py-5 text-sm text-[var(--color-muted)]">
                    No generations yet.
                  </div>
                ) : (
                  historyList.map((entry) => {
                    const firstItem = entry.items?.[0];
                    const isSelected = selectedGenerationId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleThumbnailClick(entry)}
                        className={`relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] border transition focus-ring ${isSelected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/50' : 'border-[var(--color-border)]'}`}
                        aria-label={`Load ${entry.prompt}`}
                        aria-pressed={isSelected}
                      >
                        <Image
                          src={firstItem?.thumbnailUrl || firstItem?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                          alt={entry.prompt}
                          width={200}
                          height={200}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          sizes="92px"
                          unoptimized
                        />
                        {entry.type === 'video' ? (
                          <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-xs text-white" aria-hidden="true">▶</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-soft">
          <div className="mb-4 inline-flex w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            {['image', 'video'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => dispatch({ type: 'SET_MODE', payload: option })}
                className={`w-1/2 rounded-full px-4 py-2 text-sm font-medium transition focus-ring ${mode === option ? 'bg-[var(--color-accent)] text-[var(--color-ink)]' : 'text-[var(--color-ink)]'}`}
                aria-pressed={mode === option}
              >
                {option === 'image' ? 'Image' : 'Video'}
              </button>
            ))}
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(event) => dispatch({ type: 'SET_PROMPT', payload: event.target.value })}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  if (!isGenerating && prompt.trim()) handleGenerateAction();
                }
              }}
              rows={5}
              placeholder={defaultPrompt}
              className="w-full resize-none rounded-[18px] border border-[var(--color-ink)]/40 bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGenerateAction}
              disabled={isGenerating || !prompt.trim()}
              className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
              aria-label={isGenerating ? 'Cancel generation' : 'Generate'}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <div className="mt-4 grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-2 max-[380px]:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Dropdown
              label={mode === 'video' ? '# Videos' : '# Images'}
              value={String(count)}
              options={(mode === 'video' ? videoCountOptions : countOptions).map(String)}
              onChange={(value) => dispatch({ type: 'SET_COUNT', payload: Number(value) })}
              buttonClassName="rounded-full h-10"
              menuClassName="max-h-52 overflow-auto"
            />
            <Dropdown
              label="Ratio"
              value={aspectRatio}
              options={aspectOptions}
              onChange={(value) => dispatch({ type: 'SET_ASPECT', payload: value })}
              buttonClassName="rounded-full h-10"
            />
            <Dropdown
              label="Model"
              value={model}
              options={models}
              onChange={(value) => dispatch({ type: 'SET_MODEL', payload: value })}
              buttonClassName="rounded-full h-10"
            />
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_ADVANCED' })}
              className="flex w-full items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring"
              aria-expanded={advancedOpen}
            >
              <span>Advance</span>
              {advancedOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>

            {advancedOpen ? (
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="grid gap-3">
                  <label className="text-xs text-[var(--color-muted)]">
                    <span className="mb-1 block">Negative prompt</span>
                    <input value={advanced.negativePrompt || ''} onChange={(event) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'negativePrompt', value: event.target.value } })} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" />
                  </label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <label className="text-xs text-[var(--color-muted)]">
                      <span className="mb-1 block">Seed</span>
                      <input value={advanced.seed || ''} onChange={(event) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'seed', value: event.target.value } })} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]" />
                    </label>
                    <button type="button" onClick={handleSeedRandomize} className="self-end rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] p-2 text-[var(--color-ink)] focus-ring">
                      <RefreshCcw size={15} aria-hidden="true" />
                    </button>
                  </div>

                  <label className="text-xs text-[var(--color-muted)]">
                    <span className="mb-1 flex items-center justify-between">
                      <span>Guidance</span>
                      <span>{advanced.guidance}</span>
                    </span>
                    <input type="range" min="1" max="20" value={advanced.guidance} onChange={(event) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'guidance', value: Number(event.target.value) } })} className="w-full accent-[var(--color-accent)]" />
                  </label>

                  <label className="text-xs text-[var(--color-muted)]">
                    <span className="mb-1 flex items-center justify-between">
                      <span>Steps</span>
                      <span>{advanced.steps}</span>
                    </span>
                    <input type="range" min="10" max="60" value={advanced.steps} onChange={(event) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'steps', value: Number(event.target.value) } })} className="w-full accent-[var(--color-accent)]" />
                  </label>

                  {mode === 'video' ? (
                    <>
                      <label className="text-xs text-[var(--color-muted)]">
                        <span className="mb-1 flex items-center justify-between">
                          <span>Duration</span>
                          <span>{advanced.duration}s</span>
                        </span>
                        <Dropdown label="Duration" value={`${advanced.duration}s`} options={durationOptions.map((duration) => `${duration}s`)} onChange={(value) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'duration', value: Number(value.replace('s', '')) } })} buttonClassName="h-10" />
                      </label>
                      <label className="text-xs text-[var(--color-muted)]">
                        <span className="mb-1 flex items-center justify-between">
                          <span>Motion</span>
                          <span>{advanced.motion}</span>
                        </span>
                        <Dropdown label="Motion" value={advanced.motion} options={motionOptions} onChange={(value) => dispatch({ type: 'SET_ADVANCED_FIELD', payload: { key: 'motion', value } })} buttonClassName="h-10" />
                      </label>
                    </>
                  ) : null}
                </div>

                <button type="button" onClick={() => dispatch({ type: 'RESET_ADVANCED' })} className="mt-3 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] focus-ring">
                  Reset to defaults
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_STYLES_PANEL' })}
              className="flex w-full items-center justify-between rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring"
              aria-expanded={stylesOpen}
            >
              <span>Styles</span>
              {stylesOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>

            {stylesOpen ? (
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--color-muted)]">Style presets</span>
                  {selectedStyles.length > 0 ? (
                    <button type="button" onClick={() => dispatch({ type: 'CLEAR_STYLES' })} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] focus-ring">Clear</button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {styleOptions.map((styleId) => {
                    const active = selectedStyles.includes(styleId);
                    return (
                      <button
                        key={styleId}
                        type="button"
                        onClick={() => toggleStyle(styleId)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-ring ${active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-ink)]' : 'border-[var(--color-border)] bg-[var(--color-control)] text-[var(--color-ink)]'}`}
                        aria-pressed={active}
                      >
                        {styleId}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-4">
          {generationError ? (
            <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {generationError}
            </div>
          ) : null}
          {generationHint ? (
            <div role="status" aria-live="polite" className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-[var(--color-muted)]">
              {generationHint}
            </div>
          ) : null}

          {historyList.length === 0 ? (
            <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-soft">
              <p className="text-lg font-semibold text-[var(--color-ink)]">No generations yet</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Try one of these example prompts to start your feed.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  'Sunlit portrait of a confident woman in warm studio light',
                  'Hyper-detailed forest escape with cinematic fog',
                  'Editorial product shot in a luxury modern studio',
                  'A neon city street glowing after summer rain',
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExamplePrompt(example)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <button type="button" onClick={restoreSamples} className="mt-4 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring">
                Restore sample history
              </button>
            </div>
          ) : (
            <>
              {resultRows.map((entry) => {
                const tiles = Array.isArray(entry.items) ? entry.items.slice(0, 4) : [];

                const isFavorite = Boolean(entry.favourite);

                return (
                  <article key={entry.id} className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft md:p-4">
                    <div className="flex flex-col gap-4 xl:flex-row">
                      <div className="w-full xl:max-w-[280px] xl:flex-shrink-0">
                        <div className="flex h-full min-h-[180px] flex-col justify-between rounded-[22px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
                          {entry.isPending ? (
                            <div className="space-y-3">
                              <div className="h-5 w-2/3 animate-pulse rounded-full bg-[var(--color-control)]/80" />
                              <div className="h-4 w-full animate-pulse rounded-full bg-[var(--color-control)]/70" />
                              <div className="h-4 w-5/6 animate-pulse rounded-full bg-[var(--color-control)]/70" />
                              <div className="h-4 w-4/5 animate-pulse rounded-full bg-[var(--color-control)]/70" />
                            </div>
                          ) : entry.isError ? (
                            <div className="flex h-full flex-col justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-red-600">Generation failed</p>
                                <p className="mt-2 text-sm text-[var(--color-muted)]">{entry.errorMessage || 'Something went wrong. Please retry.'}</p>
                              </div>
                              <button type="button" onClick={handleRetry} className="w-fit rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white focus-ring">Retry</button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[0.94rem] leading-7 text-[var(--color-ink)]">{entry.prompt || defaultPrompt}</p>
                              {entry.type === 'video' ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-[10px] text-[var(--color-muted)]">{entry.settings?.duration || advanced.duration}s</span>
                                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-[10px] capitalize text-[var(--color-muted)]">{entry.settings?.motion || advanced.motion} motion</span>
                                </div>
                              ) : null}
                              <div className="mt-3 flex items-end justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => handleCopyPrompt(entry.prompt)} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring">
                                    <Copy size={12} aria-hidden="true" /> Copy
                                  </button>
                                  <button type="button" onClick={() => handleReuseSettings(entry)} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring">
                                    <RefreshCcw size={12} aria-hidden="true" /> Reuse
                                  </button>
                                </div>
                                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)]">{entry.model || model}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid w-full min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                        {tiles.map((item, index) => {
                          const tileLabel = item?.prompt || entry.prompt || `Generation tile ${index + 1}`;
                          const isVideo = item?.type === 'video' || entry.type === 'video';

                          return (
                            <div
                              key={item.id || `${entry.id}-${index}`}
                              className="group relative aspect-[4/4.2] min-w-0 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <button
                                type="button"
                                onClick={() => handleTileOpen(entry, index)}
                                className="absolute inset-0 z-[1] rounded-[18px] focus-ring"
                                aria-label={`Open ${tileLabel}`}
                              />
                              {isVideo ? (
                                <video
                                  ref={(node) => { tileVideoRefs.current[index] = node; }}
                                  data-generation-tile
                                  src={item.url || item.thumbnailUrl || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                                  poster={item.thumbnailUrl || item.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                                  muted
                                  loop
                                  playsInline
                                  preload="none"
                                  className="h-full w-full object-cover"
                                  onPointerEnter={(event) => {
                                    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                                      document.querySelectorAll('video[data-generation-tile]').forEach((video) => {
                                        if (video !== event.currentTarget && !video.paused) {
                                          video.pause();
                                          video.currentTime = 0;
                                        }
                                      });
                                      event.currentTarget.play().catch(() => {});
                                    }
                                  }}
                                  onPointerLeave={(event) => {
                                    event.currentTarget.pause();
                                    event.currentTarget.currentTime = 0;
                                  }}
                                  onFocus={(event) => {
                                    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                                      event.currentTarget.play().catch(() => {});
                                    }
                                  }}
                                  onBlur={(event) => {
                                    event.currentTarget.pause();
                                    event.currentTarget.currentTime = 0;
                                  }}
                                />
                              ) : (
                                <Image
                                  src={item.thumbnailUrl || item.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                                  alt={tileLabel}
                                  width={900}
                                  height={900}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                                  unoptimized
                                />
                              )}

                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                              {isVideo ? (
                                <>
                                  <span className="pointer-events-none absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                                    <span aria-hidden="true">▶</span>
                                  </span>
                                  {Number.isFinite(Number(item.duration)) ? (
                                    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                                      0:{Math.round(Number(item.duration)).toString().padStart(2, '0')}
                                    </span>
                                  ) : null}
                                </>
                              ) : null}
                              <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                <div className="pointer-events-auto flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleDownload(item.url || item.thumbnailUrl || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp', `fomi-${entry.id}-${index}.png`); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)]/95 text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-control)] focus-ring"
                                    aria-label={`Download ${tileLabel}`}
                                  >
                                    <Download size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleCopyPrompt(entry.prompt); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)]/95 text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-control)] focus-ring"
                                    aria-label={`Copy prompt for ${tileLabel}`}
                                  >
                                    <Copy size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleReuseSettings(entry); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)]/95 text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-control)] focus-ring"
                                    aria-label={`Reuse settings for ${tileLabel}`}
                                  >
                                    <RefreshCcw size={14} aria-hidden="true" />
                                  </button>
                                </div>
                                <div className="pointer-events-auto flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleFavouriteToggle(entry); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)]/95 text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-control)] focus-ring"
                                    aria-label={isFavorite ? 'Remove from library' : 'Save to library'}
                                  >
                                    {isFavorite ? <Star size={14} className="fill-current text-[var(--color-accent)]" aria-hidden="true" /> : <Heart size={14} aria-hidden="true" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); handleDelete(entry.id); }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)]/95 text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-control)] focus-ring"
                                    aria-label={`Delete ${tileLabel}`}
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}

              {hasMoreRows ? (
                <div className="flex justify-center pt-2">
                  <button type="button" onClick={handleLoadMore} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring">
                    Load older generations
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {lightbox && lightbox.entry ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Generation preview" onMouseDown={(event) => event.target === event.currentTarget && setLightbox(null)}>
          <div ref={lightboxRef} tabIndex={-1} className="relative flex max-h-[calc(100dvh-16px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft sm:max-h-[calc(100dvh-32px)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                <span>{lightbox.entry.type === 'video' ? 'Video' : 'Image'}</span>
                <span>•</span>
                <span>{lightbox.entry.model || 'Model'}</span>
              </div>
              <button type="button" onClick={() => setLightbox(null)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] p-2 text-[var(--color-ink)] focus-ring" aria-label="Close preview">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-control)]">
                {lightbox.entry.type === 'video' ? (
                  <video
                    ref={lightboxVideoRef}
                    key={`${lightbox.entry.id}-${lightbox.index}`}
                    src={lightbox.entry.items?.[lightbox.index]?.url || lightbox.entry.items?.[0]?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                    controls
                    muted
                    className="max-h-[calc(100dvh-210px)] w-auto max-w-full object-contain sm:max-h-[calc(100dvh-180px)]"
                  />
                ) : (
                  <Image
                    src={lightbox.entry.items?.[lightbox.index]?.thumbnailUrl || lightbox.entry.items?.[lightbox.index]?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
                    alt={lightbox.entry.prompt}
                    width={1200}
                    height={1200}
                    className="max-h-[calc(100dvh-210px)] w-auto max-w-full object-contain sm:max-h-[calc(100dvh-180px)]"
                    sizes="(max-width: 1023px) calc(100vw - 32px), min(720px, 70vw)"
                    unoptimized
                  />
                )}
              </div>
              <aside className="flex flex-col gap-3 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleDownload(lightbox.entry.items?.[lightbox.index]?.url || lightbox.entry.items?.[0]?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp', lightbox.entry.type === 'video' ? `fomi-${lightbox.entry.id}-${lightbox.index}.mp4` : `fomi-${lightbox.entry.id}-${lightbox.index}.png`)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] focus-ring">
                    <Download size={15} aria-hidden="true" /> Download
                  </button>
                  <button type="button" onClick={() => handleFavouriteToggle(lightbox.entry)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-control)] text-[var(--color-ink)] focus-ring" aria-label={lightbox.entry.favourite ? 'Remove from library' : 'Save to library'}>
                    {lightbox.entry.favourite ? <Star size={16} className="fill-current text-[var(--color-accent)]" aria-hidden="true" /> : <Heart size={16} aria-hidden="true" />}
                  </button>
                </div>
                <button type="button" onClick={() => handleCopyPrompt(lightbox.entry.prompt)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] focus-ring">Copy prompt</button>
                <button type="button" onClick={() => { setLightbox(null); router.push('/edit'); }} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] focus-ring">Use as reference / Edit</button>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setLightbox((current) => current ? { ...current, index: ((current.index - 1) + current.entry.items.length) % current.entry.items.length } : current)} className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm text-[var(--color-ink)] focus-ring">
                    <ArrowLeft size={15} aria-hidden="true" /> Prev
                  </button>
                  <button type="button" onClick={() => setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.entry.items.length } : current)} className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm text-[var(--color-ink)] focus-ring">
                    Next <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {viewAllOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => event.target === event.currentTarget && (setViewAllOpen(false), window.setTimeout(() => viewAllTriggerRef.current?.focus(), 0))}
        >
          <div ref={viewAllDialogRef} role="dialog" aria-modal="true" aria-labelledby="history-view-title" tabIndex={-1} className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-soft sm:max-h-[90dvh] sm:rounded-[28px]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <h3 id="history-view-title" className="text-xl font-semibold text-[var(--color-ink)]">History</h3>
                <div className="flex items-center gap-2">
                  {historyList.length ? <button type="button" onClick={() => setClearConfirmOpen(true)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] focus-ring">Clear history</button> : null}
                  <button type="button" onClick={() => { setViewAllOpen(false); window.setTimeout(() => viewAllTriggerRef.current?.focus(), 0); }} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] p-2 text-[var(--color-ink)] focus-ring" aria-label="Close history view">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="flex w-full items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-muted)] focus-within:border-[var(--color-accent)] md:max-w-md">
                <Search size={15} aria-hidden="true" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search prompt" className="w-full bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none" aria-label="Search history by prompt" />
              </label>

              <div className="flex items-center gap-2">
                {['all', 'image', 'video'].map((option) => (
                  <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-full px-3 py-2 text-sm font-medium transition focus-ring ${filter === option ? 'bg-[var(--color-accent)] text-[var(--color-ink)]' : 'bg-[var(--color-surface)] text-[var(--color-ink)]'}`} aria-pressed={filter === option}>
                    {option === 'all' ? 'All' : option === 'image' ? 'Images' : 'Videos'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`history-modal-skeleton-${index}`} className="h-52 animate-pulse rounded-[20px] bg-[var(--color-surface)]" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                <p>{error}</p>
                <button type="button" onClick={handleRetry} className="mt-3 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white focus-ring">Retry</button>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-muted)]">Nothing matches your current filter.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredHistory.map((entry) => {
                  const firstItem = entry.items?.[0];
                  return (
                    <div key={entry.id} className="group overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                      <button type="button" onClick={() => handleThumbnailClick(entry)} className="relative block w-full text-left focus-ring">
                        <Image src={firstItem?.thumbnailUrl || firstItem?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'} alt={entry.prompt} width={600} height={600} className="h-52 w-full object-cover" loading="lazy" unoptimized />
                        {entry.type === 'video' ? <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-xs text-white" aria-hidden="true">▶</span> : null}
                      </button>
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-muted)]">{entry.type}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink)]">{entry.prompt}</p>
                        </div>
                        <button type="button" onClick={() => handleDelete(entry.id)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] p-2 text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring" aria-label={`Delete ${entry.prompt}`}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
          </div>
        </div>
      ) : null}

      {clearConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && setClearConfirmOpen(false)}>
          <div ref={clearDialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="clear-history-title" className="w-full max-w-sm rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft">
            <h2 id="clear-history-title" className="text-lg font-semibold text-[var(--color-ink)]">Clear generation history?</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">This removes every generation from this device. You can undo for 6 seconds.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setClearConfirmOpen(false)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-4 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-control-hover)] focus-ring">Cancel</button>
              <button type="button" onClick={clearHistory} className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white focus-ring">Clear history</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-soft">
          <span className="text-sm text-[var(--color-ink)]">{toast.message}</span>
          <button type="button" onClick={handleUndoDelete} className="rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] focus-ring">Undo</button>
        </div>
      ) : null}
    </>
  );
}
