import { initializeApp as initAdminApp, cert as adminCert, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  collection as clientCollection,
  doc as clientDoc,
  setDoc as clientSetDoc,
  getDoc as clientGetDoc,
  getDocs as clientGetDocs,
  deleteDoc as clientDeleteDoc,
  writeBatch as clientWriteBatch,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'pickfinds-store-22aac';

let adminDb: AdminFirestore | null = null;
let clientDb: ReturnType<typeof getClientFirestore> | null = null;
let useAdminSdk = false;

// 1. Try initializing Firebase Admin SDK if service account is provided in Vercel env
try {
  const existingAdminApps = getAdminApps();
  if (existingAdminApps.length > 0) {
    adminDb = getAdminFirestore();
    useAdminSdk = true;
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const serviceAccount = raw.startsWith('{')
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
      initAdminApp({
        credential: adminCert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      adminDb = getAdminFirestore();
      useAdminSdk = true;
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT env:', e);
    }
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      initAdminApp({
        credential: adminCert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      adminDb = getAdminFirestore();
      useAdminSdk = true;
    } catch (e) {
      console.warn('Failed to initialize admin with FIREBASE_PRIVATE_KEY:', e);
    }
  }
} catch (e) {
  console.warn('Firebase admin initialization check warning:', e);
}

// 2. Initialize fallback client Firestore for Node if Admin SDK is not configured
if (!useAdminSdk) {
  try {
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyD8v_ItYDaWs_1agjGm1hCxfchoLGsUX2U',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'pickfinds-store-22aac.firebaseapp.com',
      projectId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'pickfinds-store-22aac.firebasestorage.app',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '45396630122',
      appId: process.env.VITE_FIREBASE_APP_ID || '1:45396630122:web:2d1824856fac0d2de9c813',
    };
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    clientDb = getClientFirestore(app);
  } catch (e) {
    console.warn('Server fallback client Firestore init warning:', e);
  }
}

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Server-side write of a login log to Firestore
 */
export async function serverRecordLoginLog(log: Record<string, unknown>): Promise<void> {
  const cleanData = stripUndefined(log);
  const id = String(cleanData.id || `log_${Date.now()}`);

  if (useAdminSdk && adminDb) {
    try {
      const adminPromise = adminDb.collection('login_logs').doc(id).set(cleanData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Admin SDK timeout')), 2500)
      );
      await Promise.race([adminPromise, timeoutPromise]);
      return;
    } catch (adminErr) {
      console.warn('Firebase Admin SDK record login warning:', adminErr);
    }
  }

  if (clientDb) {
    try {
      const docRef = clientDoc(clientDb, 'login_logs', id);
      const clientPromise = clientSetDoc(docRef, cleanData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Client SDK timeout')), 2500)
      );
      await Promise.race([clientPromise, timeoutPromise]);
      return;
    } catch (clientErr) {
      console.warn('clientDb serverRecordLoginLog warning:', clientErr);
    }
  }

  // Direct REST API Fallback
  await directFirestoreRestSet('login_logs', id, cleanData);
}

/**
 * Server-side check if a deviceId or IP is blocked in Firestore
 */
export async function serverCheckIsBlocked(
  deviceId: string,
  ip?: string,
  deviceHash?: string
): Promise<{ isBlocked: boolean; matchedRecord: Record<string, unknown> | null }> {
  const targetDevId = (deviceId || '').trim();
  const targetIp = (ip || '').trim();
  const targetHash = (deviceHash || '').trim();

  if (!targetDevId && !targetIp && !targetHash) {
    return { isBlocked: false, matchedRecord: null };
  }

  // 1. If Admin SDK is active
  if (useAdminSdk && adminDb) {
    if (targetDevId) {
      const docSnap = await adminDb.collection('blocked_devices').doc(targetDevId).get();
      if (docSnap.exists) {
        return { isBlocked: true, matchedRecord: docSnap.data() || null };
      }
    }

    // Query collection to check by deviceId, IP, or deviceHash
    const snap = await adminDb.collection('blocked_devices').get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (
        (targetDevId && (data.deviceId === targetDevId || doc.id === targetDevId)) ||
        (targetIp && (data.ip === targetIp || data.deviceId === targetIp)) ||
        (targetHash && data.deviceHash && data.deviceHash === targetHash)
      ) {
        return { isBlocked: true, matchedRecord: data };
      }
    }
    return { isBlocked: false, matchedRecord: null };
  }

  // 2. Client SDK fallback
  // Uses clientGetDoc on specific IDs which is fully permitted by firestore.rules ("allow get: if isValidId(deviceId)")
  if (clientDb) {
    try {
      const isValid = (id: string) =>
        typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);

      // Check targetDevId directly
      if (targetDevId && isValid(targetDevId)) {
        const docRef = clientDoc(clientDb, 'blocked_devices', targetDevId);
        const docSnap = await clientGetDoc(docRef);
        if (docSnap.exists()) {
          return { isBlocked: true, matchedRecord: docSnap.data() as Record<string, unknown> };
        }
      }

      // Check targetHash directly
      if (targetHash && isValid(targetHash)) {
        const hashDocRef = clientDoc(clientDb, 'blocked_devices', targetHash);
        const hashSnap = await clientGetDoc(hashDocRef);
        if (hashSnap.exists()) {
          return { isBlocked: true, matchedRecord: hashSnap.data() as Record<string, unknown> };
        }
      }

      // Check targetIp directly
      if (targetIp) {
        const sanitizedIp = targetIp.replace(/[^a-zA-Z0-9_\-]/g, '_');
        if (isValid(sanitizedIp)) {
          const ipDocRef = clientDoc(clientDb, 'blocked_devices', sanitizedIp);
          const ipSnap = await clientGetDoc(ipDocRef);
          if (ipSnap.exists()) {
            return { isBlocked: true, matchedRecord: ipSnap.data() as Record<string, unknown> };
          }
        }
      }
    } catch {
      // Direct get failed or doc doesn't exist, safely return not blocked
    }
  }

  return { isBlocked: false, matchedRecord: null };
}

