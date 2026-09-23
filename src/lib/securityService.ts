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
import { buildApiUrl } from './apiConfig';
import {
  fetchCloudSecurityState,
  pushCloudLoginLog,
  pushCloudBlockDevice,
  removeCloudBlockDevice,
  clearCloudLogs,
} from './cloudSyncRelay';

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

// Record a new login attempt (both success and failed attempts across any phone/device)
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
    reason: data.reason || (data.status === 'failed' ? 'Wrong password attempt' : 'Login successful'),
    device: {
      deviceId: data.device?.deviceId || `dev_${Date.now()}`,
      ip: data.device?.ip || '127.0.0.1',
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

  // 1. Save locally immediately
  const currentLogs = getLocalLoginLogs().filter((l) => l.id !== newLog.id);
  currentLogs.unshift(newLog);
  saveLocalLoginLogs(currentLogs);

  // 2. Save directly to Firestore (Instant real-time broadcast to all devices)
  if (isFirebaseConfigured && db) {
    try {
      const logRef = doc(db, 'login_logs', id);
      await setDoc(logRef, newLog);
    } catch (err) {
      console.warn('Firestore setDoc login_logs error:', err);
    }
  }

  // 3. Push to Universal Cloud Relay
  pushCloudLoginLog(newLog).catch((err) => {
    console.warn('Cloud sync relay error for login attempt:', err);
  });

  // 4. Sync to Backend Server API
  try {
    const apiUrl = buildApiUrl('/api/security/record-login');
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newLog),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }

  return newLog;
}

// Block a device (Enforced universally across all phones and browsers)
export async function blockDevice(device: BlockedDevice): Promise<void> {
  // 1. Update local cache
  const localList = getLocalBlockedDevices().filter(
    (b) => b.id !== device.id && b.deviceId !== device.deviceId && (device.ip ? b.ip !== device.ip : true)
  );
  localList.unshift(device);

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

  // 2. Update Firestore immediately
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'blocked_devices', device.id);
      await setDoc(docRef, device);
      if (device.deviceId && device.deviceId !== device.id) {
        await setDoc(doc(db, 'blocked_devices', device.deviceId), device);
      }
      if (device.ip && device.ip !== 'Unknown IP' && device.ip !== '127.0.0.1') {
        const ipDocRef = doc(db, 'blocked_devices', `ip_${device.ip.replace(/[^a-zA-Z0-9]/g, '_')}`);
        await setDoc(ipDocRef, device);
      }
    } catch (err) {
      console.warn('Firestore blockDevice error:', err);
    }
  }

  // 3. Push to Universal Cloud Relay
  pushCloudBlockDevice(device).catch((err) => {
    console.warn('Cloud sync block error:', err);
  });

  // 4. Sync to Backend Server API
  try {
    const apiUrl = buildApiUrl('/api/security/block');
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Unblock a device globally across all networks and devices
export async function unblockDevice(deviceIdOrIp: string): Promise<void> {
  const target = (deviceIdOrIp || '').trim();
  if (!target) return;

  // 1. Immediately remove from local cache and dispatch event
  const localList = getLocalBlockedDevices().filter(
    (b) =>
      b.id !== target &&
      b.deviceId !== target &&
      b.ip !== target &&
      `ip_${(b.ip || '').replace(/[^a-zA-Z0-9]/g, '_')}` !== target
  );
  saveLocalBlockedDevices(localList);

  // 2. Delete from Firestore (Direct doc delete + Query search to remove all associated aliases)
  if (isFirebaseConfigured && db) {
    try {
      const directDocRef = doc(db, 'blocked_devices', target);
      deleteDoc(directDocRef).catch(() => {});

      // Query and delete all matching docs
      const snap = await getDocs(collection(db, 'blocked_devices'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as BlockedDevice;
        if (
          docSnap.id === target ||
          data.id === target ||
          data.deviceId === target ||
          data.ip === target ||
          `ip_${(data.ip || '').replace(/[^a-zA-Z0-9]/g, '_')}` === target
        ) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('Firestore unblockDevice error:', err);
    }
  }

  // 3. Remove from Universal Cloud Relay
  removeCloudBlockDevice(target).catch(() => {});

  // 4. Sync to Backend Server
  try {
    const apiUrl = buildApiUrl('/api/security/unblock');
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target, deviceId: target, ip: target }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

// Clear all login logs globally
export async function clearAllLoginLogs(): Promise<void> {
  saveLocalLoginLogs([]);

  // 1. Clear Firestore
  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Firestore clear logs error:', err);
    }
  }

  // 2. Clear Universal Cloud Relay
  clearCloudLogs().catch(() => {});

  // 3. Clear Backend Server
  try {
    const apiUrl = buildApiUrl('/api/security/clear-logs');
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// Real-time subscription to blocked devices list across all phones and browsers
export function subscribeToBlockedDevices(
  callback: (devices: BlockedDevice[]) => void
): () => void {
  // Initial callback with local data
  callback(getLocalBlockedDevices());

  const syncBlockedFromServer = async () => {
    try {
      // 1. Fetch from server API
      let serverBlocked: BlockedDevice[] | null = null;
      try {
        const apiUrl = buildApiUrl('/api/security/blocked');
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.devices)) {
            serverBlocked = data.devices;
          }
        }
      } catch {
        // ignore
      }

      // 2. Fetch from Universal Cloud Relay
      const cloudData = await fetchCloudSecurityState();
      const cloudBlocked = cloudData.blocked || [];

      // Combine server + cloud (server/cloud is authoritative)
      const combinedMap = new Map<string, BlockedDevice>();
      if (serverBlocked) {
        serverBlocked.forEach((b) => combinedMap.set(b.id, b));
      }
      cloudBlocked.forEach((b) => combinedMap.set(b.id, b));

      const authoritativeList = Array.from(combinedMap.values());
      // Save authoritative list without resurrecting unblocked records
      saveLocalBlockedDevices(authoritativeList);
      callback(authoritativeList);
    } catch {
      // ignore
    }
  };

  syncBlockedFromServer();

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
          saveLocalBlockedDevices(list);
          callback(list);
        },
        () => {
          syncBlockedFromServer();
        }
      );
    } catch {
      syncBlockedFromServer();
    }
  }

  const handleLocalChange = () => {
    callback(getLocalBlockedDevices());
  };
  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('app_security_blocked_update', handleLocalChange);

  // Poll every 3 seconds
  const intervalId = setInterval(syncBlockedFromServer, 3000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('app_security_blocked_update', handleLocalChange);
    clearInterval(intervalId);
  };
}

