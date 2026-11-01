import { formatValue, getFamilyKnobs } from './knobs.js';
import { createNode, createProject, ratioLabel } from './models.js';

const getPreferredVariationOrder = (family) => {
  const knobMeta = getFamilyKnobs(family);
  const order = ['lighting', 'style', 'environment'];
  const preferred = [];
  const seen = new Set();

  for (const knob of order) {
    const knobInfo = knobMeta.find((entry) => entry.knob === knob);
    if (!knobInfo) {
      continue;
    }

    for (const stop of knobInfo.stops) {
      if (stop.value === 'original' || !stop.image) {
        continue;
      }

      if (!seen.has(stop.image.id)) {
        preferred.push(stop.image);
        seen.add(stop.image.id);
      }
    }
  }

  for (const knobInfo of knobMeta) {
    if (order.includes(knobInfo.knob)) {
      continue;
    }

    for (const stop of knobInfo.stops) {
      if (stop.value === 'original' || !stop.image) {
        continue;
      }

      if (!seen.has(stop.image.id)) {
        preferred.push(stop.image);
        seen.add(stop.image.id);
      }
    }
  }

  return preferred;
};

const buildKnobState = (family, image = null) => {
  const knobs = {};
  for (const entry of getFamilyKnobs(family)) {
    knobs[entry.knob] = 'original';
  }

  if (image && image.knob) {
    knobs[image.knob] = image.value;
  }

  return knobs;
};

const createTimestamp = (projectIndex, nodeOffset = 0) =>
  new Date(Date.UTC(2024, 0, 1 + projectIndex, 9 + nodeOffset, 15)).toISOString();

const describePrompt = (familyTitle, image) => {
  const valueLabel = formatValue(image.value);

  if (image.knob === 'lighting') {
    return `A ${familyTitle} scene in ${valueLabel.toLowerCase()} light`;
  }

  if (image.knob === 'style') {
    return `A ${familyTitle} scene with ${valueLabel} treatment`;
  }

  if (image.knob === 'environment') {
    return `A ${familyTitle} scene with ${valueLabel.toLowerCase()} conditions`;
  }

  return `A ${familyTitle} scene with ${valueLabel} detail`;
};

export const createSeedProjects = (families = []) => {
  const projects = [];

  for (const [projectIndex, family] of families.entries()) {
    const projectId = `seed-${family.id}-n${projectIndex}`;
    const rootCreatedAt = createTimestamp(projectIndex, 0);
    const rootKnobs = buildKnobState(family);
    const rootNode = createNode({
      id: `${projectId}-root`,
      projectId,
      parentId: null,
      imageId: family.base.id,
      prompt: `A ${family.title} scene in natural light`,
      settings: {
        model: 'Fomi Studio',
        ratio: ratioLabel(family.base.width, family.base.height),
        seed: 1000 + projectIndex,
      },
      knobs: rootKnobs,
      changedKnob: null,
      notes: 'Root composition generated from the original source image.',
      modified: false,
      createdAt: rootCreatedAt,
    });

    const project = createProject({
      id: projectId,
      name: `${family.title} Seed`,
      familyId: family.id,
      rootNodeId: rootNode.id,
      currentNodeId: rootNode.id,
      promotedNodeId: null,
      updatedAt: rootCreatedAt,
      nodes: [rootNode],
    });

    const preferredImages = getPreferredVariationOrder(family);
    const usedImageIds = new Set([family.base.id]);
    const children = [];

    for (const image of preferredImages) {
      if (children.length >= 3) {
        break;
      }

      if (usedImageIds.has(image.id)) {
        continue;
      }

      const childNode = createNode({
        id: `${projectId}-child-${children.length + 1}`,
        projectId,
        parentId: rootNode.id,
        imageId: image.id,
        prompt: describePrompt(family.title, image),
        settings: {
          model: 'Fomi Studio',
          ratio: ratioLabel(family.base.width, family.base.height),
          seed: 1000 + projectIndex,
        },
        knobs: buildKnobState(family, image),
        changedKnob: { knob: image.knob, value: image.value },
        notes: `Adjusted the ${image.knob} knob for a ${formatValue(image.value).toLowerCase()} treatment.`,
        modified: true,
        createdAt: createTimestamp(projectIndex, children.length + 1),
      });

      children.push(childNode);
      project.nodes.push(childNode);
      usedImageIds.add(image.id);
    }

    if (children[1]) {
      const secondChild = children[1];
      const usedInBranch = new Set([family.base.id, secondChild.imageId]);
      let grandchildCount = 0;

      for (const image of preferredImages) {
        if (grandchildCount >= 2) {
          break;
        }

        if (usedInBranch.has(image.id) || image.id === secondChild.imageId) {
          continue;
        }

        const grandchildNode = createNode({
          id: `${projectId}-grandchild-${grandchildCount + 1}`,
          projectId,
          parentId: secondChild.id,
          imageId: image.id,
          prompt: describePrompt(family.title, image),
          settings: {
            model: 'Fomi Studio',
            ratio: ratioLabel(family.base.width, family.base.height),
            seed: 1000 + projectIndex,
          },
          knobs: buildKnobState(family, image),
          changedKnob: { knob: image.knob, value: image.value },
          notes: `Extended the branch with a ${formatValue(image.value).toLowerCase()} ${image.knob} update.`,
          modified: true,
          createdAt: createTimestamp(projectIndex, 10 + grandchildCount),
        });

        project.nodes.push(grandchildNode);
        usedInBranch.add(image.id);
        grandchildCount += 1;
      }
    }

    if (children.length === 0) {
      project.currentNodeId = rootNode.id;
    } else {
      project.currentNodeId = children[0].id;
    }

    project.updatedAt = rootCreatedAt;
    projects.push(project);
  }

  return projects;
};

export default createSeedProjects;
