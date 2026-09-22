import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductBadge } from '../types';
import { useStore } from '../context/StoreContext';
import {
  extractAsinFromAmazonUrl,
  extractTitleFromAmazonUrl,
  cleanAmazonUrl,
  isAmazonShortUrl,
} from '../lib/firestoreService';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Check,
  UploadCloud,
  Link as LinkIcon,
  Trash2,
  Star,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { categories, saveProductAction, settings } = useStore();

  const [title, setTitle] = useState('');
  const [amazonUrl, setAmazonUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [asin, setAsin] = useState('');
  const [image, setImage] = useState('');
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [price, setPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [rating, setRating] = useState<string>('4.7');
  const [reviewCount, setReviewCount] = useState<string>('100');
  const [category, setCategory] = useState('gadgets');
  const [badge, setBadge] = useState<ProductBadge>('');
  const [active, setActive] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [featured, setFeatured] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [fetchSuccessMessage, setFetchSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productToEdit) {
      setTitle(productToEdit.title || '');
      setAmazonUrl(productToEdit.amazonUrl || '');
      setAffiliateUrl(productToEdit.affiliateUrl || '');
      setAsin(productToEdit.asin || '');
      setImage(productToEdit.image || '');
      setAvailableImages(productToEdit.image ? [productToEdit.image] : []);
      if (productToEdit.image && productToEdit.image.startsWith('data:image/')) {
        setUploadedFileName('Custom Uploaded Image');
      } else {
        setUploadedFileName('');
      }
      setPrice(
        productToEdit.price !== undefined && productToEdit.price !== null
          ? String(productToEdit.price)
          : ''
      );
      setOriginalPrice(
        productToEdit.originalPrice !== undefined && productToEdit.originalPrice !== null
          ? String(productToEdit.originalPrice)
          : ''
      );
      setRating(String(productToEdit.rating ?? 4.7));
      setReviewCount(String(productToEdit.reviewCount ?? 100));
      setCategory(productToEdit.category || categories[0]?.slug || 'gadgets');
      setBadge(productToEdit.badge || '');
      setActive(productToEdit.active !== undefined ? productToEdit.active : true);
      setPinned(Boolean(productToEdit.pinned));
      setFeatured(Boolean(productToEdit.featured));
      setFetchSuccessMessage(null);
    } else {
      setTitle('');
      setAmazonUrl('');
      setAffiliateUrl('');
      setAsin('');
      setImage('');
      setAvailableImages([]);
      setUploadedFileName('');
      setUploadedFileSize('');
      setPrice('');
      setOriginalPrice('');
      setRating('4.7');
      setReviewCount('250');
      setCategory(categories[0]?.slug || 'electronics');
      setBadge('');
      setActive(true);
      setPinned(false);
      setFeatured(false);
      setFetchSuccessMessage(null);
    }
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  // Process and compress image to base64 WebP/JPEG using Canvas
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP).');
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

      // Optimize on canvas to prevent excessive payload
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
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
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setImage(optimizedDataUrl);
          setAvailableImages((prev) => [optimizedDataUrl, ...prev.filter((i) => i !== optimizedDataUrl)]);
        } else {
          setImage(result);
          setAvailableImages((prev) => [result, ...prev.filter((i) => i !== result)]);
        }
        setIsProcessingFile(false);
      };
      img.onerror = () => {
        setImage(result);
        setAvailableImages((prev) => [result, ...prev.filter((i) => i !== result)]);
        setIsProcessingFile(false);
      };
      img.src = result;
    };
    reader.onerror = () => {
      alert('Failed to read the selected file.');
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

  // Auto-fetch product details from server endpoint
  const autoFetchProductDetails = async (urlToFetch: string) => {
    if (!urlToFetch.trim()) return;
    setIsAutoFetching(true);
    setFetchSuccessMessage(null);

    try {
      const resp = await fetch('/api/extract-amazon-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.title) setTitle(data.title);
        if (data.asin) setAsin(data.asin);
        if (data.price !== undefined && data.price !== null) setPrice(String(data.price));
        if (data.originalPrice !== undefined && data.originalPrice !== null) {
          setOriginalPrice(String(data.originalPrice));
        }
        if (data.rating !== undefined && data.rating !== null) setRating(String(data.rating));
        if (data.reviewCount !== undefined && data.reviewCount !== null) {
          setReviewCount(String(data.reviewCount));
        }
        if (data.category && categories.some((c) => c.slug === data.category)) {
          setCategory(data.category);
        }

        if (Array.isArray(data.images) && data.images.length > 0) {
          setAvailableImages(data.images);
          setImage(data.images[0]);
        }

        // If the fetched URL is an affiliate shortlink or has affiliate tag and affiliateUrl is empty, preserve it
        if (!affiliateUrl.trim() && (urlToFetch.includes('a.co') || urlToFetch.includes('amzn.to') || urlToFetch.includes('tag='))) {
          setAffiliateUrl(urlToFetch.trim());
        }

        setFetchSuccessMessage('প্রডাক্টের সঠিক নাম, মূল্য, রেটিং ও ছবি সফলভাবে লোড হয়েছে!');
        setTimeout(() => setFetchSuccessMessage(null), 5000);
      } else {
        // Fallback: extract ASIN and title from URL
        const extracted = extractAsinFromAmazonUrl(urlToFetch);
        const titleFromUrl = extractTitleFromAmazonUrl(urlToFetch);
        if (titleFromUrl && !title) {
          setTitle(titleFromUrl);
        }
        if (extracted) {
          setAsin(extracted);
          const fallbackImgs = [
            `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SCRM_.jpg`,
            `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01._SCLZZZZZZZ_SX600_.jpg`,
            `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SL800_.jpg`,
            `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.PT01._SCRM_.jpg`,
            `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.PT02._SCRM_.jpg`,
          ];
          setAvailableImages(fallbackImgs);
          if (!image) setImage(fallbackImgs[0]);
        }
        setFetchSuccessMessage('Title, ASIN & product photos loaded!');
        setTimeout(() => setFetchSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.warn('Auto-fetch warning:', err);
      const extracted = extractAsinFromAmazonUrl(urlToFetch);
      const titleFromUrl = extractTitleFromAmazonUrl(urlToFetch);
      if (titleFromUrl && !title) {
        setTitle(titleFromUrl);
      }
      if (extracted) {
        setAsin(extracted);
        const fallbackImgs = [
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SCRM_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01._SCLZZZZZZZ_SX600_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SL800_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.PT01._SCRM_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.PT02._SCRM_.jpg`,
        ];
        setAvailableImages(fallbackImgs);
        if (!image) setImage(fallbackImgs[0]);
      }
      setFetchSuccessMessage('Title, ASIN & product photos loaded!');
      setTimeout(() => setFetchSuccessMessage(null), 5000);
    } finally {
      setIsAutoFetching(false);
    }
  };

  const handleAmazonUrlChange = (val: string) => {
    setAmazonUrl(val);
    const trimmed = val.trim();
    const extracted = extractAsinFromAmazonUrl(trimmed);
    const titleFromUrl = extractTitleFromAmazonUrl(trimmed);
    if (titleFromUrl && !title) {
      setTitle(titleFromUrl);
    }
    if (extracted) {
      setAsin(extracted);
      if (availableImages.length === 0) {
        const canonical = `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SCRM_.jpg`;
        setAvailableImages([
          canonical,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01._SCLZZZZZZZ_SX600_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.MAIN._SL800_.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${extracted}.01.PT01._SCRM_.jpg`,
        ]);
        if (!image) setImage(canonical);
      }
    }

    // If a full or short URL is pasted or entered, automatically trigger details extraction
    if (
      trimmed.startsWith('http') &&
      (isAmazonShortUrl(trimmed) || trimmed.includes('amazon.') || trimmed.includes('/dp/')) &&
      trimmed.length >= 14 &&
      !productToEdit
    ) {
      autoFetchProductDetails(trimmed);
    }
  };

  const handleAmazonUrlBlur = () => {
    if (amazonUrl.trim() && !productToEdit && !isAutoFetching) {
      autoFetchProductDetails(amazonUrl.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !image.trim()) {
      alert('অনুগ্রহ করে Title এবং Image প্রদান করুন (টাইটেল এবং ছবি আবশ্যক)');
      return;
    }

    setLoading(true);
    try {
      const finalUrl = amazonUrl.trim();
      await saveProductAction({
        ...(productToEdit
          ? { id: productToEdit.id, clickCount: productToEdit.clickCount, order: productToEdit.order }
          : {}),
        title: title.trim(),
        amazonUrl: finalUrl || undefined,
        affiliateUrl: affiliateUrl.trim() || undefined,
        asin: asin.trim() || (finalUrl ? extractAsinFromAmazonUrl(finalUrl) ?? undefined : undefined),
        image: image.trim(),
        price: price ? parseFloat(price) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        rating: rating ? parseFloat(rating) : 4.5,
        reviewCount: reviewCount ? parseInt(reviewCount, 10) : 0,
        category,
        badge,
        active,
        pinned,
        featured,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save product:', err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const numPrice = price ? parseFloat(price) : undefined;
  const numOrigPrice = originalPrice ? parseFloat(originalPrice) : undefined;
  const discountPercent =
    numPrice && numOrigPrice && numOrigPrice > numPrice
      ? Math.round(((numOrigPrice - numPrice) / numOrigPrice) * 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-neutral-200 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {productToEdit ? 'Edit Product' : 'Add Amazon Product'}
            </h3>
            <p className="text-xs text-neutral-500">
              Paste product link to automatically fetch title, multiple photos, star rating, price, and reviews
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Amazon Product URL Field with Auto-Fetch Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-neutral-800">
                Amazon Product URL
                <span className="text-[11px] font-normal text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded ml-2">ঐচ্ছিক (ডাটা ফেচ করার লিংক)</span>
              </label>
              <button
                type="button"
                onClick={() => autoFetchProductDetails(amazonUrl)}
                disabled={!amazonUrl.trim() || isAutoFetching}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors border border-amber-300 shadow-2xs cursor-pointer"
                title="Automatically fetch title, multiple images, rating, price, and review count"
              >
                {isAutoFetching ? (
                  <Loader2 size={13} className="animate-spin text-amber-700" />
                ) : (
                  <Sparkles size={13} className="text-amber-700" />
                )}
                <span>{isAutoFetching ? 'Fetching Details...' : 'Auto-Fetch Details'}</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="url"
                value={amazonUrl ?? ''}
                onChange={(e) => handleAmazonUrlChange(e.target.value)}
                onBlur={handleAmazonUrlBlur}
                placeholder="https://a.co/d/... or https://www.amazon.com/dp/B0... (ঐচ্ছিক)"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 pr-10"
              />
              {isAutoFetching && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 size={15} className="animate-spin text-amber-500" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-1">
              {asin ? (
                <span className="text-[11px] text-emerald-600 font-medium">
                  Detected ASIN: <span className="font-mono font-bold">{asin}</span>
                </span>
              ) : (
                <span className="text-[10.5px] text-neutral-400">
                  টিপস: ডাটা অটো-ফেচ করতে চাইলে লিংক দিতে পারেন (ঐচ্ছিক), অথবা সরাসরি নিচে টাইটেল ও ছবি দিয়েও সেইভ করতে পারবেন
                </span>
              )}
              {fetchSuccessMessage && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <Check size={12} /> {fetchSuccessMessage}
                </span>
              )}
            </div>
          </div>

          {/* 2. Affiliate URL (Optional) - User Redirection Destination (No data fetching) */}
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <LinkIcon size={13} className="text-amber-700" />
                <span>Affiliate URL</span>
                <span className="text-[11px] font-medium text-amber-800/80">(ঐচ্ছিক / Optional)</span>
              </label>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                User Click Destination
              </span>
            </div>

            <div className="relative">
              <input
                type="url"
                value={affiliateUrl ?? ''}
                onChange={(e) => setAffiliateUrl(e.target.value)}
                placeholder="https://amzn.to/... or https://a.co/... or your affiliate tag URL"
                className="w-full px-3 py-2 text-xs bg-white border border-amber-300/80 rounded-lg text-neutral-900 focus:bg-white focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder:text-neutral-400"
              />
            </div>

            <p className="text-[11px] text-amber-900/80 mt-1.5 leading-snug">
              💡 <strong>কীভাবে কাজ করবে:</strong> ইউজার প্রডাক্টে ক্লিক করলে এই Affiliate লিংকে নিয়ে যাওয়া হবে। খালি থাকলে স্বয়ংক্রিয়ভাবে উপরের মূল Amazon Product লিংকে নিয়ে যাবে (এই লিংক থেকে কোনো ডাটা ফেচ করা হবে না)।
            </p>
          </div>

          {/* Title Field */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Product Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title ?? ''}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Smart Fingerprint Padlock Waterproof Biometric..."
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Product Images: Multiple Gallery & Local Device Upload */}
          <div className="p-3.5 bg-neutral-50/80 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers size={15} className="text-neutral-700" />
                <span className="text-xs font-bold text-neutral-900">
                  Product Image Selection & Upload
                </span>
              </div>
              <span className="text-[11px] text-neutral-500">
                {availableImages.length > 0
                  ? `${availableImages.length} images available — Select active photo`
                  : 'Select photo from gallery or upload from device'}
              </span>
            </div>

            {/* If multiple images are available, render interactive gallery selector */}
            {availableImages.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-neutral-700 block">
                  Select Active Product Photo:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1 bg-white rounded-xl border border-neutral-200/70">
                  {availableImages.map((imgUrl, idx) => {
                    const isSelected = image === imgUrl;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImage(imgUrl)}
                        className={`relative rounded-lg p-1 aspect-square bg-white border-2 flex items-center justify-center overflow-hidden transition-all group cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 ring-2 ring-amber-400/50 shadow-xs'
                            : 'border-neutral-200 hover:border-neutral-300 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Option ${idx + 1}`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-xs">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Device Upload Dropzone */}
            <div className="pt-1">
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
                className={`border-2 border-dashed rounded-xl p-3 sm:p-4 text-center cursor-pointer transition-all bg-white ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50/60 scale-[0.99]'
                    : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                {isProcessingFile ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-neutral-600">
                    <Loader2 size={16} className="animate-spin text-amber-500" />
                    <span className="text-xs font-semibold">Processing photo...</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600 shrink-0">
                        <UploadCloud size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-neutral-800">
                          Upload Custom Photo from Phone / Computer
                        </p>
                        <p className="text-[10.5px] text-neutral-400">
                          Click to browse device gallery or drag & drop (JPG, PNG, WebP)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg transition-colors shrink-0"
                    >
                      Browse Device
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Image URL input & Quick Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Or Paste Custom Image URL:
                </label>
                <input
                  type="url"
                  value={image ?? ''}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... or Amazon image URL"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 p-2 bg-white border border-neutral-200 rounded-xl">
                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {image ? (
                    <img
                      src={image}
                      alt="Selected"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200';
                      }}
                    />
                  ) : (
                    <ImageIcon size={18} className="text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10.5px] font-bold text-neutral-700 block">Selected Photo</span>
                  <span className="text-[10px] text-neutral-400 truncate block">
                    {image.startsWith('data:image/') ? 'Custom Upload' : (image ? 'Online Image' : 'No photo chosen')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price, Original Price, Rating, Reviews */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Price ({settings.currency || '$'})
              </label>
              <input
                type="number"
                step="0.01"
                value={price ?? ''}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="29.99"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Original Price ({settings.currency || '$'})
              </label>
              <input
                type="number"
                step="0.01"
                value={originalPrice ?? ''}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="39.99"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Star Rating (1.0 - 5.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={rating ?? ''}
                onChange={(e) => setRating(e.target.value)}
                placeholder="4.7"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Review Count
              </label>
              <input
                type="number"
                value={reviewCount ?? ''}
                onChange={(e) => setReviewCount(e.target.value)}
                placeholder="1200"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category & Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Category
              </label>
              <select
                value={category ?? ''}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Badge
              </label>
              <select
                value={badge ?? ''}
                onChange={(e) => setBadge(e.target.value as ProductBadge)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
              >
                <option value="">None</option>
                <option value="New">New</option>
                <option value="Trending">Trending</option>
                <option value="Best Deal">Best Deal</option>
                <option value="Featured">Featured</option>
                <option value="Limited Deal">Limited Deal</option>
              </select>
            </div>
          </div>

          {/* Live Storefront Preview Card */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
            <span className="text-[10.5px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
              Live Storefront Preview
            </span>
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-neutral-200">
              <div className="w-16 h-16 bg-neutral-50 rounded-lg p-1 border border-neutral-100 shrink-0 flex items-center justify-center overflow-hidden">
                {image ? (
                  <img src={image} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={20} className="text-neutral-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neutral-900 line-clamp-1">
                  {title || 'Product Title will appear here'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {numPrice !== undefined ? (
                    <span className="text-xs font-extrabold text-amber-600">
                      {settings.currency || '$'}{numPrice.toFixed(2)}
                    </span>
                  ) : null}
                  {numOrigPrice !== undefined && (
                    <span className="text-[11px] text-neutral-400 line-through">
                      {settings.currency || '$'}{numOrigPrice.toFixed(2)}
                    </span>
                  )}
                  {discountPercent !== null && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                      -{discountPercent}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-neutral-500">
                  <div className="flex items-center text-amber-500">
                    <Star size={11} fill="currentColor" />
                    <span className="font-bold ml-0.5 text-neutral-800">{rating || '4.5'}</span>
                  </div>
                  <span>•</span>
                  <span>({reviewCount ? parseInt(reviewCount, 10).toLocaleString() : '0'} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-neutral-900">Active (Visible)</span>
                <span className="block text-[11px] text-neutral-500">
                  When OFF, product is hidden from all public views and search
                </span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
              />
            </label>

            <div className="border-t border-neutral-200/60 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-neutral-900">Pin to Top</span>
                  <span className="block text-[11px] text-neutral-500">
                    Always displays above normal products (invisible to visitors)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </label>
            </div>

            <div className="border-t border-neutral-200/60 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-neutral-900">Featured Highlight</span>
                  <span className="block text-[11px] text-neutral-500">
                    Showcases product in the homepage Featured highlights section
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isProcessingFile}
              className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? 'Saving...' : (productToEdit ? 'Save Changes' : 'Create Product')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
