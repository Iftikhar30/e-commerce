import React from 'react';
import { ProductBadge } from '../types';

interface BadgeProps {
  type: ProductBadge;
}

export const Badge: React.FC<BadgeProps> = ({ type }) => {
  if (!type) return null;

  const styleMap: Record<string, string> = {
    Trending: 'bg-amber-500 text-white shadow-xs',
    'Best Deal': 'bg-emerald-600 text-white shadow-xs',
    New: 'bg-blue-600 text-white shadow-xs',
    'Limited Deal': 'bg-rose-600 text-white shadow-xs',
    Featured: 'bg-violet-600 text-white shadow-xs',
  };

  const className = styleMap[type] || 'bg-neutral-800 text-white';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {type}
    </span>
  );
};
