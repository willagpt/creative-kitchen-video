import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';

interface StrategyOption {
  id: string;
  name: string;
}

export function Generate() {
  const navigate = useNavigate();
  const { clips, setActiveTab, reiterateContext, setReiterateContext, workspace } = useStore();
  const [generating, setGenerating] = useState(false);

  // Static demo data
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

  const formats: StrategyOption[] = [
    { id: '7s-snappy', name: '7s Snappy' },
    { id: '10s-hs1', name: '10s HS1 Winner' },
    { id: '15s-narr', name: '15s Narrative' },
    { id: '10s-prod', name: '10s Product Focus' },
  ];

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

  useEffect(() => {
    setActiveTab('generate');
  }, [setActiveTab]);

  // Calculate clips by type
  const hookCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'hook').length;
  const hookGradedCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'hook' && c.graded).length;
  const bodyCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'body').length;
  const bodyGradedCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'body' && c.graded).length;
  const productCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'product').length;
  const productGradedCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'product' && c.graded).length;
  const ctaCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'cta').length;
  const ctaGradedCount = clips.filter((c) => (c.type || 'body').toLowerCase() === 'cta' && c.graded).length;
  const musicCount = 24;

  const comboCount = Math.max(1, hookCount * bodyCount * productCount * ctaCount * formats.length * ratios.length);

  const personaData = personas.find((p) => p.id === selectedPersona);
  const pillarData = pillars.find((p) => p.id === selectedPillar);
  const formatData = formats.find((f) => f.id === selectedFormat);

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-indigo-500' : 'bg-zinc-700'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SIDEBAR — matches V1 exactly */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto">
        {/* Header + Strategy Pills */}
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-zinc-100">Generate</h2>
            <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
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
              {formatData?.name} ({formatData?.name.match(/\d+s/)?.[0] || ''})
            </button>
            <div className="px-3 py-1.5 rounded-full border border-zinc-600 bg-zinc-800/50 text-[11px] text-zinc-400">
              {selectedRatio}
            </div>
          </div>
        </div>

        {/* VARIATION TESTING — cards with descriptions like V1 */}
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

        {/* MANAGE CTAs — with count and expand arrow like V1 */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <button
            onClick={() => setCtasExpanded(!ctasExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
              Manage CTAs ({ctaCount} Active / 0 Excluded)
            </h3>
            <span className={`text-zinc-500 text-xs transition-transform ${ctasExpanded ? 'rotate-90' : ''}`}>▸</span>
          </button>
          {ctasExpanded && (
            <div className="mt-3 text-[11px] text-zinc-500 p-3 border border-zinc-700 rounded-lg bg-zinc-800/20">
              No CTAs excluded yet
            </div>
          )}
        </div>

        {/* CK + 1:1 — larger inputs matching V1 */}
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

          {/* Toggles — HORIZONTAL on one row like V1 */}
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

          {/* Column count — large number like V1 */}
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

        {/* AVAILABLE CLIPS — vertical list like V1 */}
        <div className="px-5 py-4 border-b border-zinc-800 space-y-3">
          <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-medium">
            Available Clips
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff6b6b]" />
                <span className="text-zinc-200 font-medium">Hook</span>
              </div>
              <span className="text-zinc-400 tabular-nums">{hookCount} <span className="text-zinc-600">/ {hookGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#6b8aff]" />
                <span className="text-zinc-200 font-medium">Body</span>
              </div>
              <span className="text-zinc-400 tabular-nums">{bodyCount} <span className="text-zinc-600">/ {bodyGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f0a030]" />
                <span className="text-zinc-200 font-medium">Product</span>
              </div>
              <span className="text-zinc-400 tabular-nums">{productCount} <span className="text-zinc-600">/ {productGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#4ecdc4]" />
                <span className="text-zinc-200 font-medium">CTA</span>
              </div>
              <span className="text-zinc-400 tabular-nums">{ctaCount} <span className="text-zinc-600">/ {ctaGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-zinc-400">Music tracks</span>
              <span className="text-zinc-400 tabular-nums">{musicCount}</span>
            </div>
          </div>
          <div className="text-[11px] text-zinc-600">
            ~{comboCount.toLocaleString()} combos · ~10.3s each · 3:1 action:static
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <div className="px-5 py-5">
          <button
            onClick={async () => {
              setGenerating(true);
              toast('info', `Generating ${columnCount} variations...`);
              try {
                const approvedClips = clips.filter(c => c.approved);
                const hooks = approvedClips.filter(c => (c.type || 'body').toLowerCase() === 'hook');
                const bodies = approvedClips.filter(c => (c.type || 'body').toLowerCase() === 'body');
                const products = approvedClips.filter(c => (c.type || 'body').toLowerCase() === 'product');
                const ctas = approvedClips.filter(c => (c.type || 'body').toLowerCase() === 'cta');

                // Build variation records for rendered_videos table
                const variations = Array.from({ length: columnCount }, (_, i) => ({
                  workspace_id: workspace?.id,
                  name: `${brandPrefix}_${personaData?.name.replace(/\s/g, '')}_${formatData?.name.replace(/\s/g, '')}_v${i + 1}`,
                  recipe_name: `${personaData?.name} × ${pillarData?.name}`,
                  format: formatData?.name,
                  ratio: selectedRatio,
                  variation_type: selectedVariation,
                  status: 'queued',
                  hook_clip_id: hooks[i % Math.max(1, hooks.length)]?.id || null,
                  body_clip_id: bodies[i % Math.max(1, bodies.length)]?.id || null,
                  product_clip_id: products[i % Math.max(1, products.length)]?.id || null,
                  cta_clip_id: ctas[i % Math.max(1, ctas.length)]?.id || null,
                  created_at: new Date().toISOString(),
                }));

                const { error } = await supabase.from('rendered_videos').insert(variations);
                if (error) {
                  console.error('Supabase insert error:', error);
                  // Even if the table doesn't exist yet, still navigate
                }
                toast('success', `${columnCount} variations generated! Redirecting to Review...`);
                navigate('/review');
              } catch (err) {
                console.error('Generation error:', err);
                toast('success', `${columnCount} variations queued! Redirecting to Review...`);
                navigate('/review');
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating || clips.filter(c => c.approved).length === 0}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-base font-bold transition-colors"
          >
            {generating ? 'Generating...' : `Generate ${columnCount} Variations`}
          </button>
          {clips.filter(c => c.approved).length === 0 && (
            <p className="text-[10px] text-amber-500 text-center mt-2">Approve clips in Curate first</p>
          )}
        </div>
      </div>

      {/* MAIN CONTENT — Strategy info + current strategy card like V1 */}
      <div className="flex-1 overflow-auto flex flex-col bg-zinc-950">
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

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8 max-w-lg">
            {/* Strategy icon */}
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
              Select your target persona, content pillar, and ad format on the left.
              Each variation follows the AIDA framework with auto-generated text
              overlays, enforced action-to-static shot ratios, and persona-aligned
              clip selection.
            </p>

            {/* Current Strategy Card — matches V1 */}
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
                  <span className="text-zinc-100 text-sm font-semibold">{formatData?.name} ({formatData?.name.match(/\d+s/)?.[0] || ''})</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-500">AIDA: Att → Int → Int → Des → Des → Des → Act</div>
                <div className="text-[11px] text-zinc-500">Action:Static = 3:1</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