// Real-time subscription to Login Logs across all phones and browsers
export function subscribeToLoginLogs(
  callback: (logs: LoginLog[]) => void
): () => void {
  callback(getLocalLoginLogs());

  const syncLogsFromServer = async () => {
    try {
      // 1. Fetch from Backend Server API
      let serverLogs: LoginLog[] = [];
      try {
        const apiUrl = buildApiUrl('/api/security/logs');
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.logs && Array.isArray(data.logs)) {
            serverLogs = data.logs.filter((l: LoginLog) => l && l.id && !l.id.includes('sample'));
          }
        }
      } catch {
        // ignore
      }

      // 2. Fetch from Universal Cloud Relay
      const cloudData = await fetchCloudSecurityState();
      const cloudLogs = (cloudData.logs || []).filter(
        (l: LoginLog) => l && l.id && !l.id.includes('sample')
      );

      const combinedMap = new Map<string, LoginLog>();
      serverLogs.forEach((l) => combinedMap.set(l.id, l));
      cloudLogs.forEach((l) => combinedMap.set(l.id, l));
      
      const local = getLocalLoginLogs();
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
    } catch {
      // ignore
    }
  };

  syncLogsFromServer();

  let unsubscribeFirestore: (() => void) | null = null;
  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'login_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(250));
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

          const sorted = list.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          saveLocalLoginLogs(sorted);
          callback(sorted);
        },
        () => {
          syncLogsFromServer();
        }
      );
    } catch {
      syncLogsFromServer();
    }
  }

  const handleLocalChange = () => {
    callback(getLocalLoginLogs());
  };
  window.addEventListener('storage', handleLocalChange);
  window.addEventListener('app_security_login_logs_update', handleLocalChange);

  // Poll every 3 seconds for continuous cross-device sync
  const intervalId = setInterval(syncLogsFromServer, 3000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalChange);
    window.removeEventListener('app_security_login_logs_update', handleLocalChange);
    clearInterval(intervalId);
  };
}

// Check if a specific device or IP is blocked
export function isDeviceBlockedCheck(
  currentDeviceId: string,
  currentIp: string | undefined,
  blockedList: BlockedDevice[]
): BlockedDevice | null {
  if (!currentDeviceId && !currentIp) return null;
  if (!Array.isArray(blockedList) || blockedList.length === 0) return null;

  const found = blockedList.find((b) => {
    if (!b) return false;
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
