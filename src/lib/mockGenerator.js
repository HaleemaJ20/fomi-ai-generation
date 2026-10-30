import mockLibrary from '@/data/mockLibrary.json';
import { resolveAspectDimensions } from './mock-data';

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'with', 'and', 'at', 'for', 'to', 'my', 'some']);

const normalizeWord = (word) => {
  const cleaned = String(word ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) return '';
  const irregular = { women: 'woman', people: 'person', men: 'man', children: 'child', mice: 'mouse' };
  const normalized = irregular[cleaned] || cleaned.replace(/ies$/, 'y');
  if (normalized.endsWith('ing') && normalized.length > 5) return normalized.slice(0, -3);
  if (normalized.endsWith('ed') && normalized.length > 4) return normalized.slice(0, -2);
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

const tokenize = (prompt) => {
  const tokens = (String(prompt || '').toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [])
    .map(normalizeWord)
    .filter((token) => token && !STOPWORDS.has(token));
  return [...new Set(tokens)];
};

const buildKeywordIndex = (keyword) => {
  const tokens = (String(keyword || '').toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [])
    .map(normalizeWord)
    .filter((token) => token && !STOPWORDS.has(token));
  const bigrams = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.add(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return { tokens: new Set(tokens), bigrams };
};

const scoreCategoryKeywords = (category, promptTerms, promptBigrams) => {
  let score = 0;
  for (const keyword of category.keywords || []) {
    const index = buildKeywordIndex(keyword);
    for (const term of index.tokens) {
      if (promptTerms.has(term)) {
        score += 2;
        continue;
      }
      const stemmedMatch = [...promptTerms].some((promptTerm) => normalizeWord(promptTerm) === term);
      if (stemmedMatch) score += 1;
    }
    for (const phrase of index.bigrams) {
      if (promptBigrams.has(phrase)) score += 2;
    }
  }
  return score;
};

const hashSeed = (value) => {
  let hash = 2166136261;
  const text = String(value ?? 'default');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed) => {
  let state = hashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = (items, seed) => {
  const random = seededRandom(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const orientationForRatio = (aspectRatio) => {
  if (aspectRatio === '16:9' || aspectRatio === '3:2' || aspectRatio === '4:3') return 'landscape';
  if (aspectRatio === '9:16' || aspectRatio === '4:5' || aspectRatio === '3:4') return 'portrait';
  return 'squarish';
};

const uniqueMedia = (categories, mediaKey) => {
  const seen = new Set();
  return categories.flatMap((category) =>
    (category[mediaKey] || []).filter((media) => {
      if (!media?.id || !media?.url || seen.has(media.id)) return false;
      seen.add(media.id);
      return true;
    }).map((media) => ({ ...media, categoryId: category.id })),
  );
};

const allocateCounts = (scoredCategories, count) => {
  const total = scoredCategories.reduce((sum, entry) => sum + entry.score, 0);
  let remaining = count;
  const allocations = scoredCategories.map((entry) => {
    const exact = count * entry.score / total;
    return { ...entry, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  remaining -= allocations.reduce((sum, entry) => sum + entry.count, 0);
  allocations
    .sort((left, right) => right.remainder - left.remainder || right.score - left.score)
    .forEach((entry) => {
      if (remaining > 0) {
        entry.count += 1;
        remaining -= 1;
      }
    });
  return allocations;
};

export const getCategoryVideoCoverage = () => (Array.isArray(mockLibrary.categories) ? mockLibrary.categories.reduce((totals, category) => {
  totals[category.id] = Array.isArray(category.videos) ? category.videos.length : 0;
  return totals;
}, {}) : {});

export const generateMockItems = ({ prompt, type, count, aspectRatio, seed, duration = 5 }) => {
  const mediaKey = type === 'video' ? 'videos' : 'images';

  const promptTerms = new Set(tokenize(prompt || ''));
  const promptBigrams = new Set();
  const promptTokens = tokenize(prompt || '');
  for (let index = 0; index < promptTokens.length - 1; index += 1) {
    promptBigrams.add(`${promptTokens[index]} ${promptTokens[index + 1]}`);
  }
  const categories = Array.isArray(mockLibrary.categories) ? mockLibrary.categories.filter((category) => category[mediaKey]?.length) : [];
  if (!categories.length) throw new Error(type === 'video' ? 'No video samples available yet' : 'No image samples available yet');

  const requestedOrientation = orientationForRatio(aspectRatio);
  const baseSeed = `${seed ?? ''}:${String(prompt || '').toLowerCase()}:${aspectRatio}`;

  const scoredCategories = categories
    .map((category) => ({ category, score: scoreCategoryKeywords(category, promptTerms, promptBigrams) }));

  const rankedByScore = [...scoredCategories].sort((left, right) => right.score - left.score);
  const sortedCategories = [];
  for (let index = 0; index < rankedByScore.length; index += 1) {
    const currentScore = rankedByScore[index].score;
    const bucket = [];
    while (index < rankedByScore.length && rankedByScore[index].score === currentScore) {
      bucket.push(rankedByScore[index]);
      index += 1;
    }
    sortedCategories.push(...seededShuffle(bucket, `${baseSeed}:score-${currentScore}`));
    index -= 1;
  }

  const matched = sortedCategories.filter((entry) => entry.score > 0);
  const rankedCategories = matched.length ? matched : sortedCategories;
  const matchedCategories = matched.map((entry) => entry.category.id);
  const selected = [];
  const selectedIds = new Set();

  const takeFromCategory = (entry, quantity) => {
    if (!entry || quantity <= 0) return;
    const pool = uniqueMedia([entry.category], mediaKey);
    const preferred = pool.filter((media) => media.orientation === requestedOrientation);
    const fallback = pool.filter((media) => media.orientation !== requestedOrientation);
    const durationRank = (media) => type === 'video'
      ? Math.abs(Number(media.duration || duration) - Number(duration))
      : 0;
    const ordered = [...seededShuffle(preferred, `${baseSeed}:${entry.category.id}`), ...seededShuffle(fallback, `${baseSeed}:${entry.category.id}:fallback`)];
    ordered.sort((left, right) => durationRank(left) - durationRank(right));
    let added = 0;
    for (const media of ordered) {
      if (selected.length >= count || added >= quantity) break;
      if (!selectedIds.has(media.id)) {
        selected.push(media);
        selectedIds.add(media.id);
        added += 1;
      }
    }
  };

  if (matched.length) {
    const allocations = allocateCounts(matched, count);
    allocations.forEach((entry) => takeFromCategory(entry, entry.count));
  }

  const categoryPool = rankedCategories.length ? rankedCategories : scoredCategories;
  for (const entry of categoryPool) {
    if (selected.length >= count) break;
    takeFromCategory(entry, count - selected.length);
  }

  const allMedia = uniqueMedia(categories, mediaKey);
  const remainingPreferred = allMedia.filter((media) => media.orientation === requestedOrientation && !selectedIds.has(media.id));
  const remainingFallback = allMedia.filter((media) => media.orientation !== requestedOrientation && !selectedIds.has(media.id));
  const remainingPool = [...seededShuffle(remainingPreferred, `${baseSeed}:all:preferred`), ...seededShuffle(remainingFallback, `${baseSeed}:all:fallback`)];
  for (const media of remainingPool) {
    if (selected.length >= count) break;
    if (!selectedIds.has(media.id)) {
      selected.push(media);
      selectedIds.add(media.id);
    }
  }

  if (selected.length < count) throw new Error(`Only ${selected.length} ${type} samples are available; ${count} were requested.`);
  const [width, height] = resolveAspectDimensions(aspectRatio);

  return {
    items: selected.slice(0, count).map((media, index) => ({
      id: `${media.id}-${hashSeed(`${baseSeed}:${index}`)}`,
      url: media.url,
      thumbnailUrl: type === 'video' ? media.poster : media.url,
      width: type === 'video' ? media.width || width : width,
      height: type === 'video' ? media.height || height : height,
      type,
      prompt,
      tags: media.categoryId ? [media.categoryId] : [],
      ...(type === 'video' ? { duration: media.duration } : {}),
    })),
    matchedCategories,
    hint: type === 'video' && matched.length === 0 ? 'No exact video match. Showing the closest samples.' : undefined,
  };
};
