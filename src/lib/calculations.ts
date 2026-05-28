import type { SplitState, PersonSummary } from '@/types';

export function calculateSplit(state: SplitState): PersonSummary[] {
  const { people, items, tip } = state;

  return people.map((person) => {
    const personItems: { name: string; share: number }[] = [];
    let subtotal = 0;

    for (const item of items) {
      if (item.assignedTo.includes(person.id)) {
        const share = item.price / item.assignedTo.length;
        personItems.push({ name: item.name, share });
        subtotal += share;
      }
    }

    const tipMultiplier = tip / 100;
    const grandTotal = items.reduce((sum, item) => {
      if (item.assignedTo.includes(person.id)) {
        return sum + item.price / item.assignedTo.length;
      }
      return sum;
    }, 0);

    const tipAmount = grandTotal * tipMultiplier;

    return {
      person,
      subtotal,
      tipAmount,
      total: subtotal + tipAmount,
      items: personItems,
    };
  });
}

export function totalBill(state: SplitState): number {
  const subtotal = state.items.reduce((sum, item) => sum + item.price, 0);
  return subtotal * (1 + state.tip / 100);
}

export function formatCurrency(amount: number, currency: string): string {
  const localeMap: Record<string, string> = {
    ARS: 'es-AR',
    USD: 'en-US',
    CLP: 'es-CL',
    EUR: 'es-ES',
  };
  return new Intl.NumberFormat(localeMap[currency] ?? 'es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

export const PERSON_COLORS = [
  '#E57373', '#64B5F6', '#81C784', '#FFD54F',
  '#BA68C8', '#4DB6AC', '#FF8A65', '#A1887F',
];

export function encodeState(state: SplitState): string {
  return btoa(encodeURIComponent(JSON.stringify(state)));
}

export function decodeState(encoded: string): SplitState | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch {
    return null;
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}
