import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD8v_ItYDaWs_1agjGm1hCxfchoLGsUX2U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pickfinds-store-22aac.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pickfinds-store-22aac',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pickfinds-store-22aac.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '45396630122',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:45396630122:web:2d1824856fac0d2de9c813',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-SJNHTT3GGQ',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.startsWith('AIzaSy')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Use experimentalForceLongPolling and persistent multi-tab cache so Firestore
    // works seamlessly in cloud containers/proxies/sandboxed environments even if WebSockets are restricted.
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    storage = getStorage(app);
  } catch (error) {
    console.warn('Firebase initialization warning:', error);
  }
}

export { app, auth, db, storage, firebaseConfig };
