import { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Plus, X } from 'lucide-react';

interface Recipe {
  id: string;
  workspace_id: string;
  name: string;
  format: string;
  ratios: string[];
  shots: ShotSlot[];
  status: string;
  created_at: string;
}

interface ShotSlot {
  type: string;
  duration: number;
  clip_id?: number;
}

const AVAILABLE_RATIOS = ['1:1', '4:5', '9:16', '16:9'];
const DEFAULT_SHOTS: ShotSlot[] = [
  { type: 'HOOK', duration: 2 },
  { type: 'BODY 1', duration: 2 },
  { type: 'BODY 2', duration: 2 },
  { type: 'BODY 3', duration: 2 },
  { type: 'CTA', duration: 2 },
];

export function Recipes() {
  const { clips, setActiveTab, workspace } = useStore();

  // Only curated (approved) clips are available for recipes
  const curatedClips = useMemo(() =>
    clips.filter((c) => c.approved && !c.archived),
    [clips]
  );

  const curatedByType = useMemo(() => ({
    hook: curatedClips.filter((c) => (c.type || 'body').toLowerCase() === 'hook'),
    body: curatedClips.filter((c) => (c.type || 'body').toLowerCase() === 'body'),
    product: curatedClips.filter((c) => (c.type || 'body').toLowerCase() === 'product'),
    cta: curatedClips.filter((c) => (c.type || 'body').toLowerCase() === 'cta'),
  }), [curatedClips]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [selectedRatios, setSelectedRatios] = useState<string[]>(['1:1']);
  const [recipeFormat, setRecipeFormat] = useState('10s HS1');
  const [shots, setShots] = useState<ShotSlot[]>(DEFAULT_SHOTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveTab('recipes');
  }, [setActiveTab]);

  /* ── Fetch recipes from Supabase ── */
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
        // If table doesn't exist or other error, use empty array
        setRecipes([]);
      } else {
        const parsed = (data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          workspace_id: r.workspace_id as string,
          name: (r.name as string) || 'Untitled',
          format: (r.format as string) || '10s HS1',
          ratios: Array.isArray(r.ratios) ? r.ratios as string[] : ['1:1'],
          shots: Array.isArray(r.shots) ? r.shots as ShotSlot[] : DEFAULT_SHOTS,
          status: (r.status as string) || 'DRAFT',
          created_at: (r.created_at as string) || '',
        }));
        setRecipes(parsed);
        // Auto-select first recipe
        if (parsed.length > 0 && !selectedRecipeId) {
          selectRecipe(parsed[0]);
        }
      }
    } catch (err) {
      console.error('Recipe fetch error:', err);
      setRecipes([]);
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  /* ── Select a recipe ── */
  const selectRecipe = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setSelectedRatios(recipe.ratios || ['1:1']);
    setRecipeFormat(recipe.format || '10s HS1');
    setShots(recipe.shots || DEFAULT_SHOTS);
  };

  /* ── Create new recipe ── */
  const handleNewRecipe = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const newRecipe = {
        workspace_id: workspace.id,
        name: `Recipe ${recipes.length + 1}`,
        format: '10s HS1',
        ratios: ['1:1'],
        shots: DEFAULT_SHOTS,
        status: 'DRAFT',
      };
      const { data, error } = await supabase.from('recipes').insert(newRecipe).select().single();
      if (error) throw error;
      const parsed: Recipe = {
        ...data,
        shots: data.shots || DEFAULT_SHOTS,
        ratios: data.ratios || ['1:1'],
      };
      setRecipes([parsed, ...recipes]);
      selectRecipe(parsed);
      toast('success', 'New recipe created');
    } catch (err) {
      console.error('Failed to create recipe:', err);
      toast('error', 'Failed to create recipe');
    }
    setSaving(false);
  };

  /* ── Save current recipe ── */
  const handleSaveRecipe = async () => {
    if (!selectedRecipeId) return;
    setSaving(true);
    try {
      const updates = {
        name: recipeName,
        format: recipeFormat,
        ratios: selectedRatios,
        shots: shots,
      };
      const { error } = await supabase.from('recipes').update(updates).eq('id', selectedRecipeId);
      if (error) throw error;
      setRecipes(recipes.map(r => r.id === selectedRecipeId ? { ...r, ...updates } : r));
      toast('success', 'Recipe saved');
    } catch (err) {
      console.error('Failed to save recipe:', err);
      toast('error', 'Failed to save recipe');
    }
    setSaving(false);
  };

  /* ── Delete recipe ── */
  const handleDeleteRecipe = async (id: string) => {
    try {
      await supabase.from('recipes').delete().eq('id', id);
      const remaining = recipes.filter(r => r.id !== id);
      setRecipes(remaining);
      if (selectedRecipeId === id) {
        if (remaining.length > 0) selectRecipe(remaining[0]);
        else setSelectedRecipeId(null);
      }
      toast('success', 'Recipe deleted');
    } catch (err) {
      console.error('Failed to delete recipe:', err);
    }
  };

  /* ── Add shot to recipe ── */
  const handleAddShot = () => {
    setShots([...shots, { type: 'BODY', duration: 2 }]);
  };

  /* ── Remove shot ── */
  const handleRemoveShot = (idx: number) => {
    if (shots.length <= 1) return;
    setShots(shots.filter((_, i) => i !== idx));
  };

  /* ── Update shot ── */
  const handleUpdateShot = (idx: number, updates: Partial<ShotSlot>) => {
    setShots(shots.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const toggleRatio = (ratio: string) => {
    setSelectedRatios((prev) => {
      if (prev.includes(ratio)) {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r !== ratio);
      }
      if (prev.length >= 3) return prev;
      return [...prev, ratio];
    });
  };

  const getShotColor = (type: string) => {
    if (type.startsWith('HOOK')) return 'bg-[#ff6b6b]';
    if (type.startsWith('BODY')) return 'bg-[#6b8aff]';
    if (type.startsWith('PRODUCT')) return 'bg-[#f0a030]';
    if (type.startsWith('CTA')) return 'bg-[#4ecdc4]';
    return 'bg-zinc-600';
  };

  const getShotTextColor = (type: string) => {
    if (type.startsWith('HOOK')) return 'text-[#ff6b6b]';
    if (type.startsWith('BODY')) return 'text-[#6b8aff]';
    if (type.startsWith('PRODUCT')) return 'text-[#f0a030]';
    if (type.startsWith('CTA')) return 'text-[#4ecdc4]';
    return 'text-zinc-400';
  };

  const getShotTypeKey = (type: string): 'hook' | 'body' | 'product' | 'cta' => {
    if (type.startsWith('HOOK')) return 'hook';
    if (type.startsWith('BODY')) return 'body';
    if (type.startsWith('PRODUCT')) return 'product';
    return 'cta';
  };

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SIDEBAR - RECIPE LIST */}
      <div className="w-56 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-zinc-800 flex-shrink-0">
          <button
            onClick={handleNewRecipe}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Recipe
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-[10px] text-zinc-500 text-center">Loading recipes...</div>
          ) : recipes.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[11px] text-zinc-500 mb-2">No recipes yet</p>
              <p className="text-[9px] text-zinc-600">Click "New Recipe" to create one</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="relative group">
                  <button
                    onClick={() => selectRecipe(recipe)}
                    className={`w-full px-3 py-2 rounded-lg text-left border transition-all ${
                      selectedRecipeId === recipe.id
                        ? 'bg-purple-900/30 border-purple-500'
                        : 'bg-zinc-800/20 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-[11px] font-medium text-zinc-100 truncate">{recipe.name}</div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">
                      {recipe.shots?.length || 0} shots · {(recipe.ratios || []).join(', ')}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600">{recipe.format}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">{recipe.status}</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(recipe.id); }}
                    className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Curated clips summary */}
        <div className="px-3 py-3 border-t border-zinc-800 flex-shrink-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Curated Clips</div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[#ff6b6b]">Hook</span>
              <span className="text-zinc-400 tabular-nums">{curatedByType.hook.length}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-[#6b8aff]">Body</span>
              <span className="text-zinc-400 tabular-nums">{curatedByType.body.length}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-[#f0a030]">Product</span>
              <span className="text-zinc-400 tabular-nums">{curatedByType.product.length}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-[#4ecdc4]">CTA</span>
              <span className="text-zinc-400 tabular-nums">{curatedByType.cta.length}</span>
            </div>
          </div>
          {curatedClips.length === 0 && (
            <div className="mt-2 text-[9px] text-amber-500">No curated clips yet — approve clips in Curate first</div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedRecipe ? (
          <>
            {/* RECIPE HEADER */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0 space-y-3">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Recipe Name</label>
                  <input
                    type="text"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    onBlur={handleSaveRecipe}
                    className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Format</label>
                  <select
                    value={recipeFormat}
                    onChange={(e) => { setRecipeFormat(e.target.value); }}
                    className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option>7s Snappy</option>
                    <option>10s HS1</option>
                    <option>15s Narrative</option>
                    <option>10s Product Focus</option>
                  </select>
                </div>
                <button
                  onClick={handleSaveRecipe}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* MULTI-RATIO SELECTOR */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Export Ratios <span className="text-zinc-600 normal-case">(select up to 3)</span>
                </label>
                <div className="flex gap-2 mt-1.5">
                  {AVAILABLE_RATIOS.map((ratio) => {
                    const isSelected = selectedRatios.includes(ratio);
                    const isDisabled = !isSelected && selectedRatios.length >= 3;
                    return (
                      <button
                        key={ratio}
                        onClick={() => toggleRatio(ratio)}
                        disabled={isDisabled}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : isDisabled
                            ? 'bg-zinc-800/30 border-zinc-800 text-zinc-600 cursor-not-allowed'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        {ratio}
                        {isSelected && selectedRatios.length > 1 && (
                          <X className="w-3 h-3 ml-1.5 inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* TIMELINE + SHOTS */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* TIMELINE */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Timeline</h3>
                    <button onClick={handleAddShot} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                      + Add Shot
                    </button>
                  </div>
                  <div className="flex gap-2 pb-4 overflow-x-auto">
                    {shots.map((shot, idx) => (
                      <div
                        key={idx}
                        className="flex-shrink-0 w-24 h-20 rounded-lg bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center relative overflow-hidden group"
                      >
                        <div className={`w-full h-1.5 ${getShotColor(shot.type)}`} />
                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                          <span className="text-[9px] font-bold text-zinc-200 text-center px-1">{shot.type}</span>
                          <span className="text-[8px] text-zinc-500 mt-1">{shot.duration}s</span>
                        </div>
                        {shots.length > 1 && (
                          <button
                            onClick={() => handleRemoveShot(idx)}
                            className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SHOT DETAILS with curated clip selection */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 mb-3 uppercase tracking-wider">Shot Details</h3>
                  <div className="space-y-3">
                    {shots.map((shot, idx) => {
                      const typeKey = getShotTypeKey(shot.type);
                      const available = curatedByType[typeKey];
                      return (
                        <div key={idx} className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-3 h-3 rounded ${getShotColor(shot.type)}`} />
                            <select
                              value={shot.type}
                              onChange={(e) => handleUpdateShot(idx, { type: e.target.value })}
                              className={`bg-transparent text-sm font-semibold ${getShotTextColor(shot.type)} focus:outline-none cursor-pointer`}
                            >
                              <option value="HOOK">HOOK</option>
                              <option value="BODY 1">BODY 1</option>
                              <option value="BODY 2">BODY 2</option>
                              <option value="BODY 3">BODY 3</option>
                              <option value="PRODUCT">PRODUCT</option>
                              <option value="CTA">CTA</option>
                            </select>
                            <input
                              type="number"
                              value={shot.duration}
                              onChange={(e) => handleUpdateShot(idx, { duration: parseFloat(e.target.value) || 1 })}
                              className="w-16 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-300 text-right tabular-nums focus:outline-none focus:border-zinc-600"
                              step="0.5"
                              min="0.5"
                              max="30"
                            />
                            <span className="text-[10px] text-zinc-500">s</span>
                          </div>

                          {/* Curated clip selector */}
                          <div className="mt-2">
                            {available.length > 0 ? (
                              <select
                                value={shot.clip_id || ''}
                                onChange={(e) => handleUpdateShot(idx, { clip_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-300 focus:outline-none focus:border-purple-500"
                              >
                                <option value="">Select curated clip...</option>
                                {available.map((clip) => (
                                  <option key={clip.id} value={clip.id}>
                                    {clip.name} ({clip.duration.toFixed(1)}s · {clip.ratio})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="text-[10px] text-amber-500/80 py-1">
                                No curated {typeKey} clips — approve some in Curate first
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* EXPORT SECTION */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const json = JSON.stringify({ name: recipeName, format: recipeFormat, ratios: selectedRatios, shots: shots.map(s => ({ type: s.type, duration: s.duration, clip_id: s.clip_id })) }, null, 2);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `${recipeName.replace(/\s+/g, '_')}.json`; a.click(); URL.revokeObjectURL(url);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    Export JSON
                  </button>
                </div>

                {/* VIDEO RENDERER */}
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-xs font-semibold text-zinc-200 mb-1">Video Renderer</h3>
                  <p className="text-[10px] text-zinc-500 mb-3">FFmpeg.wasm · runs in browser</p>

                  <div className="space-y-3">
                    <div className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      {curatedClips.length > 0 ? (
                        <>
                          <p className="text-[10px] text-emerald-400 font-semibold">✓ Ready</p>
                          <p className="text-[9px] text-zinc-500">{curatedClips.length} curated clips available · {selectedRatios.length} ratio{selectedRatios.length > 1 ? 's' : ''} selected</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-amber-400 font-semibold">⚠ No curated clips</p>
                          <p className="text-[9px] text-zinc-500">Approve clips in the Curate tab first</p>
                        </>
                      )}
                    </div>

                    <button
                      disabled={curatedClips.length === 0}
                      onClick={() => {
                        toast('info', `Rendering ${selectedRatios.length} video(s) in ${selectedRatios.join(', ')} — feature coming soon`);
                      }}
                      className="w-full px-3 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      Render {selectedRatios.length > 1 ? `${selectedRatios.length} Videos` : 'Video'} ({selectedRatios.join(' + ')})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-zinc-400">
                {loading ? 'Loading recipes...' : 'Create your first recipe to get started'}
              </p>
              {!loading && (
                <button
                  onClick={handleNewRecipe}
                  className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  + New Recipe
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
