import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Product, Banner, Category, StoreSettings } from '../types';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_BANNERS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from './defaultData';

const LOCAL_PRODUCTS_KEY = 'affiliate_store_products';
const LOCAL_BANNERS_KEY = 'affiliate_store_banners';
const LOCAL_CATEGORIES_KEY = 'affiliate_store_categories';
const LOCAL_SETTINGS_KEY = 'affiliate_store_settings';

// Wrap Firestore network calls with a 2.5-second timeout so the UI never hangs indefinitely
function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Helper to get local data
function getLocalData<T>(key: string, defaultVal: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalData<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error('Error writing to localStorage:', err);
  }
}

// Helpers to get sanitized local lists without demo items
function getLocalProducts(): Product[] {
  const prods = getLocalData<Product[]>(LOCAL_PRODUCTS_KEY, []);
  return prods.filter((p) => p && p.id && !p.id.startsWith('prod-'));
}

function getLocalBanners(): Banner[] {
  const bans = getLocalData<Banner[]>(LOCAL_BANNERS_KEY, []);
  return bans.filter((b) => b && b.id && !b.id.startsWith('ban-'));
}

// One-time cleanup function to purge any legacy demo products and demo banners from localStorage and Firestore
export async function purgeDemoData(): Promise<void> {
  try {
    const rawProds = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (rawProds) {
      const prods: Product[] = JSON.parse(rawProds);
      const cleaned = prods.filter((p) => p && p.id && !p.id.startsWith('prod-'));
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(cleaned));
    }
    const rawBanners = localStorage.getItem(LOCAL_BANNERS_KEY);
    if (rawBanners) {
      const bans: Banner[] = JSON.parse(rawBanners);
      const cleaned = bans.filter((b) => b && b.id && !b.id.startsWith('ban-'));
      localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(cleaned));
    }
  } catch (e) {
    console.warn('Error purging local demo data:', e);
  }

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const demoProdIds = ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8', 'prod-9', 'prod-10'];
      const demoBanIds = ['ban-1', 'ban-2'];
      const batch = writeBatch(firestore);
      demoProdIds.forEach((id) => {
        batch.delete(doc(firestore, 'products', id));
      });
      demoBanIds.forEach((id) => {
        batch.delete(doc(firestore, 'banners', id));
      });
      await withTimeout(batch.commit(), 2500);
    } catch {
      // Ignore if not present or permission fails
    }
  }
}
// Run purge automatically in background
purgeDemoData().catch(() => {});

// ----------------------------------------------------
// PRODUCT OPERATIONS
// ----------------------------------------------------

export async function recordProductClick(productId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        clickCount: increment(1),
        updatedAt: new Date().toISOString(),
      });
      return;
    } catch (err) {
      console.error('Firestore clickCount increment error, updating locally:', err);
    }
  }

  // Local fallback
  const products = getLocalProducts();
  const updated = products.map((p) =>
    p.id === productId ? { ...p, clickCount: (p.clickCount || 0) + 1 } : p
  );
  setLocalData(LOCAL_PRODUCTS_KEY, updated);
}

