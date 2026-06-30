// Lightweight loading skeletons — used in place of plain "Loading…" text on data-heavy pages.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-border-soft/60 ${className}`} />;
}

// A header + stat-card row + table — a good generic stand-in for finance/class/attendance pages.
export function LoadingPanel({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div className="grid gap-[18px]" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3 w-72" /></div>
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-${Math.min(stats, 4)}`}>
        {Array.from({ length: stats }).map((_, i) => <div key={i} className="rounded-2xl border border-border-soft bg-white p-4"><Skeleton className="mb-2 h-3 w-16" /><Skeleton className="h-6 w-20" /></div>)}
      </div>
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <div className="grid gap-2.5">{Array.from({ length: rows }).map((_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-9 shrink-0 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-16 rounded-full" /></div>)}</div>
      </div>
    </div>
  );
}

// A simple rows-only skeleton for tables/lists inside an existing card.
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return <div className="grid gap-2.5 py-2" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /></div>)}</div>;
}

// Error block with a retry button — pairs with the skeletons for a complete load state.
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="grid place-items-center gap-3 py-16 text-center"><p className="text-[13px] font-bold text-danger">{message}</p><button onClick={onRetry} className="rounded-[10px] bg-brand-blue px-4 py-2 text-[12px] font-extrabold text-white transition hover:bg-brand-dark">Retry</button></div>;
}
