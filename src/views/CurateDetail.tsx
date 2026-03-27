'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Volume2, Settings } from 'lucide-react';
import type { Clip, ColourGrade } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const COLOUR_GRADE_PRESETS = [
  { name: 'Default', values: { brightness: 0, contrast: 0, saturate: 0, temperature: 0, shadows: 0 } },
  { name: 'Warm', values: { brightness: 5, contrast: 10, saturate: 5, temperature: 15, shadows: -5 } },
  { name: 'Cool', values: { brightness: 0, contrast: 10, saturate: 0, temperature: -20, shadows: 5 } },
  { name: 'High Contrast', values: { brightness: 0, contrast: 25, saturate: 10, temperature: 0, shadows: -10 } },
  { name: 'Moody', values: { brightness: -10, contrast: 15, saturate: -15, temperature: -10, shadows: 15 } },
  { name: 'Vivid', values: { brightness: 5, contrast: 20, saturate: 30, temperature: 5, shadows: -5 } },
  { name: 'Faded', values: { brightness: 15, contrast: -10, saturate: -20, temperature: 10, shadows: 5 } },
  { name: 'Cinematic', values: { brightness: -5, contrast: 20, saturate: 5, temperature: 10, shadows: 10 } },
  { name: 'Bright', values: { brightness: 20, contrast: 5, saturate: 5, temperature: 5, shadows: -10 } },
  { name: 'Desaturated', values: { brightness: 0, contrast: 10, saturate: -30, temperature: 0, shadows: 0 } },
  { name: 'Tinted', values: { brightness: 5, contrast: 10, saturate: 15, temperature: 20, shadows: -5 } },
  { name: 'Dusty', values: { brightness: 10, contrast: 5, saturate: -10, temperature: 10, shadows: 5 } },
];

const SUB_TYPE_STYLES: Record<string, string> = {
  'food-action': 'bg-orange-50 text-orange-700 border-orange-200',
  'food-beauty': 'bg-pink-50 text-pink-700 border-pink-200',
  'lifestyle': 'bg-blue-50 text-blue-700 border-blue-200',
  'product': 'bg-purple-50 text-purple-700 border-purple-200',
  'stop-motion': 'bg-green-50 text-green-700 border-green-200',
};

