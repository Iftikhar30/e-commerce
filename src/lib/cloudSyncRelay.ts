import { LoginLog, BlockedDevice } from '../types';

const CLOUD_SYNC_PRIMARY_ID = 'ff808181a09d98f701a0c9519a746ec7';
const CLOUD_SYNC_BACKUP_ID = 'ff808181a09d98f701a0c951e5566ec8';
const BASE_URL = 'https://api.restful-api.dev/objects';

interface CloudPayload {
  logs: LoginLog[];
  blocked: BlockedDevice[];
}

let inFlightSync: Promise<any> | null = null;
let lastKnownState: CloudPayload = { logs: [], blocked: [] };

async function fetchFromId(id: string): Promise<CloudPayload | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${BASE_URL}/${id}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && typeof json.data === 'object') {
        const logs = Array.isArray(json.data.logs) ? json.data.logs : [];
        const blocked = Array.isArray(json.data.blocked) ? json.data.blocked : [];
        return { logs, blocked };
      }
    }
  } catch {
    // continue
  }
  return null;
}

async function writeToId(id: string, payload: CloudPayload): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'ecommerce_security_sync',
        data: {
          logs: payload.logs.slice(0, 250),
          blocked: payload.blocked.slice(0, 100),
        },
      }),
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch all login logs and blocked devices from the global Cloud Relay.
 * Works seamlessly from any phone, laptop, WiFi, mobile data, or Vercel.
 */
export async function fetchCloudSecurityState(): Promise<CloudPayload> {
  const primary = await fetchFromId(CLOUD_SYNC_PRIMARY_ID);
  if (primary) {
    lastKnownState = primary;
    return primary;
  }
  const backup = await fetchFromId(CLOUD_SYNC_BACKUP_ID);
  if (backup) {
    lastKnownState = backup;
    return backup;
  }
  return lastKnownState;
}

/**
 * Save a new login attempt (success or failed) to the universal cloud relay.
 */
export async function pushCloudLoginLog(newLog: LoginLog): Promise<void> {
  const op = async () => {
    const current = await fetchCloudSecurityState();
    const mergedLogs: LoginLog[] = [
      newLog,
      ...current.logs.filter((l) => l && l.id !== newLog.id),
    ].slice(0, 250);

    const updatedPayload: CloudPayload = {
      logs: mergedLogs,
      blocked: current.blocked,
    };

    lastKnownState = updatedPayload;

    // Write to primary and backup in parallel
    await Promise.allSettled([
      writeToId(CLOUD_SYNC_PRIMARY_ID, updatedPayload),
      writeToId(CLOUD_SYNC_BACKUP_ID, updatedPayload),
    ]);
  };

  if (inFlightSync) {
    inFlightSync = inFlightSync.then(op).catch(op);
  } else {
    inFlightSync = op();
  }
  return inFlightSync;
}

/**
 * Push a blocked device or IP to the universal cloud relay.
 */
export async function pushCloudBlockDevice(device: BlockedDevice): Promise<void> {
  const op = async () => {
    const current = await fetchCloudSecurityState();
    const cleanBlocked = current.blocked.filter(
      (b) => b && b.id !== device.id && b.deviceId !== device.deviceId && (device.ip ? b.ip !== device.ip : true)
    );
    cleanBlocked.unshift(device);

    if (device.ip && device.ip !== 'Unknown IP' && device.ip !== '127.0.0.1') {
      const ipEntry: BlockedDevice = {
        ...device,
        id: `ip_${device.ip.replace(/[^a-zA-Z0-9]/g, '_')}`,
      };
      if (!cleanBlocked.some((b) => b.id === ipEntry.id)) {
        cleanBlocked.unshift(ipEntry);
      }
    }

    const updatedPayload: CloudPayload = {
      logs: current.logs,
      blocked: cleanBlocked.slice(0, 100),
    };

    lastKnownState = updatedPayload;

    await Promise.allSettled([
      writeToId(CLOUD_SYNC_PRIMARY_ID, updatedPayload),
      writeToId(CLOUD_SYNC_BACKUP_ID, updatedPayload),
    ]);
  };

  if (inFlightSync) {
    inFlightSync = inFlightSync.then(op).catch(op);
  } else {
    inFlightSync = op();
  }
  return inFlightSync;
}

/**
 * Remove a blocked device or IP from the universal cloud relay.
 */
export async function removeCloudBlockDevice(idOrIp: string): Promise<void> {
  const op = async () => {
    const current = await fetchCloudSecurityState();
    const remaining = current.blocked.filter(
      (b) => b && b.id !== idOrIp && b.deviceId !== idOrIp && b.ip !== idOrIp
    );

    const updatedPayload: CloudPayload = {
      logs: current.logs,
      blocked: remaining,
    };

    lastKnownState = updatedPayload;

    await Promise.allSettled([
      writeToId(CLOUD_SYNC_PRIMARY_ID, updatedPayload),
      writeToId(CLOUD_SYNC_BACKUP_ID, updatedPayload),
    ]);
  };

  if (inFlightSync) {
    inFlightSync = inFlightSync.then(op).catch(op);
  } else {
    inFlightSync = op();
  }
  return inFlightSync;
}

/**
 * Clear all login logs in the universal cloud relay.
 */
export async function clearCloudLogs(): Promise<void> {
  const op = async () => {
    const current = await fetchCloudSecurityState();
    const updatedPayload: CloudPayload = {
      logs: [],
      blocked: current.blocked,
    };

    lastKnownState = updatedPayload;

    await Promise.allSettled([
      writeToId(CLOUD_SYNC_PRIMARY_ID, updatedPayload),
      writeToId(CLOUD_SYNC_BACKUP_ID, updatedPayload),
    ]);
  };

  if (inFlightSync) {
    inFlightSync = inFlightSync.then(op).catch(op);
  } else {
    inFlightSync = op();
  }
  return inFlightSync;
}
