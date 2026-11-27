const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function api(path, options = {}) {
  if (import.meta.env.PROD && !apiBaseUrl) {
    throw new Error('VITE_API_URL must be set to the deployed backend origin');
  }

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }
  return body;
}
