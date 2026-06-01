import type { ScannedItem } from '@/types';

// Palabras que indican que la línea NO es un ítem (totales, impuestos, etc.)
const IGNORE_KEYWORDS = [
  'total', 'subtotal', 'sub total', 'propina', 'tip', 'iva', 'tax',
  'impuesto', 'descuento', 'discount', 'cambio', 'vuelto', 'efectivo',
  'tarjeta', 'débito', 'crédito', 'transferencia', 'ticket', 'boleta',
  'factura', 'rut', 'mesa', 'cajero', 'gracias', 'table', 'fecha',
  'hora', 'folio', 'copia', 'local', 'dirección', 'teléfono', 'servicio',
];

// Formatos de precio que detectamos:
// 1.200 / 1,200 / 1.200,00 / 1200 / $1200 / $ 1.200
const PRICE_PATTERNS = [
  /\$?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/g,  // 1.200 / 1,200 / 1.200,00
  /\$?\s?(\d{4,7}(?:[.,]\d{2})?)/g,                 // 12000 / 12000.00
  /\$?\s?(\d{1,3}(?:[.,]\d{2}))/g,                  // 12,50 / 12.50
];

function parsePrice(raw: string): number {
  // Normaliza separadores: detecta si la coma es decimal o de miles
  let clean = raw.replace(/\$/g, '').replace(/\s/g, '');

  // Si tiene punto Y coma: 1.200,50 → miles=punto, decimal=coma
  if (/\d\.\d{3},\d{2}$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  // Si tiene solo coma con 2 decimales: 1200,50 → decimal=coma
  else if (/,\d{2}$/.test(clean)) {
    clean = clean.replace(',', '.');
  }
  // Si tiene solo punto con 2 decimales: 1200.50 → decimal=punto
  else if (/\.\d{2}$/.test(clean)) {
    // ya está bien
  }
  // Si tiene punto como separador de miles: 1.200 → quitar punto
  else if (/^\d{1,3}\.\d{3}$/.test(clean)) {
    clean = clean.replace('.', '');
  }
  // Si tiene coma como separador de miles: 1,200 → quitar coma
  else if (/^\d{1,3},\d{3}$/.test(clean)) {
    clean = clean.replace(',', '');
  }

  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function extractPriceFromLine(line: string): { price: number; raw: string } | null {
  for (const pattern of PRICE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...line.matchAll(pattern)];
    if (matches.length > 0) {
      // Toma el último número de la línea (suele ser el precio, no la cantidad)
      const last = matches[matches.length - 1];
      const price = parsePrice(last[1] ?? last[0]);
      if (price > 0) return { price, raw: last[0] };
    }
  }
  return null;
}

function cleanItemName(line: string, priceRaw: string): string {
  return line
    .replace(priceRaw, '')          // quita el precio
    .replace(/^\d+\s*[xX]\s*/,'')   // quita cantidad al inicio: "2x " "3 x "
    .replace(/\s+/g, ' ')
    .replace(/[|_\-]{2,}/g, '')     // quita separadores visuales ---- ||||
    .trim();
}

function isIgnoredLine(line: string): boolean {
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
    if (isIgnoredLine(line)) continue;

    const found = extractPriceFromLine(line);
    if (!found) continue;

    const name = cleanItemName(line, found.raw);
    if (!name || name.length < 2) continue;
    if (/^\d+$/.test(name)) continue; // solo números → no es un ítem

    items.push({ name, price: found.price });
  }

  return items;
}

// Preprocesa imagen con Canvas para mejorar el OCR:
// convierte a escala de grises y aumenta contraste
export async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Escala máxima 1800px para no sobrecargar Tesseract
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Escala de grises + contraste
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Contraste: empuja píxeles hacia blanco o negro
        const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
        d[i] = d[i + 1] = d[i + 2] = contrast;
      }
      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}
