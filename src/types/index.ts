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

// ─── Lectura de boletas ───────────────────────────────────────────────────────

export interface Bbox { x0: number; y0: number; x1: number; y1: number }

/** Una línea tal como la entrega el OCR (texto, confianza 0-100 y posición). */
export interface OcrLine {
  text: string;
  confidence: number;
  bbox?: Bbox;
}

export type LineKind =
  | 'item' | 'discount' | 'qty'
  | 'subtotal' | 'total' | 'tip' | 'tax' | 'payment'
  | 'meta' | 'text' | 'ignored';

export interface ParsedLine {
  text: string;
  kind: LineKind;
  confidence: number;
  bbox?: Bbox;
  amount?: number;
  itemIndex?: number; // índice en ParsedReceipt.items si la línea aportó a un ítem
}

export interface ReceiptItem extends ScannedItem {
  quantity: number;
  confidence: number;
  lowConfidence: boolean;
  lines: number[]; // índices en ParsedReceipt.lines
  altPrice?: number; // precio alternativo si cantidad × unitario no calzaba con el total
}

export interface ReceiptMeta {
  merchant?: string;
  rut?: string;
  rutValid?: boolean;
  docType?: 'boleta' | 'factura' | 'precuenta' | 'comprobante';
  folio?: string;
  fecha?: string; // ISO yyyy-mm-dd
  hora?: string;  // hh:mm
  subtotal?: number;
  total?: number;
  totalWithTip?: number;
  tip?: number;
  tipPercent?: number;
  neto?: number;
  iva?: number;
}

export interface ReceiptCheck {
  status: 'ok' | 'mismatch' | 'unknown';
  itemsSum: number;
  target?: number;
  targetLabel?: string;
  diff?: number; // target − suma de ítems (positivo = faltan ítems)
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  meta: ReceiptMeta;
  lines: ParsedLine[];
  check: ReceiptCheck;
}
