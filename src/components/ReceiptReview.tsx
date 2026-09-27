'use client';
import { useMemo, useRef, useState } from 'react';
import type { LineKind, ParsedReceipt, ScannedItem } from '@/types';
import type { PreparedImage } from '@/lib/receiptImage';
import { checkTotals } from '@/lib/receiptParser';
import { formatCurrency } from '@/lib/calculations';

interface Row {
  key: number;
  name: string;
  price: number;
  quantity: number;
  lowConfidence: boolean;
  altPrice?: number;
  lines: number[];
}

interface Props {
  image: PreparedImage;
  receipt: ParsedReceipt;
  currency: string;
  currentTip: number;
  onConfirm: (items: ScannedItem[], tipPercent?: number) => void;
  onRetry: () => void;
  onManualCrop: () => void;
}

const DOC_LABEL = { boleta: 'Boleta', factura: 'Factura', precuenta: 'Precuenta', comprobante: 'Comprobante' };

// Cómo se pinta cada tipo de línea sobre la foto
const BOX_STYLE: Partial<Record<LineKind, { border: string; bg: string; dashed?: boolean }>> = {
  item:     { border: '#C8956C', bg: 'rgba(200,149,108,0.16)' },
  qty:      { border: '#C8956C', bg: 'rgba(200,149,108,0.08)' },
  discount: { border: '#5B9A6E', bg: 'rgba(91,154,110,0.14)' },
  subtotal: { border: '#5B7DB1', bg: 'rgba(91,125,177,0.12)' },
  total:    { border: '#5B7DB1', bg: 'rgba(91,125,177,0.16)' },
  tip:      { border: '#8FA3BF', bg: 'rgba(143,163,191,0.08)' },
  tax:      { border: '#8FA3BF', bg: 'transparent' },
  payment:  { border: '#8FA3BF', bg: 'transparent' },
};
const REVIEW = { border: '#D97706', bg: 'rgba(217,119,6,0.16)', dashed: true };
const DISCARDED = { border: '#8B7E74', bg: 'transparent', dashed: true };

const KIND_LABEL: Record<LineKind, string> = {
  item: 'ítem', discount: 'descuento', qty: 'cantidad', subtotal: 'subtotal', total: 'total',
  tip: 'propina', tax: 'impuesto', payment: 'pago', meta: 'datos', text: 'texto', ignored: 'descartada',
};

function formatDate(iso?: string, hora?: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  return hora ? `${date} · ${hora}` : date;
}

