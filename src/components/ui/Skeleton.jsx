import React from 'react';

export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl ${className}`}
      {...props}
    />
  );
};

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6">
      <header className="mb-8">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass rounded-2xl p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-10 w-40" />
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-4 w-full rounded-full mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 flex flex-col items-center">
          <Skeleton className="h-6 w-48 mb-4 self-start" />
          <Skeleton className="w-full max-w-[300px] aspect-square rounded-full" />
        </div>
        
        <div className="glass rounded-2xl p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TransactionsSkeleton = () => {
  return (
    <div className="space-y-6 h-full">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Skeleton className="h-11 w-32 rounded-xl" />
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
      </header>

      <div className="glass rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-full md:w-[150px] rounded-xl" />
        <Skeleton className="h-11 w-full md:w-[150px] rounded-xl" />
      </div>

      <div className="hidden md:block glass rounded-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="md:hidden space-y-3 pb-24">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
