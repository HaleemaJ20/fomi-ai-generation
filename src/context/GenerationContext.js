'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { readStoredGenerationSettings, validateGenerationSettings, writeStoredGenerationSettings } from '@/lib/storedSettings';

const IMAGE_MODELS = ['portrait-max', 'flux-pro', 'image-lab'];
const VIDEO_MODELS = ['motion-studio', 'flux-pro'];
const STYLE_OPTIONS = ['portrait', 'cinematic', 'editorial', 'dreamy', 'neon', 'minimal', 'retro'];

const defaultAdvanced = {
  negativePrompt: '',
  seed: '',
  guidance: 7,
  steps: 30,
  duration: 5,
  motion: 'medium',
};

const defaultState = {
  mode: 'image',
  prompt: '',
  count: 4,
  aspectRatio: '1:1',
  model: 'portrait-max',
  selectedStyles: ['portrait'],
  advanced: { ...defaultAdvanced },
  advancedOpen: false,
  stylesOpen: false,
};

function generationReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        count: action.payload === 'video' ? Math.min(state.count, 4) : Math.min(Math.max(state.count, 1), 8),
        model:
          action.payload === 'image'
            ? IMAGE_MODELS.includes(state.model)
              ? state.model
              : IMAGE_MODELS[0]
            : VIDEO_MODELS.includes(state.model)
              ? state.model
              : VIDEO_MODELS[0],
      };
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload };
    case 'SET_COUNT':
      return { ...state, count: action.payload };
    case 'SET_ASPECT':
      return { ...state, aspectRatio: action.payload };
    case 'SET_MODEL':
      return { ...state, model: action.payload };
    case 'SET_ADVANCED_FIELD':
      return {
        ...state,
        advanced: {
          ...state.advanced,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'RESET_ADVANCED':
      return { ...state, advanced: { ...defaultAdvanced } };
    case 'TOGGLE_STYLE': {
      const isSelected = state.selectedStyles.includes(action.payload);
      return {
        ...state,
        selectedStyles: isSelected
          ? state.selectedStyles.filter((style) => style !== action.payload)
          : [...state.selectedStyles, action.payload],
      };
    }
    case 'CLEAR_STYLES':
      return { ...state, selectedStyles: [] };
    case 'TOGGLE_ADVANCED':
      return { ...state, advancedOpen: !state.advancedOpen };
    case 'TOGGLE_STYLES_PANEL':
      return { ...state, stylesOpen: !state.stylesOpen };
    case 'RESET_FORM':
      return { ...defaultState };
    case 'RESTORE_SETTINGS':
      return action.payload;
    default:
      return state;
  }
}

const GenerationContext = createContext(null);

export const GenerationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(generationReducer, defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredGenerationSettings();
    if (stored) {
      const restored = validateGenerationSettings(stored, defaultState);
      dispatch({ type: 'RESTORE_SETTINGS', payload: restored });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredGenerationSettings(state);
  }, [hydrated, state]);

  const value = useMemo(
    () => ({
      ...state,
      dispatch,
      models: state.mode === 'image' ? IMAGE_MODELS : VIDEO_MODELS,
      styleOptions: STYLE_OPTIONS,
      defaultAdvanced,
    }),
    [state],
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
};

export const useGeneration = () => {
  const context = useContext(GenerationContext);

  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }

  return context;
};

export default GenerationContext;