'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { mergeGenerationSources, readStoredGenerations } from '@/lib/storedGenerations';

const MAX_IMAGES = 10;

export default function EditPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      setLoadState('loading');
      setLoadError('');

      try {
        const data = await apiClient.get('/api/history?limit=30');
        if (!active) return;

        const mergedHistory = mergeGenerationSources(readStoredGenerations() ?? [], data.items ?? []);
        const imageItems = mergedHistory
          .flatMap((generation) =>
            generation.items
              .filter((item) => (item.type || generation.type) === 'image' && item.url)
              .map((item) => ({ id: item.id, prompt: generation.prompt, src: item.url })),
          )
          .slice(0, MAX_IMAGES);

        setItems(imageItems);
        setSelectedId(imageItems[0]?.id ?? '');
        setLoadState('ready');
      } catch (requestError) {
        if (!active) return;
        setLoadError(requestError.message || 'Unable to load saved images.');
        setLoadState('error');
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const handleEnhance = async () => {
    if (!selectedItem) return;
    setStatus('enhancing');
    setError('');

    try {
      await apiClient.post('/api/generate', {
        prompt: selectedItem.prompt || 'Enhance the selected image',
        type: 'image',
        count: 1,
        aspectRatio: '1:1',
        model: 'portrait-max',
        style: 'portrait',
        advanced: { enhancement: 'upscale' },
      });
      setStatus('done');
    } catch (requestError) {
      setError(requestError.message || 'Enhancement failed.');
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-5 pb-40 md:pb-0">
      <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-soft">
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Edit</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Pick a past image and apply a simple mock upscale or enhancement.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {loadState === 'loading' ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading images">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-60 animate-pulse rounded-[24px] bg-[var(--color-panel)]" />
              ))}
            </div>
          ) : null}

          {loadState === 'error' ? (
            <div role="alert" className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-ink)]">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-3 rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] focus-ring"
              >
                Retry
              </button>
            </div>
          ) : null}

          {loadState === 'ready' && items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-ink)]">
              <p>No images yet. Generate one first.</p>
              <Link
                href="/"
                className="mt-3 inline-block rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] focus-ring"
              >
                Go to generator
              </Link>
            </div>
          ) : null}

          {loadState === 'ready' && items.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(event) => {
                    setSelectedId(item.id);
                    event.currentTarget.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
                  }}
                  className={`overflow-hidden rounded-[24px] border text-left transition focus-ring ${selectedId === item.id ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/45' : 'border-[var(--color-border)]'}`}
                >
                  <Image src={item.src} alt={item.prompt} width={900} height={900} sizes="(max-width: 639px) 100vw, 50vw" className="h-44 w-full object-cover" />
                  <div className="bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink)]">{item.prompt}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-soft md:block">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Selected image</p>
          {selectedItem ? (
            <>
              <Image src={selectedItem.src} alt={selectedItem.prompt} width={900} height={900} sizes="320px" className="mt-3 h-52 w-full rounded-[20px] object-cover" />
              <p className="mt-3 text-sm text-[var(--color-ink)]">{selectedItem.prompt}</p>
              <button
                type="button"
                onClick={handleEnhance}
                disabled={status === 'enhancing'}
                className="mt-5 w-full rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] disabled:opacity-70 focus-ring"
              >
                {status === 'enhancing' ? 'Enhancing…' : 'Upscale / Enhance'}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Select an image to enhance it.</p>
          )}

          {status === 'done' ? <p className="mt-3 text-sm text-emerald-600">Enhancement complete.</p> : null}
          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </aside>
      </div>

      {selectedItem ? (
        <section
          aria-label="Selected image actions"
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft animate-[slide-up_180ms_cubic-bezier(0.2,0,0,1)] md:hidden"
        >
          <button
            type="button"
            onClick={handleEnhance}
            disabled={status === 'enhancing'}
            aria-label="Upscale or enhance selected image"
            className="w-full rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 focus-ring"
          >
            {status === 'enhancing' ? 'Enhancing…' : 'Upscale / Enhance'}
          </button>
          {status === 'done' ? <p className="mt-2 text-center text-xs text-emerald-600">Enhancement complete.</p> : null}
          {error ? <p className="mt-2 text-center text-xs text-red-500">{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}