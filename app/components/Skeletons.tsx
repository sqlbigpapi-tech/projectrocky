/* Reusable skeleton primitives for loading states */

export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3.5" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

/* ── Tab-specific skeletons ── */

export function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        ))}
      </div>
      {/* Teams + Tasks row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 p-5 space-y-3">
          <div className="skeleton h-3 w-24" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-12 w-full" />
          ))}
        </div>
        <div className="rounded-xl border border-zinc-800 p-5 space-y-3">
          <div className="skeleton h-3 w-20" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 p-5">
          <div className="skeleton h-3 w-28 mb-4" />
          <div className="skeleton h-44 w-full" />
        </div>
        <div className="rounded-xl border border-zinc-800 p-5">
          <div className="skeleton h-3 w-28 mb-4" />
          <div className="skeleton h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

export function NetWorthSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-32" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 p-5">
          <div className="skeleton h-3 w-36 mb-4" />
          <div className="skeleton h-[200px] w-full" />
        </div>
        <div className="rounded-xl border border-zinc-800 p-5">
          <div className="skeleton h-3 w-32 mb-4" />
          <div className="skeleton h-[200px] w-full" />
        </div>
      </div>
      {/* Accounts */}
      <div className="rounded-xl border border-zinc-800 p-5">
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-28" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="skeleton h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SportsSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-3 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skeleton h-20 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 p-4 flex items-center gap-3">
          <div className="skeleton w-5 h-5 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function HealthSkeleton() {
  return (
    <div className="space-y-4">
      {/* Score rings */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 p-5 flex flex-col items-center gap-3">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-5">
            <div className="skeleton h-3 w-32 mb-4" />
            <div className="skeleton h-44 w-full" />
          </div>
        ))}
      </div>
      {/* Stats grid */}
      <div className="rounded-xl border border-zinc-800 p-5">
        <div className="skeleton h-3 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-2 p-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IncomeSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-zinc-800 p-5">
        <div className="skeleton h-3 w-32 mb-4" />
        <div className="space-y-2">
          <div className="skeleton h-8 w-full" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
