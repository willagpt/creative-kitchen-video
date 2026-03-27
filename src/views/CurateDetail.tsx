'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Clip, ColourGrade, ClipType } from '@/types';
import VideoPlayer from '@/components/VideoPlayer';
import Timeline from '@/components/Timeline';
import { ChevronLeft, ChevronRight, Copy, Trash2, Heart, Star, X, Plus, Download } from 'lucide-react';

interface CurateDetailProps {
  clipId: number;
  workspaceId: string;
  onNavigate?: (direction: 'prev' | 'next') => void;
  filteredClipIds?: number[];
  currentIndex?: number;
}

interface ClipSegment {
  id: number;
  clip_id: number;
  trim_in: number;
  trim_out: number;
  type: ClipType;
  hook_eligible: boolean;
  tags: string[];
  star_rating: number | null;
  colour_grade: ColourGrade | null;
  label: string | null;
  created_by: string;
  created_at: string;
}

const PRESET_COLORS = [
  { name: 'Original', adjustments: { brightness: 0, contrast: 0, saturate: 0, temperature: 0, shadows: 0 } },
  { name: 'Food Pop', adjustments: { brightness: 5, contrast: 15, saturate: 20, temperature: 0, shadows: -5 } },
  { name: 'Warm Gold', adjustments: { brightness: 0, contrast: 10, saturate: 10, temperature: 20, shadows: -3 } },
  { name: 'Cool Clean', adjustments: { brightness: 5, contrast: 12, saturate: 5, temperature: -15, shadows: 0 } },
  { name: 'Rich Cinema', adjustments: { brightness: -3, contrast: 20, saturate: 15, temperature: 5, shadows: 10 } },
  { name: 'Matte Film', adjustments: { brightness: -5, contrast: 8, saturate: -10, temperature: 0, shadows: 5 } },
  { name: 'Vibrant', adjustments: { brightness: 2, contrast: 18, saturate: 30, temperature: 5, shadows: -5 } },
  { name: 'Moody Dark', adjustments: { brightness: -8, contrast: 15, saturate: 5, temperature: -10, shadows: 15 } },
  { name: 'Pastel Soft', adjustments: { brightness: 8, contrast: -5, saturate: -15, temperature: 5, shadows: -10 } },
  { name: 'High Key', adjustments: { brightness: 15, contrast: 8, saturate: 10, temperature: 10, shadows: -15 } },
  { name: 'Earthy', adjustments: { brightness: 0, contrast: 10, saturate: 8, temperature: 15, shadows: 5 } },
  { name: 'Punchy', adjustments: { brightness: 3, contrast: 25, saturate: 25, temperature: 2, shadows: -8 } },
];

const TAG_PRESETS = {
  'SHOT STYLE': ['wide', 'close-up', 'pov', 'overhead', 'slow-mo', 'macro'],
  'ACTION': ['cutting', 'plating', 'pouring', 'whisking', 'scooping', 'spreading'],
  'SUBJECT': ['hands', 'food', 'ingredient', 'finished-dish', 'process', 'detail'],
  'MOOD': ['energetic', 'calm', 'professional', 'casual', 'luxury', 'playful'],
};

