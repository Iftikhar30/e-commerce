import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Tv,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Layers,
  Smartphone,
  Monitor,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { AdsterraAd, AdPlacement, AdSize, AdDeviceTarget } from '../types';
import { saveAd } from '../lib/adService';

interface AdFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  adToEdit: AdsterraAd | null;
  onSaved?: () => void;
}

export const AdFormModal: React.FC<AdFormModalProps> = ({
  isOpen,
  onClose,
  adToEdit,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('Banner');
  const [size, setSize] = useState<AdSize>('320x50');
  const [customWidth, setCustomWidth] = useState<number>(320);
  const [customHeight, setCustomHeight] = useState<number>(50);
  const [placement, setPlacement] = useState<AdPlacement>('after_banner');
  const [deviceTarget, setDeviceTarget] = useState<AdDeviceTarget>('all');
  const [adCode, setAdCode] = useState('');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (adToEdit) {
      setTitle(adToEdit.title || '');
      setFormat(adToEdit.format || 'Banner');
      setSize(adToEdit.size || '320x50');
      setCustomWidth(adToEdit.width || 320);
      setCustomHeight(adToEdit.height || 50);
      setPlacement(adToEdit.placement || 'after_banner');
      setDeviceTarget(adToEdit.deviceTarget || 'all');
      setAdCode(adToEdit.adCode || '');
      setActive(adToEdit.active !== undefined ? adToEdit.active : true);
      setOrder(adToEdit.order || 1);
    } else {
      setTitle('');
      setFormat('Banner');
      setSize('320x50');
      setCustomWidth(320);
      setCustomHeight(50);
      setPlacement('after_banner');
      setDeviceTarget('all');
      setAdCode('');
      setActive(true);
      setOrder(1);
    }
    setPreviewMode(false);
    setErrorMessage(null);
  }, [adToEdit, isOpen]);

  // Adjust size dimensions automatically
  const handleSizeChange = (newSize: AdSize) => {
    setSize(newSize);
    if (newSize === '320x50') {
      setCustomWidth(320);
      setCustomHeight(50);
      if (deviceTarget === 'all') setDeviceTarget('all');
    } else if (newSize === '300x250') {
      setCustomWidth(300);
      setCustomHeight(250);
    } else if (newSize === '728x90') {
      setCustomWidth(728);
      setCustomHeight(90);
      setDeviceTarget('desktop_only');
    }
  };

  const handleInsertTemplate = (templateKey: string) => {
    let w = 320;
    let h = 50;
    if (size === '300x250') {
      w = 300;
      h = 250;
    } else if (size === '728x90') {
      w = 728;
      h = 90;
    } else {
      w = customWidth || 320;
      h = customHeight || 50;
    }

    const snippet = `<script type="text/javascript">
  atOptions = {
    'key' : '${templateKey || 'da048a4a76479724f1d7d82a17f95446'}',
    'format' : 'iframe',
    'height' : ${h},
    'width' : ${w},
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/${templateKey || 'da048a4a76479724f1d7d82a17f95446'}/invoke.js"></script>`;
    setAdCode(snippet);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please enter an Ad Title');
      return;
    }

    if (!adCode.trim()) {
      setErrorMessage('Please paste the Adsterra JavaScript / script snippet');
      return;
    }

    setSaving(true);
    try {
      const adId = adToEdit?.id || `ad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newAd: AdsterraAd = {
        id: adId,
        title: title.trim(),
        format: format.trim(),
        size,
        width: size === '320x50' ? 320 : size === '300x250' ? 300 : size === '728x90' ? 728 : customWidth,
        height: size === '320x50' ? 50 : size === '300x250' ? 250 : size === '728x90' ? 90 : customHeight,
        adCode: adCode.trim(),
        placement,
        deviceTarget,
        active,
        order: Number(order) || 1,
      };

      await saveAd(newAd);
      setSaving(false);
      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      setSaving(false);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save Adsterra configuration');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-neutral-200 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Tv size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                {adToEdit ? 'Edit Adsterra Ad' : 'Add New Adsterra Ad'}
              </h3>
              <p className="text-xs text-neutral-500">
                Configure Adsterra advertisement unit and automatic placement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Title & Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Ad Title (নাম) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title ?? ''}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Header Mobile Banner 320x50"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Ad Format
              </label>
              <select
                value={format ?? 'Banner'}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="Banner">Standard Banner</option>
                <option value="Native">Native Banner</option>
                <option value="Social Bar">Social Bar</option>
                <option value="Popunder">Popunder</option>
                <option value="Custom">Custom Code</option>
              </select>
            </div>
          </div>

          {/* Row 2: Size & Placement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Ad Size (সাইজ)
              </label>
              <select
                value={size ?? '320x50'}
                onChange={(e) => handleSizeChange(e.target.value as AdSize)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden font-semibold"
              >
                <option value="320x50">320x50 (Mobile Banner)</option>
                <option value="300x250">300x250 (Medium Rectangle)</option>
                <option value="728x90">728x90 (Desktop Leaderboard)</option>
                <option value="custom">Custom Size</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Placement (কোথায় দেখাবে)
              </label>
              <select
                value={placement ?? 'after_banner'}
                onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="after_banner">After banner (ব্যানারের নিচে)</option>
                <option value="after_4_products">After 4 products (৪টি প্রোডাক্টের পর)</option>
                <option value="after_8_products">After 8 products (৮টি প্রোডাক্টের পর)</option>
                <option value="after_12_products">After 12 products (১২টি প্রোডাক্টের পর)</option>
                <option value="before_footer">Before footer (ফুটারের আগে)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Device Target
              </label>
              <select
                value={deviceTarget ?? 'all'}
                onChange={(e) => setDeviceTarget(e.target.value as AdDeviceTarget)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
              >
                <option value="all">All Devices (সব ডিভাইসে)</option>
                <option value="mobile_only">Mobile Only (শুধু মোবাইলে)</option>
                <option value="desktop_only">Desktop Only (শুধু কম্পিউটারে)</option>
              </select>
            </div>
          </div>

          {/* Custom dimensions if custom */}
          {size === 'custom' && (
            <div className="grid grid-cols-2 gap-3.5 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Width (px)</label>
                <input
                  type="number"
                  value={customWidth ?? 320}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Height (px)</label>
                <input
                  type="number"
                  value={customHeight ?? 50}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Ad Code (JavaScript snippet from Adsterra) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Code2 size={13} className="text-amber-600" />
                <span>Adsterra Ad Code (JavaScript snippet)</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleInsertTemplate('da048a4a76479724f1d7d82a17f95446')}
                className="text-[10.5px] text-amber-700 hover:text-amber-800 font-semibold underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={11} />
                <span>Adsterra Sample Snippet ইনসার্ট করুন</span>
              </button>
            </div>
            <textarea
              required
              rows={6}
              value={adCode ?? ''}
              onChange={(e) => setAdCode(e.target.value)}
              placeholder={`<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`}
              className="w-full p-3 font-mono text-[11px] bg-neutral-900 text-amber-300 border border-neutral-700 rounded-xl focus:outline-hidden focus:border-amber-400 leading-relaxed"
            />
            <p className="text-[10.5px] text-neutral-400 mt-1">
              Adsterra ড্যাশবোর্ড থেকে পাওয়া সম্পূর্ণ <code>&lt;script&gt;</code> কোডটি এখানে পেস্ট করুন। এটি স্বয়ংক্রিয়ভাবে সেফ স্যান্ডবক্স আইফ্রেমে লোড হবে।
            </p>
          </div>

          {/* Status and Order */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ad-active-toggle"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="ad-active-toggle" className="text-xs font-bold text-neutral-800 cursor-pointer">
                Active (ওয়েবসাইটে বিজ্ঞাপনটি দেখাবে)
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-medium">Priority Order:</span>
              <input
                type="number"
                min="1"
                max="99"
                value={order ?? 1}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-14 px-2 py-1 text-xs bg-white border border-neutral-300 rounded-lg text-center"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'সংরক্ষণ হচ্ছে...' : adToEdit ? 'আপডেট করুন' : 'বিজ্ঞাপন যোগ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
