export const validateGenerationPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      normalized: null,
      errors: [{ field: 'body', message: 'Request body must be an object.' }],
    };
  }
  const errors = [];
  const type = typeof payload.type === 'string' ? payload.type.toLowerCase() : '';
  const count = Number(payload.count);
  const ratio = typeof payload.aspectRatio === 'string' ? payload.aspectRatio : '1:1';

  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    errors.push('Prompt is required.');
  }

  if (!['image', 'video'].includes(type)) {
    errors.push('Type must be "image" or "video".');
  }

  const maxCount = type === 'video' ? 4 : 8;
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    if (Number.isFinite(count)) {
      // Count is normalized by the route to keep old clients usable.
    } else {
      errors.push(`Count must be an integer between 1 and ${maxCount}.`);
    }
  }

  if (!['1:1', '4:5', '16:9', '9:16', '3:2'].includes(ratio)) {
    errors.push('Aspect ratio must be one of 1:1, 4:5, 16:9, 9:16, or 3:2.');
  }

  if (payload.advanced !== undefined && (typeof payload.advanced !== 'object' || payload.advanced === null || Array.isArray(payload.advanced))) {
    errors.push('Advanced settings must be an object when provided.');
  }

  return {
    isValid: errors.length === 0,
    normalized: {
      prompt: payload.prompt?.trim?.() || '',
      type,
      count: Number.isInteger(count) ? Math.min(Math.max(count, 1), maxCount) : 1,
      aspectRatio: ratio,
      model: typeof payload.model === 'string' ? payload.model.trim() : '',
      style: typeof payload.style === 'string' ? payload.style.trim() : '',
      advanced: payload.advanced ?? {},
      retry: payload.retry === true,
    },
    errors,
  };
};
