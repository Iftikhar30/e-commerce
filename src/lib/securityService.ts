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
  getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { LoginLog, BlockedDevice, DeviceInfo } from '../types';

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Record a login or access attempt
 * 1. Sends to serverless /api/security?action=record-attempt (extracts genuine IP & user-agent server-side)
 * 2. Writes to Firestore 'login_logs' (broadcasts in real-time to all admin consoles)
 * 3. Strips all passwords and sensitive data unconditionally
 */
export async function recordLoginAttempt(data: {
  email: string;
  status: 'success' | 'failed' | 'blocked';
  reason?: string;
  device: DeviceInfo;
}): Promise<LoginLog> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanEmail = (data.email || 'Admin').trim().slice(0, 100);
  const cleanReason = (data.reason || (data.status === 'failed' ? 'Wrong password' : 'Login event')).slice(0, 250);

  const cleanLog: LoginLog = {
    id: logId,
    email: cleanEmail,
    status: data.status,
    reason: cleanReason,
    device: {
      deviceId: data.device?.deviceId || `dev_${Date.now()}`,
      deviceHash: data.device?.deviceHash,
      ip: data.device?.ip || 'Unknown IP',
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

  // 1. Send to serverless API endpoint (Captures verified client IP from server headers)
  fetch('/api/security?action=record-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanLog),
  }).catch(() => {
    // ignore network errors if offline
  });

  // 2. Direct Firestore write (Centralized Real-Time Source of Truth)
  if (isFirebaseConfigured && db) {
    try {
      const logRef = doc(db, 'login_logs', logId);
      await setDoc(logRef, stripUndefined(cleanLog));
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
    deviceHash: device.deviceHash,
    ip: device.ip,
    browser: device.browser,
    os: device.os,
    deviceType: device.deviceType,
    reason: device.reason || 'Blocked by administrator',
    blockedAt: new Date().toISOString(),
    blockedBy: device.blockedBy || 'Store Admin',
  };

  // 1. Direct Firestore write (Centralized Source of Truth)
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', device.deviceId);
      await setDoc(docRef, stripUndefined(blockRecord));
    } catch (err) {
      console.warn('Firestore blockDevice error:', err);
    }
  }

  // 2. Notify Serverless backend
  fetch('/api/security?action=block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blockRecord),
  }).catch(() => {});
}

/**
 * Unblock a device in Firebase Firestore
 */
export async function unblockDevice(deviceId: string): Promise<void> {
  const targetId = (deviceId || '').trim();
  if (!targetId) return;

  // 1. Direct Firestore deletion
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', targetId);
      await deleteDoc(docRef);

      // Search and remove any document with matching deviceId or id
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

  // 2. Notify Serverless backend
  fetch('/api/security?action=unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: targetId }),
  }).catch(() => {});
}

/**
 * Unblock all devices completely from Firestore
 */
export async function unblockAllDevices(): Promise<void> {
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

  fetch('/api/security?action=unblock-all', {
    method: 'POST',
  }).catch(() => {});
}

/**
 * Clear all login logs from Firestore
 */
export async function clearAllLoginLogs(): Promise<void> {
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

  fetch('/api/security?action=clear-logs', {
    method: 'POST',
  }).catch(() => {});
}

/**
 * Real-time subscription to Blocked Devices for Admin Panel (onSnapshot)
 */
export function subscribeToBlockedDevices(callback: (devices: BlockedDevice[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }

  try {
    const colRef = collection(db, 'blocked_devices');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: BlockedDevice[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as BlockedDevice;
          if (data && data.deviceId) {
            list.push(data);
          }
        });
        callback(list);
      },
      (err) => {
        console.warn('Firestore blocked_devices subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore blocked_devices subscribe catch:', err);
    return () => {};
  }
}

/**
 * Real-time subscription to Login Logs for Admin Panel (onSnapshot)
 */
export function subscribeToLoginLogs(callback: (logs: LoginLog[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }

  try {
    const colRef = collection(db, 'login_logs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(300));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LoginLog[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as LoginLog;
          if (data && data.id) {
            list.push(data);
          }
        });
        callback(list);
      },
      (err) => {
        console.warn('Firestore login_logs subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore login_logs subscribe catch:', err);
    return () => {};
  }
}

/**
 * Single-device real-time listener for public visitors
 * Listens to doc(db, 'blocked_devices', deviceId).
 * When admin blocks this device, instantly triggers callback with block data!
 * When admin unblocks this device, instantly triggers callback with null!
 */
export function subscribeToDeviceBlockStatus(
  deviceId: string,
  deviceHash: string | undefined,
  callback: (blocked: BlockedDevice | null) => void
): () => void {
  const targetId = (deviceId || '').trim();
  if (!targetId) return () => {};

  let active = true;

  // 1. Initial server-side verification check
  fetch(`/api/security?action=check-access&deviceId=${encodeURIComponent(targetId)}&deviceHash=${encodeURIComponent(deviceHash || '')}`)
    .then((res) => res.json())
    .then((data) => {
      if (active && data) {
        if (data.isBlocked && data.matchedRecord) {
          callback(data.matchedRecord);
        } else {
          callback(null);
        }
      }
    })
    .catch(() => {});

  // 2. Real-time Firestore document listener
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', targetId);
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (!active) return;
          if (snap.exists()) {
            callback(snap.data() as BlockedDevice);
          } else {
            callback(null);
          }
        },
        () => {
          // If unauthenticated visitor cannot read doc directly, relies on server check
        }
      );
      return () => {
        active = false;
        unsub();
      };
    } catch {
      // ignore
    }
  }

  return () => {
    active = false;
  };
}

/**
 * Helper to test if a device or IP is matched in a list of blocked devices
 */
export function isDeviceBlockedCheck(
  currentDeviceId: string,
  blockedList: BlockedDevice[],
  currentDeviceHash?: string,
  currentIp?: string
): BlockedDevice | null {
  if (!currentDeviceId || !Array.isArray(blockedList) || blockedList.length === 0) {
    return null;
  }
  const match = blockedList.find((b) => {
    if (!b) return false;
    if (b.deviceId === currentDeviceId || b.id === currentDeviceId) return true;
    if (currentDeviceHash && b.deviceHash && b.deviceHash === currentDeviceHash) return true;
    if (currentIp && b.ip && b.ip !== 'Unknown IP' && b.ip !== '127.0.0.1' && b.ip === currentIp) return true;
    return false;
  });
  return match || null;
}
