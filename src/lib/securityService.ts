import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { LoginLog, BlockedDevice } from '../types';

const LOCAL_LOGIN_LOGS_KEY = 'app_security_login_logs_v2';
const LOCAL_BLOCKED_DEVICES_KEY = 'app_security_blocked_devices_v2';

// Helper to get local logs
export function getLocalLoginLogs(): LoginLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((l) => l && l.id && !l.id.includes('sample'));
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveLocalLoginLogs(logs: LoginLog[]) {
  try {
    const filtered = (logs || []).filter((l) => l && l.id && !l.id.includes('sample'));
    localStorage.setItem(LOCAL_LOGIN_LOGS_KEY, JSON.stringify(filtered.slice(0, 300)));
    window.dispatchEvent(new CustomEvent('app_security_login_logs_update'));
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
    localStorage.setItem(LOCAL_BLOCKED_DEVICES_KEY, JSON.stringify(devices || []));
    window.dispatchEvent(new CustomEvent('app_security_blocked_update'));
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
    email: (data.email || 'unknown').trim(),
    status: data.status,
    reason: data.reason,
    device: {
      deviceId: data.device?.deviceId || `dev_${Date.now()}`,
      ip: data.device?.ip || '127.0.0.1',
      browser: data.device?.browser || 'Browser',
      os: data.device?.os || 'OS',
      deviceType: data.device?.deviceType || 'Desktop',
      userAgent: data.device?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      city: data.device?.city,
      country: data.device?.country,
      screenResolution: data.device?.screenResolution,
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Save locally immediately & dispatch event
  const currentLogs = getLocalLoginLogs().filter((l) => l.id !== newLog.id);
  currentLogs.unshift(newLog);
  saveLocalLoginLogs(currentLogs);

  // 2. Sync to Backend Server API for universal cross-device persistence
  try {
    fetch('/api/security/record-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    }).catch(() => {});
  } catch {
    // ignore
  }

  // 3. Save to Firestore if configured
  if (isFirebaseConfigured && db) {
    try {
      const logRef = doc(db, 'login_logs', id);
      await setDoc(logRef, newLog).catch(() => {});
    } catch (err) {
      console.warn('Firestore recordLoginAttempt warning:', err);
    }
  }

  return newLog;
}

// Block a device
export async function blockDevice(device: BlockedDevice): Promise<void> {
  // 1. Update local cache
  const localList = getLocalBlockedDevices().filter(
    (b) => b.id !== device.id && b.deviceId !== device.deviceId && (device.ip ? b.ip !== device.ip : true)
  );
  localList.unshift(device);

  // If device has an IP, also add an IP block entry
  if (device.ip && device.ip !== 'Unknown IP' && device.ip !== '127.0.0.1') {
    const ipEntry: BlockedDevice = {
      ...device,
      id: `ip_${device.ip.replace(/[^a-zA-Z0-9]/g, '_')}`,
      deviceId: device.deviceId,
    };
    if (!localList.some((b) => b.id === ipEntry.id)) {
      localList.unshift(ipEntry);
    }
  }

  saveLocalBlockedDevices(localList);

  // 2. Sync to Backend Server API
  try {
    fetch('/api/security/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    }).catch(() => {});
  } catch {
    // ignore
  }

  // 3. Update Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', device.id);
      await setDoc(docRef, device);
      if (device.ip && device.ip !== 'Unknown IP' && device.ip !== '127.0.0.1') {
        const ipDocRef = doc(db, 'blocked_devices', `ip_${device.ip.replace(/[^a-zA-Z0-9]/g, '_')}`);
        await setDoc(ipDocRef, device);
      }
    } catch (err) {
      console.warn('Firestore blockDevice warning:', err);
    }
  }
}

// Unblock a device
export async function unblockDevice(deviceIdOrIp: string): Promise<void> {
  const localList = getLocalBlockedDevices().filter(
    (b) => b.id !== deviceIdOrIp && b.deviceId !== deviceIdOrIp && b.ip !== deviceIdOrIp
  );
  saveLocalBlockedDevices(localList);

  // Sync to Backend Server
  try {
    fetch('/api/security/unblock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deviceIdOrIp }),
    }).catch(() => {});
  } catch {
    // ignore
  }

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

// Clear all login logs
export async function clearAllLoginLogs(): Promise<void> {
  saveLocalLoginLogs([]);

  try {
    await fetch('/api/security/clear-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // ignore
  }

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Firestore clear logs warning:', err);
    }
  }
}

// Real-time subscription to blocked devices list
export function subscribeToBlockedDevices(
  callback: (devices: BlockedDevice[]) => void
): () => void {
  callback(getLocalBlockedDevices());

  const fetchServerBlocked = async () => {
    try {
      const res = await fetch('/api/security/blocked');
      if (res.ok) {
        const data = await res.json();
        if (data.devices && Array.isArray(data.devices)) {
          const merged = [...data.devices];
          const local = getLocalBlockedDevices();
          local.forEach((l) => {
            if (!merged.some((m) => m.id === l.id || m.deviceId === l.deviceId)) {
              merged.push(l);
            }
          });
          saveLocalBlockedDevices(merged);
          callback(merged);
        }
      }
    } catch {
      // ignore
    }
  };
  fetchServerBlocked();

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'blocked_devices');
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snapshot) => {
          const list: BlockedDevice[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as BlockedDevice);
          });
          if (list.length > 0) {
            saveLocalBlockedDevices(list);
            callback(list);
          } else {
            callback(getLocalBlockedDevices());
          }
        },
        () => {
          callback(getLocalBlockedDevices());
        }
      );
    } catch {
      callback(getLocalBlockedDevices());
    }
  }

  const handleLocalChange = () => {
    callback(getLocalBlockedDevices());
  };
  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('app_security_blocked_update', handleLocalChange);

  const intervalId = setInterval(fetchServerBlocked, 4000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('app_security_blocked_update', handleLocalChange);
    clearInterval(intervalId);
  };
}

