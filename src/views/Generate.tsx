import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import { Shuffle, Settings2, Zap, Check, Download, BookOpen, X } from 'lucide-react';
import type { Clip } from '@/types';

/* ── Types ─────────────────────────────────────────────────────────── */

interface AidaSlot {
  phase: 'ATT' | 'INT' | 'DES' | 'ACT';
  type: 'HOK' | 'BOD' | 'PRO' | 'CTA';
  clip: Clip | null;
  weight: number;
}

interface TextOverlay {
  text: string;
}

interface GeneratedVariation {
  idx: number;
  name: string;
  slots: AidaSlot[];
  overlays: TextOverlay[];
  musicTrack: string | null;
  totalDuration: number;
  selected: boolean;
}

interface StrategyOption {
  id: string;
  name: string;
}

/* ── AIDA templates per format ─────────────────────────────────────── */

type SlotTemplate = { phase: 'ATT' | 'INT' | 'DES' | 'ACT'; type: 'HOK' | 'BOD' | 'PRO' | 'CTA'; weight: number };

const AIDA_TEMPLATES: Record<string, { label: string; slots: SlotTemplate[] }> = {
  '7s-snappy': {
    label: '7s Snappy',
    slots: [
      { phase: 'ATT', type: 'HOK', weight: 0.28 },
      { phase: 'INT', type: 'BOD', weight: 0.22 },
      { phase: 'INT', type: 'PRO', weight: 0.22 },
      { phase: 'DES', type: 'BOD', weight: 0.15 },
      { phase: 'ACT', type: 'CTA', weight: 0.13 },
    ],
  },
  '10s-hs1': {
    label: '10s HS1 Winner',
    slots: [
      { phase: 'ATT', type: 'HOK', weight: 0.15 },
      { phase: 'INT', type: 'BOD', weight: 0.13 },
      { phase: 'INT', type: 'PRO', weight: 0.13 },
      { phase: 'DES', type: 'BOD', weight: 0.13 },
      { phase: 'DES', type: 'BOD', weight: 0.13 },
      { phase: 'DES', type: 'BOD', weight: 0.13 },
      { phase: 'ACT', type: 'CTA', weight: 0.20 },
    ],
  },
  '15s-narr': {
    label: '15s Narrative',
    slots: [
      { phase: 'ATT', type: 'HOK', weight: 0.10 },
      { phase: 'INT', type: 'BOD', weight: 0.10 },
      { phase: 'INT', type: 'PRO', weight: 0.10 },
      { phase: 'DES', type: 'BOD', weight: 0.10 },
      { phase: 'DES', type: 'BOD', weight: 0.10 },
      { phase: 'DES', type: 'PRO', weight: 0.10 },
      { phase: 'DES', type: 'BOD', weight: 0.10 },
      { phase: 'DES', type: 'BOD', weight: 0.10 },
      { phase: 'ACT', type: 'CTA', weight: 0.20 },
    ],
  },
  '10s-prod': {
    label: '10s Product Focus',
    slots: [
      { phase: 'ATT', type: 'HOK', weight: 0.15 },
      { phase: 'INT', type: 'PRO', weight: 0.15 },
      { phase: 'INT', type: 'PRO', weight: 0.15 },
      { phase: 'DES', type: 'BOD', weight: 0.13 },
      { phase: 'DES', type: 'BOD', weight: 0.13 },
      { phase: 'DES', type: 'PRO', weight: 0.13 },
      { phase: 'ACT', type: 'CTA', weight: 0.16 },
    ],
  },
};

/* ── Text overlay pools by persona × pillar ────────────────────────── */

