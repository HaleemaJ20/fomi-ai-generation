'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { mergeGenerationSources, readStoredGenerations } from '@/lib/storedGenerations';

const mockLibrary = [
  { id: 'saved-1', title: 'Sunlit portrait', type: 'image', src: '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp', favorite: true },
  { id: 'saved-2', title: 'Dreamscape still', type: 'image', src: '/mock/abstract/8h_tctpq4h0.jpg', favorite: false },
  { id: 'saved-3', title: 'Studio loop', type: 'video', src: '/mock/videos/nature/11363946-hd-1920-1080-50fps-poster.jpg', favorite: true },
  { id: 'saved-4', title: 'City motion', type: 'video', src: '/mock/videos/city/10297600-hd-3840-2160-30fps-poster.jpg', favorite: false },
];

export default function LibraryPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const history = await apiClient.get('/api/history?limit=12');
        const mergedHistory = mergeGenerationSources(readStoredGenerations() ?? [], history.items ?? []);
        const mapped = mergedHistory.map((generation, index) => ({
          id: generation.id || `library-${index}`,
          title: generation.prompt,
          type: generation.type,
          src: generation.items[0]?.thumbnailUrl || generation.items[0]?.url || '/mock/woman/Gemini_Generated_Image_5fq27c5fq27c5fq2.webp',
          favorite: index % 2 === 0,
        }));
        setItems(mapped.length ? mapped : mockLibrary);
      } catch {
        setItems(mockLibrary);
      }
    };

    loadLibrary();
  }, []);

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Library</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Saved and favourited creations from your recent sessions.</p>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'image', 'video'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition focus-ring ${filter === mode ? 'bg-[var(--color-accent)] text-[var(--color-ink)]' : 'bg-[var(--color-surface)] text-[var(--color-ink)]'}`}
                aria-pressed={filter === mode}
              >
                {mode === 'all' ? 'All' : mode === 'image' ? 'Images' : 'Videos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <article key={item.id} className="relative overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-soft">
            <Image src={item.src} alt={item.title} width={900} height={900} sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 25vw" className="h-48 w-full object-cover" />
            {item.type === 'video' ? (
              <span className="absolute left-1/2 top-24 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-black/70 text-xs text-white" aria-hidden="true">▶</span>
            ) : null}
            <div className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{item.title}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">{item.type}</p>
              </div>
              <span aria-label={item.favorite ? 'Favourited' : 'Not favourited'} className={`text-lg ${item.favorite ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}>
                {item.favorite ? '★' : '☆'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
