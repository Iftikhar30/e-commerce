import React, { useState } from 'react';
import { Category } from '../types';
import { useStore } from '../context/StoreContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Plus, Edit2, Trash2, Tag, Check, X } from 'lucide-react';

export const CategoryManager: React.FC = () => {
  const { allCategories, saveCategoryAction, deleteCategoryAction } = useStore();

  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setLoading(true);
    try {
      await saveCategoryAction({
        name: newCatName.trim(),
        order: allCategories.length + 1,
        active: true,
      });
      setNewCatName('');
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error(err);
    }
  };

  const handleSaveEdit = async (cat: Category) => {
    if (!editingName.trim()) return;
    await saveCategoryAction({
      id: cat.id,
      name: editingName.trim(),
    });
    setEditingId(null);
    setEditingName('');
  };

  const toggleCategoryActive = async (cat: Category) => {
    await saveCategoryAction({
      id: cat.id,
      active: !cat.active,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCategoryAction(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Category Management
          </h2>
          <p className="text-xs text-neutral-500">
            Create, rename, and toggle active product categories for visitor filtering
          </p>
        </div>
      </div>

      {/* Add Category Card */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <h3 className="text-xs font-bold text-neutral-900 mb-2 flex items-center gap-1.5">
          <Plus size={14} className="text-amber-600" />
          <span>Add New Category</span>
        </h3>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            required
            value={newCatName ?? ''}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Smart Home, Wearables, Gaming..."
            className="flex-1 px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-xs"
          >
            Add Category
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {allCategories.map((cat) => {
            const isEditing = editingId === cat.id;

            return (
              <div
                key={cat.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0">
                    <Tag size={15} />
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input
                        type="text"
                        value={editingName ?? ''}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-amber-400 rounded-lg focus:outline-hidden"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                        {cat.name}
                      </h4>
                      <span className="text-[11px] font-mono text-neutral-400">
                        Slug: {cat.slug}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleCategoryActive(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      cat.active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {cat.active ? 'Active' : 'Hidden'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditingName(cat.name);
                    }}
                    className="p-1.5 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(cat)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Category"
        message={`Are you sure you want to delete the category "${deleteTarget?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
