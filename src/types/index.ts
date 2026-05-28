export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // person IDs
}

export type TipOption = 0 | 10 | 15 | 'custom';
export type Currency = 'ARS' | 'USD' | 'CLP' | 'EUR';

export interface SplitState {
  people: Person[];
  items: Item[];
  tip: number; // final tip percentage (0-100)
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
}

export type OcrProvider = 'claude' | 'google' | 'tesseract';

export interface OcrResult {
  items: ScannedItem[];
  provider: OcrProvider;
  raw?: string;
}
