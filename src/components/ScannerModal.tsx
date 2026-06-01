'use client';
import { useState, useRef } from 'react';
import type { ScannedItem } from '@/types';
import { parseReceiptText, preprocessImage } from '@/lib/receiptParser';

interface Props {
  onScan: (items: ScannedItem[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'scanning' | 'review';

export default function ScannerModal({ onScan, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setStep('scanning');
    setProgress(10);

    try {
      // Muestra preview original
      const originalUrl = URL.createObjectURL(file);
      setPreview(originalUrl);

      // Preprocesa imagen para mejorar OCR
      setProgress(20);
      const processedDataUrl = await preprocessImage(file);
      setProgress(35);

      // Carga Tesseract dinámicamente (no aumenta el bundle inicial)
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(35 + Math.round(m.progress * 55));
          }
        },
      });

      setProgress(40);
      const { data: { text } } = await worker.recognize(processedDataUrl);
      await worker.terminate();

      setProgress(95);

      const items = parseReceiptText(text);
      setScanned(items);
      setProgress(100);
      setStep('review');

      if (items.length === 0) {
        setError('No se detectaron ítems. Intenta con una foto más nítida o agrégalos manualmente.');
      }
    } catch (e) {
      console.error(e);
      setError('Error al procesar la imagen. Intenta de nuevo.');
      setStep('upload');
    }
  };

  const updateItem = (i: number, patch: Partial<ScannedItem>) => {
    setScanned((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  const removeItem = (i: number) => {
    setScanned((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addManualItem = () => {
    setScanned((prev) => [...prev, { name: '', price: 0 }]);
  };

  const handleConfirm = () => {
    onScan(scanned.filter((item) => item.name.trim() && item.price > 0));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-[#E8E2D9] flex items-center justify-between shrink-0">
          <h2 className="font-heading text-lg">
            {step === 'upload' && 'Escanear boleta'}
            {step === 'scanning' && 'Analizando...'}
            {step === 'review' && 'Revisa los ítems'}
          </h2>
          <button onClick={onClose} className="text-[#8B7E74] hover:text-[#1A1410] p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Upload */}
          {step === 'upload' && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#E8E2D9] rounded-2xl p-8 text-center cursor-pointer hover:border-[#C8956C] hover:bg-[#FAF7F2] transition-all"
              >
                <div className="text-5xl mb-3">📸</div>
                <p className="font-medium text-[#1A1410]">Toca para subir foto</p>
                <p className="text-sm text-[#8B7E74] mt-1">o toma una foto con la cámara</p>
                <p className="text-xs text-[#8B7E74] mt-3 bg-[#FAF7F2] rounded-full px-3 py-1 inline-block">
                  100% local · sin internet · gratis
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <p className="text-xs text-center text-[#8B7E74]">
                El análisis ocurre en tu dispositivo. No se sube nada a ningún servidor.
              </p>
            </>
          )}

          {/* Scanning */}
          {step === 'scanning' && (
            <div className="space-y-4">
              {preview && (
                <img src={preview} alt="boleta" className="max-h-48 mx-auto rounded-xl object-contain" />
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B7E74]">Reconociendo texto...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="w-full bg-[#E8E2D9] rounded-full h-2">
                  <div
                    className="bg-[#C8956C] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-[#8B7E74] text-center">
                  Tesseract OCR · procesando en tu dispositivo
                </p>
              </div>
            </div>
          )}

          {/* Review */}
          {step === 'review' && (
            <div className="space-y-3">
              {preview && (
                <img src={preview} alt="boleta" className="max-h-32 mx-auto rounded-xl object-contain opacity-60" />
              )}

              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {scanned.length > 0 && (
                <p className="text-sm text-[#8B7E74]">
                  {scanned.length} ítem{scanned.length !== 1 ? 's' : ''} detectado{scanned.length !== 1 ? 's' : ''} · edita si algo está mal
                </p>
              )}

              <div className="space-y-2">
                {scanned.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      className="flex-1 text-sm bg-transparent focus:outline-none"
                      placeholder="Nombre del ítem"
                    />
                    <span className="text-[#E8E2D9]">|</span>
                    <input
                      type="number"
                      value={item.price || ''}
                      onChange={(e) => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                      className="w-24 text-sm text-right bg-transparent focus:outline-none font-medium"
                      placeholder="Precio"
                      min="0"
                      step="1"
                    />
                    <button onClick={() => removeItem(i)} className="text-[#8B7E74] hover:text-red-500 transition-colors ml-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addManualItem}
                className="w-full text-sm text-[#C8956C] border border-dashed border-[#C8956C] rounded-xl py-2 hover:bg-[#FAF7F2] transition-colors"
              >
                + Agregar ítem manualmente
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="p-4 border-t border-[#E8E2D9] shrink-0 space-y-2">
            <button
              onClick={handleConfirm}
              disabled={scanned.filter(i => i.name && i.price > 0).length === 0}
              className="w-full bg-[#1A1410] text-white rounded-xl py-3 font-medium hover:bg-[#2d2420] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Agregar {scanned.filter(i => i.name && i.price > 0).length} ítem{scanned.filter(i => i.name && i.price > 0).length !== 1 ? 's' : ''} al ticket
            </button>
            <button
              onClick={() => { setStep('upload'); setScanned([]); setError(null); }}
              className="w-full text-sm text-[#8B7E74] hover:text-[#1A1410] py-1 transition-colors"
            >
              Escanear otra foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