const OVERLAY_POOLS: Record<string, string[]> = {
  'busy-prof:time-eff': [
    'Ready when you are', 'Skip the queue', 'No prep needed', '5 mins flat',
    'Your week, planned', 'Delivered to your door', 'Zero cleanup',
    'More time for you', '50+ options weekly', 'Order now',
  ],
  'busy-prof:weight-loss': [
    'Under 500 cal', 'Macro-tracked', 'No hidden sugars', 'Stay on track',
    'Chef-prepared daily', 'Always fresh', 'Guilt-free lunch',
    'Fuel your goals', 'Start today', 'Order now',
  ],
  'busy-prof:price-value': [
    'Skip the markup', 'Chef quality, half the price', 'No hidden fees',
    '$8.99 per meal', 'Cancel anytime', 'Free delivery over $40',
    'Your Lunch, Sorted', 'Better than takeout', 'Try it free', 'Order now',
  ],
  'health-ent:time-eff': [
    'Clean eating, fast', 'Ready in minutes', 'Whole ingredients',
    'No compromises', 'Fresh not frozen', 'Chef-prepared',
    'Done for You', 'Always fresh', 'Skip the cooking', 'Order now',
  ],
  'health-ent:weight-loss': [
    'Calorie-counted', 'High protein', 'Dietitian approved',
    'No fillers', 'Real ingredients', 'Track everything',
    'Your goals, served', 'Lose weight deliciously', 'Start today', 'Order now',
  ],
  'health-ent:price-value': [
    'Healthier than takeout', 'Premium ingredients', 'No subscription',
    'Pay per meal', 'Always transparent', 'Freshness guaranteed',
    'Eat clean, spend less', 'Real food, real price', 'Try it free', 'Order now',
  ],
  'family-prov:time-eff': [
    'Family dinner, sorted', 'Everyone eats happy', 'No prep, no stress',
    '10 min table-ready', 'Kids love it too', 'Delivered fresh',
    'More family time', 'Weekly variety', 'Start tonight', 'Order now',
  ],
  'family-prov:weight-loss': [
    'Healthy family meals', 'Kids approved', 'Balanced portions',
    'No junk, no stress', 'Whole food ingredients', 'Dietitian designed',
    'Feed them right', 'Everyone wins', 'Start today', 'Order now',
  ],
  'family-prov:price-value': [
    'Feed 4 for $32', 'Cheaper than takeout', 'No food waste',
    'Perfectly portioned', 'Chef-quality family meals', 'Cancel anytime',
    'Savings that stack', 'Better value daily', 'Try it free', 'Order now',
  ],
};

const MUSIC_TRACKS = [
  'Downtown – Shtrik', 'Lover Please Stay I…', 'Duda – Ian Post',
  'Chartreux Noir – B…', 'Can You Make It__ …', 'Light Ahead – Remi',
  'Sunrise Coast – Al…', 'Warm Breeze – Juno', 'Quick Step – MFP',
  'Good Morning – Sam…',
];

/* ── Helpers ────────────────────────────────────────────────────────── */

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const SLOT_BG: Record<string, string> = {
  HOK: 'bg-green-700/60',
  BOD: 'bg-blue-700/50',
  PRO: 'bg-orange-700/50',
  CTA: 'bg-teal-700/50',
};


/* ── Component ─────────────────────────────────────────────────────── */

