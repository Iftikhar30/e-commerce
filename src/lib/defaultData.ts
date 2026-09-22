import { Product, Banner, Category, StoreSettings } from '../types';

export const DEFAULT_SETTINGS: StoreSettings = {
  siteName: 'IFTI TechZyro',
  logoUrl: '',
  currency: '$',
  affiliateDisclosure: 'As an Amazon Associate, we earn from qualifying purchases.',
  footerText: '© 2026 IFTI TechZyro. All rights reserved.',
  contactEmail: 'support@iftitechzyro.com',
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Electronics', slug: 'electronics', order: 1, active: true },
  { id: 'cat-2', name: 'Gadgets', slug: 'gadgets', order: 2, active: true },
  { id: 'cat-3', name: 'Home & Kitchen', slug: 'home-kitchen', order: 3, active: true },
  { id: 'cat-4', name: 'Beauty & Personal Care', slug: 'beauty', order: 4, active: true },
  { id: 'cat-5', name: 'Smart Devices', slug: 'smart-devices', order: 5, active: true },
  { id: 'cat-6', name: 'Outdoor & Travel', slug: 'outdoor', order: 6, active: true },
  { id: 'cat-7', name: 'Accessories', slug: 'accessories', order: 7, active: true },
];

export const DEFAULT_BANNERS: Banner[] = [];

export const DEFAULT_PRODUCTS: Product[] = [];