export function subscribeProducts(
  onUpdate: (products: Product[]) => void,
  isAdmin: boolean = false
): () => void {
  if (isFirebaseConfigured && db) {
    try {
      const productsRef = collection(db, 'products');
      const q = isAdmin
        ? query(productsRef, orderBy('order', 'asc'))
        : query(productsRef, where('active', '==', true));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Product[] = snapshot.docs
              .map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Product, 'id'>),
              }))
              .filter((p) => p && p.id && !p.id.startsWith('prod-'));

            // If public, sort pinned first, then by order
            const sorted = sortProductList(list);
            onUpdate(sorted);
          } else {
            onUpdate([]);
          }
        },
        (error) => {
          console.warn('Firestore products listener fallback to local:', error);
          const local = getLocalProducts();
          const filtered = isAdmin ? local : local.filter((p) => p.active);
          onUpdate(sortProductList(filtered));
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Failed to attach Firestore listener:', err);
    }
  }

  // Local fallback
  const local = getLocalProducts();
  const filtered = isAdmin ? local : local.filter((p) => p.active);
  onUpdate(sortProductList(filtered));

  const handleStorage = () => {
    const updated = getLocalProducts();
    const filteredUpdated = isAdmin ? updated : updated.filter((p) => p.active);
    onUpdate(sortProductList(filteredUpdated));
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

// Sort rule: pinned first (by their order), then unpinned (by their order)
export function sortProductList(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

// Helper to remove any undefined fields before passing an object to Firestore setDoc / updateDoc
// Firestore throws "Function setDoc() called with invalid data. Unsupported field value: undefined"
function cleanForFirestore<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function saveProduct(product: Partial<Product> & { id?: string }): Promise<string> {
  const id = product.id || `product_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const productDoc: Product = {
    id,
    title: product.title || '',
    image: product.image || '',
    amazonUrl: product.amazonUrl || '',
    ...(product.asin ? { asin: product.asin } : {}),
    ...(product.price !== undefined && !isNaN(product.price) ? { price: product.price } : {}),
    ...(product.originalPrice !== undefined && !isNaN(product.originalPrice) ? { originalPrice: product.originalPrice } : {}),
    rating: product.rating ?? 4.5,
    reviewCount: product.reviewCount ?? 0,
    category: product.category || 'gadgets',
    badge: product.badge || '',
    clickCount: product.clickCount || 0,
    order: product.order ?? Date.now(),
    pinned: Boolean(product.pinned),
    active: product.active !== undefined ? product.active : true,
    featured: Boolean(product.featured),
    createdAt: product.createdAt || now,
    updatedAt: now,
  };

  if (isFirebaseConfigured && db) {
    try {
      const ref = doc(db, 'products', id);
      await withTimeout(setDoc(ref, cleanForFirestore(productDoc as unknown as Record<string, unknown>), { merge: true }), 2500);
    } catch (err) {
      console.warn('Firestore saveProduct sync warning (local cache saved):', err);
    }
  }

  // Always update local cache for instant UI response
  const products = getLocalProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index >= 0) {
    products[index] = productDoc;
  } else {
    products.push(productDoc);
  }
  setLocalData(LOCAL_PRODUCTS_KEY, products);

  return id;
}

export async function deleteProduct(productId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(deleteDoc(doc(db, 'products', productId)), 2500);
    } catch (err) {
      console.warn('Firestore deleteProduct sync warning (local cache updated):', err);
    }
  }

  const products = getLocalProducts();
  const updated = products.filter((p) => p.id !== productId);
  setLocalData(LOCAL_PRODUCTS_KEY, updated);
}

export async function updateProductField(
  productId: string,
  field: Partial<Product>
): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(
        updateDoc(doc(db, 'products', productId), {
          ...cleanForFirestore(field as unknown as Record<string, unknown>),
          updatedAt: new Date().toISOString(),
        }),
        2500
      );
    } catch (err) {
      console.warn('Firestore updateProductField sync warning:', err);
    }
  }

  const products = getLocalProducts();
  const updated = products.map((p) =>
    p.id === productId ? { ...p, ...field, updatedAt: new Date().toISOString() } : p
  );
  setLocalData(LOCAL_PRODUCTS_KEY, updated);
}

export async function batchUpdateProductOrders(orderedList: Product[]): Promise<void> {
  const updatedWithOrder = orderedList.map((p, index) => ({
    ...p,
    order: index + 1,
    updatedAt: new Date().toISOString(),
  }));

  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const batch = writeBatch(firestore);
      updatedWithOrder.forEach((p) => {
        const ref = doc(firestore, 'products', p.id);
        batch.update(ref, { order: p.order, updatedAt: p.updatedAt });
      });
      await withTimeout(batch.commit(), 3000);
    } catch (err) {
      console.warn('Firestore batchUpdateProductOrders sync warning:', err);
    }
  }

  setLocalData(LOCAL_PRODUCTS_KEY, updatedWithOrder);
}

// ----------------------------------------------------
// BANNER OPERATIONS
// ----------------------------------------------------

export function subscribeBanners(
  onUpdate: (banners: Banner[]) => void,
  isAdmin: boolean = false
): () => void {
  if (isFirebaseConfigured && db) {
    try {
      const bannersRef = collection(db, 'banners');
      const q = isAdmin
        ? query(bannersRef, orderBy('order', 'asc'))
        : query(bannersRef, where('active', '==', true));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs
              .map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Banner, 'id'>),
              }))
              .filter((b) => b && b.id && !b.id.startsWith('ban-'));
            onUpdate([...list].sort((a, b) => a.order - b.order));
          } else {
            onUpdate([]);
          }
        },
        (error) => {
          console.warn('Firestore banners listener fallback to local:', error);
          const local = getLocalBanners();
          const filtered = isAdmin ? local : local.filter((b) => b.active);
          onUpdate([...filtered].sort((a, b) => a.order - b.order));
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Failed to attach Firestore banner listener:', err);
    }
  }

  const local = getLocalBanners();
  const filtered = isAdmin ? local : local.filter((b) => b.active);
  onUpdate([...filtered].sort((a, b) => a.order - b.order));

  const handleStorage = () => {
    const updated = getLocalBanners();
    const filteredUpdated = isAdmin ? updated : updated.filter((b) => b.active);
    onUpdate([...filteredUpdated].sort((a, b) => a.order - b.order));
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export async function saveBanner(banner: Partial<Banner> & { id?: string }): Promise<string> {
  const id = banner.id || `banner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bannerDoc: Banner = {
    id,
    image: banner.image || '',
    title: banner.title || '',
    link: banner.link || '',
    isAd: Boolean(banner.isAd),
    active: banner.active !== undefined ? banner.active : true,
    order: banner.order ?? Date.now(),
    startDate: banner.startDate || '',
    endDate: banner.endDate || '',
    createdAt: banner.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(setDoc(doc(db, 'banners', id), bannerDoc, { merge: true }), 2500);
    } catch (err) {
      console.warn('Firestore saveBanner sync warning:', err);
    }
  }

  const banners = getLocalBanners();
  const index = banners.findIndex((b) => b.id === id);
  if (index >= 0) {
    banners[index] = bannerDoc;
  } else {
    banners.push(bannerDoc);
  }
  setLocalData(LOCAL_BANNERS_KEY, banners);
  return id;
}

export async function deleteBanner(bannerId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(deleteDoc(doc(db, 'banners', bannerId)), 2500);
    } catch (err) {
      console.warn('Firestore deleteBanner sync warning:', err);
    }
  }

  const banners = getLocalBanners();
  const updated = banners.filter((b) => b.id !== bannerId);
  setLocalData(LOCAL_BANNERS_KEY, updated);
}

