export type ProductBadge = 'New' | 'Trending' | 'Best Deal' | 'Featured' | 'Limited Deal' | '';

export interface Product {
  id: string;
  title: string;
  image: string;
  amazonUrl?: string;
  affiliateUrl?: string; // Optional custom affiliate URL for user redirection
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

export type BannerType = 'image' | 'ad';

export interface Banner {
  id: string;
  type?: BannerType; // 'image' | 'ad'
  image?: string;
  title?: string;
  link?: string;
  isAd: boolean;
  adCode?: string; // Adsterra JavaScript or iframe snippet for Banner Ad
  adSize?: AdSize; // '320x50' | '300x250' | '728x90' | 'custom'
  customWidth?: number;
  customHeight?: number;
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

export type AdPlacement =
  | 'after_banner'
  | 'after_4_products'
  | 'after_8_products'
  | 'after_12_products'
  | 'before_footer';

export type AdSize = '320x50' | '300x250' | '728x90' | 'custom';
export type AdDeviceTarget = 'all' | 'mobile_only' | 'desktop_only';

export interface AdsterraAd {
  id: string;
  title: string;
  format: string; // e.g., 'Banner', 'Native', 'Popunder', 'Social Bar', 'Direct Link', 'Custom'
  size: AdSize;
  width?: number;
  height?: number;
  adCode: string; // Adsterra JavaScript or iframe snippet
  placement: AdPlacement;
  deviceTarget: AdDeviceTarget;
  active: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
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

export interface DeviceInfo {
  deviceId: string;
  deviceHash?: string;
  ip?: string;
  browser: string;
  os: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  userAgent: string;
  city?: string;
  country?: string;
  screenResolution?: string;
}

export interface LoginLog {
  id: string;
  email: string;
  status: 'success' | 'failed' | 'blocked';
  reason?: string;
  device: DeviceInfo;
  timestamp: string;
}

export interface BlockedDevice {
  id: string; // matches deviceId or IP
  deviceId: string;
  deviceHash?: string;
  ip?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  reason?: string;
  blockedAt: string;
  blockedBy?: string;
}
