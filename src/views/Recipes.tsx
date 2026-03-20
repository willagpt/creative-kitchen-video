import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Plus, X, Copy, GripVertical, Download, Music, Type, FolderOpen } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Recipe {
  id: string;
  workspace_id: string;
  name: string;
  format: string;
  ratios: string[];
  shots: ShotSlot[];
  overlays: string[];
  musicTrack: string | null;
  status: string;
  created_at: string;
}

interface ShotSlot {
  type: string;
  duration: number;
  clip_id?: number;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const FORMATS = [
  { id: 'hs1', label: 'HS1 (1.3s)', duration: 1.3 },
  { id: '7s-snappy', label: '7s Snappy', duration: 7 },
  { id: '10s-hs1', label: '10s HS1', duration: 10 },
  { id: '15s-narr', label: '15s Narrative', duration: 15 },
  { id: '10s-prod', label: '10s Product', duration: 10 },
];

const RATIOS = ['1:1', '4:5', '9:16', '16:9'];

const MUSIC_TRACKS = [
  'No music',
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

const OVERLAY_POOLS: Record<string, string[]> = {
  default: [
    'Ready when you are', 'Skip the queue', 'No prep needed', '5 mins flat',
    'Your week, planned', 'Delivered to your door', 'Zero cleanup',
    'More time for you', '50+ options weekly', 'Order now',
  ],
};

const DEFAULT_SHOTS: ShotSlot[] = [
  { type: 'HOOK', duration: 2 },
  { type: 'BODY 1', duration: 2 },
  { type: 'BODY 2', duration: 2 },
  { type: 'BODY 3', duration: 2 },
  { type: 'CTA', duration: 2 },
];

/* ── Shot colour helpers ───────────────────────────────────────────── */

function shotColor(type: string): string {
  if (type.startsWith('HOOK')) return '#ff6b6b';
  if (type.startsWith('BODY')) return '#6b8aff';
  if (type.startsWith('PRODUCT')) return '#f0a030';
  if (type.startsWith('CTA')) return '#4ecdc4';
  return '#71717a';
}

/* ── Component ─────────────────────────────────────────────────────── */

export function Recipes() {
  const { setActiveTab, workspace } = useStore();

  /* ── State ──────────────────────────────────────────────────────── */
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setDirty] = useState(false);

  // Editor fields
  const [recipeName, setRecipeName] = useState('');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedFormat, setSelectedFormat] = useState('hs1');
  const [shots, setShots] = useState<ShotSlot[]>(DEFAULT_SHOTS);
  const [musicTrack, setMusicTrack] = useState('No music');
  const [overlays, setOverlays] = useState<string[]>([]);

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

