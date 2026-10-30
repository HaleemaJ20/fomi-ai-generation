import historySeed from '@/data/history.json';

export const storedGenerationsKey = 'fomi-generations';
export const STORAGE_SCHEMA_VERSION = 2;

const isValidGeneration = (generation) => {
  if (!generation || typeof generation !== 'object') return false;
  if (typeof generation.id !== 'string' || typeof generation.prompt !== 'string') return false;
  if (!['image', 'video'].includes(generation.type)) return false;
  if (!Array.isArray(generation.items)) return false;
  return generation.items.every((item) =>
    item && typeof item.url === 'string' &&
    item.url.startsWith('/mock/') &&
    !/thumb-\d+\.svg/.test(item.url));
};

export function mergeGenerationSources(storedGenerations = [], seedGenerations = historySeed) {
  const merged = [
    ...(Array.isArray(storedGenerations) ? storedGenerations.filter(isValidGeneration) : []),
    ...((Array.isArray(seedGenerations) ? seedGenerations : []).filter((generation) => !storedGenerations.some((stored) => stored?.id === generation?.id))),
  ];

  const uniqueById = new Map();
  for (const generation of merged) {
    if (!generation || typeof generation.id !== 'string') continue;
    if (!uniqueById.has(generation.id)) uniqueById.set(generation.id, generation);
  }

  return [...uniqueById.values()].sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
  );
}

export function readStoredGenerations() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storedGenerationsKey);
    if (value === null) return null;
    const parsed = JSON.parse(value);
    if (parsed?.version !== STORAGE_SCHEMA_VERSION || !Array.isArray(parsed.generations)) return null;
    return parsed.generations.filter(isValidGeneration);
  } catch {
    return null;
  }
}

export function writeStoredGenerations(generations) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storedGenerationsKey, JSON.stringify({
      version: STORAGE_SCHEMA_VERSION,
      generations: Array.isArray(generations) ? generations.filter(isValidGeneration) : [],
    }));
  } catch {}
}
