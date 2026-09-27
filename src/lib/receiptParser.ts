import type {
  OcrLine, ParsedLine, ParsedReceipt, ReceiptItem, ReceiptMeta, ReceiptCheck, ScannedItem, Bbox,
} from '@/types';

// Parser de boletas (pensado en boletas y precuentas chilenas, sirve para otras).
// Recibe las líneas del OCR y devuelve ítems, metadatos (comercio, RUT, fecha,
// total…) y la clasificación de cada línea para poder dibujarla sobre la foto.
// No toca el DOM: se puede testear en Node.

// ─── Normalización ────────────────────────────────────────────────────────────

/** minúsculas sin tildes, y los 0 de OCR dentro de palabras vuelven a ser 'o' */
function norm(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/([a-z])0|0(?=[a-z])/g, (m) => m.replace('0', 'o'));
}

/**
 * Arregla confusiones típicas del OCR dentro de montos: O→0, l/I/|→1, S→5, B→8.
 * Solo toca tokens que ya son casi un número (≥2 dígitos reales), así no
 * rompe palabras como "1L" o "S.A.".
 */
function fixNumericToken(tok: string): string {
  if (!/^[-$]?[\dOoIl|SsB.,]+-?$/.test(tok)) return tok;
  if ((tok.match(/\d/g) ?? []).length < 2) return tok;
  return tok
    .replace(/^[Ss](?=\d)/, '$')
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/B/g, '8');
}

function tokenize(line: string): string[] {
  const raw = line
    .replace(/[|¦"“”_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(fixNumericToken);

  // Une montos que el OCR partió en dos: "12 990", "12. 990", "$ 12.990"
  const out: string[] = [];
  for (const tok of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /^\d{3}(?:[.,]\d{1,2})?$/.test(tok)
        && (/^\$?\d{1,3}[.,]$/.test(prev) || (/^\$?\d{1,3}$/.test(prev) && out.length > 1))) {
      out[out.length - 1] = prev.replace(/[.,]$/, '') + '.' + tok;
    } else if (prev === '$' && /^-?\d/.test(tok)) {
      out[out.length - 1] = '$' + tok;
    } else {
      out.push(tok);
    }
  }
  return out;
}

// ─── Montos ───────────────────────────────────────────────────────────────────

/** Convierte un token a monto, o null si no parece plata. */
export function parseAmount(tok: string): number | null {
  let t = tok.replace(/[:;]$/, '');
  let neg = false;
  if (/^-|-$/.test(t)) { neg = true; t = t.replace(/^-|-$/g, ''); }
  t = t.replace(/^\$/, '');
  if (t.startsWith('-')) { neg = true; t = t.slice(1); }

  let value: number | null = null;
  if (/^0\d/.test(t)) return null; // "0671": direcciones, códigos
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) {
    value = Number(t.replace(/[.,]/g, ''));             // 12.990 / 1.234.567
  } else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(t)) {
    value = Number(t.replace(/\./g, '').replace(',', '.')); // 1.234,50
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(t)) {
    value = Number(t.replace(/,/g, ''));                // 1,234.50
  } else if (/^\d+[.,]\d{2}$/.test(t)) {
    value = Number(t.replace(',', '.'));                // 12,50
  } else if (/^\d{3,7}$/.test(t)) {
    value = Number(t);                                  // 4500
  }
  if (value === null || !isFinite(value) || value === 0) return null;
  return neg ? -value : value;
}

const QTY_TOKEN = /^(\d{1,2})[xX]?[.°º:,)]*$|^[xX](\d{1,2})$/;
const SKU_TOKEN = /^\d{7,}$/; // códigos de barra / SKU del supermercado
const QTY_LINE = /^(\d{1,3})\s*[xX*]\s*\$?\s*(\S+)(?:\s+(\S+))?$/; // "2 x 1.290 [2.580]"

interface LineParts {
  name: string;
  qty?: number;
  unit?: number;
  amount?: number;
  alt?: number;        // otro precio posible si qty × unitario ≠ total
  consistent: boolean; // qty × unitario = total (si aplica)
}

/**
 * Descompone una línea en nombre, cantidad y montos. El monto de más a la
 * derecha es el total de la línea (nunca se multiplica por la cantidad).
 */
