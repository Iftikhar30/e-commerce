import React from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  reviewCount,
  size = 'sm',
}) => {
  const iconSize = size === 'sm' ? 13 : 16;
  const formattedRating = Number(rating || 0).toFixed(1);

  return (
    <div className="inline-flex items-center gap-1">
      <Star
        size={iconSize}
        className="fill-[#FFA41C] text-[#FFA41C] shrink-0"
      />
      <span className="font-semibold text-xs text-neutral-800 tracking-tight">
        {formattedRating}
      </span>
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="text-[11px] text-neutral-500 font-normal">
          ({reviewCount > 999 ? `${(reviewCount / 1000).toFixed(1)}k` : reviewCount})
        </span>
      )}
    </div>
  );
};
