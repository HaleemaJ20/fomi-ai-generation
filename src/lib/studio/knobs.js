export const KNOB_META = {
  lighting: {
    label: 'Lighting',
    description: 'Sets the scene mood and time of day.',
    order: ['sunset', 'moonlight'],
  },
  style: {
    label: 'Style',
    description: 'Transforms the image with an artistic finish.',
    order: ['watercolor', 'oil-painting', 'monochrome', 'surrealism', 'infrared'],
  },
  environment: {
    label: 'Environment',
    description: 'Adds the surrounding weather or setting.',
    order: ['snow'],
  },
};

export const SYNONYMS = {
  sunset: 'lighting:sunset',
  sunlight: 'lighting:sunset',
  golden: 'lighting:sunset',
  warm: 'lighting:sunset',
  moon: 'lighting:moonlight',
  moonlight: 'lighting:moonlight',
  moonlit: 'lighting:moonlight',
  night: 'lighting:moonlight',
  dark: 'lighting:moonlight',
  watercolor: 'style:watercolor',
  watercolour: 'style:watercolor',
  aquarelle: 'style:watercolor',
  oil: 'style:oil-painting',
  painterly: 'style:oil-painting',
  monochrome: 'style:monochrome',
  bw: 'style:monochrome',
  noir: 'style:monochrome',
  grayscale: 'style:monochrome',
  greyscale: 'style:monochrome',
  surreal: 'style:surrealism',
  surrealism: 'style:surrealism',
  dreamlike: 'style:surrealism',
  infrared: 'style:infrared',
  ir: 'style:infrared',
  snow: 'environment:snow',
  snowy: 'environment:snow',
  winter: 'environment:snow',
  frost: 'environment:snow',
  frozen: 'environment:snow',
};

export const formatValue = (value = '') => {
  if (!value) {
    return 'Original';
  }

  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getPreferredKnobOrder = (family) => {
  const knobEntries = getFamilyKnobs(family);
  const preferredOrder = ['lighting', 'style', 'environment'];
  const seen = new Set();
  const ordered = [];

  for (const knob of preferredOrder) {
    if (knobEntries.some((entry) => entry.knob === knob)) {
      ordered.push(knob);
      seen.add(knob);
    }
  }

  for (const entry of knobEntries) {
    if (!seen.has(entry.knob)) {
      ordered.push(entry.knob);
    }
  }

  return ordered;
};

export const getFamilyKnobs = (family) => {
  if (!family) {
    return [];
  }

  const imageMap = new Map();
  for (const image of family.images ?? []) {
    if (!image || !image.knob) {
      continue;
    }

    const values = imageMap.get(image.knob) ?? [];
    values.push(image);
    imageMap.set(image.knob, values);
  }

  const knownKnobs = [...Object.keys(KNOB_META), ...Array.from(imageMap.keys())];
  const uniqueKnobs = [...new Set(knownKnobs)];
  const orderedKnobs = uniqueKnobs.sort((left, right) => {
    const leftIndex = left in KNOB_META ? Object.keys(KNOB_META).indexOf(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = right in KNOB_META ? Object.keys(KNOB_META).indexOf(right) : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });

  return orderedKnobs
    .filter((knob) => imageMap.has(knob))
    .map((knob) => {
      const knobImages = imageMap.get(knob) ?? [];
      const values = [...new Set(knobImages.map((image) => image.value).filter(Boolean))];
      const knownOrder = KNOB_META[knob]?.order ?? [];
      const orderedValues = [
        ...knownOrder.filter((value) => values.includes(value)),
        ...values.filter((value) => !knownOrder.includes(value)).sort((left, right) => left.localeCompare(right)),
      ];

      const stops = [{ value: 'original', label: 'Original', image: family.base }];
      for (const value of orderedValues) {
        const variant = knobImages.find((image) => image.value === value);
        stops.push({ value, label: formatValue(value), image: variant ?? null });
      }

      return {
        knob,
        label: KNOB_META[knob]?.label ?? formatValue(knob),
        description: KNOB_META[knob]?.description ?? `${formatValue(knob)} variation.`,
        stops,
      };
    })
    .filter((entry) => entry.stops.length > 1);
};

export const getKnownKnobOrder = (family) => getPreferredKnobOrder(family);

export const getStopImage = (family, knob, value) => {
  if (!family) {
    return null;
  }

  if (value === 'original' || value == null) {
    return family.base ?? null;
  }

  return family.images.find((image) => image.knob === knob && image.value === value) ?? family.base ?? null;
};

export const findImage = (family, imageId) => {
  if (!family) {
    return null;
  }

  if (family.base?.id === imageId) {
    return family.base;
  }

  return family.images.find((image) => image.id === imageId) ?? null;
};

export const matchWords = (text = '', family) => {
  if (!text || !family) {
    return [];
  }

  const familyValues = new Set((family.images ?? []).map((image) => `${image.knob}:${image.value}`));
  const matches = [];
  const seen = new Set();
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];

  for (const word of words) {
    const match = SYNONYMS[word];
    if (!match) {
      continue;
    }

    const [knob, value] = match.split(':');
    const lookupKey = `${knob}:${value}`;
    if (!familyValues.has(lookupKey)) {
      continue;
    }

    const token = `${knob}:${value}:${word}`;
    if (seen.has(token)) {
      continue;
    }

    seen.add(token);
    matches.push({ knob, value, word });
  }

  return matches;
};
