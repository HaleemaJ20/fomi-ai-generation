import families from '@/data/studio/families.json';
import { createSeedProjects } from './seed.js';

export const STUDIO_STORAGE_KEY = 'fomi-studio:v1';
const familyIndex = new Map(families.map((family) => [family.id, family]));

const isImageKnown = (imageId) => {
  if (!imageId) {
    return false;
  }

  return families.some((family) => {
    if (family.base?.id === imageId) {
      return true;
    }

    return family.images.some((image) => image.id === imageId);
  });
};

export const normalizeProjects = (projects) => {
  if (!Array.isArray(projects) || projects.length === 0) {
    return createSeedProjects(families);
  }

  const validProjects = [];

  for (const project of projects) {
    const family = familyIndex.get(project.familyId);
    if (!family) {
      continue;
    }

    const validNodes = Array.isArray(project.nodes)
      ? project.nodes.filter((node) => node && isImageKnown(node.imageId))
      : [];

    if (!validNodes.length) {
      continue;
    }

    const rootNode = validNodes.find((node) => node.id === project.rootNodeId) ?? validNodes[0];
    if (!rootNode) {
      continue;
    }

    validProjects.push({
      ...project,
      rootNodeId: rootNode.id,
      currentNodeId: validNodes.some((node) => node.id === project.currentNodeId) ? project.currentNodeId : rootNode.id,
      promotedNodeId: project.promotedNodeId && validNodes.some((node) => node.id === project.promotedNodeId) ? project.promotedNodeId : null,
      nodes: validNodes,
      updatedAt: project.updatedAt ?? new Date().toISOString(),
    });
  }

  return validProjects.length ? validProjects : createSeedProjects(families);
};

export const getInitialStudioProjects = () => createSeedProjects(families);

export const readStudioProjects = () => {
  if (typeof window === 'undefined') {
    return getInitialStudioProjects();
  }

  try {
    const stored = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!stored) {
      return getInitialStudioProjects();
    }

    const parsed = JSON.parse(stored);
    if (!parsed || parsed.version !== 1) {
      return getInitialStudioProjects();
    }

    return normalizeProjects(parsed.projects ?? []);
  } catch {
    return getInitialStudioProjects();
  }
};

export const writeStudioProjects = (projects) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeProjects(projects);
  const payload = { version: 1, projects: normalized };
  window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(payload));
};

export const resetStudioProjects = () => {
  const seedProjects = createSeedProjects(families);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify({ version: 1, projects: seedProjects }));
  }

  return seedProjects;
};

const studioStorageApi = {
  STUDIO_STORAGE_KEY,
  normalizeProjects,
  getInitialStudioProjects,
  readStudioProjects,
  writeStudioProjects,
  resetStudioProjects,
};

export default studioStorageApi;
