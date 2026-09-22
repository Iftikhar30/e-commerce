import { DeviceInfo } from '../types';

const DEVICE_STORAGE_KEY = 'app_security_device_id';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }
  } catch {
    // localStorage might be unavailable
  }

  // Generate a distinct pseudo-UUID
  const rand = Math.random().toString(36).substring(2, 12);
  const time = Date.now().toString(36);
  const newId = `dev_${time}_${rand}`;

  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, newId);
    // Also save in cookie for persistence across storage clears
    document.cookie = `${DEVICE_STORAGE_KEY}=${newId};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // ignore
  }

  return newId;
}

export function parseUserAgent(): {
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
} {
  const ua = navigator.userAgent || '';
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
  if (cachedIpInfo) return cachedIpInfo;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      cachedIpInfo = {
        ip: data.ip,
        city: data.city,
        country: data.country_name || data.country,
      };
      return cachedIpInfo;
    }
  } catch {
    // fallback to ipify
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        cachedIpInfo = { ip: data.ip };
        return cachedIpInfo;
      }
    } catch {
      // ignore
    }
  }

  return {};
}

export async function getCurrentDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = getOrCreateDeviceId();
  const { os, browser, deviceType } = parseUserAgent();
  const ipInfo = await fetchClientPublicIp();

  const screenResolution =
    typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined;

  return {
    deviceId,
    ip: ipInfo.ip || 'Unknown IP',
    browser,
    os,
    deviceType,
    userAgent: navigator.userAgent || '',
    city: ipInfo.city,
    country: ipInfo.country,
    screenResolution,
  };
}
