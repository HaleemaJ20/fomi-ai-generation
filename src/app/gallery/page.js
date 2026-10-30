'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';

export default function GalleryPage() {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const sentinelRef = useRef(null);
  const requestCursorRef = useRef(null);

  const loadPage = useCallback(async (nextCursor, controller) => {
    const isFirstPage = !nextCursor;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const params = new URLSearchParams({ limit: '12' });
      if (nextCursor) params.set('cursor', nextCursor);
      const result = await apiClient.get(`/api/history?${params}`, { signal: controller.signal });
      const flattened = result.items.flatMap((generation) =>
        generation.items.map((item) => ({
          ...item,
          generationId: generation.id,
          prompt: generation.prompt,
          type: item.type || generation.type,
        })),
      );
      setItems((current) => isFirstPage ? flattened : [...current, ...flattened]);
      setCursor(result.nextCursor);
      requestCursorRef.current = result.nextCursor;
      setHasMore(result.hasMore);
    } catch (requestError) {
      if (!controller.signal.aborted && requestError.name !== 'AbortError') {
        setError(requestError.message || 'Unable to load gallery items.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setCursor(null);
    requestCursorRef.current = null;
    setHasMore(true);
    loadPage(null, controller);
    return () => controller.abort();
  }, [loadPage, requestVersion]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && requestCursorRef.current) {
        const controller = new AbortController();
        loadPage(requestCursorRef.current, controller);
      }
    }, { rootMargin: '300px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, filter, loadPage]);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.type === filter);
  }, [filter, items]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading gallery">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={`gallery-skeleton-${index}`} className="h-64 animate-pulse rounded-[24px] bg-[var(--color-panel)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-[var(--color-panel)] p-8 text-center text-sm text-[var(--color-ink)]" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => setRequestVersion((version) => version + 1)} className="mt-4 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] focus-ring">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-3 shadow-soft">
        {['all', 'image', 'video'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-ring ${filter === value ? 'bg-[var(--color-accent)] text-[var(--color-ink)]' : 'bg-[var(--color-surface)] text-[var(--color-ink)]'}`}
            aria-pressed={filter === value}
          >
            {value === 'all' ? 'All' : value === 'image' ? 'Images' : 'Videos'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item, index) => (
          <article key={`${item.generationId}-${item.id || index}`} className="relative overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-soft">
            <Image
              src={item.thumbnailUrl || item.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp'}
              alt={item.prompt || `Gallery item ${index + 1}`}
              width={900}
              height={900}
              sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 25vw"
              className="h-52 w-full object-cover"
            />
            {item.type === 'video' ? (
              <span className="absolute left-1/2 top-24 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-xs text-white" aria-hidden="true">▶</span>
            ) : null}
            <div className="space-y-2 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">{item.type}</p>
              <p className="line-clamp-2 text-sm text-[var(--color-ink)]">{item.prompt}</p>
            </div>
          </article>
        ))}
      </div>
      {visibleItems.length === 0 && !loadingMore ? (
        <p className="rounded-[24px] bg-[var(--color-panel)] p-8 text-center text-sm text-[var(--color-muted)]">No gallery items found.</p>
      ) : null}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      {loadingMore ? <p className="text-center text-sm text-[var(--color-muted)]">Loading more…</p> : null}
    </div>
  );
}
