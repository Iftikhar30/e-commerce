import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Globe,
  DollarSign,
  ShieldCheck,
  Mail,
} from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const { settings, saveSettingsAction } = useStore();

  const [siteName, setSiteName] = useState(settings.siteName || 'IFTI TechZyro');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [currency, setCurrency] = useState(settings.currency || '$');
  const [affiliateDisclosure, setAffiliateDisclosure] = useState(
    settings.affiliateDisclosure || ''
  );
  const [footerText, setFooterText] = useState(settings.footerText || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettingsAction({
      siteName: siteName.trim(),
      logoUrl: logoUrl.trim(),
      currency: currency.trim() || '$',
      affiliateDisclosure: affiliateDisclosure.trim(),
      footerText: footerText.trim(),
      contactEmail: contactEmail.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Storefront Settings
          </h2>
          <p className="text-xs text-neutral-500">
            Configure branding, currency, Amazon legal disclosures, and database connection
          </p>
        </div>
      </div>

      {/* Firebase Database Status Card */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isFirebaseConfigured
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Database Connection Status
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                isFirebaseConfigured ? 'text-emerald-600' : 'text-amber-700'
              }`}
            >
              {isFirebaseConfigured ? (
                <>
                  <CheckCircle2 size={13} /> Cloud Firestore & Firebase Auth Connected
                </>
              ) : (
                <>
                  <AlertCircle size={13} /> Running in Local Storage Mode (Ready for Firebase sync)
                </>
              )}
            </span>
          </div>
        </div>

        <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl mt-1">
          {isFirebaseConfigured
            ? 'All product documents, click counts, promotional banners, and admin authentications are synchronized directly with your live Google Cloud Firestore and Firebase Auth project.'
            : 'To connect to your live Firebase Cloud Firestore, supply your VITE_FIREBASE_* credentials in your .env file or deployment hosting environment variables (see SETUP GUIDE below).'}
        </p>
      </div>

      {/* Firebase Environment Variables Helper Card */}
      <div className="bg-neutral-900 text-neutral-100 p-5 rounded-2xl border border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-neutral-950 flex items-center justify-center font-bold">
            <Database size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Vercel Environment Variables Guide (For Cross-Device Live Sync)
            </h3>
            <p className="text-[11px] text-neutral-400">
              To make products visible on all devices, phones, and visitors, add these variables in your Vercel Project Settings.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono text-[11px] text-amber-300 space-y-1 overflow-x-auto select-all">
            <p>VITE_FIREBASE_API_KEY=your_firebase_api_key</p>
            <p>VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com</p>
            <p>VITE_FIREBASE_PROJECT_ID=your_project_id</p>
            <p>VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com</p>
            <p>VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id</p>
            <p>VITE_FIREBASE_APP_ID=your_app_id</p>
            <p>GEMINI_API_KEY=your_gemini_api_key</p>
          </div>
          <div className="text-[11px] text-neutral-400 space-y-1 pt-1">
            <p>🔹 <strong>How to find Firebase credentials:</strong> Go to Firebase Console ➔ Project Settings ➔ General ➔ Under "Your apps" copy the Web app config.</p>
            <p>🔹 <strong>Where to add in Vercel:</strong> Vercel Dashboard ➔ Select your Project ➔ Settings ➔ Environment Variables ➔ Add the keys ➔ Redeploy.</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
              <Globe size={13} />
              <span>Storefront Brand Name</span>
            </label>
            <input
              type="text"
              required
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. IFTI TechZyro"
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
              <DollarSign size={13} />
              <span>Default Currency Symbol</span>
            </label>
            <input
              type="text"
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="$"
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">
            Logo Image URL (Optional)
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://your-domain.com/logo.png"
            className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
          />
          <span className="text-[11px] text-neutral-400 block mt-1">
            Leave blank to use the modern default typography brand logo
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
            <Mail size={13} />
            <span>Support / Contact Email</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="contact@yourstore.com"
            className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1.5">
            <ShieldCheck size={13} />
            <span>Amazon Affiliate Disclosure Statement</span>
          </label>
          <textarea
            rows={4}
            value={affiliateDisclosure}
            onChange={(e) => setAffiliateDisclosure(e.target.value)}
            placeholder="Required Amazon affiliate statement..."
            className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">
            Footer Copyright / Bottom Note
          </label>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="© 2026 IFTI TechZyro. All rights reserved."
            className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          <div>
            {saved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Settings successfully saved!
              </span>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Save size={14} />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
