'use client';
import { useState } from 'react';
import type { Item, Person, ScannedItem } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import ScannerModal from './ScannerModal';
import SectionCard from './SectionCard';

interface Props {
  items: Item[];
  people: Person[];
  currency: string;
  onAdd: (name?: string, price?: number) => void;
  onUpdate: (id: string, patch: Partial<Pick<Item, 'name' | 'price'>>) => void;
  onRemove: (id: string) => void;
  onTogglePerson: (itemId: string, personId: string) => void;
  onAddScanned: (items: ScannedItem[]) => void;
}

export default function ItemsList({
  items, people, currency, onAdd, onUpdate, onRemove, onTogglePerson, onAddScanned,
}: Props) {
  const [showScanner, setShowScanner] = useState(false);
  const unassignedCount = items.filter((i) => i.assignedTo.length === 0).length;

  return (
    <SectionCard
      title="Asigna los gastos"
      hint={
        items.length === 0
          ? undefined
          : unassignedCount > 0
            ? `${items.length} ítems · ${unassignedCount} sin asignar`
            : `${items.length} ítems · todo asignado ✓`
      }
      delay={60}
      action={
        items.length > 0 && (
          <>
            <button
              onClick={() => setShowScanner(true)}
              className="text-sm font-medium bg-[#C8956C] hover:bg-[#b07a54] text-white rounded-full px-3.5 py-1.5 transition-colors"
            >
              📸 Escanear
            </button>
            <button
              onClick={() => onAdd()}
              className="text-sm font-medium text-[#C8956C] hover:text-white hover:bg-[#C8956C] border border-[#C8956C] rounded-full px-3.5 py-1.5 transition-colors"
            >
              + Ítem
            </button>
          </>
        )
      }
    >
      {items.length === 0 ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-3 bg-[#C8956C] hover:bg-[#b07a54] active:scale-[0.98] text-white rounded-2xl py-5 shadow-md transition-all"
          >
            <span className="text-3xl">📸</span>
            <span className="text-lg font-semibold">Escanear boleta</span>
          </button>
          <div className="flex items-center gap-3 text-xs text-[#8B7E74]">
            <span className="flex-1 h-px bg-[#E8E2D9]" />
            o
            <span className="flex-1 h-px bg-[#E8E2D9]" />
          </div>
          <button
            onClick={() => onAdd()}
            className="w-full text-sm font-medium text-[#1A1410] border-2 border-[#1A1410] hover:bg-[#FAF7F2] rounded-2xl py-3 transition-colors"
          >
            ✍️ Agregar a mano
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const unassigned = item.assignedTo.length === 0;
            return (
              <li
                key={item.id}
                className="rounded-2xl p-3.5 border transition-colors"
                style={{
                  backgroundColor: unassigned ? '#FFF8F4' : '#FAF7F2',
                  borderColor: unassigned ? '#F5C5A3' : '#E8E2D9',
                }}
              >
                {/* Nombre y precio */}
                <div className="flex items-center gap-2 mb-2.5">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                    placeholder="Nombre del ítem..."
                    className="flex-1 text-[15px] font-medium bg-transparent focus:outline-none placeholder:text-[#8B7E74] placeholder:font-normal min-w-0"
                  />
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-24 text-[15px] text-right bg-white border border-[#E8E2D9] focus:border-[#C8956C] rounded-lg px-2 py-1 focus:outline-none placeholder:text-[#8B7E74] font-semibold flex-shrink-0 transition-colors"
                  />
                  <button
                    onClick={() => onRemove(item.id)}
                    aria-label="Eliminar ítem"
                    className="text-[#8B7E74] hover:text-red-500 hover:bg-red-50 rounded-full p-1.5 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Asignación */}
                {people.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {unassigned && (
                      <span className="text-xs text-[#C8956C] font-semibold mr-1">¿Quién? →</span>
                    )}
                    {people.map((person) => {
                      const assigned = item.assignedTo.includes(person.id);
                      const share = assigned && item.assignedTo.length > 1
                        ? formatCurrency(item.price / item.assignedTo.length, currency)
                        : null;
                      return (
                        <button
                          key={person.id}
                          onClick={() => onTogglePerson(item.id, person.id)}
                          aria-pressed={assigned}
                          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
                          style={{
                            backgroundColor: assigned ? person.color : 'transparent',
                            color: assigned ? 'white' : person.color,
                            border: `1.5px solid ${person.color}`,
                            opacity: assigned ? 1 : 0.65,
                          }}
                        >
                          {person.name || '?'}
                          {share && <span className="opacity-80">{share}</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#8B7E74]">Agrega personas para asignar</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showScanner && (
        <ScannerModal
          onScan={onAddScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </SectionCard>
  );
}
