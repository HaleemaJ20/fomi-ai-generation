import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getHistorySeed, getModelsSeed, getStylesSeed, modelCatalog } from '@/lib/mock-data';
import { validateGenerationPayload } from '@/lib/generation';
import { generateMockItems } from '@/lib/mockGenerator';

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.', field: 'body' } },
      { status: 400 },
    );
  }

  const validation = validateGenerationPayload(payload);

  if (!validation.isValid) {
    const firstError = validation.errors[0] || {};
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: typeof firstError === 'string' ? firstError : 'Validation failed.',
          field: typeof firstError.field === 'string' ? firstError.field : 'body',
        },
      },
      { status: 400 },
    );
  }

  const { normalized } = validation;
  const requestedDurationOptions = [5, 8, 10];
  const rawDuration = Number(normalized.advanced.duration ?? 5);
  const requestedDuration = requestedDurationOptions.reduce((closest, duration) =>
    Math.abs(duration - rawDuration) < Math.abs(closest - rawDuration) ? duration : closest,
  requestedDurationOptions[0]);
  const motionStrength = {
    low: 3,
    medium: 6,
    high: 9,
  };
  const rawMotion = normalized.advanced.motion;
  const requestedMotion = Number.isFinite(Number(rawMotion))
    ? Math.min(10, Math.max(1, Math.round(Number(rawMotion))))
    : (motionStrength[String(rawMotion).toLowerCase()] ?? 6);
  const settings = {
    duration: requestedDuration,
    motion: requestedMotion,
  };

  const catalogModels = await getModelsSeed();
  const compatibleDefaults = normalized.type === 'image' ? 'portrait-max' : 'motion-studio';
  const requestedModel = catalogModels.find((model) => model.id === normalized.model && model.supports.includes(normalized.type));
  const selectedModel = requestedModel || catalogModels.find((model) => model.id === compatibleDefaults && model.supports.includes(normalized.type));
  if (!selectedModel) {
    return NextResponse.json({ error: { code: 'MODEL_UNAVAILABLE', message: 'No compatible model is available.', field: 'model' } }, { status: 400 });
  }

  const styles = await getStylesSeed();
  if (normalized.style && !styles.some((style) => style.id === normalized.style)) {
    return NextResponse.json({ error: { code: 'STYLE_UNAVAILABLE', message: 'Selected style is unavailable.', field: 'style' } }, { status: 400 });
  }

  const resolvedModel = selectedModel.id;

  const delayMs = normalized.type === 'video'
    ? 3000 + Math.random() * 2000
    : 1500 + Math.random() * 2000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const firstGenerationAfterLoad = request.headers.get('x-fomi-session') === 'first';
  if (!normalized.retry && !firstGenerationAfterLoad && Math.random() < 0.03) {
    return NextResponse.json(
      {
        error: { code: 'RENDERING_BUSY', message: 'The rendering service is temporarily busy. Please retry in a moment.', field: 'body' },
        details: ['A transient model error interrupted generation.'],
      },
      { status: 503 },
    );
  }

  let generated;
  try {
    generated = generateMockItems({
      prompt: normalized.prompt,
      type: normalized.type,
      count: normalized.count,
      aspectRatio: normalized.aspectRatio,
      style: normalized.style,
      seed: normalized.advanced.seed,
      duration: requestedDuration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'GENERATION_UNAVAILABLE', message: error.message || 'No samples are available.', field: 'prompt' } },
      { status: 422 },
    );
  }

  const result = {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: normalized.prompt,
    type: normalized.type,
    model: resolvedModel,
    createdAt: new Date().toISOString(),
    matchedTags: generated.matchedCategories,
    matchedCategories: generated.matchedCategories,
    items: generated.items,
    hint: generated.hint,
    settings,
  };

  const historyFile = path.join(process.cwd(), 'src', 'data', 'history.json');
  const history = await getHistorySeed();
  await fs.writeFile(historyFile, JSON.stringify([result, ...history], null, 2), 'utf8');

  return NextResponse.json(result);
}
