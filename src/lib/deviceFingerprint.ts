import { DeviceInfo } from '../types';

const DEVICE_STORAGE_KEY = 'store_device_id_v4';
const DEVICE_COOKIE_KEY = 'store_device_id_v4';

/**
 * Generates a fast 32-bit hash string from arbitrary text
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculates a resilient hardware & browser canvas fingerprint
 * This persists even if cookies or localStorage are cleared on the same browser/device.
 */
export function generateDeviceHash(): string {
  if (typeof window === 'undefined') return 'server_render';

  try {
    const parts: string[] = [];

    // 1. Screen & Hardware Metrics
    parts.push(`${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    parts.push(String(window.devicePixelRatio || 1));
    parts.push(String(navigator.hardwareConcurrency || 2));
    parts.push(String((navigator as unknown as { deviceMemory?: number }).deviceMemory || 4));

    // 2. Localization & Timezone
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    parts.push(String(new Date().getTimezoneOffset()));
    parts.push(navigator.language || 'en');

    // 3. Canvas Signature
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial", sans-serif';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('PickFinds_Security_402', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Store_Sec_Fp', 4, 17);
        parts.push(hashString(canvas.toDataURL()));
      }
    } catch {
      // ignore canvas block
    }

    // 4. WebGL Vendor & Renderer
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          parts.push(`${vendor}~${renderer}`);
        }
      }
    } catch {
      // ignore webgl block
    }

    return `fp_${hashString(parts.join('||'))}`;
  } catch {
    return 'fp_fallback';
  }
}

/**
 * Gets or creates a durable multi-tier Device ID
 * Stored across localStorage, sessionStorage, and HTTP Cookie
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_render_dev';

  // 1. Try reading from LocalStorage
  try {
    const fromLocal = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (fromLocal && fromLocal.length >= 8) {
      // Sync to cookie and sessionStorage if missing
      syncDeviceId(fromLocal);
      return fromLocal;
    }
  } catch {
    // LocalStorage might be disabled/restricted
  }

  // 2. Try reading from Cookie
  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [key, val] = c.trim().split('=');
      if (key === DEVICE_COOKIE_KEY && val && val.length >= 8) {
        syncDeviceId(val);
        return val;
      }
    }
  } catch {
    // Cookie might be restricted
  }

  // 3. Try reading from SessionStorage
  try {
    const fromSession = sessionStorage.getItem(DEVICE_STORAGE_KEY);
    if (fromSession && fromSession.length >= 8) {
      syncDeviceId(fromSession);
      return fromSession;
    }
  } catch {
    // SessionStorage might be restricted
  }

  // 4. If all fail, generate a new resilient Device ID
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  const hardwareHash = generateDeviceHash().slice(-6);
  const newId = `dev_${time}_${rand}_${hardwareHash}`;

  syncDeviceId(newId);
  return newId;
}

function syncDeviceId(id: string) {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(DEVICE_STORAGE_KEY, id);
  } catch {
    // ignore
  }
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${DEVICE_COOKIE_KEY}=${id};path=/;max-age=31536000;SameSite=Lax`;
    }
  } catch {
    // ignore
  }
}

export function parseUserAgent(): {
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';

  // Detect Device Type
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(
      ua
    )
  ) {
    deviceType = 'Mobile';
  }

  // Detect OS
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.2/i.test(ua)) os = 'Windows 8';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  // Detect Browser
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\/|CriOS/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\/|FxiOS/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  return { os, browser, deviceType };
}

let cachedIpInfo: { ip?: string; city?: string; country?: string } | null = null;

export async function fetchClientPublicIp(): Promise<{ ip?: string; city?: string; country?: string }> {
  if (cachedIpInfo && cachedIpInfo.ip) return cachedIpInfo;

  // 1. Try server-side endpoint first (accurate reflection of real IP on Vercel/Express)
  try {
    const res = await fetch('/api/client-ip');
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && data.ip !== '127.0.0.1') {
        cachedIpInfo = { ip: data.ip };
        return cachedIpInfo;
      }
    }
  } catch {
    // continue
  }

  // 2. Try ipapi for geolocation
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedIpInfo = {
          ip: data.ip,
          city: data.city || '',
          country: data.country_name || data.country || '',
        };
        return cachedIpInfo;
      }
    }
  } catch {
    // continue to fallback
  }

  // 3. Fallback to ipify
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedIpInfo = { ip: data.ip };
        return cachedIpInfo;
      }
    }
  } catch {
    // ignore
  }

  return cachedIpInfo || { ip: 'Unknown IP' };
}

export async function getCurrentDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = getOrCreateDeviceId();
  const deviceHash = generateDeviceHash();
  const { os, browser, deviceType } = parseUserAgent();
  const ipInfo = await fetchClientPublicIp();

  const screenResolution =
    typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined;

  return {
    deviceId,
    deviceHash,
    ip: ipInfo.ip || 'Unknown IP',
    browser,
    os,
    deviceType,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
    city: ipInfo.city,
    country: ipInfo.country,
    screenResolution,
  };
}