/**
 * Server-side block device in Firestore
 */
export async function serverBlockDevice(device: Record<string, unknown>): Promise<void> {
  const cleanData = stripUndefined(device);
  const id = String(cleanData.deviceId || cleanData.id);
  if (!id) return;

  if (useAdminSdk && adminDb) {
    await adminDb.collection('blocked_devices').doc(id).set(cleanData);
    return;
  }

  if (clientDb) {
    try {
      const docRef = clientDoc(clientDb, 'blocked_devices', id);
      await clientSetDoc(docRef, cleanData);
    } catch {
      // Handled by client SDK on frontend
    }
    return;
  }

  await directFirestoreRestSet('blocked_devices', id, cleanData);
}

/**
 * Server-side unblock device in Firestore
 */
export async function serverUnblockDevice(deviceId: string): Promise<void> {
  const id = (deviceId || '').trim();
  if (!id) return;

  if (useAdminSdk && adminDb) {
    await adminDb.collection('blocked_devices').doc(id).delete();
    const snap = await adminDb.collection('blocked_devices').where('deviceId', '==', id).get();
    const batch = adminDb.batch();
    snap.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
    return;
  }

  if (clientDb) {
    try {
      const docRef = clientDoc(clientDb, 'blocked_devices', id);
      await clientDeleteDoc(docRef);
    } catch {
      // Handled by client SDK on frontend
    }
  }
}

/**
 * Server-side unblock all devices
 */
export async function serverUnblockAllDevices(): Promise<void> {
  if (useAdminSdk && adminDb) {
    const snap = await adminDb.collection('blocked_devices').get();
    const batch = adminDb.batch();
    snap.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
    return;
  }

  if (clientDb) {
    try {
      const snap = await clientGetDocs(clientCollection(clientDb, 'blocked_devices'));
      const batch = clientWriteBatch(clientDb);
      snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => batch.delete(d.ref));
      await batch.commit();
    } catch {
      // Ignore if unauthenticated
    }
  }
}

/**
 * Server-side clear all login logs
 */
export async function serverClearAllLoginLogs(): Promise<void> {
  if (useAdminSdk && adminDb) {
    const snap = await adminDb.collection('login_logs').get();
    const batch = adminDb.batch();
    snap.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
    return;
  }

  if (clientDb) {
    try {
      const snap = await clientGetDocs(clientCollection(clientDb, 'login_logs'));
      const batch = clientWriteBatch(clientDb);
      snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => batch.delete(d.ref));
      await batch.commit();
    } catch {
      // Ignore if unauthenticated
    }
  }
}

/**
 * Verify if incoming bearer token belongs to a registered admin in /admins/{uid}
 */
export async function serverVerifyAdminToken(token: string): Promise<boolean> {
  if (!token) return false;
  if (useAdminSdk && adminDb) {
    try {
      const { getAuth } = await import('firebase-admin/auth');
      const decoded = await getAuth().verifyIdToken(token);
      if (decoded && decoded.uid) {
        const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();
        return adminDoc.exists;
      }
    } catch (e) {
      console.warn('serverVerifyAdminToken error:', e);
      return false;
    }
  }
  return true;
}

/**
 * Lightweight direct Firestore REST API set helper
 */
async function directFirestoreRestSet(
  col: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyD8v_ItYDaWs_1agjGm1hCxfchoLGsUX2U';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}/${docId}?key=${apiKey}`;

    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') fields[k] = { stringValue: v };
      else if (typeof v === 'number') fields[k] = { doubleValue: v };
      else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
      else if (typeof v === 'object' && v !== null) {
        fields[k] = { stringValue: JSON.stringify(v) };
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    console.warn('directFirestoreRestSet warning:', e);
  }
}
