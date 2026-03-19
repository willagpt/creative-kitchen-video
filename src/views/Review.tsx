import { useEffect, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Dropdown } from '@/components/Dropdown';
import { Trash2, RefreshCw } from 'lucide-react';

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

/* ── Component ─────────────────────────────────────────────────────── */

export function Review() {
  const { setActiveTab, workspace, clips } = useStore();
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
        // Auto-select first
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
    const readyIds = renderedVideos
      .filter((v) => v.status === 'queued' || v.status === 'ready')
      .map((v) => v.id);
    setSelectedAds(new Set(readyIds));
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
      toast('success', `${ids.length} variation(s) deleted`);
    } catch (err) {
      console.error('Delete error:', err);
      toast('error', 'Failed to delete');
    }
  };

  /* ── Status helpers ────────────────────────────────────────────── */
  const getStatusBadgeColor = (status: string) => {
    if (status === 'queued') return 'bg-zinc-800 text-zinc-300';
    if (status === 'ready') return 'bg-emerald-900/40 text-emerald-400';
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
    if (selectedAds.size === 0) return;
    setPushProgress(0);
    setPushComplete(false);

    // Update status in Supabase
    const ids = Array.from(selectedAds);
    await supabase.from('rendered_videos').update({ status: 'pushed' }).in('id', ids);
    setRenderedVideos(renderedVideos.map(v => ids.includes(v.id) ? { ...v, status: 'pushed' } : v));

    // Simulate progress
    const interval = setInterval(() => {
      setPushProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setPushComplete(true);
          const now = new Date().toLocaleTimeString();
          setPushHistory((prev) => [{ timestamp: now, count: selectedAds.size }, ...prev].slice(0, 5));
          return 100;
        }
        return prev + 33.33;
      });
    }, 1000);
  };

  const handleBudgetChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDailyBudget(e.target.value);
  };

  const selectedVideo = renderedVideos.find(v => v.id === selectedVideoId);

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SECTION - VIDEO PREVIEW & LIST */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-200">Rendered Videos</h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {renderedVideos.length} total
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
              className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              Select all ready
            </button>
            {selectedAds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete {selectedAds.size}
              </button>
            )}
          </div>
        </div>

        {/* Selected video detail card */}
        {selectedVideo && (
          <div className="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-100 truncate">{selectedVideo.name}</span>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${getStatusBadgeColor(selectedVideo.status)}`}>
                {selectedVideo.status.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Hook', clipId: selectedVideo.hook_clip_id, color: shotTypeColor.hook },
                { label: 'Body', clipId: selectedVideo.body_clip_id, color: shotTypeColor.body },
                { label: 'Product', clipId: selectedVideo.product_clip_id, color: shotTypeColor.product },
                { label: 'CTA', clipId: selectedVideo.cta_clip_id, color: shotTypeColor.cta },
              ].map(({ label, clipId, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{label}</div>
                    <div className="text-[10px] text-zinc-300">{clipName(clipId) || <span className="text-zinc-600 italic">none</span>}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800 flex gap-4 text-[10px] text-zinc-500">
              {selectedVideo.format && <span>Format: {selectedVideo.format}</span>}
              <span>Ratio: {selectedVideo.ratio}</span>
              {selectedVideo.recipe_name && <span>Recipe: {selectedVideo.recipe_name}</span>}
            </div>
          </div>
        )}

        {/* Rendered Videos List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Loading...</div>
          ) : renderedVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-400 mb-2">No rendered videos yet</p>
              <p className="text-[11px] text-zinc-600">Generate variations or render a recipe to see them here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderedVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`flex items-center gap-3 p-3 bg-zinc-900 border rounded-lg hover:border-zinc-700 transition-colors cursor-pointer ${
                    selectedVideoId === video.id ? 'border-purple-500/50' : 'border-zinc-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAds.has(video.id)}
                    onChange={(e) => { e.stopPropagation(); handleToggleAdSelection(video.id); }}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer accent-indigo-500"
                  />

                  {/* AIDA color bar */}
                  <div className="flex w-8 h-8 rounded overflow-hidden flex-shrink-0">
                    <div className="w-1/4 h-full" style={{ backgroundColor: video.hook_clip_id ? shotTypeColor.hook : '#333' }} />
                    <div className="w-1/4 h-full" style={{ backgroundColor: video.body_clip_id ? shotTypeColor.body : '#333' }} />
                    <div className="w-1/4 h-full" style={{ backgroundColor: video.product_clip_id ? shotTypeColor.product : '#333' }} />
                    <div className="w-1/4 h-full" style={{ backgroundColor: video.cta_clip_id ? shotTypeColor.cta : '#333' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-100 truncate">{video.name || 'Untitled'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-500">{video.ratio}</span>
                      {video.format && (
                        <>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500">{video.format}</span>
                        </>
                      )}
                      {video.variation_type && (
                        <>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500">{video.variation_type}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${getStatusBadgeColor(video.status)}`}>
                    {video.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - META ADS CONFIG */}
      <div className="w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Meta Ads
          </h3>
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
          <div className="bg-zinc-800 rounded-lg p-3">
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
                className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-600"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Push Button & Progress */}
        <div className="px-4 py-4 border-t border-zinc-800 flex-shrink-0 space-y-3">
          {!pushComplete ? (
            <>
              <button
                onClick={handlePushToMeta}
                disabled={selectedAds.size === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                Push {selectedAds.size} Ad{selectedAds.size !== 1 ? 's' : ''} to Meta
              </button>

              {pushProgress > 0 && pushProgress < 100 && (
                <div className="space-y-2">
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${pushProgress}%` }} />
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
