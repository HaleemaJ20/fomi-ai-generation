import { NextResponse } from 'next/server';
import families from '@/data/studio/families.json';
import { generateForkNodes } from '@/lib/studio/forkGenerator.js';

export const dynamic = 'force-dynamic';

const errorResponse = (status, code, message, field) =>
  NextResponse.json(
    {
      error: {
        code,
        message,
        field,
      },
    },
    { status },
  );

export async function POST(request) {
  try {
    const payload = await request.json();
    const { projectId, familyId, parent, usedImageIds = [], knob, values, prompt, count, seed, allowFailure } = payload ?? {};

    if (!familyId || !families.some((family) => family.id === familyId)) {
      return errorResponse(400, 'UNKNOWN_FAMILY', 'The requested family was not found.', 'familyId');
    }

    if (!parent || !parent.id || !parent.imageId || !parent.prompt || !parent.knobs || !parent.settings) {
      return errorResponse(400, 'MISSING_PARENT', 'A valid parent node is required.', 'parent');
    }

    const numericCount = Number(count);
    if (count !== undefined && (!Number.isFinite(numericCount) || numericCount < 1 || numericCount > 4)) {
      return errorResponse(400, 'INVALID_COUNT', 'Count must be between 1 and 4.', 'count');
    }

    const mode = knob && Array.isArray(values) ? 'knob' : typeof prompt === 'string' && prompt.trim() && !knob ? 'text' : null;
    if (!mode) {
      return errorResponse(400, 'NO_MODE', 'Choose either a knob mode or a text prompt mode.', 'mode');
    }

    const waitMs = 1200 + Math.random() * 1200;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    if (allowFailure === true && Math.random() < 0.03) {
      return NextResponse.json(
        {
          error: {
            code: 'GENERATION_FAILED',
            message: 'The fork failed. Please retry.',
          },
        },
        { status: 500 },
      );
    }

    const result = generateForkNodes({
      projectId,
      familyId,
      parent,
      usedImageIds,
      knob,
      values,
      prompt,
      count: numericCount || 1,
      seed: Number.isFinite(Number(seed)) ? Number(seed) : 1,
    });

    return NextResponse.json({
      nodes: result.nodes,
      matchedKnobs: result.matchedKnobs,
      skipped: result.skipped,
      hint: result.hint ?? null,
      message: result.message ?? null,
    });
  } catch (error) {
    return errorResponse(400, 'INVALID_REQUEST', 'The request body could not be processed.', 'body');
  }
}
