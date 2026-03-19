import { useEffect, useRef, useState, useCallback } from 'react';
import type { Clip, ColourGrade, SubType } from '@/types';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { toast } from '@/components/Toast';
import { resolveLocalVideo, loadClipsFolder } from '@/lib/localFiles';
import { driveThumbUrl } from '@/lib/drive';

/* ─── Constants ──────────────────────────────────────────── */
const COLOUR_GRADE_PRESETS: Record<string, ColourGrade> = {
  Original:     { brightness: 100, contrast: 100, saturate: 100, temperature: 0, shadows: 0 },
  'Food Pop':   { brightness: 105, contrast: 112, saturate: 130, temperature: 8, shadows: -10 },
  'Warm Gold':  { brightness: 103, contrast: 105, saturate: 115, temperature: 18, shadows: -5 },
  'Cool Clean': { brightness: 105, contrast: 108, saturate: 95, temperature: -12, shadows: 5 },
  'Rich Cinema':{ brightness: 97,  contrast: 118, saturate: 110, temperature: 5, shadows: -15 },
  'Matte Film': { brightness: 102, contrast: 92,  saturate: 90,  temperature: 3, shadows: 12 },
  Vibrant:      { brightness: 103, contrast: 110, saturate: 145, temperature: 2, shadows: -8 },
  'Moody Dark': { brightness: 90,  contrast: 120, saturate: 105, temperature: -5, shadows: -20 },
  'Pastel Soft':{ brightness: 108, contrast: 90,  saturate: 85,  temperature: 6, shadows: 8 },
  'High Key':   { brightness: 115, contrast: 95,  saturate: 100, temperature: 0, shadows: 10 },
  Earthy:       { brightness: 100, contrast: 108, saturate: 105, temperature: 12, shadows: -8 },
  Punchy:       { brightness: 100, contrast: 125, saturate: 125, temperature: 0, shadows: -12 },
};

const SUB_TYPE_STYLES: Record<SubType, string> = {
  'food-action': 'border-[#ff6b6b] bg-[#ff6b6b]/20 text-[#ff6b6b]',
  'food-beauty': 'border-[#f0a030] bg-[#f0a030]/20 text-[#f0a030]',
  'lifestyle':   'border-[#6b8aff] bg-[#6b8aff]/20 text-[#6b8aff]',
  'product':     'border-[#4ecdc4] bg-[#4ecdc4]/20 text-[#4ecdc4]',
  'stop-motion': 'border-pink-500 bg-pink-500/20 text-pink-400',
};

const TAG_CATEGORIES: Record<string, string[]> = {
  'SHOT STYLE': ['close up', 'handheld', 'studio', 'tripod', 'stop motion'],
  ACTION:       ['stir', 'pour', 'plate', 'eat', 'open', 'sprinkle'],
  SUBJECT:      ['meal', 'person', 'kitchen', 'hands', 'box', 'delivery'],
  MOOD:         ['vibrant', 'warm', 'bright', 'clean', 'natural light'],
};

const ROTATION_OPTIONS = [0, 90, 180, 270] as const;
const TARGET_RATIOS = ['Original', '9:16', '16:9', '1:1', '4:5'] as const;

const TYPE_OPTIONS = ['hook', 'body', 'cta', 'product', 'social_proof', 'transition'];
const TYPE_COLORS: Record<string, string> = {
  hook:         '#ff6b6b',
  body:         '#6b8aff',
  cta:          '#4ecdc4',
  product:      '#f0a030',
  social_proof: '#a78bfa',
  transition:   '#94a3b8',
};

/* ─── Helpers ────────────────────────────────────────────── */
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}

function buildFilterStyle(g: ColourGrade): string {
  return `brightness(${g.brightness / 100}) contrast(${g.contrast / 100}) saturate(${g.saturate / 100}) hue-rotate(${g.temperature * 1.5}deg)`;
}

/* ─── Props ──────────────────────────────────────────────── */
interface CurateDetailProps {
  clip: Clip;
  clipList: Clip[];              // filtered list for prev/next
  onBack: () => void;
  onNavigate: (clipId: number) => void;
}

