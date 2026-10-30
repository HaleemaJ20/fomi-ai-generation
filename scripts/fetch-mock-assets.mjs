// Usage: npm run fetch:mock
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.unsplash.com';
const ROOT = process.cwd();
const MOCK_LIBRARY_PATH = path.join(ROOT, 'src/data/mockLibrary.json');
const MOCK_DIRECTORY = path.join(ROOT, 'public/mock');

const categories = {
  nature: {
    target: 12,
    keywords: ['nature', 'forest', 'woods', 'trees', 'mountain', 'mountains', 'river', 'lake', 'landscape', 'scenery', 'outdoors', 'mist', 'fog', 'sunrise', 'autumn'],
    queries: [
      ['misty forest', 'landscape', 4],
      ['mountain sunrise fog', 'landscape', 3],
      ['calm lake moody', 'landscape', 3],
      ['autumn forest path', 'portrait', 2],
    ],
  },
  city: {
    target: 8,
    keywords: ['city', 'urban', 'street', 'skyline', 'building', 'buildings', 'architecture', 'night', 'neon', 'cyberpunk', 'futuristic', 'downtown'],
    queries: [
      ['neon city night rain', 'landscape', 3],
      ['city skyline dusk', 'landscape', 3],
      ['futuristic architecture', 'portrait', 2],
    ],
  },
  animals: {
    target: 8,
    keywords: ['animal', 'animals', 'cat', 'cats', 'dog', 'fox', 'owl', 'bird', 'wildlife', 'pet', 'creature'],
    queries: [
      ['cat portrait close up', 'squarish', 3],
      ['fox wildlife portrait', 'landscape', 3],
      ['owl portrait', 'portrait', 2],
    ],
  },
  food: {
    target: 8,
    keywords: ['food', 'meal', 'dish', 'dessert', 'cake', 'cuisine', 'dinner', 'lunch', 'plate', 'gourmet', 'eat'],
    queries: [
      ['gourmet dish dark background', 'landscape', 4],
      ['dessert close up', 'squarish', 4],
    ],
  },
  abstract: {
    target: 8,
    keywords: ['abstract', 'art', 'artwork', 'gradient', 'neon', 'fluid', 'shapes', 'texture', '3d', 'pattern', 'digital', 'design'],
    queries: [
      ['abstract neon gradient', 'landscape', 3],
      ['fluid abstract art', 'squarish', 3],
      ['3D abstract shapes', 'portrait', 2],
    ],
  },
};

let remainingRequests = null;
let stopReason = '';
const previouslyMissingIds = new Set(['nah9QboY9FU', 'TW1JjPTiwjA']);
const downloadedNow = Object.fromEntries(Object.keys(categories).map((id) => [id, 0]));