      if (error) {
        console.error('Failed to fetch recipes:', error);
        setRecipes([]);
      } else {
        const parsed = (data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          workspace_id: r.workspace_id as string,
          name: (r.name as string) || 'Untitled',
          format: (r.format as string) || 'hs1',
          ratios: Array.isArray(r.ratios) ? r.ratios as string[] : ['1:1'],
          shots: Array.isArray(r.shots) ? r.shots as ShotSlot[] : DEFAULT_SHOTS,
          overlays: Array.isArray(r.overlays) ? r.overlays as string[] : [],
          musicTrack: (r.music_track as string) || null,
          status: (r.status as string) || 'draft',
          created_at: (r.created_at as string) || '',
        }));
        setRecipes(parsed);
        if (parsed.length > 0 && !selectedId) {
          selectRecipe(parsed[0]);
        }
      }
    } catch (err) {
      console.error('Recipe fetch error:', err);
      setRecipes([]);
    }
    setLoading(false);
  }, [workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  /* ── Select recipe ──────────────────────────────────────────────── */
  const selectRecipe = (r: Recipe) => {
    setSelectedId(r.id);
    setRecipeName(r.name);
    setSelectedRatio(r.ratios?.[0] || '1:1');
    setSelectedFormat(r.format || 'hs1');
    setShots(r.shots?.length > 0 ? r.shots : DEFAULT_SHOTS);
    setMusicTrack(r.musicTrack || 'No music');
    setOverlays(r.overlays || []);
    setDirty(false);
  };

  /* ── Mark dirty + auto-save ─────────────────────────────────────── */
  const markDirty = useCallback(() => {
    setDirty(true);
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
        name: recipeName,
        format: selectedFormat,
        ratios: [selectedRatio],
        shots,
        overlays,
        music_track: musicTrack === 'No music' ? null : musicTrack,
      };
      const { error } = await supabase.from('recipes').update(updates).eq('id', selectedId);
      if (error) throw error;
      setRecipes(prev => prev.map(r => r.id === selectedId ? { ...r, ...updates, musicTrack: updates.music_track } : r));
      setDirty(false);
      toast('success', 'Recipe saved');
    } catch (err) {
      console.error('Save error:', err);
      toast('error', 'Failed to save');
    }
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
        format: 'hs1',
        ratios: ['1:1'],
        shots: [] as ShotSlot[],
        overlays: [] as string[],
        music_track: null,
        status: 'draft',
      };
      const { data, error } = await supabase.from('recipes').insert(newR).select().single();
      if (error) throw error;
      const parsed: Recipe = {
        id: data.id,
        workspace_id: data.workspace_id,
        name: data.name,
        format: data.format || 'hs1',
        ratios: data.ratios || ['1:1'],
        shots: data.shots || [],
        overlays: data.overlays || [],
        musicTrack: data.music_track || null,
        status: data.status || 'draft',
        created_at: data.created_at || '',
      };
      setRecipes([parsed, ...recipes]);
      selectRecipe(parsed);
      toast('success', 'New recipe created');
    } catch (err) {
      console.error('Create error:', err);
      toast('error', 'Failed to create recipe');
    }
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
        else { setSelectedId(null); setDirty(false); }
      }
      toast('success', 'Recipe deleted');
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  /* ── Shot operations ─────────────────────────────────────────────── */
  const addShot = () => {
    setShots(prev => [...prev, { type: 'BODY', duration: 2 }]);
    markDirty();
  };

  const removeShot = (idx: number) => {
    if (shots.length <= 1) return;
    setShots(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const updateShot = (idx: number, updates: Partial<ShotSlot>) => {
    setShots(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
    markDirty();
  };

  /* ── Drag to reorder shots ───────────────────────────────────────── */
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const newShots = [...shots];
    const [moved] = newShots.splice(dragIdx, 1);
    newShots.splice(idx, 0, moved);
    setShots(newShots);
    setDragIdx(null);
    setDragOverIdx(null);
    markDirty();
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  /* ── Overlays ────────────────────────────────────────────────────── */
  const autoGenerateOverlays = () => {
    const pool = OVERLAY_POOLS['default'];
    const count = Math.min(shots.length, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    setOverlays(shuffled);
    markDirty();
    toast('success', `${shuffled.length} overlays generated`);
  };

  const addManualOverlay = () => {
    setOverlays(prev => [...prev, '']);
    markDirty();
  };

  const updateOverlay = (idx: number, text: string) => {
    setOverlays(prev => prev.map((o, i) => i === idx ? text : o));
    markDirty();
  };

  const removeOverlay = (idx: number) => {
    setOverlays(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  /* ── Export ──────────────────────────────────────────────────────── */
  const getExportJson = () => JSON.stringify({
    name: recipeName,
    format: selectedFormat,
    ratio: selectedRatio,
    shots: shots.map(s => ({ type: s.type, duration: s.duration, clip_id: s.clip_id })),
    overlays,
    music: musicTrack === 'No music' ? null : musicTrack,
  }, null, 2);

  const handleExportJson = () => {
    const blob = new Blob([getExportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipeName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(getExportJson());
    toast('success', 'JSON copied to clipboard');
  };

  /* ── Derived ─────────────────────────────────────────────────────── */
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  const selectedRecipe = recipes.find(r => r.id === selectedId);

  /* ════════════════════════════════════════════════════════════════════
     JSX — V1-matched Recipes page
     ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="w-56 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden flex-shrink-0">

        {/* New Recipe + Load buttons */}
        <div className="p-3 space-y-2 flex-shrink-0">
          <button
            onClick={handleNewRecipe}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Recipe
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors">
            <FolderOpen className="w-3.5 h-3.5" />
            Load Clips Folder
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors">
            <Music className="w-3.5 h-3.5" />
            Load Music Folder
          </button>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-[10px] text-zinc-500 text-center">Loading recipes...</div>
          ) : recipes.length === 0 ? (
            <div className="p-4 text-[11px] text-zinc-500">No recipes yet</div>
          ) : (
            <div className="space-y-1 p-2">
              {recipes.map(recipe => (
                <div key={recipe.id} className="relative group">
                  <button
                    onClick={() => selectRecipe(recipe)}
                    className={`w-full px-3 py-2.5 rounded-lg text-left border transition-all ${
                      selectedId === recipe.id
                        ? 'bg-purple-900/30 border-purple-500'
                        : 'bg-zinc-800/20 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-zinc-100 truncate">{recipe.name}</div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">
                      {recipe.shots?.length || 0} shots · {(recipe.ratios || []).join(', ')} · {recipe.format}
                    </div>
                    <div className="text-[8px] text-zinc-600 uppercase font-bold mt-1">{recipe.status}</div>
                  </button>
                  {/* Hover delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id); }}
                    className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
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
            {/* ── Top bar: name + ratio + format + stats ── */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
              <input
                type="text"
                value={recipeName}
                onChange={e => { setRecipeName(e.target.value); markDirty(); }}
                className="w-48 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
              />
              <select
                value={selectedRatio}
                onChange={e => { setSelectedRatio(e.target.value); markDirty(); }}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none cursor-pointer"
              >
                {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={selectedFormat}
                onChange={e => { setSelectedFormat(e.target.value); markDirty(); }}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none cursor-pointer"
              >
                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>

              <div className="flex-1" />

              <span className="text-[11px] text-zinc-500 tabular-nums">{shots.length} shots</span>
              <span className="text-[11px] text-zinc-500 tabular-nums">{totalDuration.toFixed(1)}s</span>
              <span className="text-[9px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 uppercase font-bold tracking-wider">
                {selectedRecipe.status}
              </span>
            </div>

            {/* ── Scrollable editor ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-6 max-w-4xl">

                {/* ── TIMELINE ── */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Timeline</h3>
                  <div className="flex gap-2 pb-2 overflow-x-auto">
                    {shots.map((shot, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={handleDragEnd}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg bg-zinc-900 border flex flex-col items-center justify-center relative group cursor-grab active:cursor-grabbing transition-all ${
                          dragOverIdx === idx ? 'border-purple-500 scale-105' : 'border-zinc-700'
                        } ${dragIdx === idx ? 'opacity-40' : ''}`}
                      >
                        {/* Colour stripe */}
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: shotColor(shot.type) }} />
                        {/* Grip handle */}
                        <div className="absolute top-1.5 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="w-3 h-3 text-zinc-600" />
                        </div>
                        {/* Remove */}
                        {shots.length > 1 && (
                          <button
                            onClick={() => removeShot(idx)}
                            className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {/* Content */}
                        <select
                          value={shot.type}
                          onChange={e => updateShot(idx, { type: e.target.value, clip_id: undefined })}
                          className="bg-transparent text-[9px] font-bold text-zinc-200 text-center focus:outline-none cursor-pointer w-16"
                        >
                          <option value="HOOK">HOOK</option>
                          <option value="BODY 1">BODY 1</option>
                          <option value="BODY 2">BODY 2</option>
                          <option value="BODY 3">BODY 3</option>
                          <option value="PRODUCT">PRODUCT</option>
                          <option value="CTA">CTA</option>
                        </select>
                        <div className="flex items-center gap-0.5 mt-1">
                          <input
                            type="number"
                            value={shot.duration}
                            onChange={e => updateShot(idx, { duration: parseFloat(e.target.value) || 0.5 })}
                            className="w-8 bg-transparent text-[9px] text-zinc-500 text-center focus:outline-none tabular-nums"
                            step="0.5"
                            min="0.5"
                            max="30"
                          />
                          <span className="text-[8px] text-zinc-600">s</span>
                        </div>
                        {shot.clip_id && (
                          <span className="text-[7px] text-emerald-400 mt-0.5">clip</span>
                        )}
                      </div>
                    ))}

                    {/* Add shot — V1 dashed border button */}
                    <button
                      onClick={addShot}
                      className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 hover:border-zinc-500 flex items-center justify-center text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* ── MUSIC TRACK ── */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Music Track</h3>
                  <select
                    value={musicTrack}
                    onChange={e => { setMusicTrack(e.target.value); markDirty(); }}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {MUSIC_TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* ── TEXT OVERLAYS ── */}
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Text Overlays</h3>

                  {overlays.length === 0 ? (
                    <div className="border border-zinc-700 rounded-lg p-6 text-center">
                      <p className="text-sm text-zinc-500 mb-4">
                        No text overlays yet. Auto-generate AIDA overlays or add manually.
                      </p>
                      <button
                        onClick={autoGenerateOverlays}
                        className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
                      >
                        Auto-Generate AIDA Overlays
                      </button>
                      <div className="mt-3">
                        <button
                          onClick={addManualOverlay}
                          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          + Add Manual
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {overlays.map((text, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Type className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                          <input
                            type="text"
                            value={text}
                            onChange={e => updateOverlay(idx, e.target.value)}
                            placeholder="Enter overlay text..."
                            className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={() => removeOverlay(idx)}
                            className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={addManualOverlay}
                          className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          + Add Manual
                        </button>
                        <button
                          onClick={autoGenerateOverlays}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          Re-generate
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── EXPORT — V1 bottom buttons ── */}
                <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                  <button
                    onClick={handleExportJson}
                    className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export JSON
                  </button>
                  <button
                    onClick={handleCopyJson}
                    className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy JSON
                  </button>
                  <span className="text-[10px] text-zinc-600 ml-2">
                    or: <code className="text-zinc-500">python3 assemble.py {recipeName.replace(/\s+/g, '_')}.json</code>
                  </span>
                </div>
              </div>
            </div>

            {/* Hidden auto-save trigger */}
            <button id="recipe-auto-save" onClick={handleSave} className="hidden" />
          </>
        ) : (
          /* ── Empty state — V1 match ── */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-light text-zinc-500 mb-4">Select or create a recipe</h2>
              <button
                onClick={handleNewRecipe}
                disabled={saving}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + New Recipe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
