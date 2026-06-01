import type { ScannedItem } from '@/types';

const IGNORE_KEYWORDS = [
  'total', 'subtotal', 'sub total', 'propina', 'tip', 'iva', 'tax',
  'impuesto', 'descuento', 'discount', 'cambio', 'vuelto', 'efectivo',
  'tarjeta', 'débito', 'crédito', 'transferencia', 'ticket', 'boleta',
  'factura', 'rut', 'mesa', 'cajero', 'gracias', 'table', 'fecha',
  'hora', 'folio', 'copia', 'local', 'dirección', 'teléfono', 'servicio',
];

const PRICE_PATTERNS = [
  /\$?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/g,
  /\$?\s?(\d{4,7}(?:[.,]\d{2})?)/g,
  /\$?\s?(\d{1,3}(?:[.,]\d{2}))/g,
];

// Detecta cantidad al inicio de la línea: "2 ", "2x ", "3 x ", "02 "
const QTY_RE = /^0*(\d{1,2})\s*[xX]?\s+(?=[a-zA-ZáéíóúÁÉÍÓÚñÑ])/;

function parsePrice(raw: string): number {
  let clean = raw.replace(/\$/g, '').replace(/\s/g, '');
  if (/\d\.\d{3},\d{2}$/.test(clean))      clean = clean.replace(/\./g, '').replace(',', '.');
  else if (/,\d{2}$/.test(clean))           clean = clean.replace(',', '.');
  else if (/^\d{1,3}\.\d{3}$/.test(clean)) clean = clean.replace('.', '');
  else if (/^\d{1,3},\d{3}$/.test(clean))  clean = clean.replace(',', '');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function extractPriceFromLine(line: string): { price: number; raw: string } | null {
  for (const pattern of PRICE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...line.matchAll(pattern)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const price = parsePrice(last[1] ?? last[0]);
      if (price > 0) return { price, raw: last[0] };
    }
  }
  return null;
}

function extractQuantity(line: string): { qty: number; rest: string } {
  const match = line.match(QTY_RE);
  if (match) {
    const qty = parseInt(match[1]);
    if (qty >= 1 && qty <= 99) {
      return { qty, rest: line.slice(match[0].length) };
    }
  }
  return { qty: 1, rest: line };
}

function cleanName(line: string, priceRaw: string): string {
  return line
    .replace(priceRaw, '')
    .replace(/\s+/g, ' ')
    .replace(/[|_\-]{2,}/g, '')
    .trim();
}

function isIgnored(line: string): boolean {
  const lower = line.toLowerCase();
  return IGNORE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function parseReceiptText(rawText: string): ScannedItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const items: ScannedItem[] = [];

  for (const line of lines) {
    if (isIgnored(line)) continue;

    // Extrae cantidad al inicio
    const { qty, rest } = extractQuantity(line);

    // Busca precio en la línea (usa el resto sin la cantidad)
    const found = extractPriceFromLine(rest);
    if (!found) continue;

    const name = cleanName(rest, found.raw);
    if (!name || name.length < 2) continue;
    if (/^\d+$/.test(name)) continue;

    // Si hay cantidad > 1, la incluye en el nombre y multiplica el precio
    const finalName = qty > 1 ? `${qty}× ${name}` : name;
    const finalPrice = qty > 1 ? found.price * qty : found.price;

    items.push({ name: finalName, price: finalPrice, quantity: qty });
  }

  return items;
}

export async function preprocessImage(source: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const isFile = source instanceof File;
    const url = isFile ? URL.createObjectURL(source as File) : (source as string);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
        d[i] = d[i + 1] = d[i + 2] = contrast;
      }
      ctx.putImageData(imageData, 0, 0);
      if (isFile) URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}