export async function batchUpdateBannerOrders(orderedBanners: Banner[]): Promise<void> {
  const updated = orderedBanners.map((b, idx) => ({ ...b, order: idx + 1 }));
  const firestore = db;
  if (isFirebaseConfigured && firestore) {
    try {
      const batch = writeBatch(firestore);
      updated.forEach((b) => {
        batch.update(doc(firestore, 'banners', b.id), { order: b.order });
      });
      await withTimeout(batch.commit(), 3000);
    } catch (err) {
      console.warn('Firestore batchUpdateBannerOrders sync warning:', err);
    }
  }
  setLocalData(LOCAL_BANNERS_KEY, updated);
}

// ----------------------------------------------------
// CATEGORY OPERATIONS
// ----------------------------------------------------

export function subscribeCategories(
  onUpdate: (cats: Category[]) => void,
  isAdmin: boolean = false
): () => void {
  if (isFirebaseConfigured && db) {
    try {
      const catsRef = collection(db, 'categories');
      const q = isAdmin
        ? query(catsRef, orderBy('order', 'asc'))
        : query(catsRef, where('active', '==', true));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Category, 'id'>),
            }));
            onUpdate([...list].sort((a, b) => a.order - b.order));
          } else {
            onUpdate(DEFAULT_CATEGORIES);
          }
        },
        (err) => {
          console.warn('Firestore categories listener fallback to local:', err);
          const local = getLocalData<Category[]>(LOCAL_CATEGORIES_KEY, DEFAULT_CATEGORIES);
          onUpdate([...local].sort((a, b) => a.order - b.order));
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('Firestore category subscribe error:', err);
    }
  }

  const local = getLocalData<Category[]>(LOCAL_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  const filtered = isAdmin ? local : local.filter((c) => c.active);
  onUpdate([...filtered].sort((a, b) => a.order - b.order));

  const handleStorage = () => {
    const updated = getLocalData<Category[]>(LOCAL_CATEGORIES_KEY, DEFAULT_CATEGORIES);
    const filteredUpdated = isAdmin ? updated : updated.filter((c) => c.active);
    onUpdate([...filteredUpdated].sort((a, b) => a.order - b.order));
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export async function saveCategory(category: Partial<Category> & { id?: string }): Promise<string> {
  const id = category.id || `cat_${Date.now()}`;
  const slug =
    category.slug ||
    (category.name || 'category')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const catDoc: Category = {
    id,
    name: category.name || 'Untitled Category',
    slug,
    order: category.order ?? Date.now(),
    active: category.active !== undefined ? category.active : true,
  };

  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(setDoc(doc(db, 'categories', id), catDoc, { merge: true }), 2500);
    } catch (err) {
      console.warn('Firestore saveCategory sync warning:', err);
    }
  }

  const categories = getLocalData<Category[]>(LOCAL_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  const index = categories.findIndex((c) => c.id === id);
  if (index >= 0) {
    categories[index] = catDoc;
  } else {
    categories.push(catDoc);
  }
  setLocalData(LOCAL_CATEGORIES_KEY, categories);
  return id;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(deleteDoc(doc(db, 'categories', categoryId)), 2500);
    } catch (err) {
      console.warn('Firestore deleteCategory sync warning:', err);
    }
  }

  const categories = getLocalData<Category[]>(LOCAL_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  const updated = categories.filter((c) => c.id !== categoryId);
  setLocalData(LOCAL_CATEGORIES_KEY, updated);
}

