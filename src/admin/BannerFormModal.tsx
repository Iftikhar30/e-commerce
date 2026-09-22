import React, { useState, useEffect, useRef } from 'react';
import { Banner } from '../types';
import { useStore } from '../context/StoreContext';
import { X, Image as ImageIcon, Loader2, UploadCloud, Link as LinkIcon, CheckCircle2, Trash2 } from 'lucide-react';

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

  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'url'>('upload');
  const [image, setImage] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [isAd, setIsAd] = useState(false);
  const [active, setActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bannerToEdit) {
      const img = bannerToEdit.image || '';
      setImage(img);
      if (img.startsWith('data:image/')) {
        setImageSourceMode('upload');
        setUploadedFileName('Existing Uploaded Banner');
      } else {
        setImageSourceMode(img ? 'url' : 'upload');
        setUploadedFileName('');
      }
      setTitle(bannerToEdit.title || '');
      setLink(bannerToEdit.link || '');
      setIsAd(Boolean(bannerToEdit.isAd));
      setActive(bannerToEdit.active !== undefined ? bannerToEdit.active : true);
      setStartDate(bannerToEdit.startDate || '');
      setEndDate(bannerToEdit.endDate || '');
    } else {
      setImageSourceMode('upload');
      setImage('');
      setUploadedFileName('');
      setUploadedFileSize('');
      setTitle('');
      setLink('');
      setIsAd(false);
      setActive(true);
      setStartDate('');
      setEndDate('');
    }
  }, [bannerToEdit, isOpen]);

  if (!isOpen) return null;

  // Process and compress image to base64 WebP/JPEG using Canvas
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP, GIF).');
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

      // Optimize on canvas to avoid huge memory footprint
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
          // Try webp first for high quality and small size, fallback to jpeg
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

  const clearUploadedImage = () => {
    setImage('');
    setUploadedFileName('');
    setUploadedFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image.trim()) {
      alert('Please upload an image from your device or enter an image URL.');
      return;
    }

    setLoading(true);
    try {
      await saveBannerAction({
        ...(bannerToEdit ? { id: bannerToEdit.id, order: bannerToEdit.order } : {}),
        image: image.trim(),
        title: title.trim() || undefined,
        link: link.trim() || undefined,
        isAd,
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
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {bannerToEdit ? 'Edit Promotional Banner' : 'Add Promotional Banner'}
            </h3>
            <p className="text-xs text-neutral-500">
              Upload banner graphics from phone/computer or use an image URL
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Source Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-neutral-800">
                Banner Graphic <span className="text-rose-500">*</span>
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
                  <span>Upload Device Photo</span>
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
                {/* Drag and drop upload zone */}
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
                      <span className="text-xs font-semibold">Optimizing and loading banner image...</span>
                    </div>
                  ) : image && image.startsWith('data:image/') ? (
                    <div className="flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {uploadedFileName || 'Photo Selected from Device'}
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
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={clearUploadedImage}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Remove photo"
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
                        Click to select photo or drag & drop here
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Supports PNG, JPG, WebP from phone photo gallery or computer
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Live Preview Container */}
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
                <span className="text-neutral-400">Live Banner Preview Area</span>
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
              Headline Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Black Friday Deals & Smart Gadget Specials"
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Click Destination URL (Optional)
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.amazon.com/deals"
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500"
            />
            <span className="text-[11px] text-neutral-400 block mt-1">
              If left blank, banner will simply be displayed as a non-clickable visual image.
            </span>
          </div>

          {/* Advertisement & Active Switches */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-bold text-neutral-900">Active (Visible)</span>
                <span className="block text-[11px] text-neutral-500">
                  Enable or temporarily hide this banner from the storefront
                </span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500"
              />
            </label>

            <div className="border-t border-neutral-200 pt-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-neutral-900">Advertisement Mode</span>
                  <span className="block text-[11px] text-neutral-500">
                    Displays a small "ADVERTISEMENT" badge in the corner of the banner
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
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isProcessingFile}
              className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{bannerToEdit ? 'Save Banner' : 'Create Banner'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
