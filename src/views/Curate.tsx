import { useEffect, useState } from 'react';
import type { ColourGrade, SubType } from '@/types';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { toast } from '@/components/Toast';
import { Copy } from 'lucide-react';
import { driveThumbUrl } from '@/lib/drive';

const COLOUR_GRADE_PRESETS: Record<string, ColourGrade> = {
  Original: { brightness: 100, contrast: 100, saturate: 100, temperature: 0, shadows: 0 },
  'Food Pop': { brightness: 105, contrast: 112, saturate: 130, temperature: 8, shadows: -10 },
  'Warm Gold': { brightness: 103, contrast: 105, saturate: 115, temperature: 18, shadows: -5 },
  'Cool Clean': { brightness: 105, contrast: 108, saturate: 95, temperature: -12, shadows: 5 },
  'Rich Cinema': { brightness: 97, contrast: 118, saturate: 110, temperature: 5, shadows: -15 },
  'Matte Film': { brightness: 102, contrast: 92, saturate: 90, temperature: 3, shadows: 12 },
  'Vibrant': { brightness: 103, contrast: 110, saturate: 145, temperature: 2, shadows: -8 },
  'Moody Dark': { brightness: 90, contrast: 120, saturate: 105, temperature: -5, shadows: -20 },
  'Pastel Soft': { brightness: 108, contrast: 90, saturate: 85, temperature: 6, shadows: 8 },
  'High Key': { brightness: 115, contrast: 95, saturate: 100, temperature: 0, shadows: 10 },
  'Earthy': { brightness: 100, contrast: 108, saturate: 105, temperature: 12, shadows: -8 },
  'Punchy': { brightness: 100, contrast: 125, saturate: 125, temperature: 0, shadows: -12 },
};

const SUB_TYPE_STYLES: Record<SubType, string> = {
  'food-action': 'border-[#ff6b6b] bg-[#ff6b6b]/20 text-[#ff6b6b]',
  'food-beauty': 'border-[#f0a030] bg-[#f0a030]/20 text-[#f0a030]',
  'lifestyle': 'border-[#6b8aff] bg-[#6b8aff]/20 text-[#6b8aff]',
  'product': 'border-[#4ecdc4] bg-[#4ecdc4]/20 text-[#4ecdc4]',
  'stop-motion': 'border-pink-500 bg-pink-500/20 text-pink-400',
};

const TAG_CATEGORIES: Record<string, string[]> = {
  'SHOT STYLE': ['close up', 'handheld', 'studio', 'tripod', 'stop motion'],
  'ACTION': ['stir', 'pour', 'plate', 'eat', 'open', 'sprinkle'],
  'SUBJECT': ['meal', 'person', 'kitchen', 'hands', 'box', 'delivery'],
  'MOOD': ['vibrant', 'warm', 'bright', 'clean', 'natural light'],
};

interface Segment {
  id: string;
  label: string;
  trim_in: number;
  trim_out: number;
}

