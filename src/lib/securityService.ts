import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { LoginLog, BlockedDevice } from '../types';

const LOCAL_LOGIN_LOGS_KEY = 'app_security_login_logs';
const LOCAL_BLOCKED_DEVICES_KEY = 'app_security_blocked_devices';

const DEFAULT_SAMPLE_LOGS: LoginLog[] = [
  {
    id: 'log_sample_success',
    email: 'ifti30ahmed@gmail.com',
    status: 'success',
    device: {
      deviceId: 'dev_admin_desktop',
      ip: '103.145.22.4',
      browser: 'Google Chrome',
      os: 'Windows 11',
      deviceType: 'Desktop',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0',
      city: 'Dhaka',
      country: 'Bangladesh',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'log_sample_failed',
    email: 'guest_user@mail.com',
    status: 'failed',
    reason: 'Incorrect email or password / ভুল পাসওয়ার্ড',
    device: {
      deviceId: 'dev_suspicious_77a',
      ip: '185.220.101.5',
      browser: 'Mozilla Firefox',
      os: 'Linux',
      deviceType: 'Desktop',
      userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
      city: 'Frankfurt',
      country: 'Germany',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
  },
];

// Helper to get local data
export function getLocalLoginLogs(): LoginLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    return DEFAULT_SAMPLE_LOGS;
  } catch {
    return DEFAULT_SAMPLE_LOGS;
  }
}

export function saveLocalLoginLogs(logs: LoginLog[]) {
  try {
    localStorage.setItem(LOCAL_LOGIN_LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function getLocalBlockedDevices(): BlockedDevice[] {
  try {
    const raw = localStorage.getItem(LOCAL_BLOCKED_DEVICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalBlockedDevices(devices: BlockedDevice[]) {
  try {
    localStorage.setItem(LOCAL_BLOCKED_DEVICES_KEY, JSON.stringify(devices));
  } catch {
    // ignore
  }
}

// Record a new login attempt (both success and failed attempts)
export async function recordLoginAttempt(data: {
  email: string;
  status: 'success' | 'failed';
  reason?: string;
  device: LoginLog['device'];
}): Promise<LoginLog> {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newLog: LoginLog = {
    id,
    email: data.email,
    status: data.status,
    reason: data.reason,
    device: data.device,
    timestamp: new Date().toISOString(),
  };

  // 1. Save locally immediately
  const localLogs = getLocalLoginLogs();
  localLogs.unshift(newLog);
  saveLocalLoginLogs(localLogs);

  // 2. Save to Firestore if available
  if (isFirebaseConfigured && db) {
    try {
      const logRef = doc(db, 'login_logs', id);
      await setDoc(logRef, newLog);
    } catch (err) {
      console.warn('Firestore recordLoginAttempt warning:', err);
    }
  }

  return newLog;
}

// Block a device
export async function blockDevice(device: BlockedDevice): Promise<void> {
  // Update local cache
  const localList = getLocalBlockedDevices().filter(
    (b) => b.id !== device.id && b.deviceId !== device.deviceId
  );
  localList.unshift(device);
  saveLocalBlockedDevices(localList);

  // Dispatch custom event for immediate same-tab reactive update
  window.dispatchEvent(new CustomEvent('app_security_blocked_update'));

  // Update Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', device.id);
      await setDoc(docRef, device);
    } catch (err) {
      console.warn('Firestore blockDevice warning:', err);
    }
  }
}

// Unblock a device
export async function unblockDevice(deviceIdOrIp: string): Promise<void> {
  // Update local cache
  const localList = getLocalBlockedDevices().filter(
    (b) => b.id !== deviceIdOrIp && b.deviceId !== deviceIdOrIp && b.ip !== deviceIdOrIp
  );
  saveLocalBlockedDevices(localList);

  // Dispatch custom event
  window.dispatchEvent(new CustomEvent('app_security_blocked_update'));

  // Update Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', deviceIdOrIp);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore unblockDevice warning:', err);
    }
  }
}

// Real-time subscription to blocked devices list
export function subscribeToBlockedDevices(
  callback: (devices: BlockedDevice[]) => void
): () => void {
  // Initial fire from local
  callback(getLocalBlockedDevices());

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'blocked_devices');
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snapshot) => {
          const list: BlockedDevice[] = [];
          snapshot.forEach((doc) => {
            list.push(doc.data() as BlockedDevice);
          });
          saveLocalBlockedDevices(list);
          callback(list);
        },
        (err) => {
          console.warn('Blocked devices subscription warning:', err);
          callback(getLocalBlockedDevices());
        }
      );
    } catch {
      callback(getLocalBlockedDevices());
    }
  }

  // Also listen for cross-tab or local custom events
  const handleLocalChange = () => {
    callback(getLocalBlockedDevices());
  };
  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('app_security_blocked_update', handleLocalChange);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('app_security_blocked_update', handleLocalChange);
  };
}

// Real-time subscription to Login Logs
export function subscribeToLoginLogs(
  callback: (logs: LoginLog[]) => void
): () => void {
  // Initial fire from local
  callback(getLocalLoginLogs());

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(150));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: LoginLog[] = [];
          snapshot.forEach((doc) => {
            list.push(doc.data() as LoginLog);
          });
          if (list.length > 0) {
            saveLocalLoginLogs(list);
            callback(list);
          } else {
            callback(getLocalLoginLogs());
          }
        },
        (err) => {
          console.warn('Login logs subscription warning:', err);
          callback(getLocalLoginLogs());
        }
      );
    } catch {
      callback(getLocalLoginLogs());
    }
  }

  const handleLocalChange = () => {
    callback(getLocalLoginLogs());
  };
  window.addEventListener('storage', handleLocalChange);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
  };
}

// Check if a specific device is blocked
export function isDeviceBlockedCheck(
  currentDeviceId: string,
  currentIp: string | undefined,
  blockedList: BlockedDevice[]
): BlockedDevice | null {
  if (!currentDeviceId && !currentIp) return null;

  const found = blockedList.find((b) => {
    if (b.deviceId && currentDeviceId && b.deviceId === currentDeviceId) {
      return true;
    }
    if (b.ip && currentIp && currentIp !== 'Unknown IP' && b.ip === currentIp) {
      return true;
    }
    if (b.id && (b.id === currentDeviceId || b.id === currentIp)) {
      return true;
    }
    return false;
  });

  return found || null;
}