function headers() {
  return { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` };
}

function updateRateLimit(response) {
  const value = response.headers.get('x-ratelimit-remaining');
  if (value !== null && value !== '') remainingRequests = Number.parseInt(value, 10);
}

function shouldStop(response) {
  updateRateLimit(response);
  if (response.status === 403 || response.status === 429) {
    stopReason = `${response.status} response received`;
    return true;
  }
  if (remainingRequests !== null && remainingRequests <= 2) {
    stopReason = `rate-limit remaining reached ${remainingRequests}`;
    return true;
  }
  return false;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { categories: [] };
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

function mergeLibrary(existingLibrary) {
  const existingCategories = new Map((existingLibrary.categories || []).map((category) => [category.id, category]));
  const categoriesList = Object.entries(categories).map(([id, definition]) => {
    const existing = existingCategories.get(id);
    return {
      id,
      keywords: existing?.keywords ?? definition.keywords,
      images: Array.isArray(existing?.images) ? existing.images : [],
      videos: Array.isArray(existing?.videos) ? existing.videos : [],
    };
  });
  const existingWoman = existingCategories.get('woman');
  if (existingWoman) {
    categoriesList.unshift({
      id: 'woman',
      keywords: existingWoman.keywords ?? ['woman', 'women', 'girl', 'lady', 'female', 'portrait', 'face', 'redhead', 'model', 'person', 'people', 'human'],
      images: Array.isArray(existingWoman.images) ? existingWoman.images : [],
      videos: Array.isArray(existingWoman.videos) ? existingWoman.videos : [],
    });
  }
  return { categories: categoriesList };
}

async function searchPhotos(query, orientation) {
  if (remainingRequests !== null && remainingRequests <= 2) return [];
  const params = new URLSearchParams({
    query,
    per_page: '30',
    orientation,
    order_by: 'relevant',
    content_filter: 'high',
  });
  const response = await fetch(`${API_BASE}/search/photos?${params}`, { headers: headers() });
  if (shouldStop(response)) return [];
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json())?.errors?.join(', ') || '';
    } catch {}
    throw new Error(`Unsplash search failed (${response.status}${detail ? `: ${detail}` : ''}).`);
  }
  const data = await response.json();
  return data.results || [];
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function downloadPhoto(photo, filePath) {
  const separator = photo.urls?.raw?.includes('?') ? '&' : '?';
  const response = await fetch(`${photo.urls.raw}${separator}w=1400&q=80&fm=jpg&fit=max`, { headers: headers() });
  updateRateLimit(response);
  if (response.status === 403 || response.status === 429) {
    stopReason = `${response.status} response received while downloading`;
    return false;
  }
  if (!response.ok) {
    throw new Error(`Image download failed for ${photo.id} (${response.status}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Image download for ${photo.id} returned no data.`);
  const temporaryPath = `${filePath}.download`;
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, filePath);
  return true;
}

async function trackDownload(photo) {
  if (!photo.links?.download_location) return;
  const response = await fetch(photo.links.download_location, { headers: headers() });
  if (shouldStop(response)) return false;
  if (!response.ok) throw new Error(`Download tracking failed for ${photo.id} (${response.status}).`);
  return true;
}

function orientationOf(photo) {
  const ratio = photo.width / photo.height;
  if (Math.abs(ratio - 1) <= 0.12) return 'squarish';
  return ratio > 1 ? 'landscape' : 'portrait';
}

function toLibraryImage(photo) {
  const width = 1400;
  const height = Math.max(1, Math.round((photo.height / photo.width) * width));
  return {
    id: photo.id,
    url: `/mock/${photo.categoryId}/${photo.id}.jpg`,
    width,
    height,
    orientation: orientationOf(photo),
    alt: photo.alt_description || photo.description || `${photo.categoryId} photograph`,
    photographer: photo.user?.name || 'Unknown photographer',
    photographerUrl: photo.user?.links?.html || '',
    sourceUrl: photo.links?.html || '',
  };
}

function printSummary(library, stopped) {
  console.log('\nCategory  Downloaded now  Total  Target');
  console.log('--------  ------------  -----  ------');
  for (const category of library.categories) {
    const target = categories[category.id]?.target ?? '-';
    console.log(`${category.id.padEnd(8)}  ${String(downloadedNow[category.id] ?? 0).padStart(12)}  ${String(category.images.length).padStart(5)}  ${String(target).padStart(6)}`);
  }
  if (stopped) console.log(`\nStopped: ${stopReason}. Re-run later to continue; completed work has been saved.`);
}

async function removeMissingLibraryImages(library) {
  for (const category of library.categories) {
    const existingImages = [];
    for (const image of category.images) {
      const fileName = image.url?.split('/').at(-1);
      if (!fileName) continue;
      const imagePath = path.join(MOCK_DIRECTORY, category.id, fileName);
      if (await fileExists(imagePath)) existingImages.push(image);
      else console.log(`[${category.id}] Removed missing library entry ${image.id}`);
    }
    category.images = existingImages;
  }
}

async function main() {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) {
    console.error('Missing UNSPLASH_ACCESS_KEY. Add it to .env.local, then run npm run fetch:mock.');
    process.exitCode = 1;
    return;
  }

  const existingLibrary = await readJson(MOCK_LIBRARY_PATH);
  const library = mergeLibrary(existingLibrary);
  await mkdir(MOCK_DIRECTORY, { recursive: true });
  await removeMissingLibraryImages(library);
  await writeFile(MOCK_LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`, 'utf8');

  for (const [categoryId, definition] of Object.entries(categories)) {
    const category = library.categories.find((entry) => entry.id === categoryId);
    let categoryGoalReached = false;
    console.log(`\n[${categoryId}] Target ${definition.target}; current ${category.images.length}`);

    if (category.images.length >= definition.target) {
      console.log(`[${categoryId}] Target already reached.`);
      continue;
    }

    const knownIds = new Set(category.images.map((image) => image.id));
    const querySeen = new Set();

    for (const [query, orientation, queryCount] of definition.queries) {
      if (stopReason || category.images.length >= definition.target) break;
      console.log(`[${categoryId}] Searching: "${query}" (${orientation})`);
      let photos;
      try {
        photos = await searchPhotos(query, orientation);
      } catch (error) {
        console.error(`[${categoryId}] ${error.message}`);
        throw error;
      }
      if (stopReason) break;

      let matched = 0;
      for (const photo of photos) {
        if (category.images.length >= definition.target) {
          categoryGoalReached = true;
          break;
        }
        if (querySeen.has(photo.id) || knownIds.has(photo.id) || previouslyMissingIds.has(photo.id)) continue;
        querySeen.add(photo.id);
        if (!photo.width || photo.width < 1000) continue;
        if (matched >= queryCount) continue;

        const categoryDirectory = path.join(MOCK_DIRECTORY, categoryId);
        await mkdir(categoryDirectory, { recursive: true });
        const destination = path.join(categoryDirectory, `${photo.id}.jpg`);
        let downloaded = false;
        let newlyDownloaded = false;

        try {
          if (await fileExists(destination)) {
            downloaded = true;
          } else {
            downloaded = await downloadPhoto(photo, destination);
            newlyDownloaded = downloaded;
          }
          if (!downloaded) break;
          const tracked = await trackDownload(photo);
          if (tracked === false) break;

          photo.categoryId = categoryId;
          category.images.push(toLibraryImage(photo));
          knownIds.add(photo.id);
          if (newlyDownloaded) downloadedNow[categoryId] += 1;
          matched += 1;
          await writeFile(MOCK_LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
          console.log(`[${categoryId}] ${category.images.length}/${definition.target} ${photo.id}`);
        } catch (error) {
          console.error(`[${categoryId}] Could not store ${photo.id}: ${error.message}`);
        }
      }
      if (stopReason || categoryGoalReached) break;
    }

    await writeFile(MOCK_LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
    if (stopReason) break;
  }

  await writeFile(MOCK_LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
  printSummary(library, Boolean(stopReason));
}

main().catch((error) => {
  console.error(`\nFetch stopped: ${error.message}`);
  process.exitCode = 1;
});