function splitLine(line: string): LineParts {
  const tokens = tokenize(line).filter((t) => !SKU_TOKEN.test(t));

  const amounts: number[] = [];
  let i = tokens.length - 1;
  while (i >= 0 && amounts.length < 3) {
    const a = parseAmount(tokens[i]);
    if (a === null) break;
    amounts.unshift(a);
    i--;
  }

  // Montos mal leídos antes del total ("1.8060"): no son parte del nombre
  let garbled = false;
  while (amounts.length > 0 && i >= 0 && /^\$?\d[\d.,]*\d$/.test(tokens[i]) && /\d[.,]\d/.test(tokens[i])) {
    garbled = true;
    i--;
  }

  let qty: number | undefined;
  // Cantidad justo antes de los montos solo si hay columnas unitario + total
  // ("Café 2 2.500 5.000"); con un solo monto "Chivas Regal 12 6.500" es nombre.
  if ((amounts.length >= 2 || garbled) && i >= 0) {
    const m = tokens[i].match(QTY_TOKEN);
    if (m) { qty = Number(m[1] ?? m[2]); i--; }
  }

  let nameTokens = tokens.slice(0, i + 1);
  // Cantidad al inicio: "2 Pisco Sour", "1. Lomo", "1° Pizza", "2x Coca"
  // (si ya venía en su columna, igual se saca del nombre)
  if (nameTokens.length > 1) {
    const m = nameTokens[0].match(/^(\d{1,2})[xX]?[.°º:,)\-]*$/);
    if (m && /[a-zA-ZÀ-ÿ]/.test(nameTokens.slice(1).join(''))) {
      qty ??= Number(m[1]);
      nameTokens = nameTokens.slice(1);
    }
  }

  const name = nameTokens
    .filter((t) => /[\p{L}\d]/u.test(t))
    .join(' ')
    .replace(/^[^\p{L}\d]+|[^\p{L}\d)%]+$/gu, '')
    .trim();

  let amount = amounts.length ? amounts[amounts.length - 1] : undefined;
  let unit: number | undefined;
  let alt: number | undefined;
  let consistent = !garbled;
  if (amounts.length >= 2 && amount !== undefined) {
    unit = amounts[amounts.length - 2];
    if (qty === undefined) {
      const q = Math.round(amount / unit);
      if (q >= 1 && q <= 99 && Math.abs(q * unit - amount) < 0.5) qty = q;
      else consistent = false;
    } else if (Math.abs(qty * unit - amount) >= 0.5) {
      // Una de las dos columnas está mal leída. Por defecto manda el total,
      // salvo que sea menor que el unitario ("7.990  990": se comió dígitos).
      // La otra queda como alternativa; el total impreso de la boleta decide.
      consistent = false;
      alt = qty * unit;
      if (Math.abs(amount) < Math.abs(unit)) [amount, alt] = [alt, amount];
    }
  }
  return { name, qty, unit, amount, alt, consistent };
}

// ─── Clasificación por palabras clave (con límites de palabra) ────────────────

const RE = {
  subtotal: /\bsub\s*-?\s*tota[l1i]\b/,
  total: /\b(tota[l1i]|a pagar|monto)\b/,
  notTotal: /\b(monto|tota[l1i])\s+(neto|exento|afecto|iva)\b/, // "MONTO NETO" es impuesto
  tipWord: /\b(propina|servicio|tip)\b/,
  tax: /\b(iva|i\.v\.a|neto|exento|impuesto|impto)\b/,
  payment: /\b(efectivo|vuelto|cambio|tarjeta|debito|credito|redcompra|transferencia|pago|visa|mastercard|webpay|donacion|redondeo)\b/,
  discount: /\b(descuento|dcto|desc|rebaja|promocion|cupon|ahorro)\b/,
  meta: new RegExp([
    '\\br\\.?u\\.?t\\b', '\\bgiro\\b', '\\bfecha\\b', '\\bhora\\b', '\\bfolio\\b',
    '\\bboleta\\b', '\\bfactura\\b', '\\bprecuenta\\b', '\\bpre-cuenta\\b', '\\bticket\\b',
    '\\bmesa\\s*:?\\s*\\d', '\\bcaja\\s*:?\\s*\\d', '\\b(mesero|garzon|cajero|vendedor|atendido)\\b',
    '\\b(direccion|dir\\.|fono|telefono|tel\\.?|email|e-mail|www|http|sii|timbre|verifique|gracias|sucursal|comuna)\\b',
    '\\bcasa matriz\\b', '\\bres\\.?\\s*(ex\\.?\\s*)?(n[°º]?\\s*)?\\d', '\\bresolucion\\b',
    '\\b(av|avda|avenida|calle|pasaje)\\.?\\s', '@',
  ].join('|')),
  columns: /\b(cant|cantidad|descripcion|detalle|producto|articulo|p\.?\s?unit|unitario|precio|valor)\b/,
};

