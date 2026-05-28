'use client';
import { useState, useRef } from 'react';
import type { ScannedItem, OcrProvider } from '@/types';

interface Props {
  onScan: (items: ScannedItem[]) => void;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<OcrProvider, string> = {
  claude: '🤖 Claude Vision',
  google: '🔍 Google Vision',
  tesseract: '📄 Tesseract (local)',
};

export default function ScannerModal({ onScan, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [provider, setProvider] = useState<OcrProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    setError(null);
    setScanned([]);
    setProvider(null);

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/scan', { method: 'POST', body: fd });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.provider === 'tesseract' && data.base64) {
        // Run Tesseract on client side
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('spa+eng');
        const { data: { text } } = await worker.recognize(`data:image/jpeg;base64,${data.base64}`);
        await worker.terminate();

        const items = parseTesseractText(text);
        setScanned(items);
        setProvider('tesseract');
      } else {
        setScanned(data.items ?? []);
        setProvider(data.provider as OcrProvider);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al escanear');
    } finally {
      setScanning(false);
    }
  };

  const parseTesseractText = (text: string): ScannedItem[] => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const items: ScannedItem[] = [];
    const priceRe = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;

    for (const line of lines) {
      const prices = [...line.matchAll(priceRe)].map((m) =>
        parseFloat(m[0].replace(/\./g, '').replace(',', '.'))
      );
      if (!prices.length) continue;
      const price = prices[prices.length - 1];
      const name = line.replace(priceRe, '').replace(/\s+/g, ' ').trim();
      if (name && price > 0) items.push({ name, price });
    }
    return items;
  };

  const updateItem = (i: number, patch: Partial<ScannedItem>) => {
    setScanned((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  const removeItem = (i: number) => {
    setScanned((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleConfirm = () => {
    onScan(scanned.filter((item) => item.name && item.price > 0));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[#E8E2D9] flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-heading text-lg">Escanear ticket</h2>
          <button onClick={onClose} className="text-[#8B7E74] hover:text-[#1A1410]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#E8E2D9] rounded-xl p-6 text-center cursor-pointer hover:border-[#C8956C] transition-colors"
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <div className="text-4xl mb-2">📸</div>
                <p className="text-sm text-[#8B7E74]">Tocá para subir una foto del ticket</p>
                <p className="text-xs text-[#8B7E74] mt-1">JPG, PNG o HEIC</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {scanning && (
            <div className="text-center py-4">
              <div className="inline-block w-8 h-8 border-3 border-[#C8956C] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-[#8B7E74]">Analizando imagen...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          {provider && !scanning && (
            <div className="text-xs text-[#8B7E74] text-right">
              Escaneado con {PROVIDER_LABELS[provider]}
            </div>
          )}

          {scanned.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[#1A1410]">
                {scanned.length} ítem{scanned.length > 1 ? 's' : ''} detectado{scanned.length > 1 ? 's' : ''}
              </h3>
              {scanned.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                    className="flex-1 text-sm border border-[#E8E2D9] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2]"
                    placeholder="Nombre"
                  />
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-sm border border-[#E8E2D9] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2] text-right"
                    placeholder="Precio"
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    className="text-[#8B7E74] hover:text-red-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              <button
                onClick={handleConfirm}
                className="w-full bg-[#1A1410] text-white rounded-xl py-3 font-medium mt-2 hover:bg-[#2d2420] transition-colors"
              >
                Agregar {scanned.length} ítem{scanned.length > 1 ? 's' : ''} al ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
