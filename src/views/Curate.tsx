import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { toast } from '@/components/Toast';
import { driveThumbUrl } from '@/lib/drive';
import { loadClipsFolder, loadMusicFolder } from '@/lib/localFiles';
import { CurateDetail } from './CurateDetail';

export function Curate() {
  const { clips, setActiveTab, workspace, fetchClips, thumbnailMap, localFileMap, setLocalFileMap } = useStore();
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    setActiveTab('curate');
  }, [setActiveTab]);

  // Fetch clips if not already loaded (so Curate works without visiting Shots first)
  useEffect(() => {
    if (workspace && clips.length === 0) {
      fetchClips(workspace.id);
    }
  }, [workspace, clips.length, fetchClips]);

  // Count clips by approval status
  const pendingCount = clips.filter((c) => !c.approved && !c.rejected && !c.archived).length;
  const approvedCount = clips.filter((c) => c.approved && !c.archived).length;
  const rejectedCount = clips.filter((c) => c.rejected && !c.archived).length;
  const allCount = clips.filter((c) => !c.archived).length;

  // Calculate curation percentage
  const curatedCount = approvedCount + rejectedCount;
  const curatedPercent = allCount > 0 ? Math.round((curatedCount / allCount) * 100) : 0;

  // Filter clips based on active tab
  const filteredClips = clips.filter((c) => {
    if (c.archived) return false;
    if (activeFilter === 'pending') return !c.approved && !c.rejected;
    if (activeFilter === 'approved') return c.approved;
    if (activeFilter === 'rejected') return c.rejected;
    return true; // 'all'
  });

  const TabButton = ({
    label,
    count,
    active,
    onClick,
  }: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
        active ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
      }`}>{count}</span>
    </button>
  );

  if (clips.length === 0) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Clip Curation</h1>
          <p className="text-sm text-zinc-400">Review, trim, and approve clips before they enter the generation pool</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-zinc-800 mb-8 pb-0">
          <TabButton label="Pending" count={0} active={true} onClick={() => {}} />
          <TabButton label="Approved" count={0} active={false} onClick={() => {}} />
          <TabButton label="Rejected" count={0} active={false} onClick={() => {}} />
          <TabButton label="All" count={0} active={false} onClick={() => {}} />

          {/* Right side buttons and indicator */}
          <div className="ml-auto flex items-center gap-4">
            <button className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
              + Clips
            </button>
            <button className="px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
              + Music
            </button>
            <div className="text-sm text-zinc-500">0% curated</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-8 items-center">
          <select className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-300 focus:outline-none focus:border-zinc-600">
            <option>All types</option>
          </select>
          <input
            type="text"
            placeholder="Search clips..."
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 flex-1 max-w-xs"
          />
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-200 mb-2">Load Your Clips</h2>
              <p className="text-sm text-zinc-500 max-w-md">
                Select the folder containing your video clips. Files are saved in your browser
                automatically — you only need to do this once.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={async () => {
                  const map = await loadClipsFolder();
                  setLocalFileMap(map);
                  toast('success', `Loaded ${map.size / 2} video files`);
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Select Clips Folder
              </button>
              <button
                onClick={async () => {
                  const map = await loadMusicFolder();
                  toast('success', `Loaded ${map.size} music files`);
                }}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
              >
                Select Music Folder
              </button>
            </div>

            <div className="pt-6 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 font-mono">
                Workflow: Shots → <span className="text-indigo-400">Curate</span> → Generate → Review
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ FULL-SCREEN DETAIL VIEW ═══
  // When a clip is selected, show the detail editor instead of the grid
  const detailClip = selectedClipId ? clips.find((c) => c.id === selectedClipId) : null;
  if (detailClip) {
    return (
      <CurateDetail
        clip={detailClip}
        clipList={filteredClips}
        onBack={() => setSelectedClipId(null)}
        onNavigate={(id) => setSelectedClipId(id)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-lg font-bold text-zinc-100 mb-1">Clip Curation</h1>
        <p className="text-xs text-zinc-400">
          Review, trim, and approve clips before they enter the generation pool
        </p>
      </div>

      {/* Progress bar */}
      <div className="mx-6 mb-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${curatedPercent}%` }}
        />
      </div>

      {/* Tabs + filters on same row */}
      <div className="flex gap-4 px-6 border-b border-zinc-800 pb-0 items-center">
        <TabButton label="Pending" count={pendingCount} active={activeFilter === 'pending'} onClick={() => { setActiveFilter('pending'); setSelectedClipId(null); }} />
        <TabButton label="Approved" count={approvedCount} active={activeFilter === 'approved'} onClick={() => { setActiveFilter('approved'); setSelectedClipId(null); }} />
        <TabButton label="Rejected" count={rejectedCount} active={activeFilter === 'rejected'} onClick={() => { setActiveFilter('rejected'); setSelectedClipId(null); }} />
        <TabButton label="All" count={allCount} active={activeFilter === 'all'} onClick={() => { setActiveFilter('all'); setSelectedClipId(null); }} />

        {/* Right side buttons and indicator */}
        <div className="ml-auto flex items-center gap-3">
          <select className="h-8 px-2 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-600">
            <option>All types</option>
          </select>
          <input
            type="text"
            placeholder="Search clips..."
            className="h-8 px-3 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-48"
          />
          <button
            onClick={async () => {
              const map = await loadClipsFolder();
              setLocalFileMap(map);
              toast('success', `Loaded ${map.size / 2} video files from folder`);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            + Clips {localFileMap.size > 0 && `(${localFileMap.size / 2})`}
          </button>
          <button
            onClick={async () => {
              const map = await loadMusicFolder();
              toast('success', `Loaded ${map.size} music files`);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            + Music
          </button>
          <div className="text-sm text-zinc-400 font-bold tabular-nums">{curatedPercent}%<span className="text-zinc-500 font-normal ml-1">curated</span></div>
        </div>
      </div>

      {/* Main content area — grid of clips, click to open detail view */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {filteredClips.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {filteredClips.map((clip) => {
                const clipType = (clip.type || 'body').toLowerCase();
                const typeBg = clipType === 'hook' ? 'bg-[#ff6b6b]' : clipType === 'product' ? 'bg-[#f0a030]' : clipType === 'cta' ? 'bg-[#4ecdc4]' : 'bg-[#6b8aff]';
                const statusText = clip.approved ? 'APPROVED' : clip.rejected ? 'REJECTED' : 'PENDING';
                const statusColor = clip.approved ? 'bg-emerald-600 text-white' : clip.rejected ? 'bg-red-600 text-white' : 'bg-amber-600 text-white';
                const isActive = clip.id === selectedClipId;
                // Resolve thumbnail same as ClipCard
                const thumbSrc = clip.thumbnail_url
                  || (clip.drive_file_id ? driveThumbUrl(clip.drive_file_id) : null)
                  || (() => { const base = clip.name.replace(/\.[^.]+$/, ''); for (const [k, v] of thumbnailMap.entries()) { if (k.startsWith(base)) return driveThumbUrl(v); } return null; })();
                return (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`group relative bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isActive ? 'ring-2 ring-purple-500 border-purple-500' : 'border-zinc-800/60 hover:border-zinc-600'
                    }`}
                  >
                    <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-zinc-700/50 to-zinc-800 flex items-center justify-center">
                      {thumbSrc ? (
                        <img src={thumbSrc} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-[10px] text-zinc-600 px-2 text-center truncate">{clip.name}</span>
                      )}
                      {/* Status badge — top-left */}
                      <div className={`absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-sm ${statusColor}`}>
                        {statusText}
                      </div>
                      {/* Type badge — top-right */}
                      <div className={`absolute top-1.5 right-1.5 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${typeBg}`}>
                        {clipType}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs text-zinc-300 truncate">{clip.name}</div>
                      <div className="text-[10px] text-zinc-600">{clip.duration.toFixed(1)}s · {clip.category || 'We Transfer'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <p className="text-sm">No clips match this filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
