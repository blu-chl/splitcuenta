export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // person IDs — vacío = sin asignar
}

export type TipOption = 0 | 10 | 15 | 20 | 'custom';
export type Currency = 'ARS' | 'USD' | 'CLP' | 'EUR';

export interface SplitState {
  people: Person[];
  items: Item[];
  tip: number;
  currency: Currency;
}

export interface PersonSummary {
  person: Person;
  subtotal: number;
  tipAmount: number;
  total: number;
  items: { name: string; share: number }[];
}

export interface ScannedItem {
  name: string;
  price: number;
  quantity?: number;
}
