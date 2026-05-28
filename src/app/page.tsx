'use client';
import { useEffect } from 'react';
import { useSplit } from '@/hooks/useSplit';
import { decodeState } from '@/lib/calculations';
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
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-20">
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
    </>
  );
}
