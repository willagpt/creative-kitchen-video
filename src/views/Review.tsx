import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Dropdown } from '@/components/Dropdown';
import {
  Trash2, RefreshCw, CheckCircle2, XCircle, RotateCcw,
  Play, ChevronLeft, ChevronRight, TrendingUp,
  Zap, Eye, ArrowRight,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface RenderedVideo {
  id: string;
  name: string;
  ratio: string;
  format: string | null;
  variation_type: string | null;
  status: string;
  recipe_name: string | null;
  hook_clip_id: number | null;
  body_clip_id: number | null;
  product_clip_id: number | null;
  cta_clip_id: number | null;
  duration: number | null;
  created_at: string;
}

interface PushStatus {
  timestamp: string;
  count: number;
}

type ReviewFilter = 'all' | 'queued' | 'approved' | 'rejected' | 'pushed';

const demoAccounts = [
  { value: 'big-tasty-us', label: 'Big Tasty – US' },
  { value: 'big-tasty-uk', label: 'Big Tasty – UK' },
];

const demoCampaigns = [
  { value: 'summer-2026', label: 'Summer 2026 – Awareness' },
  { value: 'q3-conversions', label: 'Q3 Conversions' },
  { value: 'retargeting', label: 'Retargeting – Lookalike' },
];

const demoAdSets = [
  { value: 'health-25-45', label: 'Health 25-45 – Interest' },
  { value: 'broad-18-65', label: 'Broad 18-65' },
  { value: 'custom-purchasers', label: 'Custom – Purchasers' },
];

/* ── Performance prediction helpers ───────────────────────────────── */

const SHOT_TYPE_BENCHMARKS: Record<string, { avgCtr: number; avgRoas: number }> = {
  hook: { avgCtr: 2.8, avgRoas: 38.5 },
  body: { avgCtr: 2.2, avgRoas: 32.1 },
  product: { avgCtr: 2.5, avgRoas: 35.0 },
  cta: { avgCtr: 1.9, avgRoas: 28.0 },
};

function predictPerformance(video: RenderedVideo, clips: { id: number; star_rating: number | null; type: string }[]) {
  const slotIds = [
    { id: video.hook_clip_id, type: 'hook' },
    { id: video.body_clip_id, type: 'body' },
    { id: video.product_clip_id, type: 'product' },
    { id: video.cta_clip_id, type: 'cta' },
  ];

  let totalCtr = 0;
  let totalRoas = 0;
  let count = 0;

  for (const slot of slotIds) {
    if (!slot.id) continue;
    const clip = clips.find(c => c.id === slot.id);
    const benchmark = SHOT_TYPE_BENCHMARKS[slot.type] || { avgCtr: 2.0, avgRoas: 30.0 };
    const starBonus = clip?.star_rating ? (clip.star_rating - 3) * 0.15 : 0;
    totalCtr += benchmark.avgCtr * (1 + starBonus);
    totalRoas += benchmark.avgRoas * (1 + starBonus);
    count++;
  }

  if (count === 0) return { predictedCtr: 2.0, predictedRoas: 25.0, confidence: 'low' as const };

  const ctr = totalCtr / count;
  const roas = totalRoas / count;
  const confidence = count >= 3 ? 'high' as const : count >= 2 ? 'medium' as const : 'low' as const;

  return { predictedCtr: Math.round(ctr * 100) / 100, predictedRoas: Math.round(roas * 10) / 10, confidence };
}

function getRoasTier(roas: number): { label: string; color: string; bgColor: string } {
  if (roas >= 50) return { label: 'WINNER', color: 'text-emerald-400', bgColor: 'bg-emerald-600/20' };
  if (roas >= 30) return { label: 'ITERATE', color: 'text-blue-400', bgColor: 'bg-blue-600/20' };
  if (roas >= 15) return { label: 'REWORK', color: 'text-amber-400', bgColor: 'bg-amber-600/20' };
  return { label: 'KILL', color: 'text-red-400', bgColor: 'bg-red-600/20' };
}

/* ── Component ─────────────────────────────────────────────────────── */

export function Review() {
  const navigate = useNavigate();
  const { setActiveTab, workspace, clips, setReiterateContext } = useStore();
  const [renderedVideos, setRenderedVideos] = useState<RenderedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [account, setAccount] = useState('big-tasty-us');
  const [campaign, setCampaign] = useState('summer-2026');
  const [adSet, setAdSet] = useState('health-25-45');
  const [dailyBudget, setDailyBudget] = useState('50');
  const [pushProgress, setPushProgress] = useState(0);
  const [pushComplete, setPushComplete] = useState(false);
  const [pushHistory, setPushHistory] = useState<PushStatus[]>([]);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all');
  const [showPerfPreview, setShowPerfPreview] = useState(false);

  useEffect(() => {
    setActiveTab('review');
  }, [setActiveTab]);

  /* ── Fetch rendered videos from Supabase ───────────────────────── */
  const fetchVideos = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rendered_videos')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch rendered videos:', error);
        setRenderedVideos([]);
      } else {
        setRenderedVideos((data || []) as RenderedVideo[]);
        if (data && data.length > 0 && !selectedVideoId) {
          setSelectedVideoId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setRenderedVideos([]);
    }
    setLoading(false);
  }, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  /* ── Realtime subscription ──────────────────────────────────────── */
  useEffect(() => {
    if (!workspace) return;
    const channel = supabase
      .channel('rendered_videos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rendered_videos', filter: `workspace_id=eq.${workspace.id}` }, () => {
        fetchVideos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace, fetchVideos]);

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filteredVideos = useMemo(() => {
    if (activeFilter === 'all') return renderedVideos;
    return renderedVideos.filter(v => v.status === activeFilter);
  }, [renderedVideos, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: renderedVideos.length, queued: 0, approved: 0, rejected: 0, pushed: 0 };
    for (const v of renderedVideos) {
      if (counts[v.status] !== undefined) counts[v.status]++;
    }
    return counts;
  }, [renderedVideos]);

  /* ── Resolve clip names ────────────────────────────────────────── */
  const clipName = (clipId: number | null) => {
    if (!clipId) return null;
    const clip = clips.find(c => c.id === clipId);
    return clip?.name || `Clip #${clipId}`;
  };

  /* ── Selection ─────────────────────────────────────────────────── */
  const handleToggleAdSelection = (adId: string) => {
    const newSelected = new Set(selectedAds);
    if (newSelected.has(adId)) newSelected.delete(adId);
    else newSelected.add(adId);
    setSelectedAds(newSelected);
  };

  const handleSelectAllReady = () => {
    const readyIds = filteredVideos
      .filter((v) => v.status === 'queued' || v.status === 'approved')
      .map((v) => v.id);
    setSelectedAds(new Set(readyIds));
  };

  /* ── Approve / Reject ───────────────────────────────────────────── */
  const handleApprove = async (ids: string[]) => {
    try {
      const { error } = await supabase.from('rendered_videos').update({ status: 'approved' }).in('id', ids);
      if (error) throw error;
      setRenderedVideos(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: 'approved' } : v));
      toast('success', `${ids.length} variation(s) approved`);
    } catch (err) {
      console.error('Approve error:', err);
      toast('error', 'Failed to approve');
    }
  };

  const handleReject = async (ids: string[]) => {
    try {
      const { error } = await supabase.from('rendered_videos').update({ status: 'rejected' }).in('id', ids);
      if (error) throw error;
      setRenderedVideos(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: 'rejected' } : v));
      toast('info', `${ids.length} variation(s) rejected`);
    } catch (err) {
      console.error('Reject error:', err);
      toast('error', 'Failed to reject');
    }
  };

  /* ── Delete selected ───────────────────────────────────────────── */
  const handleDeleteSelected = async () => {
    if (selectedAds.size === 0) return;
    const ids = Array.from(selectedAds);
    try {
      const { error } = await supabase.from('rendered_videos').delete().in('id', ids);
      if (error) throw error;
      setRenderedVideos(renderedVideos.filter(v => !ids.includes(v.id)));
      setSelectedAds(new Set());
      if (ids.includes(selectedVideoId || '')) {
        setSelectedVideoId(null);
      }
      toast('success', `${ids.length} variation(s) deleted`);
    } catch (err) {
      console.error('Delete error:', err);
      toast('error', 'Failed to delete');
    }
  };

  /* ── Re-iterate flow ────────────────────────────────────────────── */
  const handleReiterate = (video: RenderedVideo) => {
    const perf = predictPerformance(video, clips);
    const tier = getRoasTier(perf.predictedRoas);

    const suggestions: string[] = [];
    if (tier.label === 'REWORK' || tier.label === 'KILL') {
      suggestions.push('Try a different hook — current hook CTR is below average');
      suggestions.push('Consider different body shot sub-types');
      suggestions.push('Consider a stronger CTA with urgency');
    }
    if (tier.label === 'KILL') {
      suggestions.push('Complete creative refresh needed');
      suggestions.push('Test different body shot sub-types (food-beauty performs 2x better than lifestyle)');
    }

    setReiterateContext({
      adName: video.name,
      originalRoas: perf.predictedRoas,
      status: tier.label,
      suggestions,
    });

    navigate('/generate');
  };

  /* ── Status helpers ────────────────────────────────────────────── */
  const getStatusBadgeColor = (status: string) => {
    if (status === 'queued') return 'bg-zinc-800 text-zinc-300';
    if (status === 'approved') return 'bg-emerald-900/40 text-emerald-400';
    if (status === 'rejected') return 'bg-red-900/40 text-red-400';
    if (status === 'pushed') return 'bg-amber-900/40 text-amber-400';
    if (status === 'live') return 'bg-purple-900/40 text-purple-400';
    return 'bg-zinc-800 text-zinc-400';
  };

  const shotTypeColor: Record<string, string> = {
    hook: '#ff6b6b',
    body: '#6b8aff',
    product: '#f0a030',
    cta: '#4ecdc4',
  };

  const getTargetingSummary = () => {
    const accountLabel = demoAccounts.find((a) => a.value === account)?.label || '';
    const campaignLabel = demoCampaigns.find((c) => c.value === campaign)?.label || '';
    const adSetLabel = demoAdSets.find((a) => a.value === adSet)?.label || '';
    return `${accountLabel} · ${campaignLabel} · ${adSetLabel}`;
  };

  const handlePushToMeta = async () => {
    // Only push approved ads
    const approvedSelected = Array.from(selectedAds).filter(id => {
      const v = renderedVideos.find(rv => rv.id === id);
      return v && (v.status === 'approved' || v.status === 'queued');
    });
    if (approvedSelected.length === 0) {
      toast('info', 'Select approved variations to push');
      return;
    }
    setPushProgress(0);
    setPushComplete(false);

    await supabase.from('rendered_videos').update({ status: 'pushed' }).in('id', approvedSelected);
    setRenderedVideos(renderedVideos.map(v => approvedSelected.includes(v.id) ? { ...v, status: 'pushed' } : v));

    const interval = setInterval(() => {
      setPushProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setPushComplete(true);
          const now = new Date().toLocaleTimeString();
          setPushHistory((h) => [{ timestamp: now, count: approvedSelected.length }, ...h].slice(0, 5));
          return 100;
        }
        return prev + 33.33;
      });
    }, 1000);
  };

  const handleBudgetChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDailyBudget(e.target.value);
  };

  /* ── Navigation ─────────────────────────────────────────────────── */
  const selectedVideo = filteredVideos.find(v => v.id === selectedVideoId);
  const selectedVideoIndex = filteredVideos.findIndex(v => v.id === selectedVideoId);

  const navigateVideo = (direction: 'prev' | 'next') => {
    if (filteredVideos.length === 0) return;
    let idx = selectedVideoIndex;
    if (direction === 'prev') idx = idx > 0 ? idx - 1 : filteredVideos.length - 1;
    else idx = idx < filteredVideos.length - 1 ? idx + 1 : 0;
    setSelectedVideoId(filteredVideos[idx].id);
  };

  /* ── Bulk actions count ─────────────────────────────────────────── */
  const selectedCount = selectedAds.size;
  const approvedInSelection = Array.from(selectedAds).filter(id => {
    const v = renderedVideos.find(rv => rv.id === id);
    return v && v.status === 'approved';
  }).length;
  const queuedInSelection = Array.from(selectedAds).filter(id => {
    const v = renderedVideos.find(rv => rv.id === id);
    return v && v.status === 'queued';
  }).length;

  /* ── Performance prediction for selected video ──────────────────── */
  const selectedPerf = selectedVideo ? predictPerformance(selectedVideo, clips) : null;
  const selectedTier = selectedPerf ? getRoasTier(selectedPerf.predictedRoas) : null;

  return (
    <div className="h-full flex overflow-hidden bg-[#0a0a0f]">
      {/* ═══ LEFT SECTION — VIDEO PREVIEW & LIST ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-2 flex-shrink-0">
          {(['all', 'queued', 'approved', 'rejected', 'pushed'] as ReviewFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors capitalize ${
                activeFilter === f
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {f} {statusCounts[f] > 0 && <span className="ml-1 tabular-nums">({statusCounts[f]})</span>}
            </button>
          ))}
        </div>

        {/* Header + bulk actions */}
        <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-200">Review Queue</h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {filteredVideos.length} showing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchVideos}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleSelectAllReady}
              className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
            >
              Select all
            </button>
            {selectedCount > 0 && (
              <>
                {queuedInSelection > 0 && (
                  <button
                    onClick={() => handleApprove(Array.from(selectedAds))}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve {selectedCount}
                  </button>
                )}
                {queuedInSelection > 0 && (
                  <button
                    onClick={() => handleReject(Array.from(selectedAds))}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject {selectedCount}
                  </button>
                )}
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Selected video detail card with preview ───────────────── */}
        {selectedVideo && (
          <div className="mx-6 mb-3 flex-shrink-0">
            <div className="bg-[#111118] border border-zinc-800 rounded-lg overflow-hidden">
              {/* Video preview area */}
              <div className="relative bg-black aspect-video max-h-[240px] flex items-center justify-center group">
                {/* AIDA color bar overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 flex">
                  <div className="flex-1" style={{ backgroundColor: selectedVideo.hook_clip_id ? shotTypeColor.hook : '#333' }} />
                  <div className="flex-1" style={{ backgroundColor: selectedVideo.body_clip_id ? shotTypeColor.body : '#333' }} />
                  <div className="flex-1" style={{ backgroundColor: selectedVideo.product_clip_id ? shotTypeColor.product : '#333' }} />
                  <div className="flex-1" style={{ backgroundColor: selectedVideo.cta_clip_id ? shotTypeColor.cta : '#333' }} />
                </div>

                {/* Play button overlay */}
                <button className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </button>

                {/* Navigation arrows */}
                <button
                  onClick={(e) => { e.stopPropagation(); navigateVideo('prev'); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateVideo('next'); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>

                {/* Video counter */}
                <div className="absolute top-2 right-2 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded tabular-nums">
                  {selectedVideoIndex + 1} / {filteredVideos.length}
                </div>

                {/* Status badge */}
                <div className="absolute top-2 left-2">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${getStatusBadgeColor(selectedVideo.status)}`}>
                    {selectedVideo.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Detail row */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold text-zinc-100">{selectedVideo.name}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                      {selectedVideo.format && <span>{selectedVideo.format}</span>}
                      <span>{selectedVideo.ratio}</span>
                      {selectedVideo.recipe_name && <><span>·</span><span>{selectedVideo.recipe_name}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedVideo.status === 'queued' && (
                      <>
                        <button
                          onClick={() => handleApprove([selectedVideo.id])}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject([selectedVideo.id])}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-red-600/15 text-red-400 border border-red-500/30 hover:bg-red-600/25 transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {(selectedVideo.status === 'approved' || selectedVideo.status === 'pushed') && (
                      <button
                        onClick={() => handleReiterate(selectedVideo)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Re-iterate
                      </button>
                    )}
                  </div>
                </div>

                {/* Shot composition */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'Hook', clipId: selectedVideo.hook_clip_id, color: shotTypeColor.hook },
                    { label: 'Body', clipId: selectedVideo.body_clip_id, color: shotTypeColor.body },
                    { label: 'Product', clipId: selectedVideo.product_clip_id, color: shotTypeColor.product },
                    { label: 'CTA', clipId: selectedVideo.cta_clip_id, color: shotTypeColor.cta },
                  ].map(({ label, clipId, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{label}</div>
                        <div className="text-[10px] text-zinc-300 truncate">{clipName(clipId) || <span className="text-zinc-600 italic">none</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Performance preview toggle */}
                <button
                  onClick={() => setShowPerfPreview(!showPerfPreview)}
                  className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <TrendingUp className="w-3 h-3" />
                  {showPerfPreview ? 'Hide' : 'Show'} performance preview
                </button>

                {/* Performance preview panel */}
                {showPerfPreview && selectedPerf && selectedTier && (
                  <div className="mt-3 p-3 bg-[#0a0a0f] border border-zinc-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Predicted Performance</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${selectedTier.bgColor} ${selectedTier.color}`}>
                        {selectedTier.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-[10px] text-zinc-600 mb-0.5">Predicted CTR</div>
                        <div className="text-lg font-bold text-zinc-100 tabular-nums">{selectedPerf.predictedCtr.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-600 mb-0.5">Predicted ROAS</div>
                        <div className="text-lg font-bold text-zinc-100 tabular-nums">{selectedPerf.predictedRoas.toFixed(1)}x</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-600 mb-0.5">Confidence</div>
                        <div className={`text-lg font-bold tabular-nums capitalize ${
                          selectedPerf.confidence === 'high' ? 'text-emerald-400' :
                          selectedPerf.confidence === 'medium' ? 'text-amber-400' : 'text-zinc-400'
                        }`}>{selectedPerf.confidence}</div>
                      </div>
                    </div>
                    {/* ROAS gauge bar */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 rounded-full overflow-hidden flex">
                          <div className="bg-red-500 h-full" style={{ width: '15%' }} />
                          <div className="bg-amber-500 h-full" style={{ width: '15%' }} />
                          <div className="bg-blue-500 h-full" style={{ width: '20%' }} />
                          <div className="bg-emerald-500 h-full" style={{ width: '50%' }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-[8px] text-zinc-600">
                        <span>KILL</span>
                        <span>REWORK</span>
                        <span>ITERATE</span>
                        <span>WINNER</span>
                      </div>
                    </div>

                    {(selectedTier.label === 'REWORK' || selectedTier.label === 'KILL') && (
                      <button
                        onClick={() => handleReiterate(selectedVideo)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-semibold bg-amber-600/15 text-amber-400 border border-amber-500/30 hover:bg-amber-600/25 transition-colors"
                      >
                        <Zap className="w-3 h-3" />
                        Send to Generate for re-iteration
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Rendered Videos List ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-400 mb-2">
                {activeFilter === 'all' ? 'No rendered videos yet' : `No ${activeFilter} videos`}
              </p>
              <p className="text-[11px] text-zinc-600">
                {activeFilter === 'all'
                  ? 'Generate variations or render a recipe to see them here'
                  : 'Try a different filter or generate more variations'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredVideos.map((video) => {
                const perf = predictPerformance(video, clips);
                const tier = getRoasTier(perf.predictedRoas);
                return (
                  <div
                    key={video.id}
                    onClick={() => setSelectedVideoId(video.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                      selectedVideoId === video.id
                        ? 'bg-[#1a1a24] border border-amber-500/30'
                        : 'bg-[#111118] border border-zinc-800/50 hover:border-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAds.has(video.id)}
                      onChange={(e) => { e.stopPropagation(); handleToggleAdSelection(video.id); }}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer accent-amber-500"
                    />

                    {/* AIDA color bar */}
                    <div className="flex w-8 h-8 rounded overflow-hidden flex-shrink-0">
                      <div className="w-1/4 h-full" style={{ backgroundColor: video.hook_clip_id ? shotTypeColor.hook : '#222' }} />
                      <div className="w-1/4 h-full" style={{ backgroundColor: video.body_clip_id ? shotTypeColor.body : '#222' }} />
                      <div className="w-1/4 h-full" style={{ backgroundColor: video.product_clip_id ? shotTypeColor.product : '#222' }} />
                      <div className="w-1/4 h-full" style={{ backgroundColor: video.cta_clip_id ? shotTypeColor.cta : '#222' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-100 truncate">{video.name || 'Untitled'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500">{video.ratio}</span>
                        {video.format && (
                          <>
                            <span className="text-[10px] text-zinc-600">·</span>
                            <span className="text-[10px] text-zinc-500">{video.format}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Predicted ROAS */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold tabular-nums ${tier.color}`}>
                        {perf.predictedRoas.toFixed(1)}x
                      </span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${getStatusBadgeColor(video.status)}`}>
                        {video.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Quick approve/reject for queued */}
                    {video.status === 'queued' && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove([video.id])}
                          className="w-6 h-6 rounded flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReject([video.id])}
                          className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL — META ADS CONFIG ═══ */}
      <div className="w-80 border-l border-zinc-800 bg-[#111118] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0 flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Meta Ads
          </h3>
          {approvedInSelection > 0 && (
            <span className="text-[10px] text-amber-400 tabular-nums">
              {approvedInSelection} approved selected
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[11px] text-zinc-400 block mb-2">Ad Account</label>
            <Dropdown value={account} onChange={setAccount} options={demoAccounts} placeholder="Select account" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 block mb-2">Campaign</label>
            <Dropdown value={campaign} onChange={setCampaign} options={demoCampaigns} placeholder="Select campaign" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 block mb-2">Ad Set</label>
            <Dropdown value={adSet} onChange={setAdSet} options={demoAdSets} placeholder="Select ad set" />
          </div>
          <div className="bg-[#1a1a24] rounded-lg p-3">
            <p className="text-[11px] text-zinc-400 leading-relaxed">{getTargetingSummary()}</p>
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 block mb-2">Daily Budget</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 font-medium">$</span>
              <input
                type="number"
                value={dailyBudget}
                onChange={handleBudgetChange}
                className="flex-1 text-sm bg-[#1a1a24] border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-600"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Push summary */}
          {selectedCount > 0 && (
            <div className="bg-[#1a1a24] rounded-lg p-3 space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Push Summary</div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Selected</span>
                  <span className="text-zinc-200 font-semibold tabular-nums">{selectedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Approved</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">{approvedInSelection}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Est. daily spend</span>
                  <span className="text-zinc-200 font-semibold tabular-nums">
                    ${(parseFloat(dailyBudget || '0') * (approvedInSelection + queuedInSelection)).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Push Button & Progress */}
        <div className="px-4 py-4 border-t border-zinc-800 flex-shrink-0 space-y-3">
          {!pushComplete ? (
            <>
              <button
                onClick={handlePushToMeta}
                disabled={selectedAds.size === 0}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                Push {selectedAds.size} Ad{selectedAds.size !== 1 ? 's' : ''} to Meta
              </button>

              {pushProgress > 0 && pushProgress < 100 && (
                <div className="space-y-2">
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pushProgress}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center">
                    Pushing {selectedAds.size} ad{selectedAds.size !== 1 ? 's' : ''}...
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 justify-center py-3 bg-emerald-900/20 rounded-lg border border-emerald-700/30">
                <span className="text-emerald-400 text-lg">✓</span>
                <span className="text-emerald-400 text-sm font-semibold">
                  {selectedAds.size} ad{selectedAds.size !== 1 ? 's' : ''} pushed successfully
                </span>
              </div>
              <button
                onClick={() => { setPushProgress(0); setPushComplete(false); setSelectedAds(new Set()); }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                Push More
              </button>
            </>
          )}

          {pushHistory.length > 0 && (
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                Recently pushed
              </p>
              {pushHistory.map((entry, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="text-zinc-400">{entry.count} ad{entry.count !== 1 ? 's' : ''}</span>
                  <span className="text-zinc-600">{entry.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