// ----------------------------------------------------
// SETTINGS OPERATIONS
// ----------------------------------------------------

function getSanitizedSettings(): StoreSettings {
  const settings = getLocalData<StoreSettings>(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS);
  if (!settings || !settings.siteName || settings.siteName === 'PickFinds') {
    const updated = {
      ...DEFAULT_SETTINGS,
      ...settings,
      siteName: 'IFTI TechZyro',
      footerText: '© 2026 IFTI TechZyro. All rights reserved.',
    };
    setLocalData(LOCAL_SETTINGS_KEY, updated);
    return updated;
  }
  return settings;
}

export function subscribeSettings(onUpdate: (settings: StoreSettings) => void): () => void {
  if (isFirebaseConfigured && db) {
    try {
      const unsubscribe = onSnapshot(
        doc(db, 'settings', 'store_config'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as StoreSettings;
            const finalSettings = {
              ...DEFAULT_SETTINGS,
              ...data,
              siteName: data.siteName === 'PickFinds' ? 'IFTI TechZyro' : (data.siteName || 'IFTI TechZyro'),
            };
            onUpdate(finalSettings);
          } else {
            onUpdate(DEFAULT_SETTINGS);
          }
        },
        (err) => {
          console.warn('Firestore settings listener fallback to local:', err);
          onUpdate(getSanitizedSettings());
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('Firestore settings subscribe error:', err);
    }
  }

  onUpdate(getSanitizedSettings());
  const handleStorage = () => {
    onUpdate(getSanitizedSettings());
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await withTimeout(setDoc(doc(db, 'settings', 'store_config'), settings, { merge: true }), 2500);
    } catch (err) {
      console.warn('Firestore saveSettings sync warning:', err);
    }
  }
  setLocalData(LOCAL_SETTINGS_KEY, settings);
}

// ----------------------------------------------------
// AMAZON URL PARSER HELPER
// ----------------------------------------------------

export function extractAsinFromAmazonUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:\/dp\/|\/gp\/product\/|\/exec\/obidos\/asin\/|\/d\/|ASIN=|\/)([A-Z0-9]{10})(?:[/?&#]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

export function extractTitleFromAmazonUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    for (const part of parts) {
      if (
        part !== "dp" &&
        part !== "gp" &&
        part !== "product" &&
        part !== "d" &&
        part.length > 4 &&
        !/^[A-Z0-9]{10}$/i.test(part)
      ) {
        const readable = decodeURIComponent(part)
          .replace(/[-_+]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        if (readable.length > 4) {
          return readable;
        }
      }
    }
  } catch {
    // ignore
  }
  return "";
}

export function cleanAmazonUrl(url: string): string {
  const asin = extractAsinFromAmazonUrl(url);
  if (asin) {
    return `https://www.amazon.com/dp/${asin}`;
  }
  return url.trim();
}

