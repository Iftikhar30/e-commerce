/**
 * Resolves the primary backend API base URL for cross-device and multi-environment communication.
 * Supports Cloud Run previews, dev servers, Vercel deployments, and direct origins.
 */
export function getApiBaseUrl(): string {
  // 1. Explicit environment variable if provided
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }

  // 2. Check current browser environment
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // If hosted on external static hosting (Vercel / GitHub Pages / Netlify / Render static),
    // point to the Cloud Run backend instance so cross-device sync operates universally
    if (
      hostname.includes('vercel.app') ||
      hostname.includes('github.io') ||
      hostname.includes('netlify.app') ||
      hostname.includes('pages.dev')
    ) {
      return 'https://ais-dev-goqir5kfptpsuim7ljadug-126801715579.asia-southeast1.run.app';
    }
  }

  // 3. Default relative origin (same host)
  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
