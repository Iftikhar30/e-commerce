import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        <div className="w-full aspect-square bg-neutral-100 rounded-xl mb-3" />
        <div className="flex justify-between items-center mb-2">
          <div className="h-3 w-20 bg-neutral-100 rounded" />
          <div className="h-3 w-10 bg-neutral-100 rounded" />
        </div>
        <div className="h-4 bg-neutral-100 rounded w-full mb-1.5" />
        <div className="h-4 bg-neutral-100 rounded w-2/3 mb-3" />
      </div>
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
        <div className="h-5 w-16 bg-neutral-100 rounded" />
        <div className="h-7 w-20 bg-neutral-100 rounded-lg" />
      </div>
    </div>
  );
};
