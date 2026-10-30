export const storedSettingsKey = 'fomi-generation-settings';
export const STORED_SETTINGS_VERSION = 2;

const modes = ['image', 'video'];
const aspectRatios = ['1:1', '4:5', '16:9', '9:16', '3:2'];
const durations = [5, 8, 10];
const motions = ['low', 'medium', 'high'];

export const validateGenerationSettings = (settings, defaults) => {
  if (!settings || typeof settings !== 'object') return { ...defaults };
  const mode = modes.includes(settings.mode) ? settings.mode : defaults.mode;
  const maxCount = mode === 'video' ? 4 : 8;
  const count = Number.isInteger(settings.count) ? Math.min(Math.max(settings.count, 1), maxCount) : defaults.count;

  return {
    ...defaults,
    mode,
    count,
    aspectRatio: aspectRatios.includes(settings.aspectRatio) ? settings.aspectRatio : defaults.aspectRatio,
    model: typeof settings.model === 'string' && settings.model.trim() ? settings.model : defaults.model,
    advanced: {
      ...defaults.advanced,
      duration: durations.includes(Number(settings.advanced?.duration)) ? Number(settings.advanced.duration) : defaults.advanced.duration,
      motion: motions.includes(settings.advanced?.motion) ? settings.advanced.motion : defaults.advanced.motion,
    },
  };
};

export const readStoredGenerationSettings = () => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storedSettingsKey));
    return parsed?.version === STORED_SETTINGS_VERSION ? parsed.settings : null;
  } catch {
    return null;
  }
};

export const writeStoredGenerationSettings = (settings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storedSettingsKey, JSON.stringify({
      version: STORED_SETTINGS_VERSION,
      settings,
    }));
  } catch {}
};