export default function CurateDetail({
  clipId,
  workspaceId,
  onNavigate,
  filteredClipIds = [],
  currentIndex = 0,
}: CurateDetailProps) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [segments, setSegments] = useState<ClipSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimIn, setTrimIn] = useState<number | null>(null);
  const [trimOut, setTrimOut] = useState<number | null>(null);
  const [clipType, setClipType] = useState<ClipType>('body');
  const [hookEligible, setHookEligible] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [starRating, setStarRating] = useState<number | null>(null);
  const [colourGrade, setColourGrade] = useState<ColourGrade | null>(null);
  const [notes, setNotes] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [segmentLabel, setSegmentLabel] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load clip data
  useEffect(() => {
    const loadClip = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('clips')
          .select('*')
          .eq('id', clipId)
          .eq('workspace_id', workspaceId)
          .single();

        if (error) throw error;
        setClip(data);
        setTrimIn(data.trim_in);
        setTrimOut(data.trim_out);
        setNotes(data.curation_note || '');
        setStarRating(data.star_rating);
        setColourGrade(data.colour_grade);
        setHookEligible(data.hook_eligible);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clip');
      } finally {
        setLoading(false);
      }
    };

    loadClip();
  }, [clipId, workspaceId]);

  // Load segments
  useEffect(() => {
    const loadSegments = async () => {
      try {
        const { data, error } = await supabase
          .from('clip_segments')
          .select('*')
          .eq('clip_id', clipId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSegments(data || []);
      } catch (err) {
        console.error('Failed to load segments:', err);
      }
    };

    if (clip) loadSegments();
  }, [clipId, clip]);

  const handleApprove = async () => {
    if (!clip) return;

    try {
      // Create segment record
      const { error: segmentError } = await supabase
        .from('clip_segments')
        .insert({
          clip_id: clipId,
          trim_in: trimIn ?? 0,
          trim_out: trimOut ?? clip.duration,
          type: clipType,
          hook_eligible: hookEligible,
          tags,
          star_rating: starRating,
          colour_grade: colourGrade,
          created_by: 'current_user',
        });

      if (segmentError) throw segmentError;

      // Update clip approval status
      const { error: updateError } = await supabase
        .from('clips')
        .update({
          approved: true,
          hook_eligible: hookEligible,
          trim_in: trimIn,
          trim_out: trimOut,
          star_rating: starRating,
          colour_grade: colourGrade,
          curation_note: notes,
        })
        .eq('id', clipId);

      if (updateError) throw updateError;

      // Reload segments
      const { data: updatedSegments } = await supabase
        .from('clip_segments')
        .select('*')
        .eq('clip_id', clipId)
        .order('created_at', { ascending: false });

      setSegments(updatedSegments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve clip');
    }
  };

  const handleReject = async () => {
    if (!clip) return;

    try {
      const { error } = await supabase
        .from('clips')
        .update({ rejected: true })
        .eq('id', clipId);

      if (error) throw error;

      if (onNavigate) onNavigate('next');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject clip');
    }
  };

  const handleDuplicate = async () => {
    if (!clip) return;

    try {
      const { error } = await supabase.from('clips').insert({
        workspace_id: clip.workspace_id,
        name: `${clip.name} (Copy)`,
        fullname: `${clip.fullname} (Copy)`,
        path: clip.path,
        category: clip.category,
        type: clip.type,
        ratio: clip.ratio,
        width: clip.width,
        height: clip.height,
        duration: clip.duration,
        size_mb: clip.size_mb,
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate clip');
    }
  };

  const handleDeleteSegment = async (segmentId: number) => {
    try {
      const { error } = await supabase
        .from('clip_segments')
        .delete()
        .eq('id', segmentId);

      if (error) throw error;

      setSegments(segments.filter(s => s.id !== segmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete segment');
    }
  };

  const handleSegmentClick = (segment: ClipSegment) => {
    if (videoRef.current) {
      videoRef.current.currentTime = segment.trim_in;
    }
  };

  const handleAddTag = () => {
    if (customTag && !tags.includes(customTag)) {
      setTags([...tags, customTag]);
      setCustomTag('');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') handleApprove();
      if (e.key === 'r' || e.key === 'R') handleReject();
      if (e.key === ' ') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        }
      }
      if (e.key === 'i' || e.key === 'I') setTrimIn(currentTime);
      if (e.key === 'o' || e.key === 'O') setTrimOut(currentTime);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTime]);

  // Enforce trim range looping
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const inTime = trimIn ?? 0;
      const outTime = trimOut ?? video.duration;

      if (video.currentTime > outTime) {
        video.currentTime = inTime;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [trimIn, trimOut]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!clip) return <div className="p-6">Clip not found</div>;

  const nextIndex = (currentIndex + 1) % filteredClipIds.length;
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredClipIds.length - 1;

  return (
    <div className="flex flex-col h-full bg-surface-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate && onNavigate('prev')}
            className="p-2 hover:bg-surface-tertiary rounded"
            aria-label="Previous clip"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">{clip.name}</h2>
          <button
            onClick={() => onNavigate && onNavigate('next')}
            className="p-2 hover:bg-surface-tertiary rounded"
            aria-label="Next clip"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="text-sm text-text-secondary">
          {currentIndex + 1} of {filteredClipIds.length}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Video section */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Video player */}
          <VideoPlayer
            src={clip.proxy_url || clip.drive_url || clip.path}
            ref={videoRef}
            currentTime={currentTime}
            onTimeChange={setCurrentTime}
            colourGrade={colourGrade}
            className="aspect-video bg-black rounded-lg overflow-hidden"
          />

          {/* Timeline */}
          <Timeline
            duration={clip.duration}
            currentTime={currentTime}
            trimIn={trimIn}
            trimOut={trimOut}
            onSeek={setCurrentTime}
            onTrimInChange={setTrimIn}
            onTrimOutChange={setTrimOut}
            thumbnails={clip.thumbnail_url ? [clip.thumbnail_url] : []}
          />

          {/* Approved segments panel */}
          {segments.length > 0 && (
            <div className="border border-border-subtle rounded-lg p-4 bg-surface-tertiary">
              <h3 className="text-sm font-semibold mb-3">Approved Segments</h3>
              <div className="grid grid-cols-2 gap-2">
                {segments.map((segment) => (
                  <button
                    key={segment.id}
                    onClick={() => handleSegmentClick(segment)}
                    className="text-left p-3 bg-surface-secondary hover:bg-primary-900 rounded border border-border-subtle transition-colors"
                  >
                    <div className="text-xs font-medium">
                      {segment.type}
                      {segment.hook_eligible && ' • 🎣'}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {(segment.trim_in / clip.duration * 100).toFixed(0)}% - {(segment.trim_out / clip.duration * 100).toFixed(0)}%
                    </div>
                    {segment.star_rating && (
                      <div className="text-xs text-yellow-500">{'⭐'.repeat(segment.star_rating)}</div>
                    )}
                    {segment.label && (
                      <div className="text-xs text-primary-400 mt-1">{segment.label}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details panel */}
        <div className="w-96 flex flex-col gap-4 overflow-y-auto">
          {/* Approval status */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium text-sm"
              >
                Approve (A)
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium text-sm"
              >
                Reject (R)
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDuplicate}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface-tertiary hover:bg-surface-quaternary rounded font-medium text-sm"
              >
                <Copy size={16} /> Duplicate
              </button>
            </div>
          </div>

          {/* Clip type */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Clip Type</label>
            <select
              value={clipType}
              onChange={(e) => setClipType(e.target.value as ClipType)}
              className="w-full mt-2 px-3 py-2 bg-surface-tertiary border border-border-subtle rounded text-sm"
            >
              <option value="hook">Hook</option>
              <option value="body">Body</option>
              <option value="cta">CTA</option>
              <option value="product">Product</option>
              <option value="social_proof">Social Proof</option>
              <option value="transition">Transition</option>
            </select>
          </div>

          {/* Hook eligible */}
          <div className="flex items-center gap-3 p-3 bg-surface-tertiary rounded border border-border-subtle">
            <input
              type="checkbox"
              id="hookEligible"
              checked={hookEligible}
              onChange={(e) => setHookEligible(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="hookEligible" className="text-sm cursor-pointer flex-1">
              Hook Eligible / Dual-Tag System
            </label>
          </div>

          {/* Star rating */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Rating</label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setStarRating(starRating === star ? null : star)}
                  className={`text-2xl ${
                    starRating && starRating >= star ? 'text-yellow-500' : 'text-text-tertiary'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Color grading presets */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Color Grade</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setColourGrade(preset.adjustments)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    colourGrade === preset.adjustments
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-surface-tertiary border-border-subtle hover:bg-surface-quaternary'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Color grade sliders */}
          {colourGrade && (
            <div className="space-y-3 p-3 bg-surface-tertiary rounded border border-border-subtle">
              {Object.entries(colourGrade).map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-text-secondary capitalize">
                    {key}
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={value}
                    onChange={(e) =>
                      setColourGrade({
                        ...colourGrade,
                        [key]: parseInt(e.target.value),
                      })
                    }
                    className="w-full mt-1"
                  />
                  <div className="text-xs text-text-secondary text-right">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Tags</label>
            <div className="space-y-2 mt-2">
              {Object.entries(TAG_PRESETS).map(([category, presets]) => (
                <div key={category}>
                  <div className="text-xs font-medium text-text-tertiary mb-1">{category}</div>
                  <div className="flex flex-wrap gap-1">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() =>
                          setTags(
                            tags.includes(preset)
                              ? tags.filter((t) => t !== preset)
                              : [...tags, preset]
                          )
                        }
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          tags.includes(preset)
                            ? 'bg-primary-600 text-white'
                            : 'bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom tag input */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add custom tag"
                className="flex-1 px-3 py-2 bg-surface-tertiary border border-border-subtle rounded text-sm"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-surface-tertiary hover:bg-surface-quaternary border border-border-subtle rounded"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Active tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 bg-primary-600 text-white rounded text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="hover:text-primary-200"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add curation notes..."
              className="w-full mt-2 px-3 py-2 bg-surface-tertiary border border-border-subtle rounded text-sm resize-none h-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}