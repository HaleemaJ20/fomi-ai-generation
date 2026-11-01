import { createProject } from './models.js';
import { createSeedProjects } from './seed.js';
import families from '@/data/studio/families.json';

const makeId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const cloneProjectWithNewIds = (project) => {
  const nextProjectId = makeId('project');
  const ids = new Map();
  const clonedNodes = project.nodes.map((node) => {
    const nextNodeId = makeId('node');
    ids.set(node.id, nextNodeId);
    return {
      ...node,
      id: nextNodeId,
      projectId: nextProjectId,
      parentId: node.parentId ? ids.get(node.parentId) ?? null : null,
    };
  });

  const rootNodeId = ids.get(project.rootNodeId) ?? clonedNodes[0]?.id ?? null;

  return createProject({
    id: nextProjectId,
    name: `${project.name} Copy`,
    familyId: project.familyId,
    rootNodeId,
    currentNodeId: ids.get(project.currentNodeId) ?? rootNodeId,
    promotedNodeId: project.promotedNodeId ? ids.get(project.promotedNodeId) ?? null : null,
    updatedAt: new Date().toISOString(),
    nodes: clonedNodes,
  });
};

const withHistory = (state, nextState) => ({
  ...nextState,
  history: {
    past: [...(state.history?.past ?? []), { projects: state.projects, activeProjectId: state.activeProjectId }].slice(-30),
    future: [],
  },
});

const ensureProjectNode = (project, nodeId) => {
  if (!project) {
    return null;
  }

  return project.nodes.find((node) => node.id === nodeId) ?? null;
};

const removeSubtree = (project, nodeId) => {
  const subtree = new Set();
  const queue = [nodeId];

  while (queue.length) {
    const current = queue.shift();
    if (!current || subtree.has(current)) {
      continue;
    }

    subtree.add(current);
    const children = project.nodes.filter((node) => node.parentId === current);
    queue.push(...children.map((child) => child.id));
  }

  const remainingNodes = project.nodes.filter((node) => !subtree.has(node.id));
  const nextProject = {
    ...project,
    nodes: remainingNodes,
    updatedAt: new Date().toISOString(),
  };

  if (nextProject.rootNodeId && !remainingNodes.some((node) => node.id === nextProject.rootNodeId)) {
    nextProject.rootNodeId = remainingNodes[0]?.id ?? null;
  }

  if (nextProject.currentNodeId && !remainingNodes.some((node) => node.id === nextProject.currentNodeId)) {
    nextProject.currentNodeId = remainingNodes[0]?.id ?? nextProject.rootNodeId;
  }

  return nextProject;
};

export const makeInitialStudioState = (seedProjects = createSeedProjects(families)) => ({
  projects: seedProjects,
  activeProjectId: seedProjects[0]?.id ?? null,
  armedKnob: null,
  compare: null,
  panels: { inspectorOpen: true, lineageHeight: 280, sheet: 'lineage' },
  saveStatus: 'saved',
  toast: null,
  history: { past: [], future: [] },
});

