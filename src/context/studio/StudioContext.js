'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import families from '@/data/studio/families.json';
import { createSeedProjects } from '@/lib/studio/seed.js';
import { studioReducer, makeInitialStudioState } from '@/lib/studio/reducer.js';
import { readStudioProjects, writeStudioProjects } from '@/lib/studio/storage.js';

const StudioContext = createContext(null);

export const StudioProvider = ({ children }) => {
  const [state, dispatch] = useReducer(studioReducer, makeInitialStudioState(createSeedProjects(families)));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydratedProjects = readStudioProjects();
    dispatch({ type: 'HYDRATE', payload: hydratedProjects });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    dispatch({ type: 'SAVE_START' });
    const timer = setTimeout(() => {
      try {
        writeStudioProjects(state.projects);
        dispatch({ type: 'SAVE_SUCCESS' });
      } catch {
        dispatch({ type: 'SAVE_ERROR', payload: 'Studio project save failed.' });
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [hydrated, state.projects]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      families,
    }),
    [state],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudioContext = () => {
  const context = useContext(StudioContext);

  if (!context) {
    throw new Error('useStudioContext must be used within a StudioProvider.');
  }

  return context;
};

export default StudioContext;
