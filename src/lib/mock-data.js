import historySeed from '@/data/history.json';
import modelSeed from '@/data/models.json';
import stylesSeed from '@/data/styles.json';

export const readSeedData = async (fileName) => {
  const catalog = {
    'history.json': historySeed,
    'models.json': modelSeed,
    'styles.json': stylesSeed,
  };
  return catalog[fileName] ?? [];
};

export const getHistorySeed = async () => [...historySeed];
export const getModelsSeed = async () => [...modelSeed];
export const getStylesSeed = async () => [...stylesSeed];

export const modelCatalog = [...modelSeed];
export const styleCatalog = [...stylesSeed];
export const historyItems = [...historySeed];

export const resolveAspectDimensions = (aspectRatio = '1:1') => {
  const mappings = {
    '1:1': [1024, 1024],
    '4:5': [1024, 1280],
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '3:2': [1200, 800],
    '3:4': [900, 1200],
    '4:3': [1200, 900],
  };

  return mappings[aspectRatio] || mappings['1:1'];
};

