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

const LOCAL_ADS_KEY = 'app_adsterra_ads_storage';

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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    return INITIAL_DEFAULT_ADS;
  } catch {
    return INITIAL_DEFAULT_ADS;
  }
}

export function saveLocalAds(ads: AdsterraAd[]) {
  try {
    localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(ads));
    window.dispatchEvent(new CustomEvent('app_adsterra_ads_updated'));
  } catch {
    // ignore
  }
}

export async function saveAd(ad: AdsterraAd): Promise<void> {
  // Update local storage
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

  // Sync to Firestore
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
  const current = getLocalAds();
  const updatedList = current.filter((a) => a.id !== adId);
  saveLocalAds(updatedList);

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
  // Fire initial local ads
  callback(getLocalAds());

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
          } else {
            callback(getLocalAds());
          }
        },
        (err) => {
          console.warn('Firestore ads subscription warning:', err);
          callback(getLocalAds());
        }
      );
    } catch {
      callback(getLocalAds());
    }
  }

  const handleLocalUpdate = () => {
    callback(getLocalAds());
  };

  window.addEventListener('storage', handleLocalUpdate);
  window.addEventListener('app_adsterra_ads_updated', handleLocalUpdate);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    window.removeEventListener('storage', handleLocalUpdate);
    window.removeEventListener('app_adsterra_ads_updated', handleLocalUpdate);
  };
}