const RUT = /\b(\d{1,2})[.\s]?(\d{3})[.\s]?(\d{3})\s*-\s*([\dkK])\b/;
const DATE_NUM = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/;
const DATE_ISO = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const DATE_TXT = /\b(\d{1,2})\s*(?:de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\s*(?:de\s*)?(\d{4}|\d{2})\b/;
const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function rutDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}

function findDate(n: string): string | undefined {
  const pad = (x: number) => String(x).padStart(2, '0');
  const ok = (d: number, m: number, y: number) =>
    d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099;
  let m = n.match(DATE_ISO);
  if (m && ok(+m[3], +m[2], +m[1])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = n.match(DATE_NUM);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (ok(+m[1], +m[2], y)) return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  m = n.match(DATE_TXT);
  if (m) {
    const mon = MONTHS.indexOf(m[2] === 'set' ? 'sep' : m[2]) + 1;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (ok(+m[1], mon, y)) return `${y}-${pad(mon)}-${pad(+m[1])}`;
  }
  return undefined;
}

function lastAmount(line: string): number | undefined {
  const toks = tokenize(line);
  for (let i = toks.length - 1; i >= 0; i--) {
    const a = parseAmount(toks[i]);
    if (a !== null) return a;
  }
  return undefined;
}

/** Monto que sigue a una palabra clave: "NETO 23.756  IVA 4.514" */
function amountAfter(line: string, word: RegExp): number | undefined {
  const toks = tokenize(line);
  const idx = toks.findIndex((t) => word.test(norm(t)));
  if (idx < 0) return undefined;
  for (let i = idx + 1; i < Math.min(toks.length, idx + 4); i++) {
    const a = parseAmount(toks[i]);
    if (a !== null) return a;
  }
  return undefined;
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

// ─── Parser principal ─────────────────────────────────────────────────────────

const LOW_CONFIDENCE = 72;

export function parseReceipt(ocrLines: OcrLine[]): ParsedReceipt {
  const lines: ParsedLine[] = [];
  const items: ReceiptItem[] = [];
  const meta: ReceiptMeta = {};
  let seenItem = false;
  let closed = false; // ya pasó el TOTAL: lo que venga no son ítems
  let pendingQty: { qty: number; unit: number; line: number } | null = null;

  const addItem = (name: string, price: number, qty: number, lineIdx: number[], consistent: boolean, altPrice?: number) => {
    const conf = Math.min(...lineIdx.map((i) => lines[i].confidence));
    const oddName = name.length > 0 && letters(name) / name.replace(/\s/g, '').length < 0.5;
    const item: ReceiptItem = {
      name, price, quantity: qty,
      confidence: conf,
      lowConfidence: conf < LOW_CONFIDENCE || oddName || !consistent,
      lines: lineIdx,
      ...(altPrice !== undefined && { altPrice }),
    };
    items.push(item);
    for (const i of lineIdx) lines[i].itemIndex = items.length - 1;
    seenItem = true;
    return item;
  };

  for (const ocr of ocrLines) {
    const text = ocr.text.replace(/\s+/g, ' ').trim();
    const idx = lines.length;
    const pl: ParsedLine = { text, kind: 'ignored', confidence: ocr.confidence, bbox: ocr.bbox };
    lines.push(pl);
    if (letters(text) + (text.match(/\d/g) ?? []).length < 2) continue; // ruido: "----", "."

    const n = norm(text);
    const prev = idx > 0 ? lines[idx - 1] : undefined;

    // Metadatos que pueden venir en cualquier línea
    const rut = text.match(RUT);
    if (rut && !meta.rut) {
      const body = rut[1] + rut[2] + rut[3];
      meta.rut = `${rut[1]}.${rut[2]}.${rut[3]}-${rut[4].toUpperCase()}`;
      meta.rutValid = rutDv(body) === rut[4].toUpperCase();
    }
    const fecha = findDate(n);
    if (fecha && !meta.fecha) meta.fecha = fecha;
    const hora = n.match(TIME);
    if (hora && !meta.hora && (fecha || /\bhora\b/.test(n))) meta.hora = `${hora[1].padStart(2, '0')}:${hora[2]}`;
    if (!meta.docType) {
      if (/pre-?cuenta|no valido como boleta/.test(n)) meta.docType = 'precuenta';
      else if (/\bfactura\b/.test(n)) meta.docType = 'factura';
      else if (/\bboleta\b/.test(n)) meta.docType = 'boleta';
      else if (/\b(comprobante|voucher)\b/.test(n)) meta.docType = 'comprobante';
    }
    if (!meta.folio && /\b(boleta|factura|folio|ticket|documento)\b/.test(n) && !/no valido|\bres(olucion)?\b/.test(n)) {
      const nums = text
        .replace(RUT, ' ')
        .replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}:\d{2}(:\d{2})?/g, ' ')
        .match(/\d{3,10}/g);
      if (nums) meta.folio = nums[0];
    }

    // Totales, propina, impuestos, pagos
    if (RE.subtotal.test(n)) {
      pl.kind = 'subtotal'; pl.amount = lastAmount(text);
      if (pl.amount !== undefined && meta.subtotal === undefined) meta.subtotal = pl.amount;
      closed = closed || seenItem;
      continue;
    }
    if (RE.total.test(n) && !RE.notTotal.test(n) && !RE.columns.test(n)) {
      pl.kind = 'total'; pl.amount = lastAmount(text);
      if (pl.amount !== undefined) {
        if (RE.tipWord.test(n)) meta.totalWithTip ??= pl.amount;
        else meta.total ??= pl.amount;
      }
      closed = closed || seenItem;
      continue;
    }
    if (RE.tipWord.test(n)) {
      pl.kind = 'tip'; pl.amount = lastAmount(text);
      const pct = n.match(/(\d{1,2})\s*%/);
      if (pct) meta.tipPercent ??= Number(pct[1]);
      if (pl.amount !== undefined) meta.tip ??= pl.amount;
      continue;
    }
    if (RE.tax.test(n)) {
      pl.kind = 'tax';
      meta.neto ??= amountAfter(text, /^neto/);
      meta.iva ??= amountAfter(text, /^i\.?v\.?a/);
      continue;
    }
    if (RE.payment.test(n)) { pl.kind = 'payment'; pl.amount = lastAmount(text); continue; }

    const parts = splitLine(text);

    // Descuentos: palabra clave o monto negativo → ítem negativo
    if ((RE.discount.test(n) || (parts.amount ?? 0) < 0) && parts.amount !== undefined && !closed) {
      pl.kind = 'discount'; pl.amount = -Math.abs(parts.amount);
      addItem(parts.name || 'Descuento', pl.amount, 1, [idx], true);
      continue;
    }

    if (rut || RE.meta.test(n) || ((fecha || hora) && !seenItem)) { pl.kind = 'meta'; continue; }
    if (RE.columns.test(n) && parts.amount === undefined) { pl.kind = 'meta'; continue; }

    // "2 x 1.290" (y a veces el total al final)
    const q = text.replace(/\s+/g, ' ').match(QTY_LINE);
    if (q) {
      const qty = Number(q[1]);
      const unit = parseAmount(fixNumericToken(q[2]));
      const tot = q[3] !== undefined ? parseAmount(fixNumericToken(q[3])) : null;
      if (unit !== null && qty >= 1 && qty <= 999) {
        pl.kind = 'qty'; pl.amount = tot ?? unit * qty;
        if (tot !== null && prev?.kind === 'text' && !closed) {
          // "YOGHURT FRUTILLA" + "2 x 1.290  2.580"
          prev.kind = 'item';
          addItem(splitLine(prev.text).name, tot, qty, [idx - 1, idx], Math.abs(qty * unit - tot) < 0.5);
        } else {
          const last = items[items.length - 1];
          if (last && last.lines.includes(idx - 1) && Math.abs(last.price - qty * unit) < 0.5) {
            last.quantity = qty; last.lines.push(idx); pl.itemIndex = items.length - 1;
          } else {
            pendingQty = { qty, unit, line: idx };
          }
        }
        continue;
      }
    }

    if (parts.amount !== undefined && !closed) {
      let name = parts.name;
      const lineIdx = [idx];
      // Precio solo en su línea: el nombre venía en la anterior
      if (letters(name) < 2 && prev?.kind === 'text') {
        name = splitLine(prev.text).name;
        prev.kind = 'item';
        lineIdx.unshift(idx - 1);
      }
      if (letters(name) >= 2) {
        let qty = parts.qty ?? 1;
        if (pendingQty && pendingQty.line >= idx - 2 && Math.abs(pendingQty.qty * pendingQty.unit - parts.amount) < 0.5) {
          qty = pendingQty.qty;
          lines[pendingQty.line].itemIndex = items.length;
          lineIdx.unshift(pendingQty.line);
        }
        pendingQty = null;
        pl.kind = 'item'; pl.amount = parts.amount;
        addItem(name, parts.amount, qty, lineIdx, parts.consistent, parts.alt);
        continue;
      }
    }

    if (parts.amount !== undefined) { pl.amount = parts.amount; continue; } // queda 'ignored', se puede agregar a mano
    if (letters(text) >= 3) pl.kind = 'text';
  }

  // Comercio: primera línea con texto "de nombre" antes del primer ítem
  for (const l of lines) {
    if (l.itemIndex !== undefined || l.kind === 'item') break;
    if ((l.kind === 'text' || l.kind === 'ignored') && letters(l.text) >= 4 && l.amount === undefined) {
      meta.merchant = l.text.replace(/^[^\p{L}\d]+|[^\p{L}\d.)]+$/gu, '').trim();
      break;
    }
  }
  // Las líneas 'text' que no terminaron siendo ítems son encabezado o ruido
  for (const l of lines) if (l.kind === 'text') l.kind = 'ignored';

  // Si no cuadra, probar los precios alternativos (de a uno o de a dos) y
  // quedarse con la combinación que calza con el total impreso.
  let check = checkTotals(items, meta);
  const withAlt = items.filter((it) => it.altPrice !== undefined);
  if (check.status === 'mismatch' && withAlt.length > 0) {
    const swap = (it: ReceiptItem) => { [it.price, it.altPrice] = [it.altPrice!, it.price]; };
    const combos: ReceiptItem[][] = withAlt.map((it) => [it]);
    for (let a = 0; a < withAlt.length; a++) for (let b = a + 1; b < withAlt.length; b++) combos.push([withAlt[a], withAlt[b]]);
    for (const combo of combos) {
      combo.forEach(swap);
      const c = checkTotals(items, meta);
      if (c.status === 'ok') { check = c; break; }
      combo.forEach(swap);
    }
  }
  for (const l of lines) if (l.itemIndex !== undefined && l.kind === 'item') l.amount = items[l.itemIndex].price;

  return { items, meta, lines, check };
}

