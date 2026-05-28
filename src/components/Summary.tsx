'use client';
import { useState } from 'react';
import type { SplitState, PersonSummary } from '@/types';
import { calculateSplit, formatCurrency, totalBill } from '@/lib/calculations';

interface Props {
  state: SplitState;
}

export default function Summary({ state }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const summaries = calculateSplit(state);
  const total = totalBill(state);
  const { currency } = state;

  if (state.people.length === 0 || state.items.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-sm">
        <h2 className="font-heading text-lg text-[#1A1410] mb-2">Resumen</h2>
        <p className="text-[#8B7E74] text-sm text-center py-4">
          Agregá personas e ítems para ver el resumen
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg text-[#1A1410]">Resumen</h2>
        <span className="text-sm text-[#8B7E74]">
          Total: <span className="font-medium text-[#1A1410]">{formatCurrency(total, currency)}</span>
        </span>
      </div>

      <ul className="space-y-2">
        {summaries.map((s: PersonSummary) => (
          <li key={s.person.id}>
            <button
              onClick={() => setExpanded(expanded === s.person.id ? null : s.person.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAF7F2] transition-colors text-left"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: s.person.color }}
              >
                {(s.person.name || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {s.person.name || 'Sin nombre'}
                </p>
                {state.tip > 0 && (
                  <p className="text-xs text-[#8B7E74]">
                    {formatCurrency(s.subtotal, currency)} + {formatCurrency(s.tipAmount, currency)} propina
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-lg text-[#C8956C]">
                  {formatCurrency(s.total, currency)}
                </span>
                <svg
                  className={`w-4 h-4 text-[#8B7E74] transition-transform ${expanded === s.person.id ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expanded === s.person.id && s.items.length > 0 && (
              <div className="ml-12 mr-3 mb-2 space-y-1">
                {s.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-[#8B7E74]">
                    <span className="truncate">{item.name}</span>
                    <span className="ml-2 flex-shrink-0">{formatCurrency(item.share, currency)}</span>
                  </div>
                ))}
                {state.tip > 0 && (
                  <div className="flex justify-between text-xs text-[#C8956C]">
                    <span>Propina ({state.tip}%)</span>
                    <span>{formatCurrency(s.tipAmount, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
