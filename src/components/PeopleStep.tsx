'use client';
import type { Person } from '@/types';
import SectionCard from './SectionCard';

interface Props {
  people: Person[];
  itemCount: number;
  onCount: (n: number) => void;
  onName: (id: string, name: string) => void;
  onContinue: () => void;
}

const MIN = 2;
const MAX = 20;

export default function PeopleStep({ people, itemCount, onCount, onName, onContinue }: Props) {
  const count = people.length;
  const round = 'w-12 h-12 rounded-full border-2 border-[#1A1410] text-2xl leading-none flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 hover:bg-[#1A1410] hover:text-white';

  return (
    <SectionCard
      title="¿Cuántas personas son?"
      hint={itemCount > 0 ? `${itemCount} gasto${itemCount !== 1 ? 's' : ''} listos para asignar` : undefined}
    >
      <div className="flex items-center justify-center gap-6 py-3">
        <button className={round} onClick={() => onCount(count - 1)} disabled={count <= MIN} aria-label="Una persona menos">−</button>
        <span className="font-heading text-6xl w-20 text-center tabular-nums" aria-live="polite">{count}</span>
        <button className={round} onClick={() => onCount(count + 1)} disabled={count >= MAX} aria-label="Una persona más">+</button>
      </div>

      <p className="text-[11px] font-semibold text-[#8B7E74] mt-4 mb-2 uppercase tracking-widest">
        Nombres (opcional)
      </p>
      <ul className="space-y-2.5">
        {people.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: p.color }}
            >
              {(p.name.trim()[0] ?? String(i + 1)).toUpperCase()}
            </span>
            <input
              type="text"
              value={p.name}
              onChange={(e) => onName(p.id, e.target.value)}
              placeholder={`Persona ${i + 1}`}
              className="flex-1 text-sm border border-[#E8E2D9] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#C8956C] focus:bg-white bg-[#FAF7F2] placeholder:text-[#8B7E74] transition-colors"
            />
          </li>
        ))}
      </ul>

      <button
        onClick={onContinue}
        className="w-full mt-5 bg-[#1A1410] hover:bg-[#2d2420] active:scale-[0.98] text-white rounded-2xl py-4 text-base font-semibold transition-all"
      >
        Continuar → asignar gastos
      </button>
    </SectionCard>
  );
}
