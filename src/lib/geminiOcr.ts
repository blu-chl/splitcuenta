import type { ScannedItem } from '@/types';

export const GEMINI_MODEL = 'gemini-2.0-flash-lite';

const PROMPT = `Eres un lector de boletas de restaurante. Extrae TODOS los ítems consumidos.

Devuelve ÚNICAMENTE un JSON array con este formato exacto:
[{"name":"Nombre del producto","price":1200,"quantity":1}]

Reglas:
- Incluye solo ítems de comida/bebida con precio
- El precio debe ser el valor numérico sin símbolos ($, pesos, etc.)
- Si hay cantidad × precio unitario, calcula el total (ej: 2 x 1200 = price: 2400)
- Omite totales, subtotales, propinas, IVA, impuestos, descuentos
- Si la cantidad es mayor a 1, inclúyela en "quantity"
- Si no encuentras ítems, devuelve []
- No incluyas ningún texto fuera del JSON`;

const MAX_SIDE = 2000;   // suficiente para leer texto de boleta sin pasarse del límite de la API
const JPEG_QUALITY = 0.9;

/**
 * Acepta una URL blob: o un data URL (PNG/JPEG de cualquier tamaño) y devuelve un
 * data URL JPEG de máx. 2000px. Una foto de celular en PNG pesa decenas de MB y
 * supera el límite de la API; una URL blob: ni siquiera es un data URL.
 */
async function toJpegDataUrl(source: string): Promise<string> {
  const img = new Image();
  img.src = source;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export async function scanWithGemini(
  imageSource: string,
  apiKey: string,
): Promise<ScannedItem[]> {
  const imageDataUrl = await toJpegDataUrl(imageSource);
  // Extraer base64 puro (sin el prefijo data:image/...;base64,)
  const [header, base64] = imageDataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,        // Baja temperatura = más preciso, menos creativo
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  // Extrae el JSON aunque venga envuelto en ```json ... ```
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const raw: { name: string; price: number; quantity?: number }[] = JSON.parse(match[0]);
  return raw
    .filter((item) => item.name && item.price > 0)
    .map((item) => ({
      name: (item.quantity ?? 1) > 1 ? `${item.quantity}× ${item.name}` : item.name,
      price: item.price,
      quantity: item.quantity ?? 1,
    }));
}

export function getGeminiKey(): string {
  try { return localStorage.getItem('splitcuenta_gemini_key') ?? ''; }
  catch { return ''; }
}

export function saveGeminiKey(key: string): void {
  try { localStorage.setItem('splitcuenta_gemini_key', key.trim()); }
  catch { /* localStorage bloqueado */ }
}

export function clearGeminiKey(): void {
  try { localStorage.removeItem('splitcuenta_gemini_key'); }
  catch { /* noop */ }
}