const TAG_CATEGORIES = [
  { label: 'Cuisine', tags: ['Thai', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian'] },
  { label: 'Technique', tags: ['Chop', 'Blend', 'Sauté', 'Grill', 'Bake', 'Steam'] },
  { label: 'Ingredient', tags: ['Vegetable', 'Protein', 'Grain', 'Sauce', 'Spice', 'Dairy'] },
  { label: 'Mood', tags: ['Quick', 'Comfort', 'Healthy', 'Indulgent', 'Vibrant', 'Subtle'] },
];

const TYPE_OPTIONS = [
  { value: 'hook', label: 'Hook', color: 'bg-red-100 text-red-700' },
  { value: 'body', label: 'Body', color: 'bg-blue-100 text-blue-700' },
  { value: 'cta', label: 'CTA', color: 'bg-green-100 text-green-700' },
  { value: 'product', label: 'Product', color: 'bg-purple-100 text-purple-700' },
  { value: 'social_proof', label: 'Social Proof', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'transition', label: 'Transition', color: 'bg-indigo-100 text-indigo-700' },
];

const TYPE_COLORS: Record<string, string> = {
  hook: 'bg-red-100 text-red-700',
  body: 'bg-blue-100 text-blue-700',
  cta: 'bg-green-100 text-green-700',
  product: 'bg-purple-100 text-purple-700',
  social_proof: 'bg-yellow-100 text-yellow-700',
  transition: 'bg-indigo-100 text-indigo-700',
};

export default function CurateDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const workspace_id = params.workspace as string;
  const clip_id = parseInt(params.id as string);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ type: 'trim-in' | 'trim-out' | 'playhead' | null; initialX: number; initialValue: number }>({ type: null, initialX: 0, initialValue: 0 });

  const [clip, setClip] = useState<Clip | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [colourGrade, setColourGrade] = useState<ColourGrade>({
    brightness: 0,
    contrast: 0,
    saturate: 0,
    temperature: 0,
    shadows: 0,
  });
  const [clipType, setClipType] = useState('');
  const [notes, setNotes] = useState('');
  const [starRating, setStarRating] = useState(0);
  const [hookEligible, setHookEligible] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [customTags, setCustomTags] = useState('');
  const [videoError, setVideoError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // Load clip and related data
  useEffect(() => {
    const loadClip = async () => {
      const { data: clipData } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clip_id)
        .single();

      if (clipData) {
        setClip(clipData);
        setTrimIn(clipData.trim_in || 0);
        setTrimOut(clipData.trim_out || 0);
        setSelectedTags(clipData.tags || []);
        setColourGrade(clipData.colour_grade || { brightness: 0, contrast: 0, saturate: 0, temperature: 0, shadows: 0 });
        setClipType(clipData.type || '');
        setNotes(clipData.curation_note || '');
        setStarRating(clipData.star_rating || 0);
        setHookEligible(clipData.hook_eligible || false);
      }

      const { data: clipsData } = await supabase
        .from('clips')
        .select('*')
        .eq('workspace_id', workspace_id)
        .order('created_at', { ascending: false });

      if (clipsData) {
        setClips(clipsData);
      }

      const { data: segmentsData } = await supabase
        .from('clip_segments')
        .select('*')
        .eq('clip_id', clip_id)
        .order('created_at', { ascending: true });

      if (segmentsData) {
        setSegments(segmentsData);
      }
    };

    loadClip();
  }, [clip_id, workspace_id]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const effectiveTrimOut = trimOut || duration;
      if (currentTime >= effectiveTrimOut && playing) {
        video.currentTime = trimIn;
      } else {
        setCurrentTime(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (trimOut === 0) {
        setTrimOut(video.duration);
      }
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleError = () => setVideoError('Failed to load video');

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [trimIn, trimOut, duration, playing, currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a') handleApprove();
      if (e.key === 'r') handleReject();
      if (e.key === ' ') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        }
      }
      if (e.key === 'i') setTrimIn(currentTime);
      if (e.key === 'o') setTrimOut(currentTime);
      if (e.key === 'ArrowLeft') {
        const currentIndex = clips.findIndex(c => c.id === clip_id);
        if (currentIndex > 0) {
          router.push(`/curate/${workspace_id}/${clips[currentIndex + 1].id}`);
        }
      }
      if (e.key === 'ArrowRight') {
        const currentIndex = clips.findIndex(c => c.id === clip_id);
        if (currentIndex < clips.length - 1) {
          router.push(`/curate/${workspace_id}/${clips[currentIndex - 1].id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clip_id, clips, workspace_id, currentTime]);

  // Timeline dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStateRef.current.type) return;

      const timeline = timelineRef.current;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = percent * duration;

      if (dragStateRef.current.type === 'trim-in') {
        setTrimIn(Math.min(newTime, trimOut || duration));
      } else if (dragStateRef.current.type === 'trim-out') {
        setTrimOut(Math.max(newTime, trimIn));
      } else if (dragStateRef.current.type === 'playhead') {
        if (videoRef.current) {
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStateRef.current.type = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, duration, trimIn, trimOut]);

  // Generate thumbnails
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || thumbnailsGenerated) return;

    const generateThumbnails = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const thumbnailCount = 10;
      const newThumbnails: string[] = [];

      for (let i = 0; i < thumbnailCount; i++) {
        const time = (duration / thumbnailCount) * i;
        video.currentTime = time;

        await new Promise(resolve => {
          const handler = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            newThumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
            video.removeEventListener('seeked', handler);
            resolve(null);
          };
          video.addEventListener('seeked', handler);
        });
      }

      setThumbnails(newThumbnails);
      setThumbnailsGenerated(true);
      video.currentTime = 0;
    };

    generateThumbnails();
  }, [videoRef, canvasRef, duration, thumbnailsGenerated]);

  const handleApprove = async () => {
    if (!clip) return;

    const { data: existingSegment } = await supabase
      .from('clip_segments')
      .select('*')
      .eq('clip_id', clip_id)
      .eq('trim_in', trimIn)
      .eq('trim_out', trimOut || duration)
      .single();

    if (existingSegment) {
      await supabase
        .from('clip_segments')
        .update({
          type: clipType,
          hook_eligible: hookEligible,
          tags: selectedTags,
          colour_grade: colourGrade,
        })
        .eq('id', existingSegment.id);
    } else {
      await supabase
        .from('clip_segments')
        .insert([
          {
            clip_id,
            trim_in: trimIn,
            trim_out: trimOut || duration,
            type: clipType,
            hook_eligible: hookEligible,
            tags: selectedTags,
            colour_grade: colourGrade,
          },
        ]);
    }

    await supabase
      .from('clips')
      .update({
        approved: true,
        rejected: false,
        type: clipType,
        tags: selectedTags,
        colour_grade: colourGrade,
        curation_note: notes,
        star_rating: starRating,
        hook_eligible: hookEligible,
      })
      .eq('id', clip_id);

    const { data: segmentsData } = await supabase
      .from('clip_segments')
      .select('*')
      .eq('clip_id', clip_id)
      .order('created_at', { ascending: true });

    if (segmentsData) {
      setSegments(segmentsData);
    }
  };

  const handleReject = async () => {
    if (!clip) return;

    await supabase
      .from('clips')
      .update({
        rejected: true,
        approved: false,
      })
      .eq('id', clip_id);

    setClip({ ...clip, rejected: true, approved: false });
  };

  const handleHookEligibleToggle = async () => {
    setHookEligible(!hookEligible);
    await supabase
      .from('clips')
      .update({ hook_eligible: !hookEligible })
      .eq('id', clip_id);
  };

  const handleDeleteSegment = async (segmentId: number) => {
    await supabase
      .from('clip_segments')
      .delete()
      .eq('id', segmentId);

    setSegments(segments.filter(s => s.id !== segmentId));
  };

  const handleUpdateSegmentLabel = async (segmentId: number, label: string) => {
    await supabase
      .from('clip_segments')
      .update({ type: label })
      .eq('id', segmentId);

    setSegments(segments.map(s => (s.id === segmentId ? { ...s, type: label } : s)));
  };

  const handleDuplicate = async () => {
    if (!clip) return;

    const { data: newClip } = await supabase
      .from('clips')
      .insert([
        {
          ...clip,
          id: undefined,
          name: `${clip.name} (copy)`,
        },
      ])
      .select()
      .single();

    if (newClip) {
      router.push(`/curate/${workspace_id}/${newClip.id}`);
    }
  };

  const addCustomTags = () => {
    const newTags = customTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t && !selectedTags.includes(t));

    setSelectedTags([...selectedTags, ...newTags]);
    setCustomTags('');
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const buildFilterStyle = () => {
    const filters = [
      `brightness(${100 + colourGrade.brightness}%)`,
      `contrast(${100 + colourGrade.contrast}%)`,
      `saturate(${100 + colourGrade.saturate}%)`,
      `hue-rotate(${colourGrade.temperature * 1.5}deg)`,
    ];
    return filters.join(' ');
  };

  const currentIndex = clips.findIndex(c => c.id === clip_id);
  const prevClip = currentIndex > 0 ? clips[currentIndex + 1] : null;
  const nextClip = currentIndex < clips.length - 1 ? clips[currentIndex - 1] : null;

  if (!clip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p>Loading clip...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-secondary">
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{clip.name}</h1>
              <p className="text-sm text-gray-500">{clip.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {clip.approved && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Approved
              </span>
            )}
            {clip.rejected && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Rejected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {prevClip && (
              <button
                onClick={() => router.push(`/curate/${workspace_id}/${prevClip.id}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {nextClip && (
              <button
                onClick={() => router.push(`/curate/${workspace_id}/${nextClip.id}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Sub-Type Row */}
        {clip.sub_type && (
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${SUB_TYPE_STYLES[clip.sub_type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
            >
              {clip.sub_type}
            </span>
          </div>
        )}

        {/* Video Player Section */}
        <div className="flex-1 flex items-center justify-center bg-black p-8">
          {videoError ? (
            <div className="text-center">
              <p className="text-white mb-4">{videoError}</p>
              {clip.proxy_url && (
                <a
                  href={clip.proxy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  View Original File
                </a>
              )}
            </div>
          ) : clip.drive_url ? (
            <div className="text-center">
              <p className="text-gray-300 mb-4">Video from Google Drive</p>
              <a
                href={clip.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Open in Google Drive
              </a>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={clip.path}
              className="max-h-full max-w-full rounded-lg shadow-lg"
              style={{ filter: buildFilterStyle() }}
              onContextMenu={e => e.preventDefault()}
            />
          )}
          <canvas ref={canvasRef} width={320} height={180} className="hidden" />
        </div>

        {/* Timeline */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div
            ref={timelineRef}
            className="relative h-16 bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
            onClick={e => {
              const rect = timelineRef.current!.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              const newTime = Math.max(0, Math.min(1, percent)) * duration;
              if (videoRef.current) {
                videoRef.current.currentTime = newTime;
                setCurrentTime(newTime);
              }
            }}
          >
            {/* Thumbnails */}
            <div className="flex h-full">
              {thumbnails.map((thumb, i) => (
                <img
                  key={i}
                  src={thumb}
                  alt={`Thumbnail ${i}`}
                  className="h-full flex-1 object-cover"
                />
              ))}
            </div>

            {/* Trim Markers */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-green-500 cursor-ew-resize hover:bg-green-600"
              style={{ left: `${(trimIn / duration) * 100}%` }}
              onMouseDown={() => {
                setIsDragging(true);
                dragStateRef.current = { type: 'trim-in', initialX: 0, initialValue: trimIn };
              }}
            />
            {trimOut > 0 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize hover:bg-red-600"
                style={{ left: `${(trimOut / duration) * 100}%` }}
                onMouseDown={() => {
                  setIsDragging(true);
                  dragStateRef.current = { type: 'trim-out', initialX: 0, initialValue: trimOut };
                }}
              />
            )}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-blue-500"
              style={{ left: `${(currentTime / duration) * 100}%` }}
              onMouseDown={() => {
                setIsDragging(true);
                dragStateRef.current = { type: 'playhead', initialX: 0, initialValue: currentTime };
              }}
            />

            {/* Time Display */}
            <div className="absolute inset-0 flex items-end justify-between px-2 py-1 text-xs text-gray-600 bg-gradient-to-b from-transparent to-white/20 pointer-events-none">
              <span>{Math.floor(trimIn)}s</span>
              <span>
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </span>
              <span>{Math.floor(trimOut || duration)}s</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
            {playing ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = trimIn;
                setCurrentTime(trimIn);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            <RotateCcw size={18} />
            Reset
          </button>

          <button
            onClick={() => setTrimIn(currentTime)}
            className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
          >
            Set Trim In
          </button>

          <button
            onClick={() => setTrimOut(currentTime)}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
          >
            Set Trim Out
          </button>

          <div className="ml-auto flex gap-3">
            <button
              onClick={handleApprove}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Approve (A)
            </button>
            <button
              onClick={handleReject}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Reject (R)
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto">
        {/* Type Selection */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Segment Type</h3>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setClipType(option.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  clipType === option.value
                    ? option.color
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 mb-1">Duration</p>
              <p className="text-sm font-medium">{Math.floor(duration)}s</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Category</p>
              <p className="text-sm font-medium">{clip.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Ratio</p>
              <p className="text-sm font-medium">{clip.ratio}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-700">Hook Eligible</span>
              <button
                onClick={handleHookEligibleToggle}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  hookEligible ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    hookEligible ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Tags</h3>
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showTagPicker ? 'Done' : 'Add'}
            </button>
          </div>

          {showTagPicker && (
            <div className="mb-4 space-y-3 pb-3 border-b border-gray-200">
              {TAG_CATEGORIES.map(category => (
                <div key={category.label}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                          selectedTags.includes(tag)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Custom</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTags}
                    onChange={e => setCustomTags(e.target.value)}
                    placeholder="Enter tags separated by comma"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={e => e.key === 'Enter' && addCustomTags()}
                  />
                  <button
                    onClick={addCustomTags}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
              >
                {tag}
                <button
                  onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                  className="ml-1 hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Colour Grade */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-3">Colour Grade</h3>

          {/* Presets */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {COLOUR_GRADE_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => setColourGrade(preset.values)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  JSON.stringify(colourGrade) === JSON.stringify(preset.values)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            {[
              { label: 'Brightness', key: 'brightness' as const },
              { label: 'Contrast', key: 'contrast' as const },
              { label: 'Saturate', key: 'saturate' as const },
              { label: 'Temperature', key: 'temperature' as const },
              { label: 'Shadows', key: 'shadows' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">{label}</label>
                  <span className="text-xs font-medium text-gray-700">{colourGrade[key]}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={colourGrade[key]}
                  onChange={e =>
                    setColourGrade({
                      ...colourGrade,
                      [key]: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add curation notes..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        </div>

        {/* Star Rating */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold mb-2">Star Rating</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                onClick={() => setStarRating(rating)}
                className={`text-2xl transition ${starRating >= rating ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Approved Segments */}
        {segments.length > 0 && (
          <div className="bg-white p-4">
            <h3 className="text-sm font-semibold mb-3">Approved Segments</h3>
            <div className="space-y-2">
              {segments.map(segment => (
                <div key={segment.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <select
                      value={segment.type}
                      onChange={e => handleUpdateSegmentLabel(segment.id, e.target.value)}
                      className={`text-sm font-medium rounded px-2 py-1 border-0 cursor-pointer ${
                        TYPE_COLORS[segment.type] || 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteSegment(segment.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    {Math.floor(segment.trim_in)}s - {Math.floor(segment.trim_out)}s
                  </p>
                  {segment.tags && segment.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {segment.tags.map(tag => (
                        <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}