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
  if (!width || !height) {
    return '0x0';
  }

  const widthValue = Number(width);
  const heightValue = Number(height);
  const divisor = getGreatestCommonDivisor(widthValue, heightValue);
  const simplifiedWidth = widthValue / divisor;
  const simplifiedHeight = heightValue / divisor;

  if (simplifiedWidth === 4 && simplifiedHeight === 5) {
    return '4:5';
  }

  if (simplifiedWidth === 3 && simplifiedHeight === 2) {
    return '3:2';
  }

  return `${widthValue}x${heightValue}`;
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
