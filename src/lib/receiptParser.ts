import type { ScannedItem } from '@/types';

// ─── Parser de texto ──────────────────────────────────────────────────────────

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
  /\$?\s?(\d{1,3}[.,]\d{2})/g,
];

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
    if (qty >= 1 && qty <= 99) return { qty, rest: line.slice(match[0].length) };
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

export function parseReceiptText(rawText: string): ScannedItem[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  const items: ScannedItem[] = [];

  for (const line of lines) {
    if (IGNORE_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))) continue;
    const { qty, rest } = extractQuantity(line);
    const found = extractPriceFromLine(rest);
    if (!found) continue;
    const name = cleanName(rest, found.raw);
    if (!name || name.length < 2 || /^\d+$/.test(name)) continue;
    items.push({
      name: qty > 1 ? `${qty}× ${name}` : name,
      price: qty > 1 ? found.price * qty : found.price,
      quantity: qty,
    });
  }
  return items;
}

// ─── Preprocesamiento de imagen ───────────────────────────────────────────────

/**
 * Umbralización adaptativa con tabla de área integral.
 * Maneja iluminación despareja (sombras, fotos torcidas, papel brillante).
 * Mucho mejor que un simple ajuste de contraste global.
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize = 25,
  C = 12,
): Uint8ClampedArray {
  const half = Math.floor(blockSize / 2);

  // Tabla de área integral para calcular medias locales en O(1)
  const integral = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const gray = data[i * 4];
      integral[i] = gray
        + (x > 0 ? integral[i - 1] : 0)
        + (y > 0 ? integral[i - width] : 0)
        - (x > 0 && y > 0 ? integral[i - width - 1] : 0);
    }
  }

  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = data[i];

      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const ii = y2 * width + x2;
      const sum = integral[ii]
        - (x1 > 0 ? integral[y2 * width + x1 - 1] : 0)
        - (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0)
        + (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * width + x1 - 1] : 0);

      const mean = sum / count;
      const val = gray > mean - C ? 255 : 0;
      out[i] = out[i + 1] = out[i + 2] = val;
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Sharpen con kernel de convolución 3×3.
 * Hace los bordes de las letras más nítidos antes del umbral.
 */
function sharpen(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nx = Math.min(width - 1, Math.max(0, x + kx));
          const ny = Math.min(height - 1, Math.max(0, y + ky));
          sum += data[(ny * width + nx) * 4] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      const v = Math.min(255, Math.max(0, sum));
      const i = (y * width + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Convierte imagen a escala de grises con luminosidad perceptual.
 */
function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = g;
  }
}

/**
 * Preprocesa la imagen para maximizar la precisión de Tesseract:
 * 1. Escala a tamaño óptimo (mín 2000px en el lado largo → más DPI para OCR)
 * 2. Convierte a escala de grises
 * 3. Aplica sharpen para mejorar bordes de letras
 * 4. Umbralización adaptativa (maneja iluminación despareja)
 */
export async function preprocessImage(source: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const isFile = source instanceof File;
    const url = isFile ? URL.createObjectURL(source as File) : (source as string);

    img.onload = () => {
      const canvas = document.createElement('canvas');

      // Tesseract funciona mejor con imágenes grandes (~300dpi).
      // Escala al menos a 2200px en el lado largo, sin superar 3200px.
      const minDim = 2200;
      const maxDim = 3200;
      const longest = Math.max(img.width, img.height);
      const scale = longest < minDim
        ? minDim / longest
        : Math.min(1, maxDim / longest);

      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d')!;
      // Suavizado de alta calidad al escalar
      ctx.imageSmoothingEnabled  = true;
      ctx.imageSmoothingQuality  = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 1. Escala de grises
      toGrayscale(imageData.data);

      // 2. Sharpen para bordes de letras más definidos
      const sharpened = sharpen(imageData.data, canvas.width, canvas.height);

      // 3. Umbralización adaptativa: texto negro sobre blanco limpio
      const thresholded = adaptiveThreshold(sharpened, canvas.width, canvas.height);

      const outData = new ImageData(new Uint8ClampedArray(thresholded), canvas.width, canvas.height);
      ctx.putImageData(outData, 0, 0);

      if (isFile) URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}
