import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { AdsterraAd } from '../types';

const LOCAL_ADS_KEY = 'app_adsterra_ads_storage_v2';
const ADS_INITIALIZED_KEY = 'app_adsterra_ads_initialized_flag_v3';

export const INITIAL_DEFAULT_ADS: AdsterraAd[] = [];

// Clean up any legacy sample/demo ads from localStorage and Firestore
export async function purgeDemoAds(): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY);
    if (raw) {
      const parsed: AdsterraAd[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (a) =>
            a &&
            a.id &&
            !a.id.includes('sample') &&
            !a.id.startsWith('ad_after_banner_') &&
            !a.id.startsWith('ad_after_4_') &&
            !a.id.startsWith('ad_before_footer_')
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(cleaned));
        }
      }
    }
  } catch {
    // ignore
  }

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const demoAdIds = ['ad_after_banner_sample', 'ad_after_4_products_sample', 'ad_before_footer_desktop'];
      const batch = writeBatch(firestore);
      demoAdIds.forEach((id) => {
        batch.delete(doc(firestore, 'ads', id));
      });
      await batch.commit().catch(() => {});
    } catch {
      // ignore
    }
  }
}

// Automatically trigger purge in background
purgeDemoAds().catch(() => {});

export function getLocalAds(): AdsterraAd[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (a) =>
            a &&
            a.id &&
            !a.id.includes('sample') &&
            !a.id.startsWith('ad_after_banner_') &&
            !a.id.startsWith('ad_after_4_') &&
            !a.id.startsWith('ad_before_footer_')
        );
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveLocalAds(ads: AdsterraAd[]) {
  try {
    const cleanList = (ads || []).filter(
      (a) =>
        a &&
        a.id &&
        !a.id.includes('sample') &&
        !a.id.startsWith('ad_after_banner_') &&
        !a.id.startsWith('ad_after_4_') &&
        !a.id.startsWith('ad_before_footer_')
    );
    localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(cleanList));
    localStorage.setItem(ADS_INITIALIZED_KEY, 'true');
    window.dispatchEvent(new CustomEvent('app_adsterra_ads_updated'));
  } catch {
    // ignore
  }
}

export async function saveAd(ad: AdsterraAd): Promise<void> {
  // 1. Update local storage
  const current = getLocalAds();
  const index = current.findIndex((a) => a.id === ad.id);
  const now = new Date().toISOString();
  const updatedAd = { ...ad, updatedAt: now };

  let updatedList: AdsterraAd[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = updatedAd;
  } else {
    updatedList = [...current, { ...updatedAd, createdAt: updatedAd.createdAt || now }];
  }

  saveLocalAds(updatedList);

  // 2. Sync to Backend Server for instant cross-device distribution
  try {
    fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedAd),
    }).catch(() => {});
  } catch {
    // ignore
  }

  // 3. Sync to Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'ads', ad.id);
      await setDoc(docRef, updatedAd, { merge: true });
    } catch (err) {
      console.warn('Firestore saveAd warning:', err);
    }
  }
}

export async function deleteAd(adId: string): Promise<void> {
  // 1. Immediately update local storage
  const current = getLocalAds();
  const updatedList = current.filter((a) => a.id !== adId);
  saveLocalAds(updatedList);

  // 2. Delete on backend server so it never comes back from any device
  try {
    await fetch('/api/ads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: adId }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  // 3. Delete in Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'ads', adId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore deleteAd warning:', err);
    }
  }
}

export async function toggleAdActive(adId: string, active: boolean): Promise<void> {
  const current = getLocalAds();
  const index = current.findIndex((a) => a.id === adId);
  if (index >= 0) {
    const updated = [...current];
    updated[index] = { ...updated[index], active, updatedAt: new Date().toISOString() };
    saveLocalAds(updated);
  }

  // Sync to server
  try {
    fetch(`/api/ads/${adId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'ads', adId);
      await updateDoc(docRef, { active, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('Firestore toggleAdActive warning:', err);
    }
  }
}

export function subscribeToAds(callback: (ads: AdsterraAd[]) => void): () => void {
  // 1. Initial fire from local storage
  callback(getLocalAds());

  // 2. Fetch latest ads from backend server
  const fetchServerAds = async () => {
    try {
      const res = await fetch('/api/ads');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.ads)) {
          const validAds = data.ads.filter(
            (a: AdsterraAd) =>
              a &&
              a.id &&
              !a.id.includes('sample') &&
              !a.id.startsWith('ad_after_banner_') &&
              !a.id.startsWith('ad_after_4_') &&
              !a.id.startsWith('ad_before_footer_')
          );
          saveLocalAds(validAds);
          callback(validAds);
        }
      }
    } catch {
      // ignore
    }
  };

  fetchServerAds();
  const intervalId = setInterval(fetchServerAds, 4000);

  let unsubscribeFirestore: (() => void) | null = null;

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'ads');
      const q = query(colRef, orderBy('order', 'asc'));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const list: AdsterraAd[] = [];
          snapshot.forEach((docSnap) => {
            const item = docSnap.data() as AdsterraAd;
            if (
              item &&
              item.id &&
              !item.id.includes('sample') &&
              !item.id.startsWith('ad_after_banner_') &&
              !item.id.startsWith('ad_after_4_') &&
              !item.id.startsWith('ad_before_footer_')
            ) {
              list.push(item);
            }
          });
          // CRITICAL: Always update local state and notify callback,
          // even if list is empty (0 ads remaining after deletion)!
          saveLocalAds(list);
          callback(list);
        },
        (err) => {
          console.warn('Firestore ads subscription warning:', err);
        }
      );
    } catch {
      // ignore
    }
  }

  const handleLocalUpdate = () => {
    callback(getLocalAds());
  };

  window.addEventListener('storage', handleLocalUpdate);
  window.addEventListener('app_adsterra_ads_updated', handleLocalUpdate);

  return () => {
    clearInterval(intervalId);
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalUpdate);
    window.removeEventListener('app_adsterra_ads_updated', handleLocalUpdate);
  };
}

