'use client';
import { useState } from 'react';
import type { Currency } from '@/types';
import SectionCard from './SectionCard';

const PRESETS = [0, 10, 15, 20] as const;
const CURRENCIES: Currency[] = ['CLP', 'ARS', 'USD', 'EUR'];

interface Props {
  tip: number;
  currency: Currency;
  onTipChange: (tip: number) => void;
  onCurrencyChange: (c: Currency) => void;
}

export default function TipSelector({ tip, currency, onTipChange, onCurrencyChange }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const handlePreset = (val: number) => {
    setCustomMode(false);
    setCustomVal('');
    onTipChange(val);
  };

  const handleCustom = () => {
    setCustomMode(true);
    setCustomVal(tip.toString());
  };

  const handleCustomChange = (val: string) => {
    setCustomVal(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0 && n <= 100) onTipChange(n);
  };

  const isPreset = PRESETS.includes(tip as typeof PRESETS[number]);

  const pill = (active: boolean, color: string) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 border ${
      active
        ? `${color} text-white border-transparent shadow-sm`
        : 'bg-[#FAF7F2] text-[#1A1410] border-[#E8E2D9] hover:border-[#C8956C]'
    }`;

  return (
    <SectionCard step={3} title="Propina y moneda" delay={120}>
      <div className="space-y-5">
        {/* Propina */}
        <div>
          <p className="text-[11px] font-semibold text-[#8B7E74] mb-2 uppercase tracking-widest">Propina</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                aria-pressed={!customMode && tip === p}
                className={pill(!customMode && tip === p, 'bg-[#1A1410]')}
              >
                {p === 0 ? 'Sin propina' : `${p}%`}
                {p === 20 &&<span className="ml-1 text-xs opacity-60">(CL)</span>}
              </button>
            ))}
            <button
              onClick={handleCustom}
              aria-pressed={customMode}
              className={pill(customMode, 'bg-[#1A1410]')}
            >
              Otro
            </button>
          </div>
          {customMode && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                value={customVal}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="ej: 12"
                min="0"
                max="100"
                autoFocus
                className="w-24 text-sm border border-[#E8E2D9] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2]"
              />
              <span className="text-[#8B7E74] text-sm">%</span>
            </div>
          )}
          {!customMode && !isPreset && (
            <p className="text-xs text-[#8B7E74] mt-2">Propina personalizada: {tip}%</p>
          )}
        </div>

        {/* Moneda */}
        <div>
          <p className="text-[11px] font-semibold text-[#8B7E74] mb-2 uppercase tracking-widest">Moneda</p>
          <div className="flex gap-2 flex-wrap">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => onCurrencyChange(c)}
                aria-pressed={currency === c}
                className={pill(currency === c, 'bg-[#C8956C]')}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
