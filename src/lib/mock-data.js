import { promises as fs } from 'fs';
import path from 'path';

const toDataPath = (fileName) => path.join(process.cwd(), 'src', 'data', fileName);

export const readSeedData = async (fileName) => {
  const filePath = toDataPath(fileName);
  const fileContents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
};

export const getHistorySeed = async () => readSeedData('history.json');
export const getModelsSeed = async () => readSeedData('models.json');
export const getStylesSeed = async () => readSeedData('styles.json');

export const modelCatalog = await readSeedData('models.json');
export const styleCatalog = await readSeedData('styles.json');
export const historyItems = await readSeedData('history.json');

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