export function Curate() {
  const { clips, setActiveTab, updateClip, user, workspace, fetchClips, thumbnailMap } = useStore();
  const [_showColourPanel, _setShowColourPanel] = useState(false);
  const [colourGrade, setColourGrade] = useState<ColourGrade>(COLOUR_GRADE_PRESETS.Original);
  const [activePreset, setActivePreset] = useState('Original');
  const [trimIn, setTrimIn] = useState<number | null>(null);
  const [trimOut, setTrimOut] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [starRating, setStarRating] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
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

  // Get selected clip or first in filtered list
  const pendingClips = clips.filter((c) => !c.approved && !c.rejected && !c.archived);
  const firstPendingClip = selectedClipId
    ? clips.find((c) => c.id === selectedClipId) || filteredClips[0]
    : filteredClips[0];
  const currentClipIndex = filteredClips.indexOf(firstPendingClip || filteredClips[0]);

  useEffect(() => {
    if (firstPendingClip) {
      setTrimIn(firstPendingClip.trim_in);
      setTrimOut(firstPendingClip.trim_out);
      setSelectedTags(firstPendingClip.tags || []);
      setNotes(firstPendingClip.curation_note || '');
      setColourGrade(firstPendingClip.colour_grade || COLOUR_GRADE_PRESETS.Original);
      setActivePreset(firstPendingClip.colour_grade ? 'Custom' : 'Original');
      setStarRating(firstPendingClip.star_rating || 0);
    }
  }, [firstPendingClip]);

  // Fetch segments for current clip
  useEffect(() => {
    if (!firstPendingClip) {
      setSegments([]);
      return;
    }
    const fetchSegments = async () => {
      const { data } = await supabase
        .from('clip_segments')
        .select('*')
        .eq('clip_id', firstPendingClip.id)
        .order('trim_in');
      setSegments((data as Segment[]) || []);
    };
    fetchSegments();
  }, [firstPendingClip?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'r':
          e.preventDefault();
          handleReject();
          break;
        case 's':
          e.preventDefault();
          handleSkip();
          break;
        case 'i':
          e.preventDefault();
          setTrimIn(0);
          break;
        case 'o':
          e.preventDefault();
          if (firstPendingClip) {
            setTrimOut(firstPendingClip.duration);
          }
          break;
        case 'p':
          e.preventDefault();
          handlePreviewTrim();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentClipIndex, pendingClips, firstPendingClip]);

  const handleApprove = async () => {
    if (!firstPendingClip) return;
    try {
      const updateData: Record<string, unknown> = { approved: true, rejected: false };
      if (activePreset !== 'Original') {
        updateData.colour_grade = colourGrade;
      }
      if (trimIn !== null) {
        updateData.trim_in = trimIn;
      }
      if (trimOut !== null) {
        updateData.trim_out = trimOut;
      }
      if (notes) {
        updateData.curation_note = notes;
      }

      const { error } = await supabase
        .from('clips')
        .update(updateData)
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, {
        approved: true,
        rejected: false,
        colour_grade: activePreset !== 'Original' ? colourGrade : null,
        trim_in: trimIn,
        trim_out: trimOut,
        curation_note: notes || null,
      });

      if (user && workspace) {
        await logActivity(
          workspace.id,
          user.id,
          user.email || '',
          'approved',
          'clip',
          firstPendingClip.id.toString(),
          { clipName: firstPendingClip.name, colourGrade: activePreset !== 'Original' ? activePreset : undefined }
        );
      }
    } catch (err) {
      console.error('Failed to approve clip:', err);
    }
  };

  const handleReject = async () => {
    if (!firstPendingClip) return;
    try {
      const updateData: Record<string, unknown> = { approved: false, rejected: true };
      if (notes) {
        updateData.curation_note = notes;
      }
      const { error } = await supabase
        .from('clips')
        .update(updateData)
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, {
        approved: false,
        rejected: true,
        curation_note: notes || null,
      });

      if (user && workspace) {
        await logActivity(
          workspace.id,
          user.id,
          user.email || '',
          'rejected',
          'clip',
          firstPendingClip.id.toString(),
          { clipName: firstPendingClip.name }
        );
      }
    } catch (err) {
      console.error('Failed to reject clip:', err);
    }
  };

  const handleSkip = () => {
    // Skip just moves to next pending clip (UI rerender handles this)
  };

  const handleSubTypeChange = async (st: SubType) => {
    if (!firstPendingClip) return;
    try {
      const { error } = await supabase
        .from('clips')
        .update({ sub_type: st })
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, { sub_type: st });
    } catch (err) {
      console.error('Failed to update sub_type:', err);
    }
  };

  const handleTrimChange = async (field: 'trim_in' | 'trim_out', value: number | null) => {
    if (!firstPendingClip) return;
    try {
      const updateData: Record<string, unknown> = {};
      updateData[field] = value;
      const { error } = await supabase
        .from('clips')
        .update(updateData)
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      if (field === 'trim_in') {
        setTrimIn(value);
        updateClip(firstPendingClip.id, { trim_in: value });
      } else {
        setTrimOut(value);
        updateClip(firstPendingClip.id, { trim_out: value });
      }
    } catch (err) {
      console.error('Failed to update trim:', err);
    }
  };

  const handlePreviewTrim = () => {
    // Placeholder for preview trim functionality
    console.log('Preview trim:', { trimIn, trimOut });
  };

  const handleStarRating = async (rating: number) => {
    if (!firstPendingClip) return;
    try {
      const { error } = await supabase
        .from('clips')
        .update({ star_rating: rating })
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      setStarRating(rating);
      updateClip(firstPendingClip.id, { star_rating: rating });
    } catch (err) {
      console.error('Failed to update star rating:', err);
    }
  };

  const handleDuplicate = async () => {
    if (!firstPendingClip || !workspace) return;
    try {
      const { data } = await supabase
        .from('clips')
        .insert({
          ...firstPendingClip,
          id: undefined,
          name: `${firstPendingClip.name} (copy)`,
          approved: false,
          rejected: false,
          curation_note: `Duplicate of ${firstPendingClip.name}`,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (data) {
        await fetchClips(workspace.id);
        toast('success', `Duplicated: ${firstPendingClip.name}`);
      }
    } catch (err) {
      console.error('Failed to duplicate clip:', err);
      toast('error', 'Failed to duplicate clip');
    }
  };

  const handleReset = async () => {
    if (!firstPendingClip) return;
    try {
      const { error } = await supabase
        .from('clips')
        .update({
          approved: false,
          rejected: false,
          trim_in: null,
          trim_out: null,
          colour_grade: null,
          tags: [],
          curation_note: null,
        })
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, {
        approved: false,
        rejected: false,
        trim_in: null,
        trim_out: null,
        colour_grade: null,
        tags: [],
        curation_note: null,
      });
      setTrimIn(null);
      setTrimOut(null);
      setSelectedTags([]);
      setNotes('');
      setColourGrade(COLOUR_GRADE_PRESETS.Original);
      setActivePreset('Original');
      toast('success', 'Curation reset');
    } catch (err) {
      console.error('Failed to reset curation:', err);
      toast('error', 'Failed to reset curation');
    }
  };

  const handleAddSegment = async () => {
    if (!firstPendingClip || !workspace || !user) return;
    try {
      const { data } = await supabase
        .from('clip_segments')
        .insert({
          clip_id: firstPendingClip.id,
          workspace_id: workspace.id,
          label: `${firstPendingClip.name.slice(0, 20)}_seg${segments.length + 1}`,
          trim_in: trimIn ?? 0,
          trim_out: trimOut ?? firstPendingClip.duration,
          created_by: user.id,
        })
        .select()
        .single();
      if (data) {
        setSegments([...segments, data as Segment]);
        toast('success', 'Segment created');
      }
    } catch (err) {
      console.error('Failed to create segment:', err);
      toast('error', 'Failed to create segment');
    }
  };

  const handleDeleteSegment = async (segId: string) => {
    try {
      const { error } = await supabase
        .from('clip_segments')
        .delete()
        .eq('id', segId);
      if (error) throw error;
      setSegments(segments.filter((s) => s.id !== segId));
      toast('success', 'Segment deleted');
    } catch (err) {
      console.error('Failed to delete segment:', err);
      toast('error', 'Failed to delete segment');
    }
  };

  const handleUpdateSegmentLabel = async (segId: string, newLabel: string) => {
    try {
      const { error } = await supabase
        .from('clip_segments')
        .update({ label: newLabel })
        .eq('id', segId);
      if (error) throw error;
      setSegments(segments.map((s) => (s.id === segId ? { ...s, label: newLabel } : s)));
    } catch (err) {
      console.error('Failed to update segment label:', err);
      toast('error', 'Failed to update segment');
    }
  };

  const handleTagToggle = async (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newTags);

    if (!firstPendingClip) return;
    try {
      const { error } = await supabase
        .from('clips')
        .update({ tags: newTags })
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, { tags: newTags });
    } catch (err) {
      console.error('Failed to update tags:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!firstPendingClip) return;
    try {
      const { error } = await supabase
        .from('clips')
        .update({ curation_note: notes })
        .eq('id', firstPendingClip.id);
      if (error) throw error;
      updateClip(firstPendingClip.id, { curation_note: notes });
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  // @ts-expect-error - Colour grade panel temporarily hidden during grid redesign
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ColourGradePanel = () => (
    <div className="w-64 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4 space-y-4">
      {/* Colour Grade Section */}
      <div className="space-y-3">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider">Colour Grade</h3>

        {/* Presets Grid */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(COLOUR_GRADE_PRESETS).map(([name]) => (
            <button
              key={name}
              onClick={() => {
                setColourGrade(COLOUR_GRADE_PRESETS[name]);
                setActivePreset(name);
              }}
              className={`px-2 py-1.5 rounded text-[9px] font-medium transition-colors ${
                activePreset === name
                  ? 'bg-indigo-900/60 border border-indigo-500 text-indigo-300'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-3 pt-2">
          {/* Brightness */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400">Brightness</label>
            <input
              type="range"
              min="80"
              max="120"
              value={colourGrade.brightness}
              onChange={(e) => {
                const newGrade = { ...colourGrade, brightness: parseInt(e.target.value) };
                setColourGrade(newGrade);
                setActivePreset('');
              }}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[9px] text-zinc-500 float-right">{colourGrade.brightness}</span>
            <div className="clear-both" />
          </div>

          {/* Contrast */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400">Contrast</label>
            <input
              type="range"
              min="80"
              max="130"
              value={colourGrade.contrast}
              onChange={(e) => {
                const newGrade = { ...colourGrade, contrast: parseInt(e.target.value) };
                setColourGrade(newGrade);
                setActivePreset('');
              }}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[9px] text-zinc-500 float-right">{colourGrade.contrast}</span>
            <div className="clear-both" />
          </div>

          {/* Saturate */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400">Saturate</label>
            <input
              type="range"
              min="50"
              max="150"
              value={colourGrade.saturate}
              onChange={(e) => {
                const newGrade = { ...colourGrade, saturate: parseInt(e.target.value) };
                setColourGrade(newGrade);
                setActivePreset('');
              }}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[9px] text-zinc-500 float-right">{colourGrade.saturate}</span>
            <div className="clear-both" />
          </div>

          {/* Temperature */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400">Temperature</label>
            <input
              type="range"
              min="-20"
              max="20"
              value={colourGrade.temperature}
              onChange={(e) => {
                const newGrade = { ...colourGrade, temperature: parseInt(e.target.value) };
                setColourGrade(newGrade);
                setActivePreset('');
              }}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[9px] text-zinc-500 float-right">{colourGrade.temperature}</span>
            <div className="clear-both" />
          </div>

          {/* Shadows */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400">Shadows</label>
            <input
              type="range"
              min="-20"
              max="20"
              value={colourGrade.shadows}
              onChange={(e) => {
                const newGrade = { ...colourGrade, shadows: parseInt(e.target.value) };
                setColourGrade(newGrade);
                setActivePreset('');
              }}
              className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[9px] text-zinc-500 float-right">{colourGrade.shadows}</span>
            <div className="clear-both" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setColourGrade(COLOUR_GRADE_PRESETS.Original);
              setActivePreset('Original');
            }}
            className="flex-1 px-2 py-1.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            Reset
          </button>
          <button className="flex-1 px-2 py-1.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors">
            Match
          </button>
        </div>
      </div>
    </div>
  );

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
                onClick={() => { /* Load clips from folder */ }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Select Clips Folder
              </button>
              <button className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors">
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

  // With clips loaded - show player
  // @ts-expect-error — colour grade filter temporarily unused during grid redesign
  const _filterStyle = `brightness(${colourGrade.brightness / 100}) contrast(${colourGrade.contrast / 100}) saturate(${colourGrade.saturate / 100}) hue-rotate(${colourGrade.temperature * 1.5}deg)`;

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
          <button className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
            + Clips
          </button>
          <button className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
            + Music
          </button>
          <div className="text-sm text-zinc-400 font-bold tabular-nums">{curatedPercent}%<span className="text-zinc-500 font-normal ml-1">curated</span></div>
        </div>
      </div>

      {/* Main content area — V1 style: grid of clips, click to curate */}
      <div className="flex flex-1 overflow-hidden">
        {/* CLIP GRID — matching V1's Curate layout */}
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

        {/* RIGHT: Curation detail panel — appears when a clip is selected */}
        {firstPendingClip && selectedClipId && (
          <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{firstPendingClip.name}</h3>
              <button onClick={() => setSelectedClipId(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Close</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Video player area */}
              <div className="space-y-2">
                <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-zinc-800">
                  {firstPendingClip.drive_file_id ? (
                    <iframe
                      src={`https://drive.google.com/file/d/${firstPendingClip.drive_file_id}/preview`}
                      className="w-full h-full"
                      allow="autoplay"
                      allowFullScreen
                    />
                  ) : firstPendingClip.thumbnail_url || firstPendingClip.drive_file_id ? (
                    <img
                      src={firstPendingClip.thumbnail_url || driveThumbUrl(firstPendingClip.drive_file_id!)}
                      alt={firstPendingClip.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-zinc-600 text-sm">
                      {firstPendingClip.name}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 text-center">Click anywhere to annotate · Space to play/pause</p>
              </div>

              {/* Clip info */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-zinc-100">{firstPendingClip.name}</h3>
                    <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded">
                      {firstPendingClip.category}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span>{firstPendingClip.duration.toFixed(1)}s</span>
                    <span>{firstPendingClip.ratio}</span>
                    <span className="capitalize">{firstPendingClip.type || 'body'}</span>
                  </div>
                </div>

                {/* Sub-type selector */}
                <div className="pt-2 border-t border-zinc-800">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Sub-type</h4>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['food-action', 'food-beauty', 'lifestyle', 'product', 'stop-motion'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleSubTypeChange(st)}
                        className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                          firstPendingClip.sub_type === st
                            ? SUB_TYPE_STYLES[st]
                            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trim controls */}
                <div className="pt-2 border-t border-zinc-800">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Trim</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>
                        IN: {(trimIn ?? 0).toFixed(1)}s → OUT: {(trimOut ?? firstPendingClip.duration).toFixed(1)}s
                      </span>
                      <span className="text-zinc-600">
                        (trimmed: {((trimOut ?? firstPendingClip.duration) - (trimIn ?? 0)).toFixed(1)}s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTrimChange('trim_in', (trimIn ?? 0) - 0.1)}
                          className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                        >
                          -0.1s
                        </button>
                        <button
                          onClick={() => handleTrimChange('trim_in', (trimIn ?? 0) + 0.1)}
                          className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                        >
                          +0.1s
                        </button>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTrimChange('trim_out', (trimOut ?? firstPendingClip.duration) - 0.1)}
                          className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                        >
                          -0.1s
                        </button>
                        <button
                          onClick={() => handleTrimChange('trim_out', (trimOut ?? firstPendingClip.duration) + 0.1)}
                          className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                        >
                          +0.1s
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setTrimIn(0)}
                        className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                      >
                        Set IN <span className="text-zinc-500">[I]</span>
                      </button>
                      <button
                        onClick={() => setTrimOut(firstPendingClip.duration)}
                        className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                      >
                        Set OUT <span className="text-zinc-500">[O]</span>
                      </button>
                      <button
                        onClick={() => {
                          setTrimIn(null);
                          setTrimOut(null);
                          handleTrimChange('trim_in', null);
                          handleTrimChange('trim_out', null);
                        }}
                        className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handlePreviewTrim}
                        className="flex-1 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                      >
                        Preview <span className="text-zinc-500">[P]</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tags section */}
                <div className="pt-2 border-t border-zinc-800">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Tags</h4>
                  <div className="space-y-3">
                    {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                      <div key={category}>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">{category}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {tags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => handleTagToggle(tag)}
                              className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                                selectedTags.includes(tag)
                                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NOTES */}
                <div className="mt-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Notes</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => handleSaveNotes()}
                    placeholder="Add curation notes..."
                    className="w-full h-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
                  />
                </div>

                {/* STAR RATING */}
                <div className="mt-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Rating</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleStarRating(star)}
                        className={`text-lg transition-colors ${
                          starRating >= star ? 'text-amber-500' : 'text-zinc-700 hover:text-zinc-500'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    {starRating > 0 && (
                      <button onClick={() => handleStarRating(0)} className="text-[10px] text-zinc-600 hover:text-zinc-400 ml-2">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* SEGMENTS */}
                <div className="mt-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Segments</div>
                  <div className="space-y-2">
                    {segments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {segments.map((seg) => (
                          <div key={seg.id} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
                            <input
                              type="text"
                              value={seg.label}
                              onChange={(e) => handleUpdateSegmentLabel(seg.id, e.target.value)}
                              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
                            />
                            <span className="text-[10px] text-zinc-500">
                              {seg.trim_in.toFixed(1)}s - {seg.trim_out.toFixed(1)}s
                            </span>
                            <button
                              onClick={() => handleDeleteSegment(seg.id)}
                              className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={handleAddSegment}
                      className="w-full px-2 py-1.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                    >
                      + Segment
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Approve <span className="text-xs ml-1 text-emerald-200">[A]</span>
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Reject <span className="text-xs ml-1 text-zinc-500">[R]</span>
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Skip <span className="text-xs ml-1 text-zinc-500">[S]</span>
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleDuplicate}
                    className="px-4 py-2.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