export function Generate() {
  const navigate = useNavigate();
  const { clips, setActiveTab, reiterateContext, setReiterateContext, workspace } = useStore();
  const [generating, setGenerating] = useState(false);

  // Strategy
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
  const formats = Object.entries(AIDA_TEMPLATES).map(([id, s]) => ({ id, name: s.label }));
  const ratios = ['1:1', '16:9', '9:16'];
  const variationTests = [
    { id: 'full-mix', label: 'Full Mix', desc: 'Vary everything' },
    { id: 'hook-test', label: 'Hook Test', desc: 'Only vary hooks' },
    { id: 'body-test', label: 'Body Test', desc: 'Only vary body' },
    { id: 'cta-test', label: 'CTA Test', desc: 'Only vary CTA' },
  ];

  const [selectedPersona, setSelectedPersona] = useState('busy-prof');
  const [selectedPillar, setSelectedPillar] = useState('time-eff');
  const [selectedFormat, setSelectedFormat] = useState('10s-hs1');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedVariation, setSelectedVariation] = useState('full-mix');
  const [brandPrefix, setBrandPrefix] = useState('CK');
  const [columnCount, setColumnCount] = useState(5);
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [gradedOnly, setGradedOnly] = useState(true);
  const [useMusic, setUseMusic] = useState(true);
  const [ctasExpanded, setCtasExpanded] = useState(false);
  const [strategyEditorOpen, setStrategyEditorOpen] = useState(false);
  const [variations, setVariations] = useState<GeneratedVariation[]>([]);

  useEffect(() => { setActiveTab('generate'); }, [setActiveTab]);

  /* ── Clip pools ────────────────────────────────────────────────── */
  const filteredClips = useMemo(() => {
    let pool = clips.filter(c => c.approved);
    if (gradedOnly) pool = pool.filter(c => c.graded);
    return pool;
  }, [clips, gradedOnly]);

  const clipsByType = useMemo(() => ({
    HOK: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'hook'),
    BOD: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'body'),
    PRO: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'product'),
    CTA: filteredClips.filter(c => (c.type || 'body').toLowerCase() === 'cta'),
  }), [filteredClips]);

  const allClipsByType = useMemo(() => ({
    hook: clips.filter(c => (c.type || 'body').toLowerCase() === 'hook'),
    body: clips.filter(c => (c.type || 'body').toLowerCase() === 'body'),
    product: clips.filter(c => (c.type || 'body').toLowerCase() === 'product'),
    cta: clips.filter(c => (c.type || 'body').toLowerCase() === 'cta'),
  }), [clips]);

  const comboCount = useMemo(() => {
    const h = Math.max(1, clipsByType.HOK.length);
    const b = Math.max(1, clipsByType.BOD.length);
    const p = Math.max(1, clipsByType.PRO.length);
    const ct = Math.max(1, clipsByType.CTA.length);
    return h * b * p * ct * formats.length * ratios.length;
  }, [clipsByType, formats.length, ratios.length]);

  const personaData = personas.find(p => p.id === selectedPersona);
  const pillarData = pillars.find(p => p.id === selectedPillar);
  const formatData = formats.find(f => f.id === selectedFormat);
  const aidaTemplate = AIDA_TEMPLATES[selectedFormat];

  /* ── Generate variations ───────────────────────────────────────── */
  const generateVariations = useCallback((count: number): GeneratedVariation[] => {
    const template = AIDA_TEMPLATES[selectedFormat];
    if (!template) return [];

    const formatDuration = parseFloat(template.label.match(/(\d+)s/)?.[1] || '10');
    const overlayKey = `${selectedPersona}:${selectedPillar}`;
    const overlayPool = OVERLAY_POOLS[overlayKey] || OVERLAY_POOLS['busy-prof:time-eff'];

    const result: GeneratedVariation[] = [];
    const usedHookIds = new Set<number>();

    for (let i = 0; i < count; i++) {
      // For each slot, pick a clip from the matching pool
      const slots: AidaSlot[] = template.slots.map(tmpl => {
        const pool = clipsByType[tmpl.type];
        let clip: Clip | null = null;

        if (selectedVariation === 'hook-test' && tmpl.type !== 'HOK') {
          clip = pool.length > 0 ? pool[0] : null;
        } else if (selectedVariation === 'body-test' && tmpl.type !== 'BOD') {
          clip = pool.length > 0 ? pool[0] : null;
        } else if (selectedVariation === 'cta-test' && tmpl.type !== 'CTA') {
          clip = pool.length > 0 ? pool[0] : null;
        } else {
          clip = pickRandom(pool);
        }

        // For hooks, try to get unique per variation
        if (tmpl.type === 'HOK' && pool.length > 1) {
          const unused = pool.filter(c => !usedHookIds.has(c.id));
          clip = unused.length > 0 ? pickRandom(unused) : pickRandom(pool);
        }

        if (clip && tmpl.type === 'HOK') usedHookIds.add(clip.id);

        return {
          phase: tmpl.phase,
          type: tmpl.type,
          clip,
          weight: tmpl.weight,
        };
      });

      // Pick overlay texts (pick random subset from pool)
      const numOverlays = Math.min(template.slots.length, overlayPool.length);
      const overlays = pickRandomN(overlayPool, numOverlays).map(text => ({ text }));

      // Pick music track
      const music = useMusic ? pickRandom(MUSIC_TRACKS) : null;

      const totalDuration = Math.round(formatDuration * 10) / 10;

      const formatShort = template.label.replace(/\s/g, '_').replace(/[()]/g, '');

      result.push({
        idx: i,
        name: `${brandPrefix}_${formatShort}_${selectedRatio.replace(':', 'x')}_V${i + 1}`,
        slots,
        overlays,
        musicTrack: music,
        totalDuration,
        selected: true,
      });
    }

    return result;
  }, [clipsByType, selectedFormat, selectedVariation, selectedPersona, selectedPillar, useMusic, brandPrefix, selectedRatio, personaData]);

  // Auto-generate on settings change
  useEffect(() => {
    if (filteredClips.length > 0) {
      setVariations(generateVariations(columnCount));
    } else {
      setVariations([]);
    }
  }, [columnCount, generateVariations, filteredClips.length]);

  const handleRegenerate = () => {
    setVariations(generateVariations(columnCount));
  };

  const toggleVariationSelection = (idx: number) => {
    setVariations(prev => prev.map(v => v.idx === idx ? { ...v, selected: !v.selected } : v));
  };

  const toggleSelectAll = () => {
    const allSelected = variations.every(v => v.selected);
    setVariations(prev => prev.map(v => ({ ...v, selected: !allSelected })));
  };

  const selectedCount = variations.filter(v => v.selected).length;

  /* ── Push to Supabase & navigate ───────────────────────────────── */
  const handleGenerate = async () => {
    const selected = variations.filter(v => v.selected);
    if (selected.length === 0) return;
    setGenerating(true);
    toast('info', `Generating ${selected.length} variations...`);

    try {
      const records = selected.map(v => ({
        workspace_id: workspace?.id,
        name: v.name,
        recipe_name: `${personaData?.name} × ${pillarData?.name}`,
        format: formatData?.name,
        ratio: selectedRatio,
        variation_type: selectedVariation,
        status: 'queued',
        hook_clip_id: v.slots.find(s => s.type === 'HOK')?.clip?.id || null,
        body_clip_id: v.slots.find(s => s.type === 'BOD')?.clip?.id || null,
        product_clip_id: v.slots.find(s => s.type === 'PRO')?.clip?.id || null,
        cta_clip_id: v.slots.find(s => s.type === 'CTA')?.clip?.id || null,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('rendered_videos').insert(records);
      if (error) {
        console.error('Supabase insert error:', error);
        toast('error', `DB error: ${error.message}`);
      } else {
        toast('success', `${selected.length} variations saved! Redirecting to Review...`);
      }
      navigate('/review');
    } catch (err) {
      console.error('Generation error:', err);
      toast('error', 'Generation failed — check console');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Export batch JSON ─────────────────────────────────────────── */
  const handleExportBatch = () => {
    const selected = variations.filter(v => v.selected);
    const json = JSON.stringify({
      strategy: { persona: personaData?.name, pillar: pillarData?.name, format: formatData?.name, ratio: selectedRatio },
      variations: selected.map(v => ({
        name: v.name,
        slots: v.slots.map(s => ({ phase: s.phase, type: s.type, clip: s.clip?.name || null })),
        overlays: v.overlays.map(o => o.text),
        music: v.musicTrack,
      })),
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `batch_${brandPrefix}_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Save to Recipes ───────────────────────────────────────────── */
  const handleSaveToRecipes = async () => {
    const selected = variations.filter(v => v.selected);
    if (selected.length === 0 || !workspace) return;
    try {
      const recipes = selected.map(v => ({
        workspace_id: workspace.id,
        name: v.name,
        format: formatData?.name || '10s HS1',
        ratios: [selectedRatio],
        shots: v.slots.map(s => ({ type: `${s.phase}/${s.type}`, duration: Math.round(v.totalDuration * s.weight * 10) / 10, clip_id: s.clip?.id })),
        status: 'draft',
      }));
      const { error } = await supabase.from('recipes').insert(recipes);
      if (error) throw error;
      toast('success', `${selected.length} recipe(s) saved`);
    } catch (err) {
      console.error('Save recipes error:', err);
      toast('error', 'Failed to save recipes');
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

  const hasApproved = clips.filter(c => c.approved).length > 0;
  const shotTypeColorDot: Record<string, string> = { hook: '#ff6b6b', body: '#6b8aff', product: '#f0a030', cta: '#4ecdc4' };

  /* ── Clip label helper ────────────────────────────────────────── */
  const clipLabel = (clip: Clip | null) => {
    if (!clip) return '—';
    const raw = clip.name || clip.fullname || '';
    return raw.replace(/\.(mp4|mov|webm)$/i, '').replace(/^(PGHS|IMG_|VID_)/i, '');
  };

  /* ── Deduplicate slots into summary chips (e.g. 2× BOD) ──────── */
  const slotSummary = (slots: AidaSlot[]) => {
    const groups: { phase: string; type: string; count: number; clipName: string }[] = [];
    for (const s of slots) {
      const last = groups[groups.length - 1];
      if (last && last.phase === s.phase && last.type === s.type) {
        last.count++;
      } else {
        groups.push({ phase: s.phase, type: s.type, count: 1, clipName: clipLabel(s.clip) });
      }
    }
    return groups;
  };

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto flex-shrink-0">
        {/* Header */}
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
            <button onClick={() => { const idx = personas.findIndex(p => p.id === selectedPersona); setSelectedPersona(personas[(idx + 1) % personas.length].id); }}
              className="px-3 py-1.5 rounded-full border border-teal-500/50 bg-teal-500/10 text-[11px] text-zinc-200 font-medium hover:bg-teal-500/20 transition-colors">
              {personaData?.name}
            </button>
            <button onClick={() => { const idx = pillars.findIndex(p => p.id === selectedPillar); setSelectedPillar(pillars[(idx + 1) % pillars.length].id); }}
              className="px-3 py-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-[11px] text-zinc-200 font-medium hover:bg-emerald-500/20 transition-colors">
              {pillarData?.name}
            </button>
            <button onClick={() => { const idx = formats.findIndex(f => f.id === selectedFormat); setSelectedFormat(formats[(idx + 1) % formats.length].id); }}
              className="px-3 py-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 text-[11px] text-zinc-200 font-medium hover:bg-amber-500/20 transition-colors">
              {formatData?.name} ({aidaTemplate?.label.match(/\d+s/)?.[0] || ''})
            </button>
            <div className="px-3 py-1.5 rounded-full border border-zinc-600 bg-zinc-800/50 text-[11px] text-zinc-400">
              {selectedRatio}
            </div>
          </div>
        </div>

        {/* Strategy editor */}
        {strategyEditorOpen && (
          <div className="px-5 pb-4 border-b border-zinc-800 space-y-3">
            {[
              { label: 'Persona', items: personas, sel: selectedPersona, set: setSelectedPersona, color: 'teal' },
              { label: 'Pillar', items: pillars, sel: selectedPillar, set: setSelectedPillar, color: 'emerald' },
              { label: 'Format', items: formats, sel: selectedFormat, set: setSelectedFormat, color: 'amber' },
            ].map(({ label, items, sel, set, color }) => (
              <div key={label}>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {items.map(item => (
                    <button key={item.id} onClick={() => set(item.id)}
                      className={`px-2.5 py-1 rounded text-[10px] border transition-all ${
                        sel === item.id ? `border-${color}-500 bg-${color}-500/20 text-${color}-300` : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}>
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Variation testing */}
        <div className="px-5 pb-5 border-b border-zinc-800">
          <h3 className="text-xs text-zinc-400 mb-3 uppercase tracking-widest font-medium">Variation Testing</h3>
          <div className="grid grid-cols-2 gap-2">
            {variationTests.map(test => (
              <button key={test.id} onClick={() => setSelectedVariation(test.id)}
                className={`p-3 rounded-lg border transition-all text-left ${selectedVariation === test.id ? 'bg-purple-900/30 border-purple-500' : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'}`}>
                <div className={`text-sm font-semibold ${selectedVariation === test.id ? 'text-white' : 'text-zinc-200'}`}>{test.label}</div>
                <div className={`text-[10px] mt-0.5 ${selectedVariation === test.id ? 'text-purple-300' : 'text-zinc-500'}`}>{test.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <button onClick={() => setCtasExpanded(!ctasExpanded)} className="flex items-center justify-between w-full text-left">
            <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
              Manage CTAs ({clipsByType.CTA.length} Active / 0 Excluded)
            </h3>
            <span className={`text-zinc-500 text-xs transition-transform ${ctasExpanded ? 'rotate-90' : ''}`}>▸</span>
          </button>
          {ctasExpanded && (
            <div className="mt-3 space-y-1.5">
              {clipsByType.CTA.length > 0 ? clipsByType.CTA.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[11px] p-2 border border-zinc-700 rounded bg-zinc-800/20">
                  <div className="w-2 h-2 rounded-full bg-[#4ecdc4]" />
                  <span className="text-zinc-300 flex-1 truncate">{c.name}</span>
                  <span className="text-zinc-600">{c.duration.toFixed(1)}s</span>
                </div>
              )) : (
                <div className="text-[11px] text-zinc-500 p-3 border border-zinc-700 rounded-lg bg-zinc-800/20">No CTAs available</div>
              )}
            </div>
          )}
        </div>

        {/* Brand prefix + ratio + toggles */}
        <div className="px-5 py-4 border-b border-zinc-800 space-y-4">
          <div className="flex gap-3">
            <input type="text" value={brandPrefix} onChange={e => setBrandPrefix(e.target.value)}
              className="w-24 h-10 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-purple-500" />
            <div className="relative flex-1">
              <select value={selectedRatio} onChange={e => setSelectedRatio(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none">
                {ratios.map(r => <option key={r} value={r}>{r}</option>)}
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
              <input type="range" min="3" max="10" value={columnCount} onChange={e => setColumnCount(parseInt(e.target.value))}
                className="flex-1 h-1 rounded-full bg-zinc-700 accent-indigo-500 cursor-pointer" />
              <span className="text-2xl font-bold text-zinc-100 tabular-nums w-8 text-right">{columnCount}</span>
            </div>
          </div>
        </div>

        {/* Available clips */}
        <div className="px-5 py-4 border-b border-zinc-800 space-y-3">
          <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">Available Clips</h3>
          <div className="space-y-2">
            {(['hook', 'body', 'product', 'cta'] as const).map(type => {
              const filtered = clipsByType[type === 'hook' ? 'HOK' : type === 'body' ? 'BOD' : type === 'product' ? 'PRO' : 'CTA'].length;
              const total = allClipsByType[type].length;
              return (
                <div key={type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: shotTypeColorDot[type] }} />
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
            ~{comboCount.toLocaleString()} combos · ~{aidaTemplate?.label.match(/\d+/)?.[0] || '10'}.3s each · 3:1 action:static
          </div>
        </div>

        {/* Generate button */}
        <div className="px-5 py-5">
          <button onClick={handleGenerate}
            disabled={generating || !hasApproved || selectedCount === 0}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-base font-bold transition-colors flex items-center justify-center gap-2">
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
            ) : (
              <><Zap className="w-4 h-4" />Generate {selectedCount} Variations</>
            )}
          </button>
          {!hasApproved && <p className="text-[10px] text-amber-500 text-center mt-2">Approve clips in Curate first</p>}
        </div>
      </div>

      {/* ═══ MAIN CONTENT — V1-style variation cards ═══ */}
      <div className="flex-1 overflow-auto flex flex-col bg-[#0d0d14]">
        {/* Re-iterate banner */}
        {reiterateContext && (
          <div className="mx-6 mt-4 p-4 bg-amber-600/10 border border-amber-600/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm font-semibold">Re-iterating: {reiterateContext.adName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400">
                  {reiterateContext.originalRoas.toFixed(1)}x ROAS — {reiterateContext.status}
                </span>
              </div>
              <button onClick={() => setReiterateContext(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Dismiss</button>
            </div>
            <ul className="space-y-1">
              {reiterateContext.suggestions.map((s, i) => (
                <li key={i} className="text-[11px] text-zinc-300 flex items-start gap-2"><span className="text-amber-400 shrink-0">→</span> {s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Top bar — selection count + strategy pills + actions */}
        {variations.length > 0 && (
          <div className="px-6 py-3 border-b border-zinc-800/60 flex items-center gap-4 flex-shrink-0 flex-wrap">
            {/* Select all checkbox */}
            <button onClick={toggleSelectAll}
              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                selectedCount === variations.length ? 'bg-purple-600 border-purple-600' : 'border-zinc-600 hover:border-zinc-500'
              }`}>
              {selectedCount === variations.length && <Check className="w-4 h-4 text-white" />}
            </button>
            <span className="text-sm font-semibold text-zinc-200">
              {selectedCount}/{variations.length} selected
            </span>

            {/* Strategy pills */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-[11px] text-teal-300 font-medium">{personaData?.name}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">{pillarData?.name}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 font-medium">{formatData?.name}</span>
            </div>

            <span className="text-[11px] text-zinc-500 tabular-nums">~{aidaTemplate?.label.match(/\d+/)?.[0] || '10'}.3s</span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <button onClick={() => setVariations([])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-red-400/60 hover:text-red-400 border border-zinc-700 hover:border-red-700/50 rounded-lg transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
            <button onClick={handleRegenerate} disabled={!hasApproved}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors">
              <Shuffle className="w-3 h-3" /> Re-shuffle
            </button>
            <button onClick={handleExportBatch} disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-30">
              <Download className="w-3 h-3" /> Export Batch
            </button>
            <button onClick={handleSaveToRecipes} disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors font-semibold disabled:opacity-30">
              <BookOpen className="w-3 h-3" /> Save {selectedCount} to Recipes
            </button>
          </div>
        )}

        {/* Variation cards */}
        {variations.length > 0 ? (
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {variations.map(v => {
                const groups = slotSummary(v.slots);
                return (
                <div key={v.idx}
                  className={`rounded-xl border overflow-hidden transition-colors ${
                    v.selected ? 'border-purple-500/40 bg-[#13131d]' : 'border-zinc-800/50 bg-[#111118]'
                  }`}>
                  {/* Card header — checkbox + name + duration */}
                  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-zinc-800/30">
                    <button onClick={() => toggleVariationSelection(v.idx)}
                      className="flex-shrink-0">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        v.selected ? 'bg-purple-600 border-purple-600' : 'border-zinc-600 hover:border-zinc-500'
                      }`}>
                        {v.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                    <span className="text-xs font-semibold text-zinc-200 truncate flex-1">{v.name}</span>
                    <span className="text-[10px] text-zinc-500 tabular-nums flex-shrink-0">{v.totalDuration}s</span>
                  </div>

                  {/* AIDA flow — compact colored badges in a row */}
                  <div className="px-3 py-2 flex flex-wrap gap-1">
                    {groups.map((g, gi) => (
                      <div key={gi}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded ${SLOT_BG[g.type]}`}
                        title={g.clipName}>
                        <span className={`text-[9px] font-bold text-white/90 uppercase`}>{g.phase}</span>
                        <span className="text-[9px] text-white/50">·</span>
                        <span className="text-[9px] text-white/70 uppercase">{g.type}</span>
                        {g.count > 1 && <span className="text-[8px] text-white/40">×{g.count}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Clip assignments — clean readable list */}
                  <div className="px-3 pb-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {v.slots.map((slot, si) => (
                        <div key={si} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                            backgroundColor: slot.type === 'HOK' ? '#ff6b6b' : slot.type === 'BOD' ? '#6b8aff' : slot.type === 'PRO' ? '#f0a030' : '#4ecdc4'
                          }} />
                          <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">{clipLabel(slot.clip)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Text overlays strip */}
                  <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-zinc-800/20 scrollbar-none">
                    {v.overlays.slice(0, 4).map((overlay, oi) => (
                      <span key={oi} className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">
                        {overlay.text}
                      </span>
                    ))}
                  </div>

                  {/* Footer — music + actions */}
                  <div className="px-3 py-2 border-t border-zinc-800/30 flex items-center gap-3">
                    {v.musicTrack && (
                      <span className="text-[9px] text-zinc-500 truncate flex-1">♫ {v.musicTrack}</span>
                    )}
                    {!v.musicTrack && <div className="flex-1" />}
                    <button className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors font-medium">
                      Use as base
                    </button>
                  </div>
                </div>
                );
              })}
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
              <h2 className="text-xl font-bold text-zinc-100 mb-3">Strategy-Driven Generation</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Approve clips in the Curate tab to see a live preview of variations here.
                Each variation follows the AIDA framework with auto-generated text overlays
                and persona-aligned clip selection.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
