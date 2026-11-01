import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const studioRoot = path.join(process.cwd(), 'public', 'mock', 'studio');
const outputFile = path.join(process.cwd(), 'src', 'data', 'studio', 'families.json');
const supportedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

const titleCase = (value) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const parseFileStem = (fileStem) => {
  if (fileStem === 'base') {
    return { knob: null, value: null };
  }

  const hyphenIndex = fileStem.indexOf('-');
  if (hyphenIndex <= 0 || hyphenIndex === fileStem.length - 1) {
    return null;
  }

  const knob = fileStem.slice(0, hyphenIndex);
  const value = fileStem.slice(hyphenIndex + 1);

  return { knob, value };
};

const getImageDimensions = async (filePath) => {
  const metadata = await sharp(filePath).metadata();
  let width = metadata.width ?? 0;
  let height = metadata.height ?? 0;

  if ([5, 6, 7, 8].includes(metadata.orientation ?? 0)) {
    [width, height] = [height, width];
  }

  return { width, height };
};

const families = [];

try {
  const familyEntries = await fs.readdir(studioRoot, { withFileTypes: true });

  for (const entry of familyEntries
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort((left, right) => left.localeCompare(right))) {
    const familyDirectory = path.join(studioRoot, entry);
    const files = (await fs.readdir(familyDirectory))
      .filter((fileName) => supportedExtensions.has(path.extname(fileName).slice(1).toLowerCase()))
      .sort((left, right) => left.localeCompare(right));

    let baseImage = null;
    const images = [];

    for (const fileName of files) {
      const fileStem = path.parse(fileName).name;
      const filePath = path.join(familyDirectory, fileName);

      if (fileStem === 'base') {
        const { width, height } = await getImageDimensions(filePath);
        baseImage = {
          id: `${entry}:base`,
          url: `/mock/studio/${entry}/${fileName}`,
          width,
          height,
          knob: null,
          value: null,
        };
        continue;
      }

      const parsed = parseFileStem(fileStem);
      if (!parsed) {
        console.warn(`Warning: Skipping unsupported file name "${path.join(entry, fileName)}".`);
        continue;
      }

      const { width, height } = await getImageDimensions(filePath);
      images.push({
        id: `${entry}:${fileStem}`,
        url: `/mock/studio/${entry}/${fileName}`,
        width,
        height,
        knob: parsed.knob,
        value: parsed.value,
      });
    }

    if (!baseImage) {
      console.warn(`Warning: Skipping family "${entry}" because it has no base image.`);
      continue;
    }

    const dimensions = new Set(
      [baseImage.width, ...images.map((image) => image.width)]
        .map((width) => `${width}x${baseImage.height}`)
        .concat(images.map((image) => `${image.width}x${image.height}`))
    );

    if (dimensions.size > 1) {
      console.warn(`Warning: Family "${entry}" does not use a consistent image size across all variants.`);
    }

    families.push({
      id: entry,
      title: titleCase(entry),
      base: baseImage,
      images: images.sort((left, right) => left.id.localeCompare(right.id)),
    });
  }
} catch (error) {
  console.error('Failed to build studio families.', error);
  process.exitCode = 1;
}

if (process.exitCode) {
  process.exit();
}

families.sort((left, right) => left.id.localeCompare(right.id));

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(families, null, 2)}\n`, 'utf8');

console.log('\nStudio family summary');
console.log(`${'Family'.padEnd(12)} ${'# images'.padStart(8)} ${'Knobs and values'}`);
for (const family of families) {
  const knobMap = new Map();

  for (const image of family.images) {
    const values = knobMap.get(image.knob) ?? [];
    values.push(image.value);
    knobMap.set(image.knob, values);
  }

  const summary = Array.from(knobMap.entries())
    .sort(([leftKnob], [rightKnob]) => leftKnob.localeCompare(rightKnob))
    .map(([knob, values]) => `${knob}: ${[...new Set(values)].sort((left, right) => left.localeCompare(right)).join(', ')}`)
    .join(' | ');

  console.log(`${family.id.padEnd(12)} ${String(family.images.length).padStart(8)} ${summary || 'none'}`);
}

console.log(`\nWrote ${families.length} families to ${path.relative(process.cwd(), outputFile)}`);
