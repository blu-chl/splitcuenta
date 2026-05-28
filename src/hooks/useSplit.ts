'use client';
import { useState, useCallback } from 'react';
import type { SplitState, Person, Item, Currency } from '@/types';
import { PERSON_COLORS, generateId } from '@/lib/calculations';

const defaultState: SplitState = {
  people: [],
  items: [],
  tip: 0,
  currency: 'ARS',
};

export function useSplit(initial?: SplitState) {
  const [state, setState] = useState<SplitState>(initial ?? defaultState);

  // People
  const addPerson = useCallback(() => {
    setState((s) => {
      const color = PERSON_COLORS[s.people.length % PERSON_COLORS.length];
      const person: Person = { id: generateId(), name: '', color };
      return { ...s, people: [...s.people, person] };
    });
  }, []);

  const updatePerson = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  }, []);

  const removePerson = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      items: s.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((pid) => pid !== id),
      })),
    }));
  }, []);

  // Items
  const addItem = useCallback((name = '', price = 0) => {
    setState((s) => {
      const item: Item = {
        id: generateId(),
        name,
        price,
        assignedTo: s.people.map((p) => p.id), // default: everyone
      };
      return { ...s, items: [...s.items, item] };
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Pick<Item, 'name' | 'price'>>) => {
    setState((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setState((s) => ({ ...s, items: s.items.filter((item) => item.id !== id) }));
  }, []);

  const togglePersonOnItem = useCallback((itemId: string, personId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((item) => {
        if (item.id !== itemId) return item;
        const has = item.assignedTo.includes(personId);
        const next = has
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId];
        // at least one person must remain
        return { ...item, assignedTo: next.length ? next : item.assignedTo };
      }),
    }));
  }, []);

  const addScannedItems = useCallback((scanned: { name: string; price: number }[]) => {
    setState((s) => {
      const newItems: Item[] = scanned.map((si) => ({
        id: generateId(),
        name: si.name,
        price: si.price,
        assignedTo: s.people.map((p) => p.id),
      }));
      return { ...s, items: [...s.items, ...newItems] };
    });
  }, []);

  // Tip & currency
  const setTip = useCallback((tip: number) => {
    setState((s) => ({ ...s, tip }));
  }, []);

  const setCurrency = useCallback((currency: Currency) => {
    setState((s) => ({ ...s, currency }));
  }, []);

  const reset = useCallback(() => setState(defaultState), []);

  return {
    state,
    setState,
    addPerson,
    updatePerson,
    removePerson,
    addItem,
    updateItem,
    removeItem,
    togglePersonOnItem,
    addScannedItems,
    setTip,
    setCurrency,
    reset,
  };
}
