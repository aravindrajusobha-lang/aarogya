const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredApiBase ||
  (import.meta.env.PROD ? 'https://aarogya-drishti-l6fr.onrender.com' : '')
).replace(/\/$/, '');

/** Route existing relative API calls to the deployed backend in production. */
export function installApiBaseUrl(): void {
  if (!API_BASE_URL) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl, window.location.origin);
    if (url.origin !== window.location.origin || (url.pathname !== '/api' && !url.pathname.startsWith('/api/'))) {
      return originalFetch(input, init);
    }

    const target = `${API_BASE_URL}${url.pathname}${url.search}${url.hash}`;
    const request = input instanceof Request ? new Request(target, input) : target;
    return originalFetch(request, { ...init, credentials: init?.credentials ?? 'same-origin' });
  };
}
