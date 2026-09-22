/**
 * Resolves the primary backend API base URL for cross-device and multi-environment communication.
 * Supports Cloud Run previews, dev servers, Vercel deployments, and direct origins.
 */
export function getApiBaseUrl(): string {
  // 1. Explicit environment variable if provided
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }

  // 2. Default relative origin (same host on Vercel, Cloud Run, localhost, or preview)
  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