export const studioReducer = (state = makeInitialStudioState(), action = {}) => {
  switch (action.type) {
    case 'HYDRATE': {
      const nextProjects = Array.isArray(action.payload) && action.payload.length ? action.payload : state.projects;
      return {
        ...state,
        projects: nextProjects,
        activeProjectId: nextProjects[0]?.id ?? null,
        saveStatus: 'saved',
        toast: null,
      };
    }
    case 'SAVE_START':
      return { ...state, saveStatus: 'saving' };
    case 'SAVE_SUCCESS':
      return { ...state, saveStatus: 'saved', toast: null };
    case 'SAVE_ERROR':
      return { ...state, saveStatus: 'error', toast: action.payload ?? 'Unable to save Studio project data.' };
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'SELECT_NODE': {
      const project = state.projects.find((entry) => entry.id === action.payload.projectId);
      if (!project) {
        return state;
      }

      const selectedNode = ensureProjectNode(project, action.payload.nodeId);
      if (!selectedNode) {
        return state;
      }

      return {
        ...state,
        activeProjectId: project.id,
        projects: state.projects.map((entry) =>
          entry.id === project.id ? { ...entry, currentNodeId: selectedNode.id, updatedAt: new Date().toISOString() } : entry,
        ),
      };
    }
    case 'CREATE_PROJECT': {
      const nextProject = action.payload;
      if (!nextProject || !nextProject.id) {
        return state;
      }

      const draft = {
        ...state,
        projects: [...state.projects, nextProject],
        activeProjectId: nextProject.id,
        history: {
          past: [...(state.history?.past ?? []), { projects: state.projects, activeProjectId: state.activeProjectId }].slice(-30),
          future: [],
        },
      };

      return draft;
    }
    case 'RENAME_PROJECT': {
      const { projectId, name } = action.payload;
      return withHistory(state, {
        ...state,
        projects: state.projects.map((project) =>
          project.id === projectId ? { ...project, name, updatedAt: new Date().toISOString() } : project,
        ),
      });
    }
    case 'DUPLICATE_PROJECT': {
      const project = state.projects.find((entry) => entry.id === action.payload.projectId);
      if (!project) {
        return state;
      }

      const duplicate = cloneProjectWithNewIds(project);
      return withHistory(state, {
        ...state,
        projects: [...state.projects, duplicate],
        activeProjectId: duplicate.id,
      });
    }
    case 'DELETE_PROJECT': {
      const remainingProjects = state.projects.filter((project) => project.id !== action.payload.projectId);
      if (remainingProjects.length === state.projects.length) {
        return state;
      }

      return withHistory(state, {
        ...state,
        projects: remainingProjects,
        activeProjectId: remainingProjects[0]?.id ?? null,
      });
    }
    case 'ADD_FORKED_NODES': {
      const { projectId, nodes } = action.payload;
      const project = state.projects.find((entry) => entry.id === projectId);
      if (!project || !Array.isArray(nodes) || nodes.length === 0) {
        return state;
      }

      const nextProject = {
        ...project,
        nodes: [...project.nodes, ...nodes],
        currentNodeId: nodes[0]?.id ?? project.currentNodeId,
        updatedAt: new Date().toISOString(),
      };

      return withHistory(state, {
        ...state,
        projects: state.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        activeProjectId: projectId,
      });
    }
    case 'DELETE_NODE': {
      const { projectId, nodeId } = action.payload;
      const project = state.projects.find((entry) => entry.id === projectId);
      if (!project) {
        return state;
      }

      const nextProject = removeSubtree(project, nodeId);
      return withHistory(state, {
        ...state,
        projects: state.projects.map((entry) => (entry.id === projectId ? nextProject : entry)),
        activeProjectId: projectId,
      });
    }
    case 'EDIT_PROMPT': {
      const { projectId, nodeId, prompt } = action.payload;
      return {
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            nodes: project.nodes.map((node) =>
              node.id === nodeId ? { ...node, prompt, modified: true, notes: node.notes ?? '' } : node,
            ),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case 'EDIT_SETTINGS': {
      const { projectId, nodeId, settings } = action.payload;
      return {
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            nodes: project.nodes.map((node) =>
              node.id === nodeId ? { ...node, settings: { ...node.settings, ...(settings ?? {}) }, modified: true } : node,
            ),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case 'EDIT_NOTES': {
      const { projectId, nodeId, notes } = action.payload;
      return {
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            nodes: project.nodes.map((node) => (node.id === nodeId ? { ...node, notes } : node)),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case 'MARK_MODIFIED': {
      const { projectId, nodeId, value = true } = action.payload;
      return {
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            nodes: project.nodes.map((node) => (node.id === nodeId ? { ...node, modified: Boolean(value) } : node)),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case 'REVERT_NODE': {
      const { projectId, nodeId, snapshot } = action.payload;
      return {
        ...state,
        projects: state.projects.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            nodes: project.nodes.map((node) => (node.id === nodeId ? { ...node, ...snapshot } : node)),
            updatedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case 'PROMOTE': {
      const { projectId, nodeId } = action.payload;
      return withHistory(state, {
        ...state,
        projects: state.projects.map((project) =>
          project.id === projectId ? { ...project, promotedNodeId: nodeId, updatedAt: new Date().toISOString() } : project,
        ),
      });
    }
    case 'ARM_KNOB':
      return { ...state, armedKnob: action.payload ?? null };
    case 'CLEAR_KNOB':
      return { ...state, armedKnob: null };
    case 'OPEN_COMPARE':
      return { ...state, compare: action.payload ?? { aId: null, bId: null, mode: 'side-by-side' } };
    case 'CLOSE_COMPARE':
      return { ...state, compare: null };
    case 'TOGGLE_PANEL':
      return {
        ...state,
        panels: {
          ...state.panels,
          ...action.payload,
        },
      };
    case 'RESET_SAMPLE_PROJECTS': {
      const seed = createSeedProjects(families);
      const nextState = {
        ...state,
        projects: seed,
        activeProjectId: seed[0]?.id ?? null,
        armedKnob: null,
        compare: null,
        panels: { inspectorOpen: true, lineageHeight: 280, sheet: 'lineage' },
        toast: 'Sample projects reset.',
        history: { past: [], future: [] },
      };

      return withHistory(state, nextState);
    }
    case 'UNDO': {
      if (!state.history?.past?.length) {
        return state;
      }

      const previous = state.history.past[state.history.past.length - 1];
      return {
        ...state,
        projects: previous.projects,
        activeProjectId: previous.activeProjectId,
        history: {
          past: state.history.past.slice(0, -1),
          future: [{ projects: state.projects, activeProjectId: state.activeProjectId }, ...(state.history?.future ?? [])].slice(0, 30),
        },
      };
    }
    case 'REDO': {
      if (!state.history?.future?.length) {
        return state;
      }

      const next = state.history.future[0];
      return {
        ...state,
        projects: next.projects,
        activeProjectId: next.activeProjectId,
        history: {
          past: [...(state.history?.past ?? []), { projects: state.projects, activeProjectId: state.activeProjectId }].slice(-30),
          future: state.history.future.slice(1),
        },
      };
    }
    default:
      return state;
  }
};

export default studioReducer;
