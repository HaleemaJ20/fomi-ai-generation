// Usage: npm run build:videos
import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const RAW_DIRECTORY = path.join(ROOT, 'raw-videos');
const VIDEO_DIRECTORY = path.join(ROOT, 'public/mock/videos');
const LIBRARY_PATH = path.join(ROOT, 'src/data/mockLibrary.json');
const MAX_DURATION_SECONDS = 10;
const WARNING_SIZE_BYTES = 3 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm']);
const FORCE = process.argv.includes('--force');
const processedNow = {};
const problems = [];

async function commandAvailable(command) {
  try {
    await execFileAsync(command, ['-version'], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function normalizeCategoryName(value) {
  return String(value || '').trim().toLowerCase();
}

function toSlug(filename) {
  let stem = path.basename(filename);
  for (const extension of [...VIDEO_EXTENSIONS]) {
    if (stem.toLowerCase().endsWith(extension)) {
      stem = stem.slice(0, -extension.length);
      break;
    }
  }
  return stem
    .normalize('NFKD')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function sanitizeSourceName(filename) {
  let stem = path.basename(filename);
  for (const extension of [...VIDEO_EXTENSIONS]) {
    if (stem.toLowerCase().endsWith(extension)) {
      stem = stem.slice(0, -extension.length);
      break;
    }
  }
  stem = stem.replace(/\.(tmp|bak|orig)$/i, '');
  return stem
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listVideoFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function probe(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=width,height',
    '-of', 'json',
    filePath,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });

  const payload = JSON.parse(stdout);
  const stream = payload.streams?.find((entry) => Number(entry.width) > 0 && Number(entry.height) > 0) || payload.streams?.[0] || {};
  return {
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    duration: Number(payload.format?.duration) || 0,
  };
}

function orientationOf(width, height) {
  if (!width || !height) return 'squarish';
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= 0.08) return 'squarish';
  return ratio > 1 ? 'landscape' : 'portrait';
}

function scaleFilter(width, height) {
  if (!width || !height) return 'scale=-2:720';
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= 0.08) return 'scale=720:720';
  return ratio > 1 ? 'scale=-2:720' : 'scale=720:-2';
}

async function buildClip(rawPath, categoryId, slug) {
  const metadata = await probe(rawPath);
  const categoryDirectory = path.join(VIDEO_DIRECTORY, categoryId);
  await mkdir(categoryDirectory, { recursive: true });

  const outputPath = path.join(categoryDirectory, `${slug}.mp4`);
  const posterPath = path.join(categoryDirectory, `${slug}-poster.jpg`);
  const temporaryOutput = `${outputPath}.tmp.mp4`;
  const temporaryPoster = `${posterPath}.tmp.jpg`;
  const croppedDuration = Math.min(metadata.duration || 0, MAX_DURATION_SECONDS);
  const posterTime = metadata.duration < 2 ? metadata.duration / 2 : 1;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', rawPath,
    '-t', croppedDuration.toFixed(3),
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '28',
    '-preset', 'slow',
    '-vf', scaleFilter(metadata.width, metadata.height),
    '-movflags', '+faststart',
    temporaryOutput,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
  await rename(temporaryOutput, outputPath);

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', rawPath,
    '-ss', Math.min(posterTime, metadata.duration || 0).toFixed(3),
    '-frames:v', '1',
    '-vf', 'scale=1280:-2',
    '-q:v', '3',
    temporaryPoster,
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
  await rename(temporaryPoster, posterPath);

  return { outputPath, posterPath };
}

async function normalizeVideoFolders(library) {
  const categoryMap = new Map(library.categories.map((category) => [normalizeCategoryName(category.id), category.id]));
  await mkdir(VIDEO_DIRECTORY, { recursive: true });
  await mkdir(RAW_DIRECTORY, { recursive: true });
  const entries = await readdir(VIDEO_DIRECTORY, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const normalized = normalizeCategoryName(entry.name);
    const canonical = categoryMap.get(normalized);
    if (!canonical) {
      console.warn(`[warning] Unknown video category folder "${entry.name}" was left alone.`);
      problems.push(`unknown-folder:${entry.name}`);
      continue;
    }
    if (normalized !== canonical.toLowerCase()) {
      const from = path.join(VIDEO_DIRECTORY, entry.name);
      const to = path.join(VIDEO_DIRECTORY, canonical);
      if (!(await pathExists(to))) {
        await rename(from, to);
        console.log(`[normalize] Renamed video folder "${entry.name}" to "${canonical}".`);
      } else {
        console.warn(`[warning] Folder "${entry.name}" did not match category id and could not be renamed because "${canonical}" already exists.`);
      }
    }
  }

  const rawEntries = await readdir(RAW_DIRECTORY, { withFileTypes: true }).catch(() => []);
  for (const entry of rawEntries) {
    if (!entry.isDirectory()) continue;
    const normalized = normalizeCategoryName(entry.name);
    const canonical = categoryMap.get(normalized);
    if (!canonical) {
      console.warn(`[warning] Unknown raw category folder "${entry.name}" was left alone.`);
      problems.push(`unknown-raw-folder:${entry.name}`);
      continue;
    }
    if (normalized !== canonical.toLowerCase()) {
      const from = path.join(RAW_DIRECTORY, entry.name);
      const to = path.join(RAW_DIRECTORY, canonical);
      if (!(await pathExists(to))) {
        await rename(from, to);
        console.log(`[normalize] Renamed raw folder "${entry.name}" to "${canonical}".`);
      }
    }
  }
}

async function stageRawVideos(categoryId) {
  const categoryDirectory = path.join(VIDEO_DIRECTORY, categoryId);
  const rawDirectory = path.join(RAW_DIRECTORY, categoryId);
  await mkdir(rawDirectory, { recursive: true });

  const directFiles = await listVideoFiles(categoryDirectory);
  for (const fileName of directFiles) {
    const sourcePath = path.join(categoryDirectory, fileName);
    const rawStem = sanitizeSourceName(fileName).replace(/\.tmp$/i, '');
    const rawFileName = `${rawStem}${path.extname(fileName).toLowerCase()}`;
    const targetPath = path.join(rawDirectory, rawFileName);
    const posterPath = path.join(categoryDirectory, `${path.parse(fileName).name.replace(/\.tmp$/i, '')}-poster.jpg`);

    if (FORCE || !(await pathExists(posterPath))) {
      if (await pathExists(targetPath)) {
        await unlink(targetPath);
      }
      await rename(sourcePath, targetPath);
      console.log(`[${categoryId}] Moved raw video from public to raw-videos: ${fileName}`);
    }
  }
}

async function resolveSources(categoryId) {
  const sourceDirectory = path.join(RAW_DIRECTORY, categoryId);
  const sourceFiles = await listVideoFiles(sourceDirectory);
  const categoryDirectory = path.join(VIDEO_DIRECTORY, categoryId);
  await mkdir(categoryDirectory, { recursive: true });

  const resolved = [];
  for (const fileName of sourceFiles) {
    if (fileName.includes('.mp4.mp4')) {
      await unlink(path.join(sourceDirectory, fileName));
      console.warn(`[${categoryId}] Removed broken artifact ${fileName}`);
      continue;
    }
    const sourcePath = path.join(sourceDirectory, fileName);
    const slug = toSlug(fileName);
    const outputPath = path.join(categoryDirectory, `${slug}.mp4`);
    const posterPath = path.join(categoryDirectory, `${slug}-poster.jpg`);

    if (FORCE || !(await pathExists(outputPath)) || !(await pathExists(posterPath))) {
      resolved.push({ sourcePath, slug, fileName, outputPath, posterPath });
    }
  }

  return resolved;
}

async function rebuildLibrary(library) {
  for (const category of library.categories) {
    const directory = path.join(VIDEO_DIRECTORY, category.id);
    const videos = [];

    try {
      const files = await readdir(directory);
      const posterFiles = new Set(files.filter((file) => file.endsWith('-poster.jpg')));
      const mp4Files = files.filter((file) => path.extname(file).toLowerCase() === '.mp4' && !file.includes('.tmp.'));

      for (const file of mp4Files.sort()) {
        const slug = path.parse(file).name;
        const poster = `${slug}-poster.jpg`;
        if (!posterFiles.has(poster)) {
          problems.push(`${category.id}:${file}:missing-poster`);
          continue;
        }

        const outputPath = path.join(directory, file);
        const next = await probe(outputPath);
        videos.push({
          id: `${category.id}-${slug}`,
          url: `/mock/videos/${category.id}/${file}`,
          poster: `/mock/videos/${category.id}/${poster}`,
          width: next.width,
          height: next.height,
          orientation: orientationOf(next.width, next.height),
          duration: Number((next.duration || 0).toFixed(1)),
          source: 'stock video',
        });
      }

      category.videos = videos.filter((video) => video.url && video.poster);
    } catch {
      category.videos = [];
    }
  }

  await writeFile(LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function printSummary(library) {
  console.log('\nCategory  Clips processed now  Total clips  Total size');
  console.log('--------  -------------------  -----------  ----------');

  for (const category of library.categories) {
    const directory = path.join(VIDEO_DIRECTORY, category.id);
    let totalBytes = 0;
    try {
      const files = await readdir(directory);
      for (const file of files) {
        if (file.endsWith('.mp4') || file.endsWith('-poster.jpg')) {
          totalBytes += (await stat(path.join(directory, file))).size;
        }
      }
    } catch {}
    console.log(`${category.id.padEnd(8)}  ${String(processedNow[category.id] || 0).padStart(19)}  ${String(category.videos?.length || 0).padStart(11)}  ${formatBytes(totalBytes).padStart(10)}`);
  }

  if (problems.length) {
    console.log('\nProblems:');
    for (const entry of problems) {
      console.log(` - ${entry}`);
    }
  }
}

async function main() {
  if (!await commandAvailable('ffmpeg') || !await commandAvailable('ffprobe')) {
    console.error('ffmpeg and ffprobe are required. Install ffmpeg and make sure both commands are available in PATH.');
    process.exitCode = 1;
    return;
  }

  const library = JSON.parse(await readFile(LIBRARY_PATH, 'utf8'));
  const categories = library.categories || [];
  const categoryMap = new Map(categories.map((category) => [normalizeCategoryName(category.id), category.id]));

  await normalizeVideoFolders(library);

  for (const category of categories) {
    const categoryId = category.id;
    processedNow[categoryId] = 0;
    await stageRawVideos(categoryId);
    const sources = await resolveSources(categoryId);

    for (const source of sources) {
      console.log(`[${categoryId}] Processing ${source.fileName}`);
      const result = await buildClip(source.sourcePath, categoryId, source.slug);
      processedNow[categoryId] += 1;

      const outputSize = (await stat(result.outputPath)).size;
      if (outputSize > WARNING_SIZE_BYTES) {
        console.warn(`[warning] ${result.outputPath} is ${formatBytes(outputSize)}, larger than 3 MB.`);
      }
    }
  }

  for (const categoryId of [...categoryMap.keys()].map((key) => categoryMap.get(key))) {
    const directory = path.join(VIDEO_DIRECTORY, categoryId);
    if (!(await pathExists(directory))) {
      problems.push(`${categoryId}:missing-video-folder`);
    }
  }

  await rebuildLibrary(library);
  await printSummary(library);
}

main().catch((error) => {
  console.error(`Video asset build failed: ${error.message}`);
  process.exitCode = 1;
});
