export type ProductBadge = 'New' | 'Trending' | 'Best Deal' | 'Featured' | 'Limited Deal' | '';

export interface Product {
  id: string;
  title: string;
  image: string;
  amazonUrl: string;
  asin?: string;
  price?: number;
  originalPrice?: number;
  rating: number;
  reviewCount?: number;
  category: string;
  badge?: ProductBadge;
  clickCount: number;
  order: number;
  pinned: boolean;
  active: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Banner {
  id: string;
  image: string;
  title?: string;
  link?: string;
  isAd: boolean;
  active: boolean;
  order: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  order: number;
  active: boolean;
}

export interface StoreSettings {
  siteName: string;
  logoUrl?: string;
  currency: string;
  affiliateDisclosure: string;
  footerText: string;
  contactEmail: string;
}

export interface UserAuth {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}
