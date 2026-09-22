import React, { useState, useEffect, useRef } from 'react';
import { Banner, BannerType, AdSize } from '../types';
import { useStore } from '../context/StoreContext';
import {
  X,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  Link as LinkIcon,
  CheckCircle2,
  Trash2,
  Tv,
  Code2,
  Sparkles,
  Eye,
} from 'lucide-react';

interface BannerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  bannerToEdit?: Banner | null;
}

export const BannerFormModal: React.FC<BannerFormModalProps> = ({
  isOpen,
  onClose,
  bannerToEdit,
}) => {
  const { saveBannerAction } = useStore();

  // Mode: 'image' (Normal Graphic Banner) vs 'ad' (Adsterra / Script Ad Banner)
  const [bannerType, setBannerType] = useState<BannerType>('image');

  // Image Banner States
  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'url'>('upload');
  const [image, setImage] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Script Ad States
  const [adCode, setAdCode] = useState('');
  const [adSize, setAdSize] = useState<AdSize>('300x250');
  const [customWidth, setCustomWidth] = useState<number>(300);
  const [customHeight, setCustomHeight] = useState<number>(250);

  // Shared States
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [isAd, setIsAd] = useState(false);
  const [active, setActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (bannerToEdit) {
      const type = bannerToEdit.type || (bannerToEdit.adCode ? 'ad' : 'image');
      setBannerType(type);

      const img = bannerToEdit.image || '';
      setImage(img);
      if (img.startsWith('data:image/')) {
        setImageSourceMode('upload');
        setUploadedFileName('Existing Uploaded Banner');
      } else {
        setImageSourceMode(img ? 'url' : 'upload');
        setUploadedFileName('');
      }

      setAdCode(bannerToEdit.adCode || '');
      setAdSize(bannerToEdit.adSize || '300x250');
      setCustomWidth(bannerToEdit.customWidth || 300);
      setCustomHeight(bannerToEdit.customHeight || 250);
      setTitle(bannerToEdit.title || '');
      setLink(bannerToEdit.link || '');
      setIsAd(type === 'ad' ? true : Boolean(bannerToEdit.isAd));
      setActive(bannerToEdit.active !== undefined ? bannerToEdit.active : true);
      setStartDate(bannerToEdit.startDate || '');
      setEndDate(bannerToEdit.endDate || '');
    } else {
      setBannerType('image');
      setImageSourceMode('upload');
      setImage('');
      setUploadedFileName('');
      setUploadedFileSize('');
      setAdCode('');
      setAdSize('300x250');
      setCustomWidth(300);
      setCustomHeight(250);
      setTitle('');
      setLink('');
      setIsAd(false);
      setActive(true);
      setStartDate('');
      setEndDate('');
    }
  }, [bannerToEdit, isOpen]);

  // Live preview effect for Script Ad in sandbox iframe
  useEffect(() => {
    if (bannerType !== 'ad' || !adCode || !previewIframeRef.current) return;
    try {
      const iframe = previewIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                html, body {
                  margin: 0; padding: 0; width: 100%; height: 100%;
                  background: transparent; display: flex;
                  justify-content: center; align-items: center;
                  overflow: hidden;
                }
              </style>
            </head>
            <body>
              ${adCode}
            </body>
          </html>
        `);
        doc.close();
      }
    } catch {
      // ignore
    }
  }, [bannerType, adCode, adSize, customWidth, customHeight]);

  if (!isOpen) return null;

  // Process and compress image to base64 WebP/JPEG using Canvas
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('অনুগ্রহ করে সঠিক ইমেজ ফাইল সিলেক্ট করুন (PNG, JPG, WebP, GIF)');
      return;
    }

    setIsProcessingFile(true);
    const sizeKB = (file.size / 1024).toFixed(1);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${sizeKB} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        setIsProcessingFile(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 700;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setImage(optimizedDataUrl);
        } else {
          setImage(result);
        }
        setIsProcessingFile(false);
      };
      img.onerror = () => {
        setImage(result);
        setIsProcessingFile(false);
      };
      img.src = result;
    };
    reader.onerror = () => {
      alert('ইমেজ ফাইলটি পড়তে ব্যর্থ হয়েছে।');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const clearUploadedImage = () => {
    setImage('');
    setUploadedFileName('');
    setUploadedFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sample Ad Codes for Quick Insertion
  const insertSampleAd = (sizeType: AdSize) => {
    setAdSize(sizeType);
    let sample = '';
    if (sizeType === '320x50') {
      sample = `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`;
    } else if (sizeType === '300x250') {
      sample = `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`;
    } else if (sizeType === '728x90') {
      sample = `<script type="text/javascript">
  atOptions = {
    'key' : 'da048a4a76479724f1d7d82a17f95446',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highrevenueformat.com/da048a4a76479724f1d7d82a17f95446/invoke.js"></script>`;
    }
    setAdCode(sample);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bannerType === 'image' && !image.trim()) {
      alert('অনুগ্রহ করে ফোন/কম্পিউটার থেকে একটি ছবি আপলোড করুন অথবা ছবির URL দিন।');
      return;
    }

    if (bannerType === 'ad' && !adCode.trim()) {
      alert('অনুগ্রহ করে Adsterra বা বিজ্ঞাপনের জাভাস্ক্রিপ্ট কোড পেস্ট করুন।');
      return;
    }

    setLoading(true);
    try {
      await saveBannerAction({
        ...(bannerToEdit ? { id: bannerToEdit.id, order: bannerToEdit.order } : {}),
        type: bannerType,
        image: bannerType === 'image' ? image.trim() : undefined,
        adCode: bannerType === 'ad' ? adCode.trim() : undefined,
        adSize: bannerType === 'ad' ? adSize : undefined,
        customWidth:
          bannerType === 'ad' && adSize === 'custom' ? Number(customWidth) || 300 : undefined,
        customHeight:
          bannerType === 'ad' && adSize === 'custom' ? Number(customHeight) || 250 : undefined,
        title: title.trim() || undefined,
        link: bannerType === 'image' ? (link.trim() || undefined) : undefined,
        isAd: bannerType === 'ad' ? true : isAd,
        active,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLoading(false);
      onClose();
    } catch (err) {
      setLoading(false);
      console.error('Error saving banner:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-neutral-200 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {bannerToEdit ? 'ব্যানার সম্পাদনা করুন' : 'নতুন ব্যানার / Ad যোগ করুন'}
            </h3>
            <p className="text-xs text-neutral-500">
              সাধারণ ইমেজ ব্যানার অথবা Adsterra স্ক্রিপ্ট Ad ব্যানার নির্বাচন করুন
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Type Switcher: [ব্যানার (Image Banner)] vs [ad (Script Ad)] */}
        <div className="mb-4 bg-neutral-100 p-1 rounded-xl grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setBannerType('image')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              bannerType === 'image'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ImageIcon size={15} className={bannerType === 'image' ? 'text-amber-600' : ''} />
            <span>ব্যানার (ইমেজ ব্যানার)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBannerType('ad');
              if (!adCode) insertSampleAd('300x250');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              bannerType === 'ad'
                ? 'bg-amber-500 text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Tv size={15} className={bannerType === 'ad' ? 'text-neutral-950' : 'text-amber-600'} />
            <span>Ad (Adsterra / স্ক্রিপ্ট ব্যানার)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ==================================================== */}
          {/* IMAGE BANNER FORM */}
          {/* ==================================================== */}
          {bannerType === 'image' ? (
            <>
              {/* Image Source Mode Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-neutral-800">
                    ব্যানার ছবি <span className="text-rose-500">*</span>
                  </label>
                  <div className="inline-flex p-0.5 bg-neutral-100 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setImageSourceMode('upload')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                        imageSourceMode === 'upload'
                          ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <UploadCloud size={13} />
                      <span>গ্যালারি / ফাইল</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSourceMode('url')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                        imageSourceMode === 'url'
                          ? 'bg-white text-neutral-900 shadow-2xs font-bold'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <LinkIcon size={13} />
                      <span>Image URL</span>
                    </button>
                  </div>
                </div>

                {imageSourceMode === 'upload' ? (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-amber-500 bg-amber-50/70 scale-[0.99]'
                          : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50 hover:bg-neutral-100/70'
                      }`}
                    >
                      {isProcessingFile ? (
                        <div className="flex flex-col items-center justify-center py-2 text-neutral-600">
                          <Loader2 size={24} className="animate-spin text-amber-500 mb-2" />
                          <span className="text-xs font-semibold">ইমেজ অপ্টিমাইজ করা হচ্ছে...</span>
                        </div>
                      ) : image && image.startsWith('data:image/') ? (
                        <div className="flex items-center justify-between gap-3 text-left">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 truncate">
                                {uploadedFileName || 'ডিভাইস থেকে ছবি যুক্ত হয়েছে'}
                              </p>
                              {uploadedFileSize && (
                                <p className="text-[11px] text-neutral-500">{uploadedFileSize}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-[11px] font-bold rounded-lg shadow-2xs"
                            >
                              পরিবর্তন
                            </button>
                            <button
                              type="button"
                              onClick={clearUploadedImage}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                              title="ছবি মুছুন"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2">
                          <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-neutral-200 flex items-center justify-center text-neutral-600 mb-2">
                            <UploadCloud size={20} />
                          </div>
                          <p className="text-xs font-bold text-neutral-800">
                            ছবি সিলেক্ট করতে ক্লিক করুন অথবা টেনে আনুন (Drag & Drop)
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            মোবাইল ফটো গ্যালারি বা কম্পিউটার থেকে PNG, JPG, WebP
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      value={image ?? ''}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Image Live Preview */}
              <div className="rounded-xl overflow-hidden bg-neutral-900 border border-neutral-200 aspect-[21/9] flex items-center justify-center relative">
                {image ? (
                  <>
                    <img
                      src={image}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                    {title && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3 sm:p-4">
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 drop-shadow-sm">
                          {title}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-neutral-400 text-xs flex flex-col items-center">
                    <ImageIcon size={24} className="mb-1 opacity-60" />
                    <span className="text-neutral-400">লাইভ ব্যানার প্রিভিউ</span>
                  </div>
                )}
                {isAd && (
                  <div className="absolute top-2 right-2 bg-black/80 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded border border-white/20">
                    Advertisement
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  শিরোনাম / অফার টেক্সট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={title ?? ''}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: বিশেষ অফার ও স্মার্ট গ্যাজেট ডিল"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ক্লিক লিংক / Destination URL (ঐচ্ছিক)
                </label>
                <input
                  type="url"
                  value={link ?? ''}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.amazon.com/deals"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                />
              </div>

              {/* Advertisement Tag Switch for Image Banner */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-neutral-900">Advertisement ট্যাগ</span>
                    <span className="block text-[11px] text-neutral-500">
                      ইমেজ ব্যানারের কোণায় ছোট "ADVERTISEMENT" ব্যাজ দেখাবে
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAd}
                    onChange={(e) => setIsAd(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                </label>
              </div>
            </>
          ) : (
            /* ==================================================== */
            /* SCRIPT AD BANNER FORM (Adsterra in Banner) */
            /* ==================================================== */
            <>
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Ad এর নাম / লেবেল (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={title ?? ''}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: Adsterra Hero Banner"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  বিজ্ঞাপনের সাইজ (Ad Size)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '300x250', label: '300x250 (স্কয়ার)' },
                    { id: '320x50', label: '320x50 (মোবাইল)' },
                    { id: '728x90', label: '728x90 (লিডারবোর্ড)' },
                    { id: 'custom', label: 'Custom (অন্যান্য)' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAdSize(s.id as AdSize)}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                        adSize === s.id
                          ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                          : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Custom Dimensions Input if Custom is Selected */}
                {adSize === 'custom' && (
                  <div className="mt-2.5 p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                    <div className="text-[11px] font-bold text-neutral-700">
                      কাস্টম বিজ্ঞাপনের সাইজ এন্টার করুন (Custom Size in px):
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-neutral-600 mb-1">
                          Width / প্রস্থ (px) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="50"
                          max="1200"
                          value={customWidth ?? 300}
                          onChange={(e) => setCustomWidth(Number(e.target.value) || 0)}
                          placeholder="300"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-neutral-600 mb-1">
                          Height / উচ্চতা (px) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="800"
                          value={customHeight ?? 250}
                          onChange={(e) => setCustomHeight(Number(e.target.value) || 0)}
                          placeholder="250"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                    <Code2 size={13} className="text-amber-600" />
                    <span>Adsterra স্ক্রিপ্ট কোড</span> <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertSampleAd('300x250')}
                      className="text-[10px] text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold"
                    >
                      + 300x250 স্যাম্পল
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSampleAd('320x50')}
                      className="text-[10px] text-neutral-600 hover:text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded font-bold"
                    >
                      + 320x50
                    </button>
                  </div>
                </div>

                <textarea
                  value={adCode ?? ''}
                  onChange={(e) => setAdCode(e.target.value)}
                  rows={4}
                  placeholder={`<script type="text/javascript">\n  atOptions = { 'key' : '...', 'format' : 'iframe', ... };\n</script>\n<script src="..."></script>`}
                  className="w-full px-3 py-2 text-[11px] font-mono bg-neutral-900 text-amber-400 border border-neutral-800 rounded-xl focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Script Ad Banner Mockup Preview */}
              <div>
                <label className="text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
                  <Eye size={13} className="text-neutral-500" />
                  <span>ব্যানার অংশে Ad কেমন দেখাবে (Live Preview)</span>
                </label>
                <div className="rounded-xl overflow-hidden bg-neutral-900 border border-neutral-300 p-4 flex flex-col items-center justify-center min-h-[140px] relative">
                  <div className="absolute top-2 right-2 bg-black/80 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded border border-white/20 z-10">
                    Advertisement
                  </div>

                  {adCode ? (
                    <div className="w-full flex items-center justify-center overflow-hidden">
                      <iframe
                        ref={previewIframeRef}
                        title="Ad Banner Preview"
                        scrolling="no"
                        frameBorder="0"
                        className="border-0 bg-transparent overflow-hidden"
                        style={{
                          width:
                            adSize === 'custom' && customWidth
                              ? `${customWidth}px`
                              : adSize === '320x50'
                              ? '320px'
                              : adSize === '728x90'
                              ? '728px'
                              : '300px',
                          height:
                            adSize === 'custom' && customHeight
                              ? `${customHeight}px`
                              : adSize === '320x50'
                              ? '50px'
                              : adSize === '728x90'
                              ? '90px'
                              : '250px',
                          maxWidth: '100%',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-neutral-400 text-xs text-center py-4">
                      বিজ্ঞাপনের কোড পেস্ট করলে এখানে সরাসরি লাইভ প্রিভিউ দেখাবে
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Active Switch (Shared) */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-neutral-900">সক্রিয় (Active)</span>
                <span className="block text-[11px] text-neutral-500">
                  চালু থাকলে ওয়েবসাইটে ব্যানার সেকশনে দেখাবে
                </span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500"
              />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading || isProcessingFile}
              className="px-5 py-2 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{bannerToEdit ? 'পরিবর্তন সংরক্ষণ করুন' : 'ব্যানার যুক্ত করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

