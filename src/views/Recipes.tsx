import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/store';
import { Plus, X } from 'lucide-react';

interface Recipe {
  id: string;
  name: string;
  shotCount: number;
  ratios: string[];
  format: string;
  status: string;
}

interface Shot {
  id: string;
  type: string;
  duration: number;
  index: number;
  clipId?: number; // linked curated clip
}

const AVAILABLE_RATIOS = ['1:1', '4:5', '9:16', '16:9'];

export function Recipes() {
  const { clips, setActiveTab } = useStore();

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

  // Demo recipes
  const demoRecipes: Recipe[] = [
    { id: '1', name: 'Hero Video', shotCount: 5, ratios: ['1:1'], format: '10s HS1', status: 'DRAFT' },
    { id: '2', name: 'Product Showcase', shotCount: 6, ratios: ['16:9'], format: '15s Narrative', status: 'DRAFT' },
    { id: '3', name: 'Quick Hook', shotCount: 4, ratios: ['9:16'], format: '7s Snappy', status: 'DRAFT' },
  ];

  const demoShots: Shot[] = [
    { id: 'hook', type: 'HOOK', duration: 2, index: 0 },
    { id: 'body1', type: 'BODY 1', duration: 2, index: 1 },
    { id: 'body2', type: 'BODY 2', duration: 2, index: 2 },
    { id: 'body3', type: 'BODY 3', duration: 2, index: 3 },
    { id: 'cta', type: 'CTA', duration: 2, index: 4 },
  ];

  const [recipes] = useState<Recipe[]>(demoRecipes);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('1');
  const [recipeName, setRecipeName] = useState<string>('Hero Video');
  const [selectedRatios, setSelectedRatios] = useState<string[]>(['1:1']);
  const [recipeFormat, setRecipeFormat] = useState<string>('10s HS1');
  const [shots] = useState<Shot[]>(demoShots);

  useEffect(() => {
    setActiveTab('recipes');
  }, [setActiveTab]);

  const handleSelectRecipe = (id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      setSelectedRecipeId(id);
      setRecipeName(recipe.name);
      setSelectedRatios(recipe.ratios);
      setRecipeFormat(recipe.format);
    }
  };

  const toggleRatio = (ratio: string) => {
    setSelectedRatios((prev) => {
      if (prev.includes(ratio)) {
        // Don't remove the last one
        if (prev.length === 1) return prev;
        return prev.filter((r) => r !== ratio);
      }
      // Max 3 ratios
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

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SIDEBAR - RECIPE LIST */}
      <div className="w-56 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-zinc-800 space-y-2 flex-shrink-0">
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Recipe
          </button>
          <button className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
            Load Clips Folder
          </button>
          <button className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
            Load Music Folder
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1 p-2">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => handleSelectRecipe(recipe.id)}
                className={`w-full px-3 py-2 rounded-lg text-left border transition-all ${
                  selectedRecipeId === recipe.id
                    ? 'bg-purple-900/30 border-purple-500'
                    : 'bg-zinc-800/20 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="text-[11px] font-medium text-zinc-100 truncate">{recipe.name}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">
                  {recipe.shotCount} shots · {recipe.ratios.join(', ')}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-zinc-600">{recipe.format}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">{recipe.status}</span>
                </div>
              </button>
            ))}
          </div>
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
        {selectedRecipeId ? (
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
                    className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Format</label>
                  <select
                    value={recipeFormat}
                    onChange={(e) => setRecipeFormat(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option>7s Snappy</option>
                    <option>10s HS1</option>
                    <option>15s Narrative</option>
                    <option>10s Product Focus</option>
                  </select>
                </div>
              </div>

              {/* MULTI-RATIO SELECTOR — up to 3 */}
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
                {selectedRatios.length > 1 && (
                  <div className="mt-1.5 text-[10px] text-purple-400">
                    Will export {selectedRatios.length} versions: {selectedRatios.join(' + ')}
                  </div>
                )}
              </div>
            </div>

            {/* TIMELINE + SHOTS */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* TIMELINE */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 mb-3 uppercase tracking-wider">Timeline</h3>
                  <div className="flex gap-2 pb-4 overflow-x-auto">
                    {shots.map((shot) => (
                      <div
                        key={shot.id}
                        className="flex-shrink-0 w-24 h-20 rounded-lg bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center relative overflow-hidden"
                      >
                        <div className={`w-full h-1.5 ${getShotColor(shot.type)}`} />
                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                          <span className="text-[9px] font-bold text-zinc-200 text-center px-1">{shot.type}</span>
                          <span className="text-[8px] text-zinc-500 mt-1">{shot.duration}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SHOT DETAILS with curated clip selection */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 mb-3 uppercase tracking-wider">Shot Details</h3>
                  <div className="space-y-3">
                    {shots.map((shot) => {
                      const typeKey = getShotTypeKey(shot.type);
                      const available = curatedByType[typeKey];
                      return (
                        <div key={shot.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded ${getShotColor(shot.type)}`} />
                              <span className={`text-sm font-semibold ${getShotTextColor(shot.type)}`}>{shot.type}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500">{shot.duration}s</span>
                          </div>

                          {/* Curated clip selector */}
                          <div className="mt-2">
                            {available.length > 0 ? (
                              <select className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-300 focus:outline-none focus:border-purple-500">
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
                  <button className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
                    Export JSON
                  </button>
                  <button className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
                    Copy JSON
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
              <p className="text-sm text-zinc-500">Select or create a recipe</p>
              <button className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors">
                + New Recipe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
