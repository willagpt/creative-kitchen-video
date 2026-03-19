import type { Clip } from '@/types';
import { useStore } from '@/store';
import { Check } from 'lucide-react';
import { driveThumbUrl } from '@/lib/drive';

const TYPE_BADGE_COLORS: Record<string, string> = {
  body: 'bg-[#6b8aff]',
  hook: 'bg-[#ff6b6b]',
  product: 'bg-[#f0a030]',
  cta: 'bg-[#4ecdc4]',
  social_proof: 'bg-pink-500',
  transition: 'bg-zinc-600',
};


interface ClipCardProps {
  clip: Clip;
  manageMode?: boolean;
}

export function ClipCard({ clip, manageMode = false }: ClipCardProps) {
  const { selectedClips, toggleSelectClip, thumbnailMap } = useStore();
  const isSelected = selectedClips.has(clip.id);

  // Resolve thumbnail: try clip.thumbnail_url first, then Drive thumbnailMap
  const getThumbnailSrc = (): string | null => {
    if (clip.thumbnail_url) return clip.thumbnail_url;
    if (clip.drive_file_id) return driveThumbUrl(clip.drive_file_id);
    // Try matching by name in thumbnailMap (e.g., "clip-name.jpg")
    const baseName = clip.name.replace(/\.[^.]+$/, '');
    for (const [thumbName, fileId] of thumbnailMap.entries()) {
      if (thumbName.startsWith(baseName)) return driveThumbUrl(fileId);
    }
    return null;
  };
  const thumbnailSrc = getThumbnailSrc();

  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  const getStatusBadge = () => {
    if (clip.approved) {
      return {
        text: 'APPROVED',
        color: 'bg-emerald-600/20 text-emerald-400',
      };
    }
    if (clip.rejected) {
      return {
        text: 'REJECTED',
        color: 'bg-red-600/20 text-red-400',
      };
    }
    return {
      text: 'UNGRADED',
      color: 'bg-amber-600/20 text-amber-500',
    };
  };

  const statusBadge = getStatusBadge();
  const clipType = (clip.type || 'body').toLowerCase();
  const typeBgColor = TYPE_BADGE_COLORS[clipType] || 'bg-zinc-700';

  return (
    <div
      className={`group relative bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'ring-1 ring-purple-500 border-purple-500'
          : 'border-zinc-800/60 hover:border-purple-500/50'
      }`}
      onClick={() => toggleSelectClip(clip.id)}
    >
      {/* Thumbnail Area */}
      <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-zinc-700/50 to-zinc-800 rounded-t-lg flex items-center justify-center">
        {/* Actual thumbnail or faint clip name */}
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt={clip.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-600 px-2 text-center">
            <span className="line-clamp-1">{clip.name}</span>
          </div>
        )}

        {/* TYPE Badge - TOP-LEFT */}
        <div className={`absolute top-1.5 left-1.5 z-[5] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${typeBgColor}`}>
          {clipType}
        </div>

        {/* Selection checkbox - overlays on hover/manage */}
        <div
          className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded border flex items-center justify-center transition-opacity ${
            isSelected
              ? 'bg-purple-500 border-purple-500 opacity-100'
              : manageMode
              ? 'border-zinc-500 bg-black/30 opacity-100'
              : 'border-zinc-500 bg-black/30 opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectClip(clip.id);
          }}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>

        {/* RATIO Badge - TOP-RIGHT */}
        {clip.ratio && (
          <div className="absolute top-1.5 right-1.5 text-[9px] text-zinc-400 bg-zinc-900/70 px-1 py-0.5 rounded-sm">
            {clip.ratio}
          </div>
        )}

        {/* STATUS Badge - BOTTOM-LEFT */}
        <div className={`absolute bottom-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${statusBadge.color}`}>
          {statusBadge.text}
        </div>

        {/* DURATION - BOTTOM-RIGHT */}
        {clip.duration > 0 && (
          <div className="absolute bottom-1.5 right-1.5 text-[10px] text-zinc-300 font-mono">
            {formatDuration(clip.duration)}
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button className="px-2 py-1 text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors">
            Manage
          </button>
          <button className="px-2 py-1 text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors">
            Archive
          </button>
          <button className="px-2 py-1 text-[10px] font-medium bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Text Area — V1: p-2, clip name + source */}
      <div className="p-2">
        <div className="text-xs text-zinc-300 truncate">{clip.name}</div>
        <div className="text-[10px] text-zinc-600 truncate">{clip.category || ''}</div>
      </div>
    </div>
  );
}
