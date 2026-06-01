'use client';
import { useState } from 'react';
import type { Item, Person } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import ScannerModal from './ScannerModal';
import type { ScannedItem } from '@/types';

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

  return (
    <section className="bg-white rounded-2xl border border-[#E8E2D9] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg text-[#1A1410]">Ítems</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="text-sm text-[#8B7E74] hover:text-[#C8956C] font-medium flex items-center gap-1 transition-colors"
          >
            📸 Escanear
          </button>
          <button
            onClick={() => onAdd()}
            className="text-sm text-[#C8956C] hover:text-[#b07a54] font-medium flex items-center gap-1 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Agregar
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-[#8B7E74] text-sm text-center py-4">
          Agrega ítems manualmente o escanea el ticket
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const unassigned = item.assignedTo.length === 0;
            return (
              <li
                key={item.id}
                className="rounded-xl p-3 border transition-colors"
                style={{
                  backgroundColor: unassigned ? '#FFF8F4' : '#FAF7F2',
                  borderColor: unassigned ? '#F5C5A3' : '#E8E2D9',
                }}
              >
                {/* Nombre y precio */}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                    placeholder="Nombre del ítem..."
                    className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[#8B7E74] min-w-0"
                  />
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => onUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-24 text-sm text-right bg-transparent focus:outline-none placeholder:text-[#8B7E74] font-medium flex-shrink-0"
                  />
                  <button
                    onClick={() => onRemove(item.id)}
                    className="text-[#8B7E74] hover:text-red-500 transition-colors flex-shrink-0"
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
                      <span className="text-xs text-[#C8956C] font-medium mr-1">Sin asignar →</span>
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
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
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
    </section>
  );
}
