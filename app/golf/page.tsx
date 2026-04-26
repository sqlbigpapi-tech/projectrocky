import DistanceChart from '@/app/components/golf/DistanceChart';
import ClubRecommender from '@/app/components/golf/ClubRecommender';

export default function GolfPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-3xl mx-auto p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <a href="/" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition">← Rocky</a>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
            Golf
          </h1>
          <div className="w-12" />
        </div>

        {/* Section: Bag */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-zinc-100">My Bag</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Distances</span>
          </div>
          <DistanceChart />
        </section>

        {/* Section: Recommender */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-zinc-100">Club Recommender</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Pick the stick</span>
          </div>
          <ClubRecommender />
        </section>

        {/* Section: Recent Rounds (Phase 2 placeholder) */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-zinc-100">Recent Rounds</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Phase 2</span>
          </div>
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center">
            <p className="text-sm font-mono text-zinc-500">Round logging coming soon</p>
          </div>
        </section>
      </div>
    </main>
  );
}
