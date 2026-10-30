'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { readStoredGenerations, writeStoredGenerations } from '@/lib/storedGenerations';

export default function useHistory() {
  const [history, updateHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const hasStoredValue = useRef(false);

  const setHistory = useCallback((nextHistory) => {
    hasStoredValue.current = true;
    updateHistory((current) => {
      const resolved = typeof nextHistory === 'function' ? nextHistory(current) : nextHistory;
      writeStoredGenerations(resolved);
      return resolved;
    });
  }, []);

  const fetchSamples = useCallback(async (controllerSignal) => {
    const payload = await apiClient.get('/api/history?limit=24', { signal: controllerSignal });
    return Array.isArray(payload?.items) ? payload.items : [];
  }, []);

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    try {
      const samples = await fetchSamples(controller.signal);
      if (!hasStoredValue.current) updateHistory(samples);
      return samples;
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') setError(requestError?.message || 'Unable to load history.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchSamples]);

  const restoreSamples = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    try {
      const samples = await fetchSamples(controller.signal);
      setHistory(samples);
      return samples;
    } catch (requestError) {
      setError(requestError?.message || 'Unable to restore sample history.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchSamples, setHistory]);

  useEffect(() => {
    const stored = readStoredGenerations();
    hasStoredValue.current = stored !== null;
    if (stored !== null) updateHistory(stored);
    setHydrated(true);
    load();
  }, [load]);

  useEffect(() => {
    if (hydrated) writeStoredGenerations(history);
  }, [history, hydrated]);

  return { history, setHistory, loading, error, reload: load, restoreSamples };
}
