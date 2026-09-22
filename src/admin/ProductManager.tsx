import React, { useState } from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import {
  Plus,
  Search,
  GripVertical,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Sparkles,
  Edit2,
  Trash2,
  MousePointerClick,
  ChevronUp,
  ChevronDown,
  Filter,
  Link as LinkIcon,
} from 'lucide-react';

interface ProductManagerProps {
  onOpenAddModal: () => void;
  onOpenEditModal: (product: Product) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  onOpenAddModal,
  onOpenEditModal,
}) => {
  const {
    allProducts,
    deleteProductAction,
    toggleActiveAction,
    togglePinAction,
    toggleFeaturedAction,
    reorderProductsAction,
    categories,
  } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden' | 'pinned' | 'featured'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Filter products for display in admin
  const filteredProducts = allProducts.filter((p) => {
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'hidden' && p.active) return false;
    if (statusFilter === 'pinned' && !p.pinned) return false;
    if (statusFilter === 'featured' && !p.featured) return false;

    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.asin && p.asin.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small timeout to give drag shadow
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const updated = [...allProducts];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setDraggedIndex(null);
    await reorderProductsAction(updated);
  };

  const moveUp = async (index: number) => {
    if (index <= 0) return;
    const updated = [...allProducts];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    await reorderProductsAction(updated);
  };

  const moveDown = async (index: number) => {
    if (index >= allProducts.length - 1) return;
    const updated = [...allProducts];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    await reorderProductsAction(updated);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteProductAction(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Product Management
          </h2>
          <p className="text-xs text-neutral-500">
            Drag to reorder, pin to top, toggle visibility, and track Amazon clicks
          </p>
        </div>
        <button
          type="button"
          id="admin-add-product-button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0"
        >
          <Plus size={15} />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, ASIN..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:col-span-2">
            <span className="text-xs text-neutral-400 shrink-0 flex items-center gap-1 mr-1">
              <Filter size={13} />
            </span>
            {(
              [
                { id: 'all', label: `All (${allProducts.length})` },
                { id: 'active', label: `Active (${allProducts.filter((p) => p.active).length})` },
                { id: 'hidden', label: `Hidden (${allProducts.filter((p) => !p.active).length})` },
                { id: 'pinned', label: `Pinned (${allProducts.filter((p) => p.pinned).length})` },
                { id: 'featured', label: `Featured (${allProducts.filter((p) => p.featured).length})` },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === filter.id
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products List with Drag & Drop */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-neutral-500">
            No products found matching the criteria.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredProducts.map((product, index) => {
              const originalIndex = allProducts.findIndex((p) => p.id === product.id);
              const isDragging = draggedIndex === originalIndex;

              return (
                <div
                  key={product.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isDragging
                      ? 'opacity-40 bg-amber-50 scale-[0.99] border-dashed border-2 border-amber-400'
                      : 'hover:bg-neutral-50/80 bg-white'
                  }`}
                >
                  {/* Left: Drag handle, image, title, tags */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Drag Handle & Mobile Order Arrows */}
                    <div className="flex sm:flex-col items-center gap-0.5 text-neutral-400 shrink-0">
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 hover:text-neutral-700"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </div>
                      <div className="flex sm:hidden items-center">
                        <button
                          type="button"
                          onClick={() => moveUp(originalIndex)}
                          disabled={originalIndex === 0}
                          className="p-1 hover:text-neutral-800 disabled:opacity-30"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(originalIndex)}
                          disabled={originalIndex === allProducts.length - 1}
                          className="p-1 hover:text-neutral-800 disabled:opacity-30"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>

                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-12 h-12 rounded-xl object-contain bg-neutral-50 p-1 border border-neutral-200/60 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 truncate max-w-md">
                          {product.title}
                        </h4>
                        {product.badge && (
                          <span className="text-[10px] bg-neutral-100 text-neutral-700 font-bold px-1.5 py-0.2 rounded uppercase">
                            {product.badge}
                          </span>
                        )}
                      </div>

                      {/* Status Badges & Category */}
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
                        <span className="capitalize font-medium text-neutral-600">
                          {product.category}
                        </span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            product.active ? 'text-emerald-600' : 'text-neutral-400'
                          }`}
                        >
                          {product.active ? 'Active' : 'Hidden'}
                        </span>
                        {product.pinned && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-bold flex items-center gap-0.5">
                              <Pin size={10} /> Pinned Top
                            </span>
                          </>
                        )}
                        {product.featured && (
                          <>
                            <span>•</span>
                            <span className="text-purple-600 font-semibold flex items-center gap-0.5">
                              <Sparkles size={10} /> Featured
                            </span>
                          </>
                        )}
                        {product.asin && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-neutral-400">ASIN: {product.asin}</span>
                          </>
                        )}
                        {product.affiliateUrl && (
                          <>
                            <span>•</span>
                            <span
                              className="text-amber-700 bg-amber-50 border border-amber-200/80 font-medium px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]"
                              title={`Affiliate Redirect: ${product.affiliateUrl}`}
                            >
                              <LinkIcon size={10} className="text-amber-600" /> Affiliate Link Set
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Click Count & Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                    {/* Click Count pill */}
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 text-xs font-bold"
                      title="Total visitor clicks"
                    >
                      <MousePointerClick size={12} className="text-amber-600" />
                      <span>{(product.clickCount || 0).toLocaleString()} clicks</span>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1">
                      {/* Pin/Unpin */}
                      <button
                        type="button"
                        onClick={() => togglePinAction(product.id, product.pinned)}
                        title={product.pinned ? 'Unpin product' : 'Pin to top of catalog'}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          product.pinned
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {product.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                      </button>

                      {/* Hide/Show */}
                      <button
                        type="button"
                        onClick={() => toggleActiveAction(product.id, product.active)}
                        title={product.active ? 'Hide from storefront' : 'Show on storefront'}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          product.active
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        {product.active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>

                      {/* Featured */}
                      <button
                        type="button"
                        onClick={() => toggleFeaturedAction(product.id, product.featured)}
                        title={product.featured ? 'Remove from featured' : 'Highlight as featured'}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          product.featured
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <Sparkles size={14} />
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(product)}
                        title="Edit product details"
                        className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(product)}
                        title="Delete product"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${deleteTarget?.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={isDeleting}
      />
    </div>
  );
};
