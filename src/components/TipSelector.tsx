'use client';
import { useState } from 'react';
import type { Currency } from '@/types';

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

  return (
    <section className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-sm space-y-3">
      <h2 className="font-heading text-lg text-[#1A1410]">Propina & Moneda</h2>

      {/* Propina */}
      <div>
        <p className="text-xs text-[#8B7E74] mb-2 uppercase tracking-wide">Propina</p>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={{
                backgroundColor: !customMode && tip === p ? '#1A1410' : '#FAF7F2',
                color: !customMode && tip === p ? 'white' : '#1A1410',
                borderColor: '#E8E2D9',
              }}
            >
              {p === 0 ? 'Sin propina' : `${p}%`}
              {p === 20 && <span className="ml-1 text-xs opacity-60">(CL)</span>}
            </button>
          ))}
          <button
            onClick={handleCustom}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all border"
            style={{
              backgroundColor: customMode ? '#1A1410' : '#FAF7F2',
              color: customMode ? 'white' : '#1A1410',
              borderColor: '#E8E2D9',
            }}
          >
            Otro
          </button>
        </div>
        {customMode && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={customVal}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="ej: 12"
              min="0"
              max="100"
              className="w-24 text-sm border border-[#E8E2D9] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2]"
            />
            <span className="text-[#8B7E74] text-sm">%</span>
          </div>
        )}
        {!customMode && !isPreset && (
          <p className="text-xs text-[#8B7E74] mt-1">Propina personalizada: {tip}%</p>
        )}
      </div>

      {/* Moneda */}
      <div>
        <p className="text-xs text-[#8B7E74] mb-2 uppercase tracking-wide">Moneda</p>
        <div className="flex gap-2 flex-wrap">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => onCurrencyChange(c)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={{
                backgroundColor: currency === c ? '#C8956C' : '#FAF7F2',
                color: currency === c ? 'white' : '#1A1410',
                borderColor: '#E8E2D9',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
