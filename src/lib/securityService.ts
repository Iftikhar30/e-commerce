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

const LOCAL_LOGIN_LOGS_KEY = 'store_security_logs_v3';
const LOCAL_BLOCKED_KEY = 'store_blocked_devices_v3';

// Helper for local caching (offline / initial fast render)
export function getLocalLoginLogs(): LoginLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalLoginLogs(logs: LoginLog[]) {
  try {
    localStorage.setItem(LOCAL_LOGIN_LOGS_KEY, JSON.stringify((logs || []).slice(0, 300)));
    window.dispatchEvent(new CustomEvent('app_security_logs_updated'));
  } catch {
    // ignore
  }
}

export function getLocalBlockedDevices(): BlockedDevice[] {
  try {
    const raw = localStorage.getItem(LOCAL_BLOCKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalBlockedDevices(devices: BlockedDevice[]) {
  try {
    localStorage.setItem(LOCAL_BLOCKED_KEY, JSON.stringify(devices || []));
    window.dispatchEvent(new CustomEvent('app_security_blocked_updated'));
  } catch {
    // ignore
  }
}

/**
 * Record a login attempt directly to Firebase Firestore
 * Broadcasts in real-time to any device viewing the admin panel worldwide.
 */
export async function recordLoginAttempt(data: {
  email: string;
  status: 'success' | 'failed';
  reason?: string;
  device: LoginLog['device'];
}): Promise<LoginLog> {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanLog: LoginLog = {
    id,
    email: (data.email || 'Admin').trim(),
    status: data.status,
    reason: data.reason || (data.status === 'failed' ? 'Wrong password' : 'Login successful'),
    device: {
      deviceId: data.device?.deviceId || `dev_${Date.now()}`,
      ip: data.device?.ip || 'Unknown IP',
      browser: data.device?.browser || 'Browser',
      os: data.device?.os || 'OS',
      deviceType: data.device?.deviceType || 'Mobile',
      userAgent: data.device?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      city: data.device?.city,
      country: data.device?.country,
      screenResolution: data.device?.screenResolution,
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Update local cache immediately
  const localList = getLocalLoginLogs();
  localList.unshift(cleanLog);
  saveLocalLoginLogs(localList);

  // 2. Direct Firestore write (Vercel-native & real-time global broadcast)
  if (isFirebaseConfigured && db) {
    try {
      const logRef = doc(db, 'login_logs', id);
      await setDoc(logRef, cleanLog);
    } catch (err) {
      console.warn('Firestore recordLoginAttempt error:', err);
    }
  }

  return cleanLog;
}

/**
 * Block a device in Firebase Firestore
 */
export async function blockDevice(device: BlockedDevice): Promise<void> {
  if (!device || !device.deviceId) return;

  const blockRecord: BlockedDevice = {
    id: device.deviceId,
    deviceId: device.deviceId,
    ip: device.ip,
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    reason: device.reason || 'Blocked by administrator',
    blockedAt: new Date().toISOString(),
    blockedBy: device.blockedBy || 'Store Admin',
  };

  // 1. Save to local cache
  const localList = getLocalBlockedDevices().filter((b) => b.deviceId !== device.deviceId);
  localList.unshift(blockRecord);
  saveLocalBlockedDevices(localList);

  // 2. Direct Firestore write
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', device.deviceId);
      await setDoc(docRef, blockRecord);
    } catch (err) {
      console.warn('Firestore blockDevice error:', err);
    }
  }
}

/**
 * Unblock a device in Firebase Firestore
 */
export async function unblockDevice(deviceId: string): Promise<void> {
  const targetId = (deviceId || '').trim();
  if (!targetId) return;

  // 1. Immediately remove from local storage
  const localList = getLocalBlockedDevices().filter((b) => b.deviceId !== targetId && b.id !== targetId);
  saveLocalBlockedDevices(localList);

  // 2. Delete from Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', targetId);
      await deleteDoc(docRef);

      // Search and delete any document with matching deviceId
      const snap = await getDocs(collection(db, 'blocked_devices'));
      const batch = writeBatch(db);
      let found = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === targetId || data.deviceId === targetId || data.id === targetId) {
          batch.delete(d.ref);
          found++;
        }
      });
      if (found > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('Firestore unblockDevice error:', err);
    }
  }
}

/**
 * Clear all blocked devices completely
 */
export async function unblockAllDevices(): Promise<void> {
  saveLocalBlockedDevices([]);

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'blocked_devices'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Firestore unblockAllDevices error:', err);
    }
  }
}

/**
 * Clear all login activity logs from Firestore
 */
export async function clearAllLoginLogs(): Promise<void> {
  saveLocalLoginLogs([]);

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'login_logs'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Firestore clearAllLoginLogs error:', err);
    }
  }
}

/**
 * Real-time subscription to Blocked Devices from Firestore
 */
export function subscribeToBlockedDevices(callback: (devices: BlockedDevice[]) => void): () => void {
  // Call immediately with local cache
  callback(getLocalBlockedDevices());

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'blocked_devices');
      unsubscribeFirestore = onSnapshot(
        colRef,
        (snapshot) => {
          const list: BlockedDevice[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as BlockedDevice;
            if (data && data.deviceId) {
              list.push(data);
            }
          });
          saveLocalBlockedDevices(list);
          callback(list);
        },
        (err) => {
          console.warn('Firestore blocked_devices listener error:', err);
          callback(getLocalBlockedDevices());
        }
      );
    } catch (err) {
      console.warn('Firestore blocked_devices subscribe error:', err);
    }
  }

  const handleLocal = () => callback(getLocalBlockedDevices());
  window.addEventListener('app_security_blocked_updated', handleLocal);
  window.addEventListener('storage', handleLocal);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('app_security_blocked_updated', handleLocal);
    window.removeEventListener('storage', handleLocal);
  };
}

/**
 * Real-time subscription to Login Logs from Firestore
 */
export function subscribeToLoginLogs(callback: (logs: LoginLog[]) => void): () => void {
  // Call immediately with local cache
  callback(getLocalLoginLogs());

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(300));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: LoginLog[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as LoginLog;
            if (data && data.id) {
              list.push(data);
            }
          });
          saveLocalLoginLogs(list);
          callback(list);
        },
        (err) => {
          console.warn('Firestore login_logs listener error:', err);
          callback(getLocalLoginLogs());
        }
      );
    } catch (err) {
      console.warn('Firestore login_logs subscribe error:', err);
    }
  }

  const handleLocal = () => callback(getLocalLoginLogs());
  window.addEventListener('app_security_logs_updated', handleLocal);
  window.addEventListener('storage', handleLocal);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('app_security_logs_updated', handleLocal);
    window.removeEventListener('storage', handleLocal);
  };
}

/**
 * Check if a specific device is currently blocked
 */
export function isDeviceBlockedCheck(
  currentDeviceId: string,
  blockedList: BlockedDevice[]
): BlockedDevice | null {
  if (!currentDeviceId || !Array.isArray(blockedList) || blockedList.length === 0) {
    return null;
  }
  const match = blockedList.find(
    (b) => b && (b.deviceId === currentDeviceId || b.id === currentDeviceId)
  );
  return match || null;
}