/* ─── Component ──────────────────────────────────────────── */
export function CurateDetail({ clip, clipList, onBack, onNavigate }: CurateDetailProps) {
  const { updateClip, user, workspace, localFileMap, setLocalFileMap, videoFileMap, thumbnailMap } = useStore();

  /* ── Video player refs / state ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(clip.duration || 0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [dragging, setDragging] = useState<null | 'playhead' | 'in' | 'out'>(null);

  /* ── Clip editing state ── */
  const [trimIn, setTrimIn] = useState(clip.trim_in ?? 0);
  const [trimOut, setTrimOut] = useState(clip.trim_out ?? clip.duration);
  const [selectedTags, setSelectedTags] = useState<string[]>(clip.tags || []);
  const [colourGrade, setColourGrade] = useState<ColourGrade>(clip.colour_grade || COLOUR_GRADE_PRESETS.Original);
  const [activePreset, setActivePreset] = useState(clip.colour_grade ? 'Custom' : 'Original');
  const [rotation, setRotation] = useState(0);
  const [targetRatio, setTargetRatio] = useState<string>('Original');
  const [showColour, setShowColour] = useState(true);
  const [clipType, setClipType] = useState(clip.type || 'body');

  /* ── Nav index ── */
  const idx = clipList.findIndex((c) => c.id === clip.id);
  const hasPrev = idx > 0;
  const hasNext = idx < clipList.length - 1;

  /* ── Resolve video source ── */
  const localSrc = resolveLocalVideo(clip.name, localFileMap);
  const driveId = clip.drive_file_id || (() => {
    const base = clip.name.replace(/\.[^.]+$/, '');
    for (const [k, v] of videoFileMap.entries()) {
      if (k.startsWith(base) || base.startsWith(k)) return v;
    }
    return null;
  })();
  const thumbSrc = clip.thumbnail_url
    || (clip.drive_file_id ? driveThumbUrl(clip.drive_file_id) : null)
    || (() => {
      const base = clip.name.replace(/\.[^.]+$/, '');
      for (const [k, v] of thumbnailMap.entries()) {
        if (k.startsWith(base)) return driveThumbUrl(v);
      }
      return null;
    })();

  /* ── Sync state when clip changes ── */
  useEffect(() => {
    setTrimIn(clip.trim_in ?? 0);
    setTrimOut(clip.trim_out ?? clip.duration);
    setSelectedTags(clip.tags || []);
    setColourGrade(clip.colour_grade || COLOUR_GRADE_PRESETS.Original);
    setActivePreset(clip.colour_grade ? 'Custom' : 'Original');
    setClipType(clip.type || 'body');
    setRotation(0);
    setTargetRatio('Original');
    setCurTime(0);
    setPlaying(false);
  }, [clip.id]);

  /* ── Generate thumbnail strip from video ── */
  useEffect(() => {
    if (!localSrc) { setThumbnails([]); return; }
    let cancelled = false;
    const vid = document.createElement('video');
    vid.preload = 'auto';
    vid.muted = true;
    vid.playsInline = true;
    vid.src = localSrc;

    const frames: string[] = [];
    const numFrames = 20;
    let currentFrame = 0;

    vid.addEventListener('loadedmetadata', () => {
      if (cancelled) return;
      const step = vid.duration / numFrames;
      vid.currentTime = step * 0.5; // start slightly into first frame

      const captureFrame = () => {
        if (cancelled) return;
        if (currentFrame >= numFrames) {
          setThumbnails([...frames]);
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.6));
          }
        } catch {
          // skip frame on error
        }
        currentFrame++;
        if (currentFrame < numFrames) {
          vid.currentTime = Math.min(currentFrame * step + 0.01, vid.duration - 0.05);
        } else {
          setThumbnails([...frames]);
        }
      };

      vid.addEventListener('seeked', captureFrame);
      vid.currentTime = 0.1; // trigger first seek
    });

    return () => { cancelled = true; vid.src = ''; };
  }, [localSrc]);

  /* ── Video time tracking ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurTime(v.currentTime);
    const onDur = () => setDuration(v.duration || clip.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onDur);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onDur);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [clip.id]);

  /* ── Enforce trim boundaries during playback ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    if (currentTime >= trimOut) {
      v.pause();
      v.currentTime = trimIn;
    }
  }, [currentTime, trimOut, trimIn, playing]);

  /* ── Persist helpers ── */
  const persistClip = useCallback(async (updates: Partial<Clip>) => {
    try {
      const { error } = await supabase.from('clips').update(updates).eq('id', clip.id);
      if (error) throw error;
      updateClip(clip.id, updates);
    } catch (err) {
      console.error('Failed to update clip:', err);
      toast('error', 'Failed to save');
    }
  }, [clip.id, updateClip]);

  /* ── Actions ── */
  const handleApprove = useCallback(async () => {
    const updates: Record<string, unknown> = {
      approved: true,
      rejected: false,
      trim_in: trimIn,
      trim_out: trimOut,
      tags: selectedTags,
      type: clipType,
    };
    if (activePreset !== 'Original') updates.colour_grade = colourGrade;
    await persistClip(updates as Partial<Clip>);
    if (user && workspace) {
      await logActivity(workspace.id, user.id, user.email || '', 'approved', 'clip', clip.id.toString(), { clipName: clip.name });
    }
    toast('success', `Approved: ${clip.name}`);
    // Auto-advance
    if (hasNext) onNavigate(clipList[idx + 1].id);
  }, [clip, trimIn, trimOut, selectedTags, colourGrade, activePreset, clipType, hasNext, idx, clipList, onNavigate, persistClip, user, workspace]);

  const handleReject = useCallback(async () => {
    await persistClip({ approved: false, rejected: true } as Partial<Clip>);
    if (user && workspace) {
      await logActivity(workspace.id, user.id, user.email || '', 'rejected', 'clip', clip.id.toString(), { clipName: clip.name });
    }
    toast('success', `Rejected: ${clip.name}`);
    if (hasNext) onNavigate(clipList[idx + 1].id);
  }, [clip, hasNext, idx, clipList, onNavigate, persistClip, user, workspace]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'r':
          e.preventDefault();
          handleReject();
          break;
        case 'escape':
          e.preventDefault();
          onBack();
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) { videoRef.current.currentTime = Math.max(trimIn, videoRef.current.currentTime); videoRef.current.play(); }
            else videoRef.current.pause();
          }
          break;
        case 'i':
          e.preventDefault();
          setTrimIn(currentTime);
          break;
        case 'o':
          e.preventDefault();
          setTrimOut(currentTime);
          break;
        case 'arrowleft':
          e.preventDefault();
          if (e.shiftKey && hasPrev) onNavigate(clipList[idx - 1].id);
          else if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (1 / 30));
          break;
        case 'arrowright':
          e.preventDefault();
          if (e.shiftKey && hasNext) onNavigate(clipList[idx + 1].id);
          else if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + (1 / 30));
          break;
        case 'j':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          break;
        case 'l':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleApprove, handleReject, onBack, currentTime, trimIn, trimOut, duration, hasPrev, hasNext, idx, clipList, onNavigate]);

  /* ── Timeline interaction ── */
  const getTimeFromX = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * duration;
  }, [duration]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    const t = getTimeFromX(e.clientX);
    // Determine if near a marker
    const inPx = (trimIn / duration) * (timelineRef.current?.clientWidth || 1);
    const outPx = (trimOut / duration) * (timelineRef.current?.clientWidth || 1);
    const rect = timelineRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left || 0);

    if (Math.abs(x - inPx) < 10) {
      setDragging('in');
    } else if (Math.abs(x - outPx) < 10) {
      setDragging('out');
    } else {
      setDragging('playhead');
      if (videoRef.current) videoRef.current.currentTime = t;
    }
  }, [trimIn, trimOut, duration, getTimeFromX]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const t = getTimeFromX(e.clientX);
      if (dragging === 'in') setTrimIn(Math.max(0, Math.min(t, trimOut - 0.1)));
      else if (dragging === 'out') setTrimOut(Math.min(duration, Math.max(t, trimIn + 0.1)));
      else if (videoRef.current) videoRef.current.currentTime = t;
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, trimIn, trimOut, duration, getTimeFromX]);

  /* ── Tag toggle ── */
  const handleTagToggle = async (tag: string) => {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setSelectedTags(next);
    await persistClip({ tags: next } as Partial<Clip>);
  };

  /* ── Sub-type change ── */
  const handleSubTypeChange = async (st: SubType) => {
    await persistClip({ sub_type: st } as Partial<Clip>);
  };

  /* ── Type change ── */
  const handleTypeChange = async (t: string) => {
    setClipType(t);
    await persistClip({ type: t } as Partial<Clip>);
  };

  /* ── CSS filter for colour grading ── */
  const filterStyle = buildFilterStyle(colourGrade);

  const typeColor = TYPE_COLORS[clipType] || '#6b8aff';

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-zinc-100 overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center h-10 px-4 border-b border-white/5 bg-[#111118] flex-shrink-0 gap-3">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Grid
        </button>

        <div className="h-5 w-px bg-white/10" />

        {/* Sub-type pills */}
        <div className="flex gap-1.5">
          {(['food-action', 'food-beauty', 'lifestyle', 'product', 'stop-motion'] as SubType[]).map((st) => (
            <button
              key={st}
              onClick={() => handleSubTypeChange(st)}
              className={`px-2.5 py-0.5 text-[10px] rounded-full border transition-colors font-medium ${
                clip.sub_type === st ? SUB_TYPE_STYLES[st] : 'border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-400'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Clip counter */}
          <span className="text-[10px] text-zinc-500 tabular-nums font-medium">
            {idx + 1} / {clipList.length}
          </span>

          {/* Prev / Next */}
          <div className="flex gap-1">
            <button
              disabled={!hasPrev}
              onClick={() => hasPrev && onNavigate(clipList[idx - 1].id)}
              className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={!hasNext}
              onClick={() => hasNext && onNavigate(clipList[idx + 1].id)}
              className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 rounded transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT: Video player + timeline ═══ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Video player */}
          <div className="flex-1 flex items-center justify-center bg-black p-4 min-h-0 relative">
            {localSrc ? (
              /* ── Local video playback ── */
              <video
                ref={videoRef}
                key={`vid-${clip.id}`}
                src={localSrc}
                controls
                playsInline
                autoPlay
                poster={thumbSrc || undefined}
                className="max-w-full max-h-full object-contain rounded"
                style={{
                  filter: filterStyle,
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                }}
                preload="auto"
              />
            ) : driveId ? (
              /* ── Drive video fallback ── */
              <div className="flex flex-col items-center gap-3 w-full h-full">
                <iframe
                  key={clip.id}
                  src={`https://drive.google.com/file/d/${driveId}/preview`}
                  className="flex-1 w-full max-w-3xl rounded"
                  allow="autoplay"
                  allowFullScreen
                />
                <button
                  onClick={async () => {
                    const map = await loadClipsFolder();
                    setLocalFileMap(map);
                    toast('success', `Loaded ${map.size / 2} video files`);
                  }}
                  className="px-4 py-1.5 text-[11px] bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                >
                  Load local files for full editing
                </button>
              </div>
            ) : (
              /* ── No video source: show thumbnail + load prompt ── */
              <div className="flex flex-col items-center justify-center gap-4 max-w-lg text-center">
                {thumbSrc ? (
                  <img src={thumbSrc} alt={clip.name} className="max-w-full max-h-[50vh] object-contain rounded opacity-60" />
                ) : (
                  <div className="w-64 h-36 bg-zinc-900 rounded-lg flex items-center justify-center border border-white/10">
                    <span className="text-zinc-600 text-sm truncate px-4">{clip.name}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    Load your local video files for playback & editing
                  </p>
                  <button
                    onClick={async () => {
                      const map = await loadClipsFolder();
                      setLocalFileMap(map);
                      toast('success', `Loaded ${map.size / 2} video files`);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Load Clips Folder
                  </button>
                  <p className="text-[10px] text-zinc-600">
                    Select the folder containing your .mov/.mp4 files
                  </p>
                </div>
              </div>
            )}

            {/* Play status indicator — non-blocking */}
            {localSrc && !playing && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-[10px] text-zinc-300 pointer-events-none">
                Paused — Space to play
              </div>
            )}
          </div>

          {/* ═══ TIMELINE SCRUBBER ═══ */}
          <div className="bg-[#111118] border-t border-white/5 px-4 py-3 flex-shrink-0">
            {/* Time display */}
            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2 tabular-nums">
              <span>{fmtTime(currentTime)}</span>
              <span className="text-zinc-400 font-medium">
                Trimmed: {fmtTime(trimOut - trimIn)} ({((trimOut - trimIn)).toFixed(1)}s)
              </span>
              <span>{fmtTime(duration)}</span>
            </div>

            {/* Timeline track */}
            <div
              ref={timelineRef}
              className="relative h-14 bg-[#1a1a24] rounded-lg overflow-hidden cursor-crosshair select-none border border-white/5"
              onMouseDown={handleTimelineMouseDown}
            >
              {/* Thumbnail strip */}
              <div className="absolute inset-0 flex">
                {thumbnails.length > 0
                  ? thumbnails.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-full flex-1 object-cover opacity-60" draggable={false} />
                  ))
                  : <div className="w-full h-full bg-gradient-to-r from-zinc-800 to-zinc-900" />
                }
              </div>

              {/* Dimmed outside-trim regions */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/70"
                style={{ width: `${(trimIn / duration) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/70"
                style={{ width: `${((duration - trimOut) / duration) * 100}%` }}
              />

              {/* Trim IN marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-emerald-500 cursor-ew-resize z-10 group"
                style={{ left: `${(trimIn / duration) * 100}%` }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-4 bg-emerald-500 rounded-b-sm flex items-center justify-center">
                  <span className="text-[7px] text-white font-bold">I</span>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-emerald-400 tabular-nums whitespace-nowrap font-medium">
                  {fmtTime(trimIn)}
                </div>
              </div>

              {/* Trim OUT marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize z-10 group"
                style={{ left: `${(trimOut / duration) * 100}%` }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-4 bg-red-500 rounded-b-sm flex items-center justify-center">
                  <span className="text-[7px] text-white font-bold">O</span>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-red-400 tabular-nums whitespace-nowrap font-medium">
                  {fmtTime(trimOut)}
                </div>
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="flex gap-4 mt-2 text-[9px] text-zinc-600">
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">Space</kbd> Play/Pause</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">I</kbd> Set IN</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">O</kbd> Set OUT</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">←/→</kbd> Frame step</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">J/L</kbd> ±5s</span>
              <span><kbd className="px-1 py-0.5 bg-white/5 rounded text-zinc-400 font-mono">Esc</kbd> Back</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div className="w-80 border-l border-white/5 bg-[#111118] overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-5">

            {/* ── Clip Name ── */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 truncate">{clip.name}</h2>
              <div className="text-[10px] text-zinc-500 mt-0.5">{clip.fullname || clip.name}</div>
            </div>

            {/* ── Details ── */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Details</h3>

              <div className="grid grid-cols-2 gap-2">
                {/* Type dropdown */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Type</label>
                  <select
                    value={clipType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full mt-0.5 h-7 px-2 text-[11px] bg-[#1a1a24] border border-white/10 rounded text-zinc-300 focus:outline-none focus:border-white/20"
                    style={{ color: typeColor }}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Category</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-white/10 rounded text-zinc-400">
                    {clip.category || 'Uncategorized'}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Duration</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-white/10 rounded text-zinc-400 tabular-nums">
                    {clip.duration.toFixed(1)}s
                  </div>
                </div>

                {/* Ratio */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Ratio</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-white/10 rounded text-zinc-400">
                    {clip.ratio || `${clip.width}×${clip.height}`}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Size</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-white/10 rounded text-zinc-400">
                    {clip.size_mb.toFixed(1)} MB
                  </div>
                </div>

                {/* Graded */}
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Graded</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-white/10 rounded">
                    <span className={clip.graded ? 'text-emerald-400' : 'text-amber-400'}>
                      {clip.graded ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tags ── */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Tags</h3>
              {Object.entries(TAG_CATEGORIES).map(([cat, tags]) => (
                <div key={cat}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{cat}</p>
                  <div className="flex gap-1 flex-wrap">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`px-2 py-0.5 text-[9px] rounded-full border transition-colors ${
                          selectedTags.includes(tag)
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                            : 'border-white/10 text-zinc-500 hover:border-white/20'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Reframe ── */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Reframe</h3>

              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Rotation</label>
                <div className="flex gap-1 mt-1">
                  {ROTATION_OPTIONS.map((deg) => (
                    <button
                      key={deg}
                      onClick={() => setRotation(deg)}
                      className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
                        rotation === deg
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : 'border-white/10 text-zinc-500 hover:border-white/20'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider">Target Ratio</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {TARGET_RATIOS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setTargetRatio(r)}
                      className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                        targetRatio === r
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                          : 'border-white/10 text-zinc-500 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Trim ── */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Trim</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">IN</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-emerald-500/30 rounded text-emerald-400 tabular-nums font-medium">
                    {fmtTime(trimIn)}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-600 uppercase tracking-wider">OUT</label>
                  <div className="mt-0.5 h-7 px-2 flex items-center text-[11px] bg-[#1a1a24] border border-red-500/30 rounded text-red-400 tabular-nums font-medium">
                    {fmtTime(trimOut)}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 tabular-nums">
                Duration: {(trimOut - trimIn).toFixed(2)}s (original: {clip.duration.toFixed(2)}s)
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setTrimIn(0); setTrimOut(duration || clip.duration); }}
                  className="flex-1 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400 rounded border border-white/5 transition-colors"
                >
                  Reset Trim
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = trimIn;
                      videoRef.current.play();
                    }
                  }}
                  className="flex-1 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400 rounded border border-white/5 transition-colors"
                >
                  Preview Trim
                </button>
              </div>
            </div>

            {/* ── Colour Grade toggle ── */}
            <div className="space-y-2.5">
              <button
                onClick={() => setShowColour(!showColour)}
                className="flex items-center gap-2 w-full"
              >
                <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Colour Grade</h3>
                <svg className={`w-3 h-3 text-zinc-500 transition-transform ${showColour ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {activePreset !== 'Original' && (
                  <span className="text-[9px] text-indigo-400 ml-auto">{activePreset}</span>
                )}
              </button>

              {showColour && (
                <div className="space-y-3">
                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(COLOUR_GRADE_PRESETS).map(([name]) => (
                      <button
                        key={name}
                        onClick={() => { setColourGrade(COLOUR_GRADE_PRESETS[name]); setActivePreset(name); }}
                        className={`px-1.5 py-1 rounded text-[9px] font-medium transition-colors ${
                          activePreset === name
                            ? 'bg-indigo-900/60 border border-indigo-500 text-indigo-300'
                            : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-300'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>

                  {/* Sliders */}
                  {(
                    [
                      { key: 'brightness', label: 'Brightness', min: 80, max: 120 },
                      { key: 'contrast', label: 'Contrast', min: 80, max: 130 },
                      { key: 'saturate', label: 'Saturate', min: 50, max: 150 },
                      { key: 'temperature', label: 'Temperature', min: -20, max: 20 },
                      { key: 'shadows', label: 'Shadows', min: -20, max: 20 },
                    ] as const
                  ).map(({ key, label, min, max }) => (
                    <div key={key} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] text-zinc-500">{label}</label>
                        <span className="text-[9px] text-zinc-600 tabular-nums">{colourGrade[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={colourGrade[key]}
                        onChange={(e) => {
                          setColourGrade({ ...colourGrade, [key]: parseInt(e.target.value) });
                          setActivePreset('Custom');
                        }}
                        className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  ))}

                  <div className="flex gap-1">
                    <button
                      onClick={() => { setColourGrade(COLOUR_GRADE_PRESETS.Original); setActivePreset('Original'); }}
                      className="flex-1 py-1 text-[9px] bg-white/5 hover:bg-white/10 text-zinc-400 rounded transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={async () => { await persistClip({ colour_grade: colourGrade } as Partial<Clip>); toast('success', 'Grade saved'); }}
                      className="flex-1 py-1 text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                    >
                      Apply Grade
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ STICKY BOTTOM: Approve / Reject ═══ */}
          <div className="sticky bottom-0 bg-[#111118] border-t border-white/5 p-4 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Approve & Next
                <kbd className="text-[10px] px-1.5 py-0.5 bg-emerald-700 rounded text-emerald-200 font-mono">A</kbd>
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-2.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Reject
                <kbd className="text-[10px] px-1.5 py-0.5 bg-red-700 rounded text-red-200 font-mono">R</kbd>
              </button>
            </div>

            {/* Status indicator */}
            <div className="text-center text-[10px] tabular-nums">
              {clip.approved && <span className="text-emerald-400 font-medium">✓ Approved</span>}
              {clip.rejected && <span className="text-red-400 font-medium">✗ Rejected</span>}
              {!clip.approved && !clip.rejected && <span className="text-amber-400 font-medium">● Pending</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
