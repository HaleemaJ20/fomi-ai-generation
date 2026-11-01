const getRequestPayload = (payload = {}) => ({
  ...payload,
  allowFailure: payload.allowFailure ?? false,
});

export async function forkNodes(payload = {}, { signal } = {}) {
  try {
    const response = await fetch('/api/studio/fork', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(getRequestPayload(payload)),
      signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.error?.message || 'Unable to fork node.');
    }

    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      return null;
    }

    throw error;
  }
}

export default forkNodes;
