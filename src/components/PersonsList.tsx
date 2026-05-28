'use client';
import type { Person } from '@/types';

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
    <section className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg text-[#1A1410]">Personas</h2>
        <button
          onClick={onAdd}
          className="text-sm text-[#C8956C] hover:text-[#b07a54] font-medium flex items-center gap-1 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Agregar
        </button>
      </div>

      {people.length === 0 ? (
        <p className="text-[#8B7E74] text-sm text-center py-4">
          Agregá personas para empezar a dividir
        </p>
      ) : (
        <ul className="space-y-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: person.color }}
              >
                {initials(person.name)}
              </div>
              <input
                type="text"
                value={person.name}
                onChange={(e) => onUpdate(person.id, e.target.value)}
                placeholder="Nombre..."
                className="flex-1 text-sm border border-[#E8E2D9] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2] placeholder:text-[#8B7E74]"
              />
              <button
                onClick={() => onRemove(person.id)}
                className="text-[#8B7E74] hover:text-red-500 transition-colors p-1"
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
    </section>
  );
}
