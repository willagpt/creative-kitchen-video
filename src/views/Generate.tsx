import { useEffect, useState } from 'react';
import { useStore } from '@/store';

interface StrategyOption {
  id: string;
  name: string;
}

export function Generate() {
  const { clips, setActiveTab, reiterateContext, setReiterateContext } = useStore();

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
    { id: 'full-mix', label: 'Full Mix' },
    { id: 'hook-test', label: 'Hook Test' },
    { id: 'body-test', label: 'Body Test' },
    { id: 'cta-test', label: 'CTA Test' },
  ];

  const [selectedPersona, setSelectedPersona] = useState<string>('busy-prof');
  const [selectedPillar, setSelectedPillar] = useState<string>('time-eff');
  const [selectedFormat, setSelectedFormat] = useState<string>('7s-snappy');
  const [selectedRatio, setSelectedRatio] = useState<string>('1:1');
  const [selectedVariation, setSelectedVariation] = useState<string>('full-mix');
  const [brandPrefix, setBrandPrefix] = useState<string>('CK');
  const [columnCount, setColumnCount] = useState<number>(5);
  const [curatedOnly, setCuratedOnly] = useState<boolean>(false);
  const [gradedOnly, setGradedOnly] = useState<boolean>(false);
  const [useMusic, setUseMusic] = useState<boolean>(true);

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

  // Calculate combo count (approximate): product of counts × format permutations
  const comboCount = Math.max(1, hookCount * bodyCount * productCount * ctaCount * formats.length * ratios.length);

  const personaData = personas.find((p) => p.id === selectedPersona);
  const pillarData = pillars.find((p) => p.id === selectedPillar);
  const formatData = formats.find((f) => f.id === selectedFormat);

  return (
    <div className="h-full flex overflow-hidden bg-zinc-950">
      {/* LEFT SIDEBAR */}
      <div className="w-72 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-100">Generate</h2>
            <button className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors">
              Edit strategy
            </button>
          </div>

          {/* Strategy Pills */}
          <div className="flex flex-wrap gap-2">
            <div className="px-2.5 py-1 rounded-full border border-teal-600/50 bg-teal-600/10 text-[10px] text-zinc-200">
              {personaData?.name}
            </div>
            <div className="px-2.5 py-1 rounded-full border border-emerald-600/50 bg-emerald-600/10 text-[10px] text-zinc-200">
              {pillarData?.name}
            </div>
            <div className="px-2.5 py-1 rounded-full border border-amber-600/50 bg-amber-600/10 text-[10px] text-zinc-200">
              {formatData?.name}
            </div>
            <div className="px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800/30 text-[10px] text-zinc-400">
              {selectedRatio}
            </div>
          </div>
        </div>

        {/* VARIATION TESTING */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-200 mb-3 uppercase tracking-wider">
            Variation Testing
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {variationTests.map((test) => (
              <button
                key={test.id}
                onClick={() => setSelectedVariation(test.id)}
                className={`p-3 rounded-lg border transition-all text-[11px] font-medium ${
                  selectedVariation === test.id
                    ? 'bg-purple-900/30 border-purple-500 text-purple-300'
                    : 'border-zinc-800 bg-zinc-800/20 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {test.label}
              </button>
            ))}
          </div>
        </div>

        {/* MANAGE CTAs */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-200 mb-2 uppercase tracking-wider">
            Manage CTAs
          </h3>
          <div className="text-[10px] text-zinc-500 p-2 border border-zinc-800 rounded bg-zinc-900/30">
            No CTAs excluded yet
          </div>
        </div>

        {/* CONTROLS */}
        <div className="p-4 space-y-4 border-b border-zinc-800">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={brandPrefix}
                onChange={(e) => setBrandPrefix(e.target.value)}
                className="w-full h-8 px-2 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex-1">
              <select
                value={selectedRatio}
                onChange={(e) => setSelectedRatio(e.target.value)}
                className="w-full h-8 px-2 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {ratios.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-zinc-300">Curated only</span>
              <button
                onClick={() => setCuratedOnly(!curatedOnly)}
                className={`relative w-9 h-5 rounded-full transition-colors ${curatedOnly ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${curatedOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-zinc-300">Graded only</span>
              <button
                onClick={() => setGradedOnly(!gradedOnly)}
                className={`relative w-9 h-5 rounded-full transition-colors ${gradedOnly ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${gradedOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-zinc-300">Music</span>
              <button
                onClick={() => setUseMusic(!useMusic)}
                className={`relative w-9 h-5 rounded-full transition-colors ${useMusic ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${useMusic ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Column Count
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min="3"
                max="10"
                value={columnCount}
                onChange={(e) => setColumnCount(parseInt(e.target.value))}
                className="flex-1 h-1.5 rounded-full bg-zinc-700 accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500 w-6">{columnCount}</span>
            </div>
          </div>
        </div>

        {/* AVAILABLE CLIPS */}
        <div className="p-4 border-b border-zinc-800 space-y-2">
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Available Clips
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff6b6b]" />
                <span className="text-zinc-300">Hook</span>
              </div>
              <span className="text-zinc-500 tabular-nums">{hookCount} <span className="text-zinc-600">/ {hookGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#6b8aff]" />
                <span className="text-zinc-300">Body</span>
              </div>
              <span className="text-zinc-500 tabular-nums">{bodyCount} <span className="text-zinc-600">/ {bodyGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f0a030]" />
                <span className="text-zinc-300">Product</span>
              </div>
              <span className="text-zinc-500 tabular-nums">{productCount} <span className="text-zinc-600">/ {productGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4ecdc4]" />
                <span className="text-zinc-300">CTA</span>
              </div>
              <span className="text-zinc-500 tabular-nums">{ctaCount} <span className="text-zinc-600">/ {ctaGradedCount}</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-zinc-400">Music tracks</span>
              <span className="text-zinc-500 tabular-nums">{musicCount}</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 mt-2">
            ~{comboCount.toLocaleString()} combos · ~10.3s each · 3:1 action:static
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <div className="p-4">
          <button className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-purple-600/20">
            Generate 5 Variations
          </button>
        </div>

        {/* TARGET PERSONA */}
        <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Target Persona
          </h3>
          <div className="space-y-2">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p.id)}
                className={`w-full px-3 py-2 rounded-lg border text-[11px] font-medium transition-all text-left ${
                  selectedPersona === p.id
                    ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-800/20 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT PILLAR */}
        <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Content Pillar
          </h3>
          <div className="space-y-2">
            {pillars.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPillar(p.id)}
                className={`w-full px-3 py-2 rounded-lg border text-[11px] font-medium transition-all text-left ${
                  selectedPillar === p.id
                    ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-800/20 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* AD FORMAT */}
        <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Ad Format
          </h3>
          <div className="space-y-2">
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFormat(f.id)}
                className={`w-full px-3 py-2 rounded-lg border text-[11px] font-medium transition-all text-left ${
                  selectedFormat === f.id
                    ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-800/20 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto flex flex-col bg-zinc-950">
        {reiterateContext && (
          <div className="mx-4 mt-4 p-4 bg-amber-600/10 border border-amber-600/30 rounded-lg">
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
          <div className="text-center px-6 max-w-md">
            <h2 className="text-lg font-semibold text-zinc-100 mb-3">
              Strategy-Driven Generation
            </h2>
            <p className="text-[12px] text-zinc-400 leading-relaxed">
              Select your target persona, content pillar, and ad format on the left.
              Each variation follows the AIDA framework with auto-generated text
              overlays, enforced action-to-static shot ratios, and persona-aligned
              clip selection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