// Real-time subscription to Login Logs
export function subscribeToLoginLogs(
  callback: (logs: LoginLog[]) => void
): () => void {
  callback(getLocalLoginLogs());

  // Function to fetch from server API
  const fetchServerLogs = async () => {
    try {
      const res = await fetch('/api/security/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs && Array.isArray(data.logs)) {
          const serverLogs: LoginLog[] = data.logs.filter((l: LoginLog) => l && l.id && !l.id.includes('sample'));
          const local = getLocalLoginLogs();
          const combinedMap = new Map<string, LoginLog>();
          
          serverLogs.forEach((l) => combinedMap.set(l.id, l));
          local.forEach((l) => {
            if (!combinedMap.has(l.id)) {
              combinedMap.set(l.id, l);
            }
          });

          const sorted = Array.from(combinedMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          saveLocalLoginLogs(sorted);
          callback(sorted);
        }
      }
    } catch {
      // ignore
    }
  };

  fetchServerLogs();

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(200));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: LoginLog[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data() as LoginLog;
            if (item && item.id && !item.id.includes('sample')) {
              list.push(item);
            }
          });
          
          const local = getLocalLoginLogs();
          const combinedMap = new Map<string, LoginLog>();
          list.forEach((l) => combinedMap.set(l.id, l));
          local.forEach((l) => {
            if (!combinedMap.has(l.id)) {
              combinedMap.set(l.id, l);
            }
          });

          const sorted = Array.from(combinedMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          saveLocalLoginLogs(sorted);
          callback(sorted);
        },
        (err) => {
          console.warn('Login logs Firestore warning:', err);
          fetchServerLogs();
        }
      );
    } catch {
      fetchServerLogs();
    }
  }

  const handleLocalChange = () => {
    callback(getLocalLoginLogs());
  };
  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('app_security_login_logs_update', handleLocalChange);

  // Poll server every 4 seconds for cross-device updates
  const intervalId = setInterval(fetchServerLogs, 4000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('app_security_login_logs_update', handleLocalChange);
    clearInterval(intervalId);
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
