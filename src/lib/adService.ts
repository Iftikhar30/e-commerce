import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { AdsterraAd } from '../types';

const LOCAL_ADS_KEY = 'app_adsterra_ads_storage_v2';
const ADS_INITIALIZED_KEY = 'app_adsterra_ads_initialized_flag';

export const INITIAL_DEFAULT_ADS: AdsterraAd[] = [
  {
    id: 'ad_after_banner_sample',
    title: 'Adsterra Top Banner (Responsive)',
    format: 'Banner',
    size: '320x50',
    width: 320,
    height: 50,
    placement: 'after_banner',
    deviceTarget: 'all',
    active: true,
    order: 1,
    adCode: `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad_after_4_products_sample',
    title: 'Adsterra Mid-Grid Square (300x250)',
    format: 'Banner',
    size: '300x250',
    width: 300,
    height: 250,
    placement: 'after_4_products',
    deviceTarget: 'all',
    active: true,
    order: 2,
    adCode: `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad_before_footer_desktop',
    title: 'Adsterra Footer Leaderboard (728x90)',
    format: 'Banner',
    size: '728x90',
    width: 728,
    height: 90,
    placement: 'before_footer',
    deviceTarget: 'desktop_only',
    active: true,
    order: 3,
    adCode: `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`,
    createdAt: new Date().toISOString(),
  },
];

export function getLocalAds(): AdsterraAd[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    const isInitialized = localStorage.getItem(ADS_INITIALIZED_KEY);
    if (!isInitialized) {
      localStorage.setItem(ADS_INITIALIZED_KEY, 'true');
      localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(INITIAL_DEFAULT_ADS));
      return INITIAL_DEFAULT_ADS;
    }

    return [];
  } catch {
    return [];
  }
}

export function saveLocalAds(ads: AdsterraAd[]) {
  try {
    localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(ads));
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
    fetch('/api/ads/delete', {
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
        if (data.ads && Array.isArray(data.ads)) {
          saveLocalAds(data.ads);
          callback(data.ads);
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
            list.push(docSnap.data() as AdsterraAd);
          });
          if (list.length > 0) {
            saveLocalAds(list);
            callback(list);
          }
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

