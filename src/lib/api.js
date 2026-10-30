const buildUrl = (url) => {
  if (typeof window !== 'undefined' && url.startsWith('/')) {
    return new URL(url, window.location.origin).toString();
  }

  return url;
};

export const API_REQUEST_TIMEOUT_MS = 30000;

export const apiClient = {
  async request(url, options = {}) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    let timedOut = false;
    const timeoutMs = options.timeout ?? API_REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const cancelFromCaller = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    externalSignal?.addEventListener('abort', cancelFromCaller, { once: true });

    try {
      const response = await fetch(buildUrl(url), {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        const message = typeof payload?.error === 'object'
          ? payload.error.message
          : payload?.error || payload || 'Request failed';
        const requestError = new Error(message || 'Request failed');
        if (payload?.error && typeof payload.error === 'object') {
          requestError.details = payload.error;
        }
        throw requestError;
      }

      return payload;
    } catch (error) {
      if (controller.signal.aborted) {
        if (timedOut) {
          const timeoutError = new Error('Request timed out');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        if (error.name !== 'AbortError') throw error;
        throw error;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', cancelFromCaller);
    }
  },

  get(url, options) {
    return this.request(url, { ...options, method: 'GET' });
  },

  post(url, body, options) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export default apiClient;
