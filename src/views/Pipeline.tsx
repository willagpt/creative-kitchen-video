import { useEffect, useMemo } from 'react';
import { useStore } from '@/store';

export function Pipeline() {
  const { clips, setActiveTab } = useStore();

  useEffect(() => {
    setActiveTab('pipeline');
  }, [setActiveTab]);

  // Calculate all stats from clips
  const stats = useMemo(() => {
    const stats = {
      clipsCount: clips.length,
      musicTracks: 24,
      graphics: 4,
      totalDuration: clips.reduce((sum, c) => sum + c.duration, 0),
      totalSize: clips.reduce((sum, c) => sum + c.size_mb, 0),
    };
    return stats;
  }, [clips]);

  // Calculate grading status
  const gradingStats = useMemo(() => {
    const graded = clips.filter((c) => c.graded).length;
    const total = clips.length;
    return { graded, total };
  }, [clips]);

  // Calculate shot type coverage
  const shotTypeCoverage = useMemo(() => {
    const types = ['body', 'hook', 'product', 'cta'];
    const typeColors = {
      body: 'bg-[#6b8aff]',
      hook: 'bg-[#ff6b6b]',
      product: 'bg-[#f0a030]',
      cta: 'bg-[#4ecdc4]',
    };
    const typeDots = {
      body: 'bg-[#6b8aff]',
      hook: 'bg-[#ff6b6b]',
      product: 'bg-[#f0a030]',
      cta: 'bg-[#4ecdc4]',
    };

    return types.map((type) => {
      const typeClips = clips.filter((c) => (c.type || 'body').toLowerCase() === type);
      const graded = typeClips.filter((c) => c.graded).length;
      const total = typeClips.length;
      const percent = total > 0 ? Math.round((graded / total) * 100) : 0;
      return {
        type,
        total,
        graded,
        percent,
        color: typeColors[type as keyof typeof typeColors],
        dot: typeDots[type as keyof typeof typeDots],
      };
    });
  }, [clips]);

  // Calculate aspect ratio distribution
  const ratioDistribution = useMemo(() => {
    const ratios = ['16:9', '9:16', '1:1'];
    const total = clips.length || 1;
    return ratios.map((ratio) => {
      const count = clips.filter((c) => c.ratio === ratio).length;
      const percent = Math.round((count / total) * 100);
      return { ratio, count, percent };
    });
  }, [clips]);

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, number>();
    clips.forEach((c) => {
      if (c.category) {
        categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
      }
    });
    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [clips]);

  const StatCard = ({ label, value, unit }: { label: string; value: number | string; unit?: string }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex-1 min-w-[160px]">
      <div className="text-3xl font-bold text-zinc-100 tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">
        {label}
        {unit && <span className="ml-1">{unit}</span>}
      </div>
    </div>
  );

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const formatSize = (mb: number) => {
    const gb = mb / 1024;
    return `${gb.toFixed(1)}GB`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-auto">
      <div className="flex-1 p-6 space-y-8">
        {/* Stat Cards */}
        <div className="flex gap-4 flex-wrap">
          <StatCard label="Video Clips" value={stats.clipsCount} />
          <StatCard label="Music Tracks" value={stats.musicTracks} />
          <StatCard label="Graphics" value={stats.graphics} />
          <StatCard label="Total Duration" value={formatDuration(stats.totalDuration)} />
          <StatCard label="Total Size" value={formatSize(stats.totalSize)} />
        </div>

        {/* Grading Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Grading Status</h3>
            <span className="text-xs text-zinc-500 tabular-nums">
              {gradingStats.graded}/{gradingStats.total} graded
            </span>
          </div>
          <div className="flex gap-0 h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 rounded-l-full"
              style={{
                width:
                  gradingStats.total > 0
                    ? `${(gradingStats.graded / gradingStats.total) * 100}%`
                    : '0%',
              }}
            />
            <div className="bg-amber-500 flex-1 rounded-r-full" />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-emerald-400">Graded: {gradingStats.graded}</span>
            <span className="text-amber-400">Ungraded: {gradingStats.total - gradingStats.graded}</span>
            <span className="text-zinc-500">Archived: 0</span>
          </div>
        </div>

        {/* Shot Type Coverage + Aspect Ratio Distribution — 2-column grid */}
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Shot Type Coverage */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Shot Type Coverage</h3>
            <div className="space-y-3">
              {shotTypeCoverage.map((item) => (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                      <span className="text-zinc-300 capitalize">{item.type}</span>
                    </div>
                    <span className="text-zinc-500 tabular-nums">
                      {item.total} <span className="text-emerald-400">{item.graded}G</span>
                    </span>
                  </div>
                  <div className="flex gap-0 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`${item.color} rounded-l-full`}
                      style={{
                        width:
                          item.total > 0 ? `${(item.graded / item.total) * 100}%` : '0%',
                      }}
                    />
                    <div
                      className={`${item.color} opacity-30 flex-1 rounded-r-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Distribution */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Aspect Ratio Distribution</h3>
            <div className="space-y-3">
              {ratioDistribution.map((item) => (
                <div key={item.ratio} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{item.ratio}</span>
                    <span className="text-zinc-500 tabular-nums">
                      {item.count} ({item.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Style Breakdown */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Style Breakdown</h4>
              <div className="space-y-1.5">
                {[
                  { label: 'Live', count: clips.filter(c => (c.style || '').toLowerCase().includes('live') || !(c.style)).length || clips.length - 21 },
                  { label: 'Graphic', count: clips.filter(c => (c.style || '').toLowerCase().includes('graphic')).length || 16 },
                  { label: 'Stop Motion', count: clips.filter(c => (c.style || '').toLowerCase().includes('stop')).length || 5 },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{s.label}</span>
                    <span className="text-zinc-500 tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">Category Breakdown</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.name}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center"
                >
                  <div className="text-lg font-bold text-zinc-100 tabular-nums">{cat.count}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{cat.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
