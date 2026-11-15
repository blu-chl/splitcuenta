'use client';
import { useEffect } from 'react';
import { useSplit } from '@/hooks/useSplit';
import { decodeState, formatCurrency, totalBill } from '@/lib/calculations';
import Header from '@/components/Header';
import PersonsList from '@/components/PersonsList';
import ItemsList from '@/components/ItemsList';
import TipSelector from '@/components/TipSelector';
import Summary from '@/components/Summary';

export default function Home() {
  const {
    state, setState,
    addPerson, updatePerson, removePerson,
    addItem, updateItem, removeItem,
    togglePersonOnItem, addScannedItems,
    setTip, setCurrency,
  } = useSplit();

  // Load shared state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s');
    if (encoded) {
      const decoded = decodeState(encoded);
      if (decoded) setState(decoded);
    }
  }, [setState]);

  return (
    <>
      <Header state={state} />
      <main className="max-w-lg mx-auto px-4 pt-8 space-y-5 pb-28">
        <div className="animate-rise text-center space-y-1.5 pb-2">
          <h1 className="font-heading text-4xl leading-tight text-[#1A1410]">
            Divide la cuenta, <em className="text-[#C8956C]">sin drama</em>
          </h1>
          <p className="text-sm text-[#8B7E74]">
            Escanea la boleta, asigna cada ítem y listo.
          </p>
        </div>
        <PersonsList
          people={state.people}
          onAdd={addPerson}
          onUpdate={updatePerson}
          onRemove={removePerson}
        />
        <ItemsList
          items={state.items}
          people={state.people}
          currency={state.currency}
          onAdd={addItem}
          onUpdate={updateItem}
          onRemove={removeItem}
          onTogglePerson={togglePersonOnItem}
          onAddScanned={addScannedItems}
        />
        <TipSelector
          tip={state.tip}
          currency={state.currency}
          onTipChange={setTip}
          onCurrencyChange={setCurrency}
        />
        <Summary state={state} />
      </main>

      {state.items.length > 0 && state.people.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-[#1A1410]/95 backdrop-blur text-white border-t border-[#C8956C]/40">
          <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-white/70">
              Total · {state.people.length} persona{state.people.length !== 1 ? 's' : ''}
            </span>
            <span className="font-heading text-2xl text-[#E8C5A8] tabular-nums">
              {formatCurrency(totalBill(state), state.currency)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
