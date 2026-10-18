import React from 'react';

export const MenuSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-surface rounded-xl border border-border p-4 animate-pulse flex flex-col justify-between"
        >
          <div>
            {/* Category tag skeleton */}
            <div className="flex justify-between items-center mb-2">
              <div className="h-4 w-20 bg-surface-muted rounded" />
              <div className="h-4 w-12 bg-surface-muted rounded" />
            </div>

            {/* Image banner skeleton */}
            <div className="w-full h-32 bg-surface-muted rounded-lg mb-3" />

            {/* Title skeleton */}
            <div className="h-4 w-3/4 bg-surface-muted rounded mb-2" />
            <div className="h-4 w-1/2 bg-surface-muted rounded mb-3" />

            {/* Description skeleton */}
            <div className="h-3 w-full bg-surface-muted rounded mb-1" />
            <div className="h-3 w-2/3 bg-surface-muted rounded mb-3" />
          </div>

          {/* Footer skeleton */}
          <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
            <div className="h-5 w-24 bg-surface-muted rounded" />
            <div className="h-8 w-20 bg-surface-muted rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};
