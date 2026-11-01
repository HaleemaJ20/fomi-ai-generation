import families from '@/data/studio/families.json';
import { formatValue, matchWords } from './knobs.js';

const clampCount = (value, fallback = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(4, Math.max(1, Math.round(numeric)));
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `node-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const mulberry32 = (seed = 1) => {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleSeeded = (items, seed) => {
  const array = [...items];
  const random = mulberry32(seed);

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
};

const buildNode = ({ projectId, parent, knob, value, image, parentPrompt }) => {
  const nextKnobs = { ...(parent.knobs ?? {}) };
  const knobText = knob ? formatValue(value) : '';
  const prompt = knob ? `${parentPrompt}, ${knobText.toLowerCase()} ${knob}` : parentPrompt;

  if (knob) {
    nextKnobs[knob] = value;
  }

  return {
    id: createId(),
    projectId,
    parentId: parent.id,
    imageId: image.id,
    prompt,
    settings: {
      ...(parent.settings ?? {}),
      model: parent.settings?.model ?? 'Fomi Studio',
      ratio: parent.settings?.ratio ?? '1:1',
      seed: parent.settings?.seed ?? 1000,
    },
    knobs: nextKnobs,
    changedKnob: knob ? { knob, value } : null,
    notes: knob ? `Adjusted ${knob} to ${formatValue(value)}.` : '',
    modified: true,
    createdAt: new Date().toISOString(),
  };
};

const getProjectFamily = (familyId) => families.find((family) => family.id === familyId) ?? null;

export const generateForkNodes = ({
  projectId,
  familyId,
  parent,
  usedImageIds = [],
  knob,
  values = [],
  prompt,
  count = 1,
  seed = 1,
}) => {
  const family = getProjectFamily(familyId);

  if (!family) {
    throw new Error('Unknown family');
  }

  if (!parent || !parent.id || !parent.imageId || !parent.prompt) {
    throw new Error('Missing parent');
  }

  const usedSet = new Set((usedImageIds ?? []).filter(Boolean));
  const normalizedCount = clampCount(count, 1);
  const matchedKnobs = [];
  const skipped = [];
  const nodes = [];

  if (knob && Array.isArray(values) && values.length > 0) {
    for (const value of values) {
      const variant = family.images.find((image) => image.knob === knob && image.value === value);

      if (!variant) {
        skipped.push({ knob, value, reason: 'Value not available in this family.' });
        continue;
      }

      if (usedSet.has(variant.id)) {
        skipped.push({ knob, value, reason: 'Image already used in this project.' });
        continue;
      }

      if ((parent.knobs ?? {})[knob] === value) {
        skipped.push({ knob, value, reason: 'Value already active on the parent node.' });
        continue;
      }

      const forkNode = buildNode({
        projectId,
        parent,
        knob,
        value,
        image: variant,
        parentPrompt: parent.prompt,
      });

      nodes.push(forkNode);
      matchedKnobs.push({ knob, value });
      usedSet.add(variant.id);
    }

    return {
      nodes,
      matchedKnobs,
      skipped,
      hint: null,
      message: nodes.length > 0 ? null : 'No more variations in this sample project',
    };
  }

  if (typeof prompt === 'string' && prompt.trim() && !knob) {
    const recognized = matchWords(prompt, family);

    if (recognized.length > 0) {
      const firstMatch = recognized[0];
      const selectedImage = family.images.find(
        (image) => image.knob === firstMatch.knob && image.value === firstMatch.value,
      );

      if (selectedImage && !usedSet.has(selectedImage.id)) {
        const forkNode = buildNode({
          projectId,
          parent,
          knob: firstMatch.knob,
          value: firstMatch.value,
          image: selectedImage,
          parentPrompt: parent.prompt,
        });

        nodes.push(forkNode);
        matchedKnobs.push({ knob: firstMatch.knob, value: firstMatch.value, word: firstMatch.word });
        const uniqueKnobs = new Set(recognized.map((match) => match.knob));

        return {
          nodes,
          matchedKnobs,
          skipped,
          hint: null,
          message:
            uniqueKnobs.size > 1 ? `Several styles recognized, using ${firstMatch.knob}.` : null,
        };
      }
    }

    const availableImages = family.images.filter(
      (image) => image.id !== family.base.id && !usedSet.has(image.id),
    );

    if (availableImages.length === 0) {
      return {
        nodes: [],
        matchedKnobs: [],
        skipped,
        hint: null,
        message: 'No more variations in this sample project',
      };
    }

    const shuffled = shuffleSeeded(availableImages, seed || 1);
    const selected = shuffled.slice(0, Math.min(normalizedCount, shuffled.length));

    for (const image of selected) {
      const fallbackNode = {
        id: createId(),
        projectId,
        parentId: parent.id,
        imageId: image.id,
        prompt: parent.prompt,
        settings: {
          ...(parent.settings ?? {}),
          model: parent.settings?.model ?? 'Fomi Studio',
          ratio: parent.settings?.ratio ?? '1:1',
          seed: parent.settings?.seed ?? 1000,
        },
        knobs: { ...(parent.knobs ?? {}) },
        changedKnob: null,
        notes: '',
        modified: true,
        createdAt: new Date().toISOString(),
      };

      nodes.push(fallbackNode);
      usedSet.add(image.id);
    }

    return {
      nodes,
      matchedKnobs: [],
      skipped,
      hint: 'No style keywords recognized. Showing similar variations.',
      message: null,
    };
  }

  return {
    nodes: [],
    matchedKnobs,
    skipped,
    hint: null,
    message: 'No more variations in this sample project',
  };
};

export default generateForkNodes;
