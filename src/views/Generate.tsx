import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Shuffle, ChevronRight, Settings2, Zap } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface StrategyOption {
  id: string;
  name: string;
}

interface GeneratedVariation {
  idx: number;
  name: string;
  hookClip: ClipRef | null;
  bodyClip: ClipRef | null;
  productClip: ClipRef | null;
  ctaClip: ClipRef | null;
  totalDuration: number;
  actionRatio: number;
}

interface ClipRef {
  id: number;
  name: string;
  duration: number;
  type: string;
  ratio: string;
  thumbnail_url: string | null;
}

/* ── AIDA shot structure by format ─────────────────────────────────── */

const AIDA_STRUCTURES: Record<string, { label: string; slots: { type: string; phase: string; weight: number }[] }> = {
  '7s-snappy': {
    label: '7s Snappy',
    slots: [
      { type: 'hook', phase: 'Attention', weight: 0.28 },
      { type: 'body', phase: 'Interest', weight: 0.29 },
      { type: 'product', phase: 'Desire', weight: 0.28 },
      { type: 'cta', phase: 'Action', weight: 0.15 },
    ],
  },
  '10s-hs1': {
    label: '10s HS1 Winner',
    slots: [
      { type: 'hook', phase: 'Attention', weight: 0.20 },
      { type: 'body', phase: 'Interest', weight: 0.25 },
      { type: 'body', phase: 'Interest', weight: 0.15 },
      { type: 'product', phase: 'Desire', weight: 0.25 },
      { type: 'cta', phase: 'Action', weight: 0.15 },
    ],
  },
  '15s-narr': {
    label: '15s Narrative',
    slots: [
      { type: 'hook', phase: 'Attention', weight: 0.13 },
      { type: 'body', phase: 'Interest', weight: 0.17 },
      { type: 'body', phase: 'Interest', weight: 0.13 },
      { type: 'product', phase: 'Desire', weight: 0.20 },
      { type: 'product', phase: 'Desire', weight: 0.17 },
      { type: 'body', phase: 'Desire', weight: 0.10 },
      { type: 'cta', phase: 'Action', weight: 0.10 },
    ],
  },
  '10s-prod': {
    label: '10s Product Focus',
    slots: [
      { type: 'hook', phase: 'Attention', weight: 0.15 },
      { type: 'product', phase: 'Interest', weight: 0.25 },
      { type: 'product', phase: 'Desire', weight: 0.25 },
      { type: 'body', phase: 'Desire', weight: 0.20 },
      { type: 'cta', phase: 'Action', weight: 0.15 },
    ],
  },
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function pickRandom<T>(arr: T[], exclude?: T): T | null {
  if (arr.length === 0) return null;
  if (arr.length === 1) return arr[0];
  const filtered = exclude ? arr.filter(a => a !== exclude) : arr;
  if (filtered.length === 0) return arr[0];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function toClipRef(c: { id: number; name: string; duration: number; type: string; ratio: string; thumbnail_url: string | null }): ClipRef {
  return { id: c.id, name: c.name, duration: c.duration, type: c.type, ratio: c.ratio, thumbnail_url: c.thumbnail_url };
}

/* ── Component ─────────────────────────────────────────────────────── */

export function Generate() {
  const navigate = useNavigate();
  const { clips, setActiveTab, reiterateContext, setReiterateContext, workspace } = useStore();
  const [generating, setGenerating] = useState(false);

  // Strategy options
  const personas: StrategyOption[] = [
    { id: 'busy-prof', name: 'Busy Professional' },
    { id: 'health-ent', name: 'Health Enthusiast' },
    { id: 'family-prov', name: 'Family Provider' },
  ];

  const pillars: StrategyOption[] = [
    { id: 'time-eff', name: 'Time Efficiency' },
    { id: 'weight-loss', name: 'Weight Loss' },
    { id: 'price-value', name: 'Price & Value' },
  ];

  const formats = Object.entries(AIDA_STRUCTURES).map(([id, s]) => ({ id, name: s.label }));
  const ratios = ['1:1', '16:9', '9:16'];

  const variationTests = [
    { id: 'full-mix', label: 'Full Mix', desc: 'Vary everything' },
    { id: 'hook-test', label: 'Hook Test', desc: 'Only vary hooks' },
    { id: 'body-test', label: 'Body Test', desc: 'Only vary body' },
    { id: 'cta-test', label: 'CTA Test', desc: 'Only vary CTA' },
  ];

  const [selectedPersona, setSelectedPersona] = useState<string>('busy-prof');
  const [selectedPillar, setSelectedPillar] = useState<string>('time-eff');
  const [selectedFormat, setSelectedFormat] = useState<string>('10s-hs1');
  const [selectedRatio, setSelectedRatio] = useState<string>('1:1');
  const [selectedVariation, setSelectedVariation] = useState<string>('full-mix');
  const [brandPrefix, setBrandPrefix] = useState<string>('CK');
  const [columnCount, setColumnCount] = useState<number>(5);
  const [curatedOnly, setCuratedOnly] = useState<boolean>(false);
  const [gradedOnly, setGradedOnly] = useState<boolean>(true);
  const [useMusic, setUseMusic] = useState<boolean>(true);
  const [ctasExpanded, setCtasExpanded] = useState<boolean>(false);
  const [strategyEditorOpen, setStrategyEditorOpen] = useState(false);
  const [previewVariations, setPreviewVariations] = useState<GeneratedVariation[]>([]);

  useEffect(() => {
    setActiveTab('generate');
  }, [setActiveTab]);

  /* ── Filtered clips by type ────────────────────────────────────── */
  const filteredClips = useMemo(() => {
    let pool = clips.filter(c => c.approved);
    if (curatedOnly) pool = pool.filter(c => c.approved);
    if (gradedOnly) pool = pool.filter(c => c.graded);
    return pool;
  }, [clips, curatedOnly, gradedOnly]);

  const clipsByType = useMemo(() => ({
    hook: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'hook'),
    body: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'body'),
    product: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'product'),
    cta: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'cta'),
  }), [filteredClips]);

  const allClipsByType = useMemo(() => ({
    hook: clips.filter(c => (c.type || 'body').toLowerCase() === 'hook'),
    body: clips.filter(c => (c.type || 'body').toLowerCase() === 'body'),
    product: clips.filter(c => (c.type || 'body').toLowerCase() === 'product'),
    cta: clips.filter(c => (c.type || 'body').toLowerCase() === 'cta'),
  }), [clips]);

  const comboCount = useMemo(() => {
    const h = Math.max(1, clipsByType.hook.length);
    const b = Math.max(1, clipsByType.body.length);
    const p = Math.max(1, clipsByType.product.length);
    const ct = Math.max(1, clipsByType.cta.length);
    return h * b * p * ct * formats.length * ratios.length;
  }, [clipsByType, formats.length, ratios.length]);

  const personaData = personas.find(p => p.id === selectedPersona);
  const pillarData = pillars.find(p => p.id === selectedPillar);
  const formatData = formats.find(f => f.id === selectedFormat);
  const aidaStructure = AIDA_STRUCTURES[selectedFormat];

  /* ── Combinatorial generation ──────────────────────────────────── */
  const generateVariations = useCallback((count: number): GeneratedVariation[] => {
    const hooks = clipsByType.hook;
    const bodies = clipsByType.body;
    const products = clipsByType.product;
    const ctas = clipsByType.cta;
    const structure = AIDA_STRUCTURES[selectedFormat];
    if (!structure) return [];

    const variations: GeneratedVariation[] = [];
    const usedCombos = new Set<string>();

    for (let i = 0; i < count; i++) {
      let hookClip: ClipRef | null = null;
      let bodyClip: ClipRef | null = null;
      let productClip: ClipRef | null = null;
      let ctaClip: ClipRef | null = null;

      // Different strategies based on variation test type
      if (selectedVariation === 'hook-test') {
        // Vary only hooks, keep body/product/cta fixed
        hookClip = hooks.length > 0 ? toClipRef(hooks[i % hooks.length]) : null;
        bodyClip = bodies.length > 0 ? toClipRef(bodies[0]) : null;
        productClip = products.length > 0 ? toClipRef(products[0]) : null;
        ctaClip = ctas.length > 0 ? toClipRef(ctas[0]) : null;
      } else if (selectedVariation === 'body-test') {
        hookClip = hooks.length > 0 ? toClipRef(hooks[0]) : null;
        bodyClip = bodies.length > 0 ? toClipRef(bodies[i % bodies.length]) : null;
        productClip = products.length > 0 ? toClipRef(products[0]) : null;
        ctaClip = ctas.length > 0 ? toClipRef(ctas[0]) : null;
      } else if (selectedVariation === 'cta-test') {
        hookClip = hooks.length > 0 ? toClipRef(hooks[0]) : null;
        bodyClip = bodies.length > 0 ? toClipRef(bodies[0]) : null;
        productClip = products.length > 0 ? toClipRef(products[0]) : null;
        ctaClip = ctas.length > 0 ? toClipRef(ctas[i % ctas.length]) : null;
      } else {
        // Full mix — try unique combos, fall back to random
        let attempts = 0;
        do {
          hookClip = hooks.length > 0 ? toClipRef(pickRandom(hooks)!) : null;
          bodyClip = bodies.length > 0 ? toClipRef(pickRandom(bodies)!) : null;
          productClip = products.length > 0 ? toClipRef(pickRandom(products)!) : null;
          ctaClip = ctas.length > 0 ? toClipRef(pickRandom(ctas)!) : null;
          const key = `${hookClip?.id}-${bodyClip?.id}-${productClip?.id}-${ctaClip?.id}`;
          if (!usedCombos.has(key) || attempts > 50) {
            usedCombos.add(key);
            break;
          }
          attempts++;
        } while (true);
      }

      // Calculate duration from structure weights and clip durations
      let totalDuration = 0;
      let actionSeconds = 0;
      const formatDuration = parseFloat(structure.label.match(/(\d+)s/)?.[1] || '10');

      for (const slot of structure.slots) {
        const slotDuration = formatDuration * slot.weight;
        totalDuration += slotDuration;
        // "action" = hook + cta, "static" = body + product
        if (slot.type === 'hook' || slot.type === 'cta') {
          actionSeconds += slotDuration;
        }
      }

      const actionRatio = totalDuration > 0 ? actionSeconds / (totalDuration - actionSeconds) : 0;

      variations.push({
        idx: i,
        name: `${brandPrefix}_${(personaData?.name || '').replace(/\s/g, '')}_${(formatData?.name || '').replace(/\s/g, '')}_v${i + 1}`,
        hookClip,
        bodyClip,
        productClip,
        ctaClip,
        totalDuration: Math.round(totalDuration * 10) / 10,
        actionRatio: Math.round(actionRatio * 10) / 10,
      });
    }

    return variations;
  }, [clipsByType, selectedFormat, selectedVariation, brandPrefix, personaData, formatData]);

  // Auto-generate preview when settings change
  useEffect(() => {
    if (filteredClips.length > 0) {
      setPreviewVariations(generateVariations(columnCount));
    } else {
      setPreviewVariations([]);
    }
  }, [columnCount, generateVariations, filteredClips.length]);

  const handleRegenerate = () => {
    setPreviewVariations(generateVariations(columnCount));
  };

  /* ── Push to Supabase & navigate ───────────────────────────────── */
  const handleGenerate = async () => {
    if (previewVariations.length === 0) return;
    setGenerating(true);
    toast('info', `Generating ${columnCount} variations...`);

    try {
      const records = previewVariations.map(v => ({
        workspace_id: workspace?.id,
        name: v.name,
        recipe_name: `${personaData?.name} × ${pillarData?.name}`,
        format: formatData?.name,
        ratio: selectedRatio,
        variation_type: selectedVariation,
        status: 'queued',
        hook_clip_id: v.hookClip?.id || null,
        body_clip_id: v.bodyClip?.id || null,
        product_clip_id: v.productClip?.id || null,
        cta_clip_id: v.ctaClip?.id || null,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('rendered_videos').insert(records);
      if (error) {
        console.error('Supabase insert error:', error);
        toast('error', `DB error: ${error.message}`);
      } else {
        toast('success', `${columnCount} variations saved! Redirecting to Review...`);
      }
      navigate('/review');
    } catch (err) {
      console.error('Generation error:', err);
      toast('error', 'Generation failed — check console');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Sub-components ────────────────────────────────────────────── */
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-indigo-500' : 'bg-zinc-700'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  const shotTypeColor: Record<string, string> = {
    hook: '#ff6b6b',
    body: '#6b8aff',
    product: '#f0a030',
    cta: '#4ecdc4',
  };

  const hasApproved = clips.filter(c => c.approved).length > 0;

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SIDEBAR */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto">
        {/* Header + Strategy Pills */}
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-100">Generate</h2>
            <button
              onClick={() => setStrategyEditorOpen(!strategyEditorOpen)}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" />
              Edit strategy
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { const idx = personas.findIndex(p => p.id === selectedPersona); setSelectedPersona(personas[(idx + 1) % personas.length].id); }}
              className="px-3 py-1.5 rounded-full border border-teal-500/50 bg-teal-500/10 text-[11px] text-zinc-200 font-medium hover:bg-teal-500/20 transition-colors"
            >
              {personaData?.name}
            </button>
            <button
              onClick={() => { const idx = pillars.findIndex(p => p.id === selectedPillar); setSelectedPillar(pillars[(idx + 1) % pillars.length].id); }}
              className="px-3 py-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-[11px] text-zinc-200 font-medium hover:bg-emerald-500/20 transition-colors"
            >
              {pillarData?.name}
            </button>
            <button
              onClick={() => { const idx = formats.findIndex(f => f.id === selectedFormat); setSelectedFormat(formats[(idx + 1) % formats.length].id); }}
              className="px-3 py-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 text-[11px] text-zinc-200 font-medium hover:bg-amber-500/20 transition-colors"
            >
              {formatData?.name}
            </button>
            <div className="px-3 py-1.5 rounded-full border border-zinc-600 bg-zinc-800/50 text-[11px] text-zinc-400">
              {selectedRatio}
            </div>
          </div>
        </div>

        {/* Strategy Editor (toggled) */}
        {strategyEditorOpen && (
          <div className="px-5 pb-4 border-b border-zinc-800">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Persona</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {personas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersona(p.id)}
                      className={`px-2.5 py-1 rounded text-[10px] border transition-all ${
                        selectedPersona === p.id
                          ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Pillar</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {pillars.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPillar(p.id)}
                      className={`px-2.5 py-1 rounded text-[10px] border transition-all ${
                        selectedPillar === p.id
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Format</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {formats.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFormat(f.id)}
                      className={`px-2.5 py-1 rounded text-[10px] border transition-all ${
                        selectedFormat === f.id
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VARIATION TESTING */}
        <div className="px-5 pb-5 border-b border-zinc-800">
          <h3 className="text-xs text-zinc-400 mb-3 uppercase tracking-widest font-medium">
            Variation Testing
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {variationTests.map((test) => (
              <button
                key={test.id}
                onClick={() => setSelectedVariation(test.id)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  selectedVariation === test.id
                    ? 'bg-purple-900/30 border-purple-500'
                    : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                }`}
              >
                <div className={`text-sm font-semibold ${selectedVariation === test.id ? 'text-white' : 'text-zinc-200'}`}>
                  {test.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${selectedVariation === test.id ? 'text-purple-300' : 'text-zinc-500'}`}>
                  {test.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* MANAGE CTAs */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <button
            onClick={() => setCtasExpanded(!ctasExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
              Manage CTAs ({clipsByType.cta.length} Active / 0 Excluded)
            </h3>
            <span className={`text-zinc-500 text-xs transition-transform ${ctasExpanded ? 'rotate-90' : ''}`}>▸</span>
          </button>
          {ctasExpanded && (
            <div className="mt-3 space-y-1.5">
              {clipsByType.cta.length > 0 ? clipsByType.cta.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[11px] p-2 border border-zinc-700 rounded bg-zinc-800/20">
                  <div className="w-2 h-2 rounded-full bg-[#4ecdc4]" />
                  <span className="text-zinc-300 flex-1 truncate">{c.name}</span>
                  <span className="text-zinc-600">{c.duration.toFixed(1)}s</span>
                </div>
              )) : (
                <div className="text-[11px] text-zinc-500 p-3 border border-zinc-700 rounded-lg bg-zinc-800/20">
                  No CTAs available
                </div>
              )}
            </div>
          )}
        </div>

        {/* Brand prefix + ratio + toggles */}
        <div className="px-5 py-4 border-b border-zinc-800 space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={brandPrefix}
              onChange={(e) => setBrandPrefix(e.target.value)}
              className="w-24 h-10 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
            />
            <div className="relative flex-1">
              <select
                value={selectedRatio}
                onChange={(e) => setSelectedRatio(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
              >
                {ratios.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-3 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={curatedOnly} onChange={() => setCuratedOnly(!curatedOnly)} />
              <span className="text-xs text-zinc-300">Curated<br/>only</span>
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={gradedOnly} onChange={() => setGradedOnly(!gradedOnly)} />
              <span className="text-xs text-zinc-300">Graded<br/>only</span>
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={useMusic} onChange={() => setUseMusic(!useMusic)} />
              <span className="text-xs text-zinc-300">Music</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="3"
                max="10"
                value={columnCount}
                onChange={(e) => setColumnCount(parseInt(e.target.value))}
                className="flex-1 h-1 rounded-full bg-zinc-700 accent-indigo-500 cursor-pointer"
              />
              <span className="text-2xl font-bold text-zinc-100 tabular-nums w-8 text-right">{columnCount}</span>
            </div>
          </div>
        </div>

        {/* AVAILABLE CLIPS */}
        <div className="px-5 py-4 border-b border-zinc-800 space-y-3">
          <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
            Available Clips
          </h3>
          <div className="space-y-2">
            {(['hook', 'body', 'product', 'cta'] as const).map(type => {
              const color = shotTypeColor[type];
              const filtered = clipsByType[type].length;
              const total = allClipsByType[type].length;
              return (
                <div key={type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-zinc-200 font-medium capitalize">{type}</span>
                  </div>
                  <span className="text-zinc-400 tabular-nums">{filtered} <span className="text-zinc-600">/ {total}</span></span>
                </div>
              );
            })}
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-zinc-400">Music tracks</span>
              <span className="text-zinc-400 tabular-nums">24</span>
            </div>
          </div>
          <div className="text-[11px] text-zinc-600">
            ~{comboCount.toLocaleString()} combos · {aidaStructure?.label || ''} · AIDA enforced
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <div className="px-5 py-5">
          <button
            onClick={handleGenerate}
            disabled={generating || !hasApproved}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-base font-bold transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate {columnCount} Variations
              </>
            )}
          </button>
          {!hasApproved && (
            <p className="text-[10px] text-amber-500 text-center mt-2">Approve clips in Curate first</p>
          )}
        </div>
      </div>

      {/* MAIN CONTENT — Preview Grid */}
      <div className="flex-1 overflow-auto flex flex-col bg-zinc-950">
        {/* Re-iterate banner */}
        {reiterateContext && (
          <div className="mx-6 mt-6 p-4 bg-amber-600/10 border border-amber-600/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm font-semibold">Re-iterating: {reiterateContext.adName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400">
                  {reiterateContext.originalRoas.toFixed(1)}x ROAS — {reiterateContext.status}
                </span>
              </div>
              <button onClick={() => setReiterateContext(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">
                Dismiss
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 mb-2">Performance insights suggest:</div>
            <ul className="space-y-1">
              {reiterateContext.suggestions.map((s, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex items-start gap-2">
                  <span className="text-amber-400 shrink-0">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Header bar */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              Variation Preview
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {previewVariations.length} variations
            </span>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={!hasApproved}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-purple-400 hover:text-purple-300 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Shuffle className="w-3 h-3" />
            Re-shuffle
          </button>
        </div>

        {previewVariations.length > 0 ? (
          <div className="flex-1 overflow-auto p-6">
            {/* AIDA structure legend */}
            <div className="mb-5 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">AIDA Structure:</span>
              {aidaStructure?.slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shotTypeColor[slot.type] }} />
                  <span className="text-[10px] text-zinc-400">{slot.phase}</span>
                  <span className="text-[9px] text-zinc-600">({slot.type})</span>
                </div>
              ))}
            </div>

            {/* Variation grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(previewVariations.length, 5)}, 1fr)` }}>
              {previewVariations.map((v) => (
                <div
                  key={v.idx}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  {/* Variation header */}
                  <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-200 truncate">V{v.idx + 1}</span>
                    <span className="text-[9px] text-zinc-600 tabular-nums">{v.totalDuration}s</span>
                  </div>

                  {/* AIDA timeline bar */}
                  <div className="flex h-1.5">
                    {aidaStructure?.slots.map((slot, si) => (
                      <div
                        key={si}
                        className="h-full"
                        style={{
                          backgroundColor: shotTypeColor[slot.type],
                          width: `${slot.weight * 100}%`,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                  </div>

                  {/* Clip assignments */}
                  <div className="p-3 space-y-2">
                    {[
                      { label: 'Hook', clip: v.hookClip, color: '#ff6b6b' },
                      { label: 'Body', clip: v.bodyClip, color: '#6b8aff' },
                      { label: 'Product', clip: v.productClip, color: '#f0a030' },
                      { label: 'CTA', clip: v.ctaClip, color: '#4ecdc4' },
                    ].map(({ label, clip, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{label}</div>
                          <div className="text-[10px] text-zinc-300 truncate">
                            {clip ? clip.name : <span className="text-zinc-600 italic">none</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer stats */}
                  <div className="px-3 py-2 border-t border-zinc-800/50 flex items-center justify-between">
                    <span className="text-[9px] text-zinc-500">Action:Static</span>
                    <span className="text-[9px] text-zinc-400 tabular-nums">{v.actionRatio}:1</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="mt-6 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-6 text-[11px]">
                <div>
                  <span className="text-zinc-500">Persona:</span>{' '}
                  <span className="text-teal-400 font-medium">{personaData?.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Pillar:</span>{' '}
                  <span className="text-emerald-400 font-medium">{pillarData?.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Format:</span>{' '}
                  <span className="text-amber-400 font-medium">{formatData?.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Ratio:</span>{' '}
                  <span className="text-zinc-300">{selectedRatio}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-zinc-400">
                  <ChevronRight className="w-3 h-3" />
                  <span>Generate to push to Review</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8 max-w-lg">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-3">
                Strategy-Driven Generation
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-8">
                Approve clips in the Curate tab to see a live preview of variations here.
                Each variation follows the AIDA framework with enforced action-to-static
                shot ratios and persona-aligned clip selection.
              </p>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left max-w-md mx-auto">
                <div className="text-xs text-zinc-500 mb-4">Current Strategy:</div>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <span className="text-teal-400 text-sm font-semibold w-16">Persona:</span>
                    <span className="text-zinc-100 text-sm font-semibold">{personaData?.name}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-emerald-400 text-sm font-semibold w-16">Pillar:</span>
                    <span className="text-zinc-100 text-sm font-semibold">{pillarData?.name}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-400 text-sm font-semibold w-16">Format:</span>
                    <span className="text-zinc-100 text-sm font-semibold">{formatData?.name}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800 space-y-1">
                  <div className="text-[11px] text-zinc-500">
                    AIDA: {aidaStructure?.slots.map(s => s.phase.slice(0, 3)).join(' → ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
