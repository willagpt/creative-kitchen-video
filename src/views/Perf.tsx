import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';

interface AdPerformanceData {
  name: string;
  roas: number;
  spend: number;
  badge: string;
  badgeColor: string;
}

interface CreativeFatigueData {
  name: string;
  impressions: number;
  initialCtr: number;
  currentCtr: number;
  trend: 'up' | 'down' | 'flat';
  status: 'fresh' | 'watch' | 'fatigued';
}

interface AudienceSegmentData {
  name: string;
  impressions: number;
  ctr: number;
  cpa: number;
  roas: number;
  bestCreative: string;
}

interface ABTestData {
  variant: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  roas: number;
  spend: number;
  isWinner: boolean;
}

export function Perf() {
  const { setActiveTab, setReiterateContext } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab('perf');
  }, [setActiveTab]);

  const handleReiterate = (ad: AdPerformanceData) => {
    const roas = ad.roas;
    const tier = roas >= 50 ? 'WINNER' : roas >= 30 ? 'ITERATE' : roas >= 15 ? 'REWORK' : 'KILL';

    let suggestions: string[] = [];
    if (tier === 'REWORK') {
      suggestions = [
        'Try a different hook — current hook CTR is below average',
        'Keep the body shots — they\'re performing well',
        'Consider a stronger CTA with urgency',
      ];
    } else if (tier === 'KILL') {
      suggestions = [
        'Complete creative refresh needed — start with a new hook style',
        'Test different body shot sub-types (food-beauty performs 2x better than lifestyle)',
        'Switch to a winning music track (The Trumpet Dude has highest ROAS)',
        'Consider a different target persona',
      ];
    }

    setReiterateContext({
      adName: ad.name,
      originalRoas: ad.roas,
      status: tier,
      suggestions,
    });

    navigate('/generate');
  };

  const performanceStats = {
    totalSpend: 192,
    totalRevenue: 6960,
    blendedRoas: 36.2,
    totalPurchases: 87,
  };

  const roasBarData: AdPerformanceData[] = [
    { name: 'Unboxing_V1', roas: 50.4, spend: 450, badge: 'WINNER', badgeColor: 'bg-emerald-600/20 text-emerald-400' },
    { name: 'CHF001_Nutrition', roas: 49.6, spend: 380, badge: 'WINNER', badgeColor: 'bg-emerald-600/20 text-emerald-400' },
    { name: 'FoodMix_V2', roas: 29.9, spend: 320, badge: 'ITERATE', badgeColor: 'bg-blue-600/20 text-blue-400' },
    { name: 'Chef_CTA', roas: 22.5, spend: 280, badge: 'ITERATE', badgeColor: 'bg-blue-600/20 text-blue-400' },
    { name: 'StopMotion_V1', roas: 13.0, spend: 220, badge: 'REWORK', badgeColor: 'bg-amber-600/20 text-amber-400' },
    { name: 'Eating_SlowPace', roas: 6.5, spend: 150, badge: 'KILL', badgeColor: 'bg-red-600/20 text-red-400' },
  ];

  const creativeFatigueData: CreativeFatigueData[] = [
    { name: 'Unboxing_V1', impressions: 125000, initialCtr: 2.8, currentCtr: 2.7, trend: 'flat', status: 'fresh' },
    { name: 'CHF001_Nutrition', impressions: 118000, initialCtr: 2.6, currentCtr: 2.3, trend: 'down', status: 'watch' },
    { name: 'FoodMix_V2', impressions: 92000, initialCtr: 2.2, currentCtr: 1.8, trend: 'down', status: 'fatigued' },
    { name: 'Chef_CTA', impressions: 78000, initialCtr: 2.1, currentCtr: 1.9, trend: 'flat', status: 'watch' },
  ];

  const audienceSegmentData: AudienceSegmentData[] = [
    { name: 'Health 25-45', impressions: 320000, ctr: 2.8, cpa: 2.2, roas: 45.2, bestCreative: 'Unboxing_V1' },
    { name: 'Broad 18-65', impressions: 280000, ctr: 2.1, cpa: 2.8, roas: 31.5, bestCreative: 'CHF001_Nutrition' },
    { name: 'Lookalike – Purchasers', impressions: 215000, ctr: 2.3, cpa: 2.4, roas: 38.9, bestCreative: 'Unboxing_V1' },
    { name: 'Interest – Cooking', impressions: 185000, ctr: 1.9, cpa: 3.1, roas: 28.4, bestCreative: 'FoodMix_V2' },
  ];

  const abTestData: ABTestData[] = [
    {
      variant: 'Variant A (16:9)',
      impressions: 152000,
      clicks: 4200,
      ctr: 2.76,
      conversions: 78,
      roas: 42.1,
      spend: 165,
      isWinner: true,
    },
    {
      variant: 'Variant B (1:1)',
      impressions: 141000,
      clicks: 3100,
      ctr: 2.20,
      conversions: 52,
      roas: 31.8,
      spend: 164,
      isWinner: false,
    },
  ];

  const ctrTrendData = [
    { date: 'Mon', ctr: 2.1 },
    { date: 'Tue', ctr: 2.3 },
    { date: 'Wed', ctr: 2.0 },
    { date: 'Thu', ctr: 2.4 },
    { date: 'Fri', ctr: 2.2 },
    { date: 'Sat', ctr: 1.9 },
    { date: 'Sun', ctr: 2.1 },
  ];

  const maxCtr = Math.max(...ctrTrendData.map((d) => d.ctr));
  const minCtr = Math.min(...ctrTrendData.map((d) => d.ctr));
  const ctrRange = maxCtr - minCtr || 1;

  const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex-1 min-w-[160px] text-center">
      <div className="text-3xl font-bold text-zinc-100 tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500 mt-2 capitalize">{label}</div>
    </div>
  );

  return (
    <div className="h-full overflow-auto bg-zinc-950">
      <div className="p-6 space-y-8">
        {/* Stat Cards */}
        <div className="flex gap-4 flex-wrap">
          <StatCard label="Total Spend" value={`$${performanceStats.totalSpend}`} />
          <StatCard label="Total Revenue" value={`$${performanceStats.totalRevenue}`} />
          <StatCard label="Blended ROAS" value={`${performanceStats.blendedRoas}x`} />
          <StatCard label="Total Purchases" value={performanceStats.totalPurchases} />
        </div>

        {/* Performance Legend */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Performance Legend
            </h3>
            <button
              onClick={() => alert('Export Report feature coming soon — will export performance data as CSV/PDF.')}
              className="text-xs border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              Export Report
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">50x+ = WINNER</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-zinc-300">30x+ = ITERATE</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-zinc-300">15x+ = REWORK</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-300">0x+ = KILL</span>
            </div>
          </div>
        </div>

        {/* ROAS by Ad (Bar Chart) + Ad Performance List */}
        <div className="grid grid-cols-[2fr_1fr] gap-6">
          {/* Bar Chart */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">ROAS by Ad</h3>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-end justify-around h-48 gap-4">
                {roasBarData.map((ad) => {
                  const maxRoas = Math.max(...roasBarData.map((d) => d.roas));
                  const heightPercent = (ad.roas / maxRoas) * 100;
                  const getBarColor = (roas: number) => {
                    if (roas >= 50) return 'bg-emerald-500';
                    if (roas >= 30) return 'bg-blue-500';
                    if (roas >= 15) return 'bg-amber-500';
                    return 'bg-red-500';
                  };

                  return (
                    <div key={ad.name} className="flex flex-col items-center gap-2 flex-1 min-w-0">
                      <div className="relative w-full h-32 flex items-end justify-center">
                        <div className={`${getBarColor(ad.roas)} rounded-t w-full`} style={{ height: `${heightPercent}%` }} />
                        <div className="absolute -top-6 text-xs font-semibold text-zinc-300 tabular-nums">{ad.roas.toFixed(1)}x</div>
                      </div>
                      <span className="text-[9px] text-zinc-500 text-center truncate w-full px-1">{ad.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ad Performance List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Ad Performance</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {roasBarData.map((ad) => {
                const tier = ad.roas >= 50 ? 'WINNER' : ad.roas >= 30 ? 'ITERATE' : ad.roas >= 15 ? 'REWORK' : 'KILL';
                return (
                  <div key={ad.name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-300 truncate">{ad.name}</div>
                        <div className="text-[10px] text-zinc-500">${ad.spend} spent</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`px-2 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap ${ad.badgeColor}`}>
                          {ad.badge}
                        </div>
                        {(tier === 'REWORK' || tier === 'KILL') && (
                          <button
                            onClick={() => handleReiterate(ad)}
                            className="text-[10px] px-2 py-0.5 rounded border border-purple-500/30 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-colors whitespace-nowrap"
                          >
                            Re-iterate
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-zinc-100 tabular-nums">{ad.roas.toFixed(1)}x</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTR Trends */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">CTR Trends (Last 7 Days)</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-end justify-between h-32 gap-3">
              {ctrTrendData.map((point, idx) => {
                const normalizedCtr = (point.ctr - minCtr) / ctrRange;
                const heightPercent = normalizedCtr * 80 + 20;

                return (
                  <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                    {/* Connecting line to previous point */}
                    {idx > 0 && (
                      <div className="absolute w-12 border-t border-zinc-600" style={{ top: `${128 - (ctrTrendData[idx - 1].ctr - minCtr) / ctrRange * 80 - 20}px` }} />
                    )}

                    {/* Dot */}
                    <div className="relative" style={{ height: `${heightPercent * 1.28}px`, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <div className="absolute -top-5 text-xs font-semibold text-zinc-400 tabular-nums">{point.ctr.toFixed(1)}%</div>
                    </div>

                    {/* Label */}
                    <span className="text-[9px] text-zinc-500 text-center">{point.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Creative Fatigue Detection */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Creative Fatigue Detection</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-semibold">Creative</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">Impressions</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">Initial CTR</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">Current CTR</th>
                    <th className="text-center px-4 py-3 text-xs text-zinc-500 font-semibold">Trend</th>
                    <th className="text-center px-4 py-3 text-xs text-zinc-500 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeFatigueData.map((item) => {
                    const trendSymbol = item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→';
                    const statusColor =
                      item.status === 'fresh'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : item.status === 'watch'
                          ? 'bg-amber-600/20 text-amber-400'
                          : 'bg-red-600/20 text-red-400';

                    return (
                      <tr key={item.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-300 font-medium text-xs">{item.name}</td>
                        <td className="text-right px-4 py-3 text-zinc-400 text-xs">{(item.impressions / 1000).toFixed(0)}k</td>
                        <td className="text-right px-4 py-3 text-zinc-400 text-xs">{item.initialCtr.toFixed(2)}%</td>
                        <td className="text-right px-4 py-3 text-zinc-400 text-xs">{item.currentCtr.toFixed(2)}%</td>
                        <td className="text-center px-4 py-3 text-zinc-400 text-sm">{trendSymbol}</td>
                        <td className="text-center px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded capitalize ${statusColor}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audience Segment Performance */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Audience Segment Performance</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-semibold">Segment</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">Impressions</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">CTR</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">CPA</th>
                    <th className="text-right px-4 py-3 text-xs text-zinc-500 font-semibold">ROAS</th>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-semibold">Best Creative</th>
                  </tr>
                </thead>
                <tbody>
                  {audienceSegmentData.map((item) => (
                    <tr key={item.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-zinc-300 font-medium text-xs">{item.name}</td>
                      <td className="text-right px-4 py-3 text-zinc-400 text-xs">{(item.impressions / 1000).toFixed(0)}k</td>
                      <td className="text-right px-4 py-3 text-zinc-400 text-xs">{item.ctr.toFixed(2)}%</td>
                      <td className="text-right px-4 py-3 text-zinc-400 text-xs">${item.cpa.toFixed(2)}</td>
                      <td className="text-right px-4 py-3 text-emerald-400 font-semibold text-xs">{item.roas.toFixed(1)}x</td>
                      <td className="px-4 py-3 text-zinc-300 text-xs">{item.bestCreative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* A/B Test Comparison */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">A/B Test Results</h3>
          <div className="grid grid-cols-2 gap-4">
            {abTestData.map((variant, idx) => (
              <div
                key={idx}
                className={`bg-zinc-900 border rounded-lg p-4 space-y-3 ${
                  variant.isWinner ? 'border-emerald-600/50' : 'border-zinc-800'
                }`}
              >
                {variant.isWinner && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-emerald-600/30">
                    <span className="text-emerald-400 text-sm font-bold">✓</span>
                    <span className="text-emerald-400 text-xs font-semibold">WINNER</span>
                  </div>
                )}

                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Variant</div>
                  <div className="text-sm text-zinc-300 font-medium mt-1">{variant.variant}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-600">Impressions</div>
                    <div className="text-zinc-200 font-semibold">{(variant.impressions / 1000).toFixed(0)}k</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">Clicks</div>
                    <div className="text-zinc-200 font-semibold">{(variant.clicks / 1000).toFixed(1)}k</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">CTR</div>
                    <div className="text-zinc-200 font-semibold">{variant.ctr.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">Conversions</div>
                    <div className="text-zinc-200 font-semibold">{variant.conversions}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">Spend</div>
                    <div className="text-zinc-200 font-semibold">${variant.spend}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">ROAS</div>
                    <div className={`font-semibold ${variant.isWinner ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {variant.roas.toFixed(1)}x
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Statistical significance: 94%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WINNING PATTERNS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-4">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Winning Patterns</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Best Hooks */}
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Top Hooks</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Unboxing reveal</span>
                  <span className="text-xs text-emerald-400 font-mono">4.2% CTR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Food close-up</span>
                  <span className="text-xs text-emerald-400 font-mono">3.8% CTR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Chef action</span>
                  <span className="text-xs text-zinc-400 font-mono">2.1% CTR</span>
                </div>
              </div>
            </div>
            {/* Best Body Types */}
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Top Body Types</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Food beauty shots</span>
                  <span className="text-xs text-emerald-400 font-mono">38.2x ROAS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Lifestyle scenes</span>
                  <span className="text-xs text-zinc-400 font-mono">22.1x ROAS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Stop motion</span>
                  <span className="text-xs text-zinc-400 font-mono">15.4x ROAS</span>
                </div>
              </div>
            </div>
            {/* Best Music */}
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Top Music Tracks</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">The Trumpet Dude</span>
                  <span className="text-xs text-emerald-400 font-mono">42.1x ROAS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Casserole Original</span>
                  <span className="text-xs text-zinc-400 font-mono">28.3x ROAS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Mister V</span>
                  <span className="text-xs text-zinc-400 font-mono">19.7x ROAS</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-500">
              <span className="text-emerald-400 font-medium">Recommendation:</span> Combine unboxing hooks + food beauty body shots + The Trumpet Dude music for highest predicted ROAS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
