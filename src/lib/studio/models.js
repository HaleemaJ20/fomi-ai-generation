/**
 * @typedef {Object} Node
 * @property {string} id
 * @property {string} projectId
 * @property {string|null} parentId
 * @property {string} imageId
 * @property {string} prompt
 * @property {{ model: string, ratio: string, seed: number }} settings
 * @property {Record<string, string>} knobs
 * @property {{ knob: string, value: string }|null} changedKnob
 * @property {string} notes
 * @property {boolean} modified
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} familyId
 * @property {string} rootNodeId
 * @property {string} currentNodeId
 * @property {string|null} promotedNodeId
 * @property {string} updatedAt
 * @property {Node[]} nodes
 */

export const ratioLabel = (width, height) => {
  const widthValue = Number(width);
  const heightValue = Number(height);
  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
    return `${widthValue} x ${heightValue}`;
  }

  if (widthValue === heightValue) {
    return '1:1';
  }

  const divisor = getGreatestCommonDivisor(widthValue, heightValue);
  const simplifiedWidth = widthValue / divisor;
  const simplifiedHeight = heightValue / divisor;

  if (simplifiedWidth <= 20 && simplifiedHeight <= 20) {
    return `${simplifiedWidth}:${simplifiedHeight}`;
  }

  const commonRatios = [
    { label: '1:1', value: 1 },
    { label: '4:5', value: 4 / 5 },
    { label: '5:4', value: 5 / 4 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '9:16', value: 9 / 16 },
    { label: '16:9', value: 16 / 9 },
  ];
  const aspectRatio = widthValue / heightValue;
  const nearestRatio = commonRatios.reduce((nearest, ratio) => {
    const difference = Math.abs(aspectRatio - ratio.value) / ratio.value;
    return difference < nearest.difference ? { ...ratio, difference } : nearest;
  }, { ...commonRatios[0], difference: Infinity });

  if (nearestRatio.difference <= 0.02) {
    return nearestRatio.label;
  }

  return `${widthValue} x ${heightValue}`;
};

const getGreatestCommonDivisor = (left, right) => {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
};

export const createNode = ({
  id,
  projectId,
  parentId = null,
  imageId,
  prompt,
  settings = {},
  knobs = {},
  changedKnob = null,
  notes = '',
  modified = false,
  createdAt,
}) => ({
  id,
  projectId,
  parentId,
  imageId,
  prompt,
  settings: {
    model: settings.model ?? 'Fomi Studio',
    ratio: settings.ratio ?? '1:1',
    seed: settings.seed ?? 0,
  },
  knobs: Object.entries(knobs).reduce((result, [key, value]) => {
    result[key] = value ?? 'original';
    return result;
  }, {}),
  changedKnob: changedKnob ? { ...changedKnob } : null,
  notes,
  modified: Boolean(modified),
  createdAt,
});

export const createProject = ({
  id,
  name,
  familyId,
  rootNodeId,
  currentNodeId,
  promotedNodeId = null,
  updatedAt,
  nodes = [],
}) => ({
  id,
  name,
  familyId,
  rootNodeId,
  currentNodeId,
  promotedNodeId,
  updatedAt,
  nodes,
});
