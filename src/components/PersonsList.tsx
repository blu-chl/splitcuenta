'use client';
import type { Person } from '@/types';
import SectionCard from './SectionCard';

interface Props {
  people: Person[];
  onAdd: () => void;
  onUpdate: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function initials(name: string) {
  return name.trim()
    ? name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
}

export default function PersonsList({ people, onAdd, onUpdate, onRemove }: Props) {
  return (
    <SectionCard
      step={1}
      title="¿Quiénes comen?"
      hint={people.length > 0 ? `${people.length} persona${people.length !== 1 ? 's' : ''}` : undefined}
      action={
        people.length > 0 && (
          <button
            onClick={onAdd}
            className="text-sm font-medium text-[#C8956C] hover:text-white hover:bg-[#C8956C] border border-[#C8956C] rounded-full px-3.5 py-1.5 transition-colors"
          >
            + Agregar
          </button>
        )
      }
    >
      {people.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="text-4xl">👥</span>
          <p className="text-sm text-[#8B7E74]">Agrega a las personas para empezar a dividir</p>
          <button
            onClick={onAdd}
            className="bg-[#1A1410] hover:bg-[#2d2420] active:scale-[0.98] text-white text-sm font-medium rounded-full px-5 py-2.5 transition-all"
          >
            + Agregar primera persona
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-white shadow-sm"
                style={{ backgroundColor: person.color }}
              >
                {initials(person.name)}
              </div>
              <input
                type="text"
                value={person.name}
                onChange={(e) => onUpdate(person.id, e.target.value)}
                placeholder="Nombre..."
                className="flex-1 text-sm border border-[#E8E2D9] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#C8956C] focus:bg-white bg-[#FAF7F2] placeholder:text-[#8B7E74] transition-colors"
              />
              <button
                onClick={() => onRemove(person.id)}
                className="text-[#8B7E74] hover:text-red-500 hover:bg-red-50 rounded-full transition-colors p-2"
                aria-label="Eliminar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
