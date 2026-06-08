'use client';
import { useState, useRef } from 'react';
import type { ScannedItem } from '@/types';
import { parseReceiptText, preprocessImage } from '@/lib/receiptParser';
import CropTool from './CropTool';

interface Props {
  onScan: (items: ScannedItem[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'crop' | 'scanning' | 'review';

export default function ScannerModal({ onScan, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // 1. Usuario elige archivo → mostrar herramienta de crop
  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep('crop');
  };

  // 2. Con imagen recortada (o completa) → correr Tesseract
  const runOCR = async (imageSource: string) => {
    setStep('scanning');
    setProgress(10);
    setError(null);

    try {
      const processed = await preprocessImage(imageSource);
      setProgress(30);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(30 + Math.round(m.progress * 60));
          }
        },
      });

      const { data: { text } } = await worker.recognize(processed);
      await worker.terminate();
      setProgress(95);

      const items = parseReceiptText(text);
      setScanned(items);
      setProgress(100);
      setStep('review');

      if (items.length === 0) {
        setError('No se detectaron ítems. Puedes agregarlos manualmente abajo.');
      }
    } catch (e) {
      console.error(e);
      setError('Error al procesar la imagen. Intenta de nuevo.');
      setStep('upload');
    }
  };

  const updateItem = (i: number, patch: Partial<ScannedItem>) =>
    setScanned((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  const removeItem = (i: number) =>
    setScanned((prev) => prev.filter((_, idx) => idx !== i));

  const addManualItem = () =>
    setScanned((prev) => [...prev, { name: '', price: 0 }]);

  const validItems = scanned.filter((i) => i.name.trim() && i.price > 0);

  const handleConfirm = () => {
    onScan(validItems);
    onClose();
  };

  const reset = () => {
    setStep('upload');
    setPreviewUrl(null);
    setScanned([]);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-[#E8E2D9] flex items-center justify-between shrink-0">
          <h2 className="font-heading text-lg">
            {step === 'upload'   && 'Escanear boleta'}
            {step === 'crop'     && 'Selecciona la zona'}
            {step === 'scanning' && 'Analizando...'}
            {step === 'review'   && 'Revisa los ítems'}
          </h2>
          <button onClick={onClose} className="text-[#8B7E74] hover:text-[#1A1410] p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* STEP: upload */}
          {step === 'upload' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Cámara */}
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#E8E2D9] rounded-2xl p-6 hover:border-[#C8956C] hover:bg-[#FAF7F2] transition-all"
                >
                  <span className="text-4xl">📷</span>
                  <span className="font-medium text-sm text-[#1A1410]">Tomar foto</span>
                  <span className="text-xs text-[#8B7E74]">Usar cámara</span>
                </button>

                {/* Galería */}
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#E8E2D9] rounded-2xl p-6 hover:border-[#C8956C] hover:bg-[#FAF7F2] transition-all"
                >
                  <span className="text-4xl">🖼️</span>
                  <span className="font-medium text-sm text-[#1A1410]">Elegir foto</span>
                  <span className="text-xs text-[#8B7E74]">Desde galería</span>
                </button>
              </div>

              <p className="text-xs text-center text-[#8B7E74]">
                100% local · sin internet · gratis
              </p>

              {/* Input cámara — fuerza apertura de cámara */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {/* Input galería — sin capture, abre el selector de archivos */}
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </>
          )}

          {/* STEP: crop */}
          {step === 'crop' && previewUrl && (
            <CropTool
              imageUrl={previewUrl}
              onCrop={(dataUrl) => runOCR(dataUrl)}
              onSkip={() => runOCR(previewUrl)}
            />
          )}

          {/* STEP: scanning */}
          {step === 'scanning' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B7E74]">Reconociendo texto...</span>
                  <span className="font-medium text-[#1A1410]">{progress}%</span>
                </div>
                <div className="w-full bg-[#E8E2D9] rounded-full h-2.5">
                  <div
                    className="bg-[#C8956C] h-2.5 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-[#8B7E74] text-center pt-1">
                  Tesseract.js · procesando en tu dispositivo
                </p>
              </div>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="space-y-3">
              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {scanned.length > 0 && !error && (
                <p className="text-sm text-[#8B7E74]">
                  {scanned.length} ítem{scanned.length !== 1 ? 's' : ''} detectados · edita si algo está mal
                </p>
              )}

              <div className="space-y-2">
                {scanned.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2 border border-[#E8E2D9]">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
                      placeholder="Nombre del ítem"
                    />
                    <span className="text-[#E8E2D9] flex-shrink-0">|</span>
                    <input
                      type="number"
                      value={item.price || ''}
                      onChange={(e) => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                      className="w-24 text-sm text-right bg-transparent focus:outline-none font-medium flex-shrink-0"
                      placeholder="Precio"
                      min="0"
                    />
                    <button onClick={() => removeItem(i)} className="text-[#8B7E74] hover:text-red-500 transition-colors flex-shrink-0">
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
              disabled={validItems.length === 0}
              className="w-full bg-[#1A1410] text-white rounded-xl py-3 font-medium hover:bg-[#2d2420] transition-colors disabled:opacity-40"
            >
              Agregar {validItems.length} ítem{validItems.length !== 1 ? 's' : ''} al ticket
            </button>
            <button
              onClick={reset}
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
