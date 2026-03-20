import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Plus, X, Copy, GripVertical, Download, Music, FolderOpen } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Recipe {
  id: string;
  workspace_id: string;
  name: string;
  format: string;
  ratios: string[];
  shots: ShotSlot[];
  overlays: OverlayItem[];
  musicTrack: string | null;
  musicVolume: number;
  status: string;
  created_at: string;
}

interface ShotSlot {
  type: string;
  clipName: string;
  clipMeta: string;
  clipType: string;
  duration: number;
  clip_id?: number;
}

interface OverlayItem {
  text: string;
  position: 'Center' | 'Bottom' | 'Top';
  startTime: number;
  duration: number;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const FORMATS = [
  { id: 'hs1', label: 'HS1 (1.3s)', shotDuration: 1.3 },
  { id: '7s-snappy', label: '7s Snappy', shotDuration: 1.4 },
  { id: '10s-hs1', label: '10s HS1', shotDuration: 1.3 },
  { id: '15s-narr', label: '15s Narrative', shotDuration: 1.5 },
  { id: '10s-prod', label: '10s Product', shotDuration: 1.3 },
];

const RATIOS = ['1:1', '4:5', '9:16', '16:9'];

const MUSIC_TRACKS = [
  'No music',
  'Smash - Shtriker Big Band (115s)',
  'Downtown – Shtrik',
  'Lover Please Stay I…',
  'Duda – Ian Post',
  'Chartreux Noir – B…',
  'Can You Make It__ …',
  'Light Ahead – Remi',
  'Sunrise Coast – Al…',
  'Warm Breeze – Juno',
  'Quick Step – MFP',
  'Good Morning – Sam…',
];

const OVERLAY_TEXTS = [
  'Ready when you are', 'Delivered to your door', 'More time for you',
  'Skip the queue', 'No prep needed', 'Zero cleanup', 'Order now',
  'Your week, planned', '5 mins flat', 'Workday Solved',
  '50+ options weekly', 'Chef-prepared daily',
];

const SHOT_TYPES = ['HOOK', 'BODY 1', 'BODY 2', 'BODY 3', 'BODY 4', 'BODY 5', 'PRODUCT', 'CTA'];

const DEFAULT_SHOTS: ShotSlot[] = [];

/* ── Shot colour helpers ───────────────────────────────────────────── */

function shotBgColor(type: string): string {
  const t = type.toUpperCase();
  if (t.startsWith('HOOK') || t.includes('HOK') || t.includes('ATT')) return '#ff6b6b';
  if (t.startsWith('BODY') || t.includes('BOD') || t.includes('INT') || t.includes('DES')) return '#6b8aff';
  if (t.startsWith('PRODUCT') || t.includes('PRO')) return '#f0a030';
  if (t.startsWith('CTA') || t.includes('ACT')) return '#4ecdc4';
  return '#71717a';
}

function shotTypeLabel(type: string): string {
  const t = type.toUpperCase();
  if (t.startsWith('HOOK') || t.includes('HOK') || t.includes('ATT')) return 'hook';
  if (t.startsWith('BODY') || t.includes('BOD') || t.includes('INT') || t.includes('DES')) return 'body';
  if (t.startsWith('PRODUCT') || t.includes('PRO')) return 'product';
  if (t.startsWith('CTA') || t.includes('ACT')) return 'cta';
  return 'body';
}

/* ── Component ─────────────────────────────────────────────────────── */

export function Recipes() {
  const { clips, setActiveTab, workspace } = useStore();

  const clipsByType = useMemo(() => ({
    hook: clips.filter(c => c.approved && (c.type || 'body').toLowerCase() === 'hook'),
    body: clips.filter(c => c.approved && (c.type || 'body').toLowerCase() === 'body'),
    product: clips.filter(c => c.approved && (c.type || 'body').toLowerCase() === 'product'),
    cta: clips.filter(c => c.approved && (c.type || 'body').toLowerCase() === 'cta'),
  }), [clips]);

  /* ── State ──────────────────────────────────────────────────────── */
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor fields
  const [recipeName, setRecipeName] = useState('');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedFormat, setSelectedFormat] = useState('hs1');
  const [shots, setShots] = useState<ShotSlot[]>(DEFAULT_SHOTS);
  const [musicTrack, setMusicTrack] = useState('No music');
  const [musicVolume, setMusicVolume] = useState(0.25);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setActiveTab('recipes'); }, [setActiveTab]);

  /* ── Fetch recipes ──────────────────────────────────────────────── */
  const fetchRecipes = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (error) { setRecipes([]); }
      else {
        const parsed = (data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          workspace_id: r.workspace_id as string,
          name: (r.name as string) || 'Untitled',
          format: (r.format as string) || 'hs1',
          ratios: Array.isArray(r.ratios) ? r.ratios as string[] : ['1:1'],
          shots: Array.isArray(r.shots) ? r.shots as ShotSlot[] : [],
          overlays: Array.isArray(r.overlays) ? (r.overlays as unknown[]).map((o) => {
            if (typeof o === 'string') return { text: o, position: 'Center' as const, startTime: 0, duration: 1.3 };
            const raw = o as Record<string, unknown>;
            return {
              text: (raw.text as string) || '',
              position: (raw.position as OverlayItem['position']) || 'Center',
              startTime: typeof raw.startTime === 'number' ? raw.startTime : 0,
              duration: typeof raw.duration === 'number' ? raw.duration : 1.3,
            };
          }) : [],
          musicTrack: (r.music_track as string) || null,
          musicVolume: typeof r.music_volume === 'number' ? r.music_volume : 0.25,
          status: (r.status as string) || 'draft',
          created_at: (r.created_at as string) || '',
        }));
        setRecipes(parsed);
        if (parsed.length > 0 && !selectedId) selectRecipe(parsed[0]);
      }
    } catch { setRecipes([]); }
    setLoading(false);
  }, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  /* ── Select recipe ──────────────────────────────────────────────── */
  const selectRecipe = (r: Recipe) => {
    setSelectedId(r.id);
    setRecipeName(r.name);
    setSelectedRatio(r.ratios?.[0] || '1:1');
    setSelectedFormat(r.format || 'hs1');
    setShots(r.shots?.length > 0 ? r.shots : []);
    setMusicTrack(r.musicTrack || 'No music');
    setMusicVolume(r.musicVolume ?? 0.25);

    // Normalize overlays — handle both {text:string} (old Generate format)
    // and full OverlayItem {text,position,startTime,duration} format
    if (r.overlays?.length > 0) {
      let runningTime = 0;
      const normalized: OverlayItem[] = r.overlays.map((o) => {
        const raw = o as unknown as Record<string, unknown>;
        const text = typeof raw === 'string' ? (raw as unknown as string) : (raw.text as string) || o.text || '';
        const position = (raw.position as OverlayItem['position']) || o.position || 'Center';
        const startTime = typeof raw.startTime === 'number' ? raw.startTime : (typeof o.startTime === 'number' ? o.startTime : runningTime);
        const duration = typeof raw.duration === 'number' ? raw.duration : (typeof o.duration === 'number' ? o.duration : 1.3);
        runningTime = startTime + duration;
        return { text, position, startTime, duration };
      });
      setOverlays(normalized);
    } else {
      setOverlays([]);
    }
  };

  /* ── Auto-save ──────────────────────────────────────────────────── */
  const markDirty = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      document.getElementById('recipe-auto-save')?.click();
    }, 1500);
  }, []);

  /* ── Save ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updates = {
        name: recipeName, format: selectedFormat, ratios: [selectedRatio],
        shots, overlays,
        music_track: musicTrack === 'No music' ? null : musicTrack,
        music_volume: musicVolume,
      };
      const { error } = await supabase.from('recipes').update(updates).eq('id', selectedId);
      if (error) throw error;
      setRecipes(prev => prev.map(r => r.id === selectedId ? { ...r, ...updates, musicTrack: updates.music_track, musicVolume } : r));
    } catch { toast('error', 'Failed to save'); }
    setSaving(false);
  };

  /* ── New recipe ──────────────────────────────────────────────────── */
  const handleNewRecipe = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const newR = {
        workspace_id: workspace.id,
        name: `Ad_V${recipes.length + 1}`,
        format: 'hs1', ratios: ['1:1'],
        shots: [] as ShotSlot[], overlays: [] as OverlayItem[],
        music_track: null, music_volume: 0.25, status: 'draft',
      };
      const { data, error } = await supabase.from('recipes').insert(newR).select().single();
      if (error) throw error;
      const parsed: Recipe = {
        id: data.id, workspace_id: data.workspace_id, name: data.name,
        format: data.format || 'hs1', ratios: data.ratios || ['1:1'],
        shots: data.shots || [], overlays: data.overlays || [],
        musicTrack: data.music_track || null, musicVolume: data.music_volume ?? 0.25,
        status: data.status || 'draft', created_at: data.created_at || '',
      };
      setRecipes([parsed, ...recipes]);
      selectRecipe(parsed);
      toast('success', 'New recipe created');
    } catch { toast('error', 'Failed to create recipe'); }
    setSaving(false);
  };

  /* ── Delete recipe ───────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    try {
      await supabase.from('recipes').delete().eq('id', id);
      const remaining = recipes.filter(r => r.id !== id);
      setRecipes(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) selectRecipe(remaining[0]);
        else setSelectedId(null);
      }
      toast('success', 'Recipe deleted');
    } catch { /* noop */ }
  };

  /* ── Shot operations ─────────────────────────────────────────────── */
  const addShot = () => {
    const fmt = FORMATS.find(f => f.id === selectedFormat);
    setShots(prev => [...prev, { type: 'BODY', clipName: '', clipMeta: '', clipType: 'body', duration: fmt?.shotDuration || 1.3 }]);
    markDirty();
  };

  const removeShot = (idx: number) => {
    setShots(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const updateShot = (idx: number, updates: Partial<ShotSlot>) => {
    setShots(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
    markDirty();
  };

  /* ── Drag to reorder ─────────────────────────────────────────────── */
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...shots]; const [moved] = arr.splice(dragIdx, 1); arr.splice(idx, 0, moved);
    setShots(arr); setDragIdx(null); setDragOverIdx(null); markDirty();
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  /* ── Overlay operations ──────────────────────────────────────────── */
  const autoGenerateOverlays = () => {
    const count = Math.max(shots.length, 3);
    const shuffled = [...OVERLAY_TEXTS].sort(() => Math.random() - 0.5).slice(0, count);
    let runningTime = 0;
    const generated: OverlayItem[] = shuffled.map((text, i) => {
      const dur = shots[i]?.duration || 1.3;
      const item: OverlayItem = { text, position: i === count - 1 ? 'Bottom' : 'Center', startTime: runningTime, duration: dur };
      runningTime += dur;
      return item;
    });
    setOverlays(generated);
    markDirty();
    toast('success', `${generated.length} overlays generated`);
  };

  const addManualOverlay = () => {
    const lastEnd = overlays.length > 0 ? overlays[overlays.length - 1].startTime + overlays[overlays.length - 1].duration : 0;
    setOverlays(prev => [...prev, { text: '', position: 'Center', startTime: lastEnd, duration: 1.3 }]);
    markDirty();
  };

  const updateOverlay = (idx: number, updates: Partial<OverlayItem>) => {
    setOverlays(prev => prev.map((o, i) => i === idx ? { ...o, ...updates } : o));
    markDirty();
  };

  const removeOverlay = (idx: number) => {
    setOverlays(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  /* ── Export ──────────────────────────────────────────────────────── */
  const getExportJson = () => JSON.stringify({
    name: recipeName, format: selectedFormat, ratio: selectedRatio,
    shots: shots.map(s => ({ type: s.type, clipName: s.clipName, duration: s.duration, clip_id: s.clip_id })),
    overlays: overlays.map(o => ({ text: o.text, position: o.position, startTime: o.startTime, duration: o.duration })),
    music: musicTrack === 'No music' ? null : musicTrack, musicVolume,
  }, null, 2);

  const handleExportJson = () => {
    const blob = new Blob([getExportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${recipeName.replace(/\s+/g, '_')}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => { navigator.clipboard.writeText(getExportJson()); toast('success', 'JSON copied'); };

  /* ── Render ──────────────────────────────────────────────────────── */
  const handleRender = async () => {
    if (!workspace || !selectedRecipe) return;
    try {
      const record = {
        workspace_id: workspace.id,
        name: `${recipeName}_${selectedRatio.replace(':', 'x')}`,
        recipe_name: recipeName, format: selectedFormat, ratio: selectedRatio,
        variation_type: 'recipe', status: 'queued',
        hook_clip_id: shots.find(s => s.type.startsWith('HOOK'))?.clip_id || null,
        body_clip_id: shots.find(s => s.type.startsWith('BODY'))?.clip_id || null,
        product_clip_id: shots.find(s => s.type.startsWith('PRODUCT'))?.clip_id || null,
        cta_clip_id: shots.find(s => s.type.startsWith('CTA'))?.clip_id || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('rendered_videos').insert(record);
      if (error) throw error;
      toast('success', 'Render queued — check Review tab');
      await supabase.from('recipes').update({ status: 'rendered' }).eq('id', selectedRecipe.id);
      setRecipes(prev => prev.map(r => r.id === selectedRecipe.id ? { ...r, status: 'rendered' } : r));
    } catch { toast('error', 'Failed to queue render'); }
  };

  /* ── Derived ─────────────────────────────────────────────────────── */
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  const selectedRecipe = recipes.find(r => r.id === selectedId);
  const clipsMatched = shots.filter(s => s.clip_id).length;

  /* ════════════════════════════════════════════════════════════════════
     JSX — V1-matched Recipes page (complete)
     ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="w-24 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-2 space-y-1.5 flex-shrink-0">
          <button onClick={handleNewRecipe} disabled={saving}
            className="w-full flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 text-white text-[9px] font-semibold transition-colors">
            <Plus className="w-3 h-3" /> New Recipe
          </button>
          <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[8px] hover:bg-zinc-700 transition-colors">
            <FolderOpen className="w-3 h-3" /> Load Clips
          </button>
          <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-[8px] hover:bg-zinc-700 transition-colors">
            <Music className="w-3 h-3" /> Load Music
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-2 text-[8px] text-zinc-500 text-center">Loading...</div>
          ) : recipes.length === 0 ? (
            <div className="p-2 text-[9px] text-zinc-500">No recipes yet</div>
          ) : (
            <div className="space-y-0.5 px-1">
              {recipes.map(recipe => (
                <div key={recipe.id} className="relative group">
                  <button onClick={() => selectRecipe(recipe)}
                    className={`w-full px-2 py-1.5 rounded text-left transition-all ${
                      selectedId === recipe.id ? 'bg-purple-900/40 border border-purple-500' : 'hover:bg-zinc-800/50 border border-transparent'
                    }`}>
                    <div className="text-[9px] font-semibold text-zinc-100 truncate">{recipe.name}</div>
                    <div className="text-[7px] text-zinc-500 mt-0.5 truncate">
                      {recipe.shots?.length || 0} shots · {(recipe.ratios || []).join(', ')} · {recipe.format}
                    </div>
                    <div className="text-[7px] text-zinc-600 uppercase font-bold mt-0.5">{recipe.status}</div>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id); }}
                    className="absolute top-1 right-1 w-3 h-3 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-2 h-2" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedRecipe ? (
          <>
            {/* ── Top bar ── */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
              <input type="text" value={recipeName}
                onChange={e => { setRecipeName(e.target.value); markDirty(); }}
                className="w-44 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500" />
              <select value={selectedRatio} onChange={e => { setSelectedRatio(e.target.value); markDirty(); }}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none cursor-pointer">
                {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={selectedFormat} onChange={e => { setSelectedFormat(e.target.value); markDirty(); }}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none cursor-pointer">
                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <div className="flex-1" />
              <span className="text-[11px] text-zinc-500 tabular-nums">{shots.length} shots</span>
              <span className="text-[11px] text-zinc-500 tabular-nums">{totalDuration.toFixed(1)}s</span>
              <span className="text-[9px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 uppercase font-bold tracking-wider">{selectedRecipe.status}</span>
            </div>

            {/* ── Scrollable editor ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 space-y-5">

                {/* ═══ 1. TIMELINE — V1: colour-coded shot cards with clip names ═══ */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Timeline</h3>
                  <div className="flex gap-1.5 pb-2 overflow-x-auto">
                    {shots.map((shot, idx) => (
                      <div key={idx} draggable onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd}
                        className={`flex-shrink-0 w-[72px] h-16 rounded-md border flex flex-col overflow-hidden relative group cursor-grab active:cursor-grabbing transition-all ${
                          dragOverIdx === idx ? 'border-purple-500 scale-105' : 'border-zinc-700'
                        } ${dragIdx === idx ? 'opacity-40' : ''}`}
                        style={{ backgroundColor: shotBgColor(shot.type) + '18' }}>
                        {/* Colour bar */}
                        <div className="h-1 flex-shrink-0" style={{ backgroundColor: shotBgColor(shot.type) }} />
                        {/* Content */}
                        <div className="flex-1 flex flex-col items-center justify-center px-1 min-w-0">
                          <span className="text-[8px] font-bold text-zinc-100 uppercase">{shot.type}</span>
                          <span className="text-[7px] text-zinc-400 truncate max-w-full">{shot.clipName || '—'}</span>
                          <span className="text-[7px] text-zinc-500 tabular-nums">{shot.duration}s</span>
                        </div>
                        {/* Remove */}
                        <button onClick={() => removeShot(idx)}
                          className="absolute top-0.5 right-0.5 w-3 h-3 flex items-center justify-center text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[8px]">
                          ×
                        </button>
                        {/* Grip */}
                        <div className="absolute top-1 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="w-2 h-2 text-zinc-500" />
                        </div>
                      </div>
                    ))}
                    {/* V1 dashed add button */}
                    <button onClick={addShot}
                      className="flex-shrink-0 w-[72px] h-16 rounded-md border-2 border-dashed border-zinc-700 hover:border-zinc-500 flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ═══ 2. SHOT LIST — V1: numbered rows with clip details ═══ */}
                {shots.length > 0 && (
                  <div className="space-y-1">
                    {shots.map((shot, idx) => {
                      const typeKey = shotTypeLabel(shot.type);
                      const available = clipsByType[typeKey as keyof typeof clipsByType] || [];
                      return (
                        <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800/50">
                          {/* Number badge */}
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: shotBgColor(shot.type) }}>
                            {idx + 1}
                          </div>
                          {/* Clip selector */}
                          <select value={shot.clip_id || ''}
                            onChange={e => {
                              const clipId = e.target.value ? parseInt(e.target.value) : undefined;
                              const clip = clipId ? clips.find(c => c.id === clipId) : null;
                              updateShot(idx, {
                                clip_id: clipId,
                                clipName: clip?.name || '',
                                clipMeta: clip ? `${(clip.type || 'body').toUpperCase()} · ${clip.ratio || '16:9'} · ${clip.duration.toFixed(1)}s` : '',
                                clipType: clip ? (clip.type || 'body').toLowerCase() : 'body',
                              });
                            }}
                            className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-200 focus:outline-none focus:border-purple-500">
                            <option value="">Select clip...</option>
                            {available.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.duration.toFixed(1)}s)</option>
                            ))}
                          </select>
                          {/* Shot type */}
                          <select value={shot.type} onChange={e => updateShot(idx, { type: e.target.value })}
                            className="px-2 py-1 bg-transparent text-[9px] font-bold text-zinc-300 focus:outline-none cursor-pointer">
                            {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {/* Duration */}
                          <input type="number" value={shot.duration}
                            onChange={e => updateShot(idx, { duration: parseFloat(e.target.value) || 0.5 })}
                            className="w-12 px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400 text-center tabular-nums focus:outline-none" step="0.1" min="0.1" max="30" />
                          <span className="text-[8px] text-zinc-600">s</span>
                          <button onClick={() => removeShot(idx)} className="text-zinc-600 hover:text-red-400 transition-colors text-[10px]">×</button>
                        </div>
                      );
                    })}
                    {/* Show assigned clip details below each (V1 numbered list) */}
                    <div className="space-y-0.5 mt-2">
                      {shots.map((shot, idx) => {
                        if (!shot.clipName) return null;
                        return (
                          <div key={idx} className="flex items-center gap-3 px-3 py-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: shotBgColor(shot.type) + '80' }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-zinc-200 font-medium truncate">{shot.clipName}</div>
                              <div className="text-[8px] text-zinc-500">{shot.clipMeta}</div>
                            </div>
                            <span className="text-[8px] px-1.5 py-0.5 rounded text-zinc-400" style={{ backgroundColor: shotBgColor(shot.type) + '25' }}>
                              {shotTypeLabel(shot.type)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ 3. MUSIC TRACK — V1: dropdown + volume slider ═══ */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Music Track</h3>
                  <select value={musicTrack} onChange={e => { setMusicTrack(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer">
                    {MUSIC_TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {musicTrack !== 'No music' && (
                    <div className="flex items-center gap-3 mt-2">
                      <label className="text-[10px] text-zinc-500 font-medium">Vol</label>
                      <input type="range" min="0" max="1" step="0.05" value={musicVolume}
                        onChange={e => { setMusicVolume(parseFloat(e.target.value)); markDirty(); }}
                        className="flex-1 h-1 rounded-full bg-zinc-700 accent-purple-500 cursor-pointer" />
                      <span className="text-[10px] text-zinc-400 tabular-nums w-8">{Math.round(musicVolume * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* ═══ 4. TEXT OVERLAYS — V1: text + position + timestamp + duration ═══ */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Text Overlays</h3>
                  {overlays.length === 0 ? (
                    <div className="border border-zinc-700 rounded-lg p-5 text-center">
                      <p className="text-sm text-zinc-500 mb-3">No text overlays yet. Auto-generate AIDA overlays or add manually.</p>
                      <button onClick={autoGenerateOverlays}
                        className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                        Auto-Generate AIDA Overlays
                      </button>
                      <div className="mt-2">
                        <button onClick={addManualOverlay} className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">+ Add Manual</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {overlays.map((ov, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[8px] text-zinc-600 w-3 text-right flex-shrink-0">{idx + 1}</span>
                          <input type="text" value={ov.text} onChange={e => updateOverlay(idx, { text: e.target.value })}
                            placeholder="Overlay text..."
                            className="flex-1 min-w-0 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-purple-500" />
                          <select value={ov.position} onChange={e => updateOverlay(idx, { position: e.target.value as OverlayItem['position'] })}
                            className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 focus:outline-none cursor-pointer">
                            <option value="Center">Center</option>
                            <option value="Bottom">Bottom</option>
                            <option value="Top">Top</option>
                          </select>
                          <input type="number" value={ov.startTime} onChange={e => updateOverlay(idx, { startTime: parseFloat(e.target.value) || 0 })}
                            className="w-14 px-1.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 text-right tabular-nums focus:outline-none"
                            step="0.1" min="0" />
                          <span className="text-[9px] text-zinc-500 tabular-nums w-8 flex-shrink-0">{ov.duration.toFixed(1)}s</span>
                          <button onClick={() => removeOverlay(idx)} className="text-zinc-600 hover:text-red-400 transition-colors text-[10px]">×</button>
                        </div>
                      ))}
                      <div className="flex items-center gap-4 mt-2">
                        <button onClick={addManualOverlay} className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors">+ Add Manual</button>
                        <button onClick={autoGenerateOverlays} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">Regenerate AIDA</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ═══ 5. EXPORT — V1: Export JSON + Copy JSON + CLI hint ═══ */}
                <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                  <button onClick={handleExportJson}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors flex items-center gap-1.5">
                    <Download className="w-3 h-3" /> Export JSON
                  </button>
                  <button onClick={handleCopyJson}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors flex items-center gap-1.5">
                    <Copy className="w-3 h-3" /> Copy JSON
                  </button>
                  <span className="text-[9px] text-zinc-600">
                    or: <code className="text-zinc-500">python3 assemble.py {recipeName.replace(/\s+/g, '_')}.json</code>
                  </span>
                </div>

                {/* ═══ 6. VIDEO RENDERER — V1: FFmpeg.wasm section ═══ */}
                <div className="border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-bold text-zinc-200">Video Renderer</h3>
                    <span className="text-[9px] text-zinc-500">FFmpeg.wasm · runs in browser</span>
                  </div>

                  {/* Clips Matched */}
                  <h4 className="text-[10px] font-semibold text-zinc-300 mb-2">Clips Matched ({clipsMatched}/{shots.length})</h4>
                  {shots.length > 0 ? (
                    <div className="space-y-1 mb-4">
                      {shots.map((shot, idx) => {
                        const matched = shot.clip_id ? clips.find(c => c.id === shot.clip_id) : null;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: shotBgColor(shot.type) }}>
                              {shot.type.startsWith('BODY') ? 'BODY' : shot.type}
                            </span>
                            <span className="text-zinc-300 truncate flex-1 min-w-0">{shot.clipName || '(empty)'}</span>
                            {matched ? (
                              <span className="text-emerald-400 text-[9px] flex-shrink-0">✓ Matched</span>
                            ) : (
                              <span className="text-red-400 text-[9px] flex-shrink-0">✗ No match in library</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-500 mb-4">Add shots to the timeline first</p>
                  )}

                  {/* Music file */}
                  <div className="flex items-center gap-2 mb-2 text-[10px]">
                    <span className="text-zinc-400 font-medium">Music:</span>
                    <span className="text-zinc-500">{musicTrack === 'No music' ? 'Select music file or load music folder...' : musicTrack}</span>
                  </div>

                  {/* Overlay count */}
                  <div className="flex items-center gap-2 mb-4 text-[10px]">
                    <span className="text-zinc-400 font-medium">Text Overlays:</span>
                    {overlays.length > 0 ? (
                      <><span className="text-purple-400 font-semibold">{overlays.length} overlays</span><span className="text-zinc-500">will be burned into video</span></>
                    ) : (
                      <span className="text-zinc-500">None</span>
                    )}
                  </div>

                  {/* Render button */}
                  <button onClick={handleRender} disabled={shots.length === 0}
                    className="w-full px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    🎬 Render Video
                  </button>
                  {shots.length === 0 && (
                    <p className="text-[9px] text-zinc-500 text-center mt-1">Add shots to timeline to enable rendering</p>
                  )}
                </div>
              </div>
            </div>

            <button id="recipe-auto-save" onClick={handleSave} className="hidden" />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-light text-zinc-500 mb-4">Select or create a recipe</h2>
              <button onClick={handleNewRecipe} disabled={saving}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors">
                + New Recipe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