/** ¿La suma de ítems cuadra con algún total impreso? */
export function checkTotals(items: Pick<ScannedItem, 'price'>[], meta: ReceiptMeta): ReceiptCheck {
  const itemsSum = items.reduce((s, i) => s + i.price, 0);
  const candidates: [number | undefined, string][] = [
    [meta.subtotal, 'Subtotal'],
    [meta.total, 'Total'],
    [meta.total !== undefined && meta.tip !== undefined ? meta.total - meta.tip : undefined, 'Total sin propina'],
    [meta.totalWithTip !== undefined && meta.tip !== undefined ? meta.totalWithTip - meta.tip : undefined, 'Total sin propina'],
  ];
  for (const [value, label] of candidates) {
    // Pesos: exacto. Con decimales se tolera el redondeo.
    const tol = Number.isInteger(itemsSum) && Number.isInteger(value) ? 0.5 : 0.05;
    if (value !== undefined && Math.abs(value - itemsSum) <= tol) {
      return { status: 'ok', itemsSum, target: value, targetLabel: label, diff: 0 };
    }
  }
  const [target, targetLabel] = candidates.find(([v]) => v !== undefined) ?? [undefined, undefined];
  if (target === undefined) return { status: 'unknown', itemsSum };
  return { status: 'mismatch', itemsSum, target, targetLabel, diff: target - itemsSum };
}

// ─── Entrada desde Tesseract ──────────────────────────────────────────────────

interface TessLine { text: string; confidence: number; bbox: Bbox }
interface TessBlock { paragraphs: { lines: TessLine[] }[] }

/** Aplana blocks → paragraphs → lines de Tesseract.js en orden de lectura. */
export function linesFromBlocks(blocks: TessBlock[] | null | undefined): OcrLine[] {
  if (!blocks) return [];
  const out: OcrLine[] = [];
  for (const b of blocks) for (const p of b.paragraphs) for (const l of p.lines) {
    const text = l.text.replace(/\n/g, ' ').trim();
    if (text) out.push({ text, confidence: l.confidence, bbox: l.bbox });
  }
  // De arriba hacia abajo (Tesseract a veces devuelve columnas por separado)
  return out.sort((a, b) => {
    const ay = (a.bbox!.y0 + a.bbox!.y1) / 2;
    const by = (b.bbox!.y0 + b.bbox!.y1) / 2;
    const h = Math.min(a.bbox!.y1 - a.bbox!.y0, b.bbox!.y1 - b.bbox!.y0);
    return Math.abs(ay - by) < h * 0.5 ? a.bbox!.x0 - b.bbox!.x0 : ay - by;
  });
}