export default function ReceiptReview({ image, receipt, currency, currentTip, onConfirm, onRetry, onManualCrop }: Props) {
  const { meta, lines } = receipt;
  const nextKey = useRef(receipt.items.length);
  const [rows, setRows] = useState<Row[]>(() =>
    receipt.items.map((it, i) => ({
      key: i, name: it.name, price: it.price, quantity: it.quantity,
      lowConfidence: it.lowConfidence, altPrice: it.altPrice, lines: it.lines,
    })),
  );
  const [selected, setSelected] = useState<number | null>(null); // key de la fila
  const [showPhoto, setShowPhoto] = useState(true);
  const [useTip, setUseTip] = useState(true);
  // Mostrar bajo cada ítem su línea de la boleta (parte activo si no cuadra)
  const [compare, setCompare] = useState(receipt.check.status === 'mismatch');
  const photoRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  const fmt = (n: number) => formatCurrency(n, currency);
  const check = useMemo(() => checkTotals(rows, meta), [rows, meta]);

  const lineToRow = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r, i) => r.lines.forEach((l) => m.set(l, i)));
    return m;
  }, [rows]);

  // Líneas con monto que no quedaron como ítem ni como total: se pueden agregar
  const discarded = lines
    .map((l, i) => ({ ...l, index: i }))
    .filter((l) => l.kind === 'ignored' && l.amount !== undefined && !lineToRow.has(l.index));
  const exactFix = check.status === 'mismatch'
    ? discarded.find((l) => Math.abs((l.amount ?? 0) - (check.diff ?? 0)) < 0.5)
    : undefined;

  // Recorte de la imagen que cubre las líneas de un ítem (con un poco de aire)
  const snippetFor = (lineIdxs: number[]) => {
    const boxes = lineIdxs.map((i) => lines[i]?.bbox).filter((b) => b !== undefined);
    if (!boxes.length) return null;
    const pad = Math.max(6, (boxes[0].y1 - boxes[0].y0) * 0.35);
    const x = Math.max(0, Math.min(...boxes.map((b) => b.x0)) - pad * 2);
    const y = Math.max(0, Math.min(...boxes.map((b) => b.y0)) - pad);
    const x1 = Math.min(image.width, Math.max(...boxes.map((b) => b.x1)) + pad * 2);
    const y1 = Math.min(image.height, Math.max(...boxes.map((b) => b.y1)) + pad);
    return { x, y, w: x1 - x, h: y1 - y };
  };

  const scrollPhotoTo = (lineIdx: number) => {
    const box = lines[lineIdx]?.bbox;
    const el = photoRef.current;
    if (!box || !el) return;
    const y = (box.y0 / image.height) * el.scrollHeight;
    el.scrollTo({ top: Math.max(0, y - el.clientHeight / 3), behavior: 'smooth' });
  };

  const selectRow = (key: number, fromPhoto = false) => {
    setSelected(key);
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (fromPhoto) rowRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    else if (row.lines.length) scrollPhotoTo(row.lines[row.lines.length - 1]);
  };

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));

  const addFromLine = (lineIdx: number) => {
    const l = lines[lineIdx];
    const name = l.text.replace(/[-$]?\s*[\d.,]+\s*$/, '').replace(/^[^\p{L}\d]+/u, '').trim() || 'Ítem';
    const key = nextKey.current++;
    setRows((prev) => [...prev, { key, name, price: l.amount ?? 0, quantity: 1, lowConfidence: true, lines: [lineIdx] }]);
    setSelected(key);
  };

  const addManual = () => {
    const key = nextKey.current++;
    setRows((prev) => [...prev, { key, name: '', price: 0, quantity: 1, lowConfidence: false, lines: [] }]);
    setSelected(key);
  };

  const validRows = rows.filter((r) => r.name.trim() && r.price !== 0);
  const tipDiffers = meta.tipPercent !== undefined && meta.tipPercent !== currentTip;

  const confirm = () => {
    onConfirm(
      validRows.map((r) => ({
        name: r.quantity > 1 ? `${r.quantity}× ${r.name.trim()}` : r.name.trim(),
        price: r.price,
        quantity: r.quantity,
      })),
      tipDiffers && useTip ? meta.tipPercent : undefined,
    );
  };

  const dateText = formatDate(meta.fecha, meta.hora);
  const printedTotal = meta.total ?? meta.totalWithTip;

  return (
    <div className="space-y-4">
      {/* ── Ficha de la boleta ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E8E2D9] bg-[#FAF7F2] p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-[#1A1410] truncate">
              {meta.merchant || <span className="text-[#8B7E74] font-normal">Comercio no detectado</span>}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#8B7E74] mt-0.5">
              {meta.rut && (
                <span title={meta.rutValid ? 'Dígito verificador correcto' : 'El dígito verificador no calza: puede estar mal leído'}>
                  RUT {meta.rut} {meta.rutValid ? <span className="text-[#5B9A6E]">✓</span> : <span className="text-[#D97706]">(revisar)</span>}
                </span>
              )}
              {meta.folio && <span>N° {meta.folio}</span>}
              {dateText && <span>{dateText}</span>}
            </div>
          </div>
          {meta.docType && (
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-white border border-[#E8E2D9] text-[#8B7E74]">
              {DOC_LABEL[meta.docType]}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded-xl py-2 border border-[#E8E2D9]">
            <p className="text-[11px] text-[#8B7E74]">{check.targetLabel ?? 'Total'} boleta</p>
            <p className="font-semibold text-sm text-[#1A1410]">
              {check.target !== undefined ? fmt(check.target) : printedTotal !== undefined ? fmt(printedTotal) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl py-2 border border-[#E8E2D9]">
            <p className="text-[11px] text-[#8B7E74]">Suma ítems</p>
            <p className="font-semibold text-sm text-[#1A1410]">{fmt(check.itemsSum)}</p>
          </div>
          <div className="bg-white rounded-xl py-2 border border-[#E8E2D9]">
            <p className="text-[11px] text-[#8B7E74]">Propina{meta.tipPercent !== undefined ? ` ${meta.tipPercent}%` : ''}</p>
            <p className="font-semibold text-sm text-[#1A1410]">{meta.tip !== undefined ? fmt(meta.tip) : '—'}</p>
          </div>
        </div>

        {check.status === 'ok' && (
          <p className="text-sm rounded-xl px-3 py-2 bg-[#EEF6F0] text-[#3F7A52] border border-[#CFE5D6]">
            ✓ Cuadra con el {check.targetLabel?.toLowerCase()} de la boleta
          </p>
        )}
        {check.status === 'mismatch' && check.diff !== undefined && (
          <div className="text-sm rounded-xl px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 space-y-1.5">
            <p>
              ⚠ {check.diff > 0 ? `Faltan ${fmt(check.diff)}` : `Sobran ${fmt(-check.diff)}`} para cuadrar con el{' '}
              {check.targetLabel?.toLowerCase()}. Compara cada monto con su línea de la boleta
              {discarded.length ? ' o revisa las líneas descartadas' : ''}.
            </p>
            {exactFix && (
              <button onClick={() => addFromLine(exactFix.index)} className="text-xs font-medium underline underline-offset-2">
                «{exactFix.text}» calza justo con la diferencia → agregar
              </button>
            )}
          </div>
        )}
        {check.status === 'unknown' && (
          <p className="text-sm rounded-xl px-3 py-2 bg-white text-[#8B7E74] border border-[#E8E2D9]">
            No encontré el total impreso: revisa que estén todos los ítems.
          </p>
        )}
      </div>

      {/* ── Foto con lo que se leyó ─────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#8B7E74]">
            {image.cropped ? 'Recortada' : 'Foto'}{image.angle ? ` y enderezada ${Math.abs(image.angle)}°` : ''} · toca una línea
          </p>
          <button onClick={() => setShowPhoto((v) => !v)} className="text-xs text-[#C8956C] font-medium">
            {showPhoto ? 'Ocultar foto' : 'Ver foto'}
          </button>
        </div>
        {showPhoto && (
          <>
            <div ref={photoRef} className="max-h-[42vh] overflow-y-auto overflow-x-hidden rounded-xl border border-[#E8E2D9] bg-white">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.dataUrl} alt="Boleta procesada" className="w-full block select-none" draggable={false} />
                {lines.map((l, i) => {
                  if (!l.bbox) return null;
                  const rowIdx = lineToRow.get(i);
                  const row = rowIdx !== undefined ? rows[rowIdx] : undefined;
                  const isDiscarded = l.kind === 'ignored' && l.amount !== undefined && !row;
                  const style = row
                    ? (row.lowConfidence ? REVIEW : BOX_STYLE[row.price < 0 ? 'discount' : 'item']!)
                    : isDiscarded ? DISCARDED : BOX_STYLE[l.kind];
                  if (!style) return null;
                  const isSel = row !== undefined && row.key === selected;
                  const clickable = row !== undefined || isDiscarded;
                  const firstLineOfRow = row !== undefined && row.lines[0] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!clickable}
                      onClick={() => (row ? selectRow(row.key, true) : addFromLine(i))}
                      title={isDiscarded ? `Agregar «${l.text}» como ítem` : l.text}
                      className="absolute rounded-[3px] transition-shadow disabled:cursor-default"
                      style={{
                        left: `${(l.bbox.x0 / image.width) * 100 - 0.6}%`,
                        top: `${(l.bbox.y0 / image.height) * 100 - 0.25}%`,
                        width: `${((l.bbox.x1 - l.bbox.x0) / image.width) * 100 + 1.2}%`,
                        height: `${((l.bbox.y1 - l.bbox.y0) / image.height) * 100 + 0.5}%`,
                        border: `1.5px ${style.dashed ? 'dashed' : 'solid'} ${style.border}`,
                        background: style.bg,
                        boxShadow: isSel ? '0 0 0 3px #1A1410' : undefined,
                      }}
                    >
                      {firstLineOfRow && (
                        <span
                          className="absolute -left-1 top-1/2 -translate-x-full -translate-y-1/2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-[18px] text-white text-center"
                          style={{ background: style.border }}
                        >
                          {rowIdx! + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8B7E74]">
              <Legend color="#C8956C" label="Ítem" />
              <Legend color="#D97706" label="Revisar" dashed />
              <Legend color="#5B7DB1" label="Totales" />
              <Legend color="#8B7E74" label="Descartada (toca para agregar)" dashed />
            </div>
          </>
        )}
      </div>

      {/* ── Ítems ────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-[#8B7E74]">
            {rows.length} ítem{rows.length !== 1 ? 's' : ''}
            {rows.some((r) => r.lowConfidence) && ' · los marcados en naranjo conviene revisarlos'}
          </p>
          <button onClick={() => setCompare((v) => !v)} className="shrink-0 text-xs text-[#C8956C] font-medium">
            {compare ? 'Ocultar líneas' : 'Comparar con la boleta'}
          </button>
        </div>
        {rows.map((r, i) => {
          const borderColor = r.key === selected ? '#1A1410' : r.lowConfidence ? '#F2C48D' : '#E8E2D9';
          const snippet = (compare || r.key === selected || r.lowConfidence) ? snippetFor(r.lines) : null;
          return (
            <div
              key={r.key}
              ref={(el) => { if (el) rowRefs.current.set(r.key, el); else rowRefs.current.delete(r.key); }}
              onClick={() => selectRow(r.key)}
              className="rounded-xl px-2.5 py-2 border transition-colors space-y-2"
              style={{
                background: r.key === selected ? '#FFF' : '#FAF7F2',
                borderColor,
                borderLeftWidth: r.lowConfidence ? 4 : 1,
                borderLeftColor: r.lowConfidence ? '#D97706' : borderColor,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
                  style={{ background: r.lowConfidence ? '#D97706' : r.price < 0 ? '#5B9A6E' : '#C8956C' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <input
                    value={r.name}
                    onChange={(e) => updateRow(r.key, { name: e.target.value })}
                    onFocus={() => selectRow(r.key)}
                    className="w-full text-sm bg-transparent focus:outline-none"
                    placeholder="Nombre del ítem"
                  />
                  {(r.quantity > 1 || r.altPrice !== undefined) && (
                    <div className="flex gap-2 text-[11px] text-[#8B7E74]">
                      {r.quantity > 1 && <span>{r.quantity} × {fmt(r.price / r.quantity)}</span>}
                      {r.altPrice !== undefined && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateRow(r.key, { price: r.altPrice!, altPrice: r.price }); }}
                          className="text-[#D97706] font-medium underline underline-offset-2"
                        >
                          ¿{fmt(r.altPrice)}?
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  value={r.price || ''}
                  onChange={(e) => updateRow(r.key, { price: parseFloat(e.target.value) || 0 })}
                  onFocus={() => selectRow(r.key)}
                  className="w-24 text-sm text-right bg-transparent focus:outline-none font-medium shrink-0"
                  style={{ color: r.price < 0 ? '#3F7A52' : undefined }}
                  placeholder="Precio"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeRow(r.key); }}
                  className="text-[#8B7E74] hover:text-red-500 transition-colors shrink-0"
                  aria-label="Quitar ítem"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Lo que dice la boleta en esa línea, para comparar sin buscar en la foto */}
              {snippet && (
                <div
                  className="relative overflow-hidden rounded-md ring-1 ring-[#E8E2D9] bg-white"
                  style={{ aspectRatio: `${snippet.w} / ${snippet.h}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.dataUrl}
                    alt=""
                    className="absolute max-w-none select-none"
                    draggable={false}
                    style={{
                      width: `${(image.width / snippet.w) * 100}%`,
                      left: `${(-snippet.x / snippet.w) * 100}%`,
                      top: `${(-snippet.y / snippet.h) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={addManual}
          className="w-full text-sm text-[#C8956C] border border-dashed border-[#C8956C] rounded-xl py-2 hover:bg-[#FAF7F2] transition-colors"
        >
          + Agregar ítem manualmente
        </button>
      </div>

      {/* ── Líneas con monto que no entraron ─────────────────────────────── */}
      {discarded.length > 0 && (
        <details className="rounded-xl border border-[#E8E2D9] px-3 py-2">
          <summary className="text-sm text-[#8B7E74] cursor-pointer">
            {discarded.length} línea{discarded.length !== 1 ? 's' : ''} con monto descartada{discarded.length !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 space-y-1">
            {discarded.map((l) => (
              <li key={l.index} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[#1A1410]">{l.text}</span>
                <button onClick={() => addFromLine(l.index)} className="shrink-0 text-xs text-[#C8956C] font-medium">
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded-xl border border-[#E8E2D9] px-3 py-2">
        <summary className="text-sm text-[#8B7E74] cursor-pointer">Ver todo lo que se leyó</summary>
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] leading-relaxed">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 w-[68px] text-[#8B7E74]">{KIND_LABEL[l.kind]}</span>
              <span className={l.confidence < 72 ? 'text-[#D97706]' : 'text-[#1A1410]'}>{l.text}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* ── Confirmar ────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 -mb-4 px-4 pb-4 pt-3 bg-white border-t border-[#E8E2D9] space-y-2">
        {tipDiffers && (
          <label className="flex items-center gap-2 text-sm text-[#1A1410]">
            <input type="checkbox" checked={useTip} onChange={(e) => setUseTip(e.target.checked)} className="accent-[#C8956C]" />
            Usar la propina de la boleta ({meta.tipPercent}%) en vez de {currentTip}%
          </label>
        )}
        <button
          onClick={confirm}
          disabled={validRows.length === 0}
          className="w-full bg-[#1A1410] text-white rounded-xl py-3 font-medium hover:bg-[#2d2420] transition-colors disabled:opacity-40"
        >
          Agregar {validRows.length} ítem{validRows.length !== 1 ? 's' : ''} al ticket
        </button>
        <div className="flex justify-center gap-4">
          <button onClick={onManualCrop} className="text-sm text-[#8B7E74] hover:text-[#1A1410] py-1 transition-colors">
            Recortar a mano
          </button>
          <button onClick={onRetry} className="text-sm text-[#8B7E74] hover:text-[#1A1410] py-1 transition-colors">
            Escanear otra foto
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-2.5 rounded-[2px]" style={{ border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      {label}
    </span>
  );
}
