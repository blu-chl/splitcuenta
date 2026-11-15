'use client';
import { useState, useRef } from 'react';
import type { ScannedItem } from '@/types';
import { parseReceiptText, preprocessImage } from '@/lib/receiptParser';
import { scanWithGemini, getGeminiKey } from '@/lib/geminiOcr';
import CropTool from './CropTool';
import GeminiKeyModal from './GeminiKeyModal';
import EngineBadge from './EngineBadge';

interface Props {
  currency: string;
  tip: number;
  onScan: (items: ScannedItem[]) => void;
  onTipChange: (tip: number) => void;
  onClose: () => void;
}

type Step = 'upload' | 'crop' | 'scanning' | 'review';

async function asPrepared(src: string): Promise<PreparedImage> {
  // Si el preprocesamiento falla, se usa la foto tal cual
  try {
    return await prepareReceiptImage(src);
  } catch (e) {
    console.error(e);
    const img = new Image();
    img.src = src;
    await img.decode();
    return { dataUrl: src, width: img.naturalWidth, height: img.naturalHeight, angle: 0, cropped: false };
  }
}

export default function ScannerModal({ currency, tip, onScan, onTipChange, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usedEngine, setUsedEngine] = useState<'gemini' | 'tesseract' | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  // El modal solo se monta al hacer clic (cliente), así que leer localStorage acá es seguro
  const [hasGeminiKey, setHasGeminiKey] = useState(() => !!getGeminiKey());
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setPreviewUrl(URL.createObjectURL(file));
    setStep('crop');
  };

  const runOCR = async (imageSource: string) => {
    setStep('scanning');
    setProgress(5);
    setError(null);
    setPrepared(null);
    setProgress(5);
    setStage('Buscando la boleta en la foto…');

    try {
      const apiKey = getGeminiKey();
      setFellBack(false);
      setUsedEngine(apiKey ? 'gemini' : 'tesseract');

      // ── Intentar Gemini primero ───────────────────────────────────────────
      if (apiKey) {
        setProgressLabel('Analizando con Gemini AI...');
        setProgress(20);
        try {
          const items = await scanWithGemini(imageSource, apiKey);
          setScanned(items);
          setUsedEngine('gemini');
          setProgress(100);
          setStep('review');
          if (items.length === 0) {
            setError('Gemini no encontró ítems. Puedes agregarlos manualmente.');
          }
          return;
        } catch (geminiErr) {
          console.warn('Gemini falló, usando Tesseract:', geminiErr);
          setFellBack(true);
          setUsedEngine('tesseract');
        }
      }

      // ── Fallback: Tesseract ───────────────────────────────────────────────
      setProgressLabel('Preprocesando imagen...');
      setProgress(15);
      const processed = await preprocessImage(imageSource);
      setProgress(30);

      setProgressLabel('Reconociendo texto...');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setStage('Leyendo el texto…');
            setProgress(25 + Math.round(m.progress * 70));
          }
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (worker as any).setParameters({
        tessedit_pageseg_mode: '4',
        preserve_interword_spaces: '1',
      });
      const { data: { text } } = await worker.recognize(processed);
      await worker.terminate();

      const items = parseReceiptText(text);
      setScanned(items);
      setUsedEngine('tesseract');
      setProgress(100);
      setStep('review');
      if (items.length === 0) {
        setError('No se detectaron ítems. Puedes agregarlos manualmente.');
      }
    } catch (e) {
      console.error(e);
      setError('Error al procesar la imagen. Intenta de nuevo.');
      setStep('upload');
    }
  };

  // Elegir foto → procesar directo (el recorte a mano queda como plan B)
  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    runScan(url);
  };

  const removeItem = (i: number) =>
    setScanned((prev) => prev.filter((_, idx) => idx !== i));

  const validItems = scanned.filter((i) => i.name.trim() && i.price > 0);

  const reset = () => {
    setStep('upload');
    setPhotoUrl(null);
    setPrepared(null);
    setReceipt(null);
    setError(null);
    setProgress(0);
    setProgressLabel('');
    setUsedEngine(null);
    setFellBack(false);
  };

  return (
    <>
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
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="text-[#8B7E74] hover:text-[#1A1410] p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* STEP: upload */}
            {step === 'upload' && (
              <>
                {error && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                {/* Motor de lectura que se va a usar */}
                <div>
                  <p className="text-[11px] font-semibold text-[#8B7E74] mb-1.5 uppercase tracking-widest">
                    Se leerá con
                  </p>
                  <div className="flex items-stretch gap-2">
                    <EngineBadge engine={hasGeminiKey ? 'gemini' : 'tesseract'} className="flex-1" />
                    <button
                      onClick={() => setShowKeyModal(true)}
                      className="shrink-0 text-xs font-medium px-3 rounded-xl border border-[#E8E2D9] text-[#8B7E74] hover:border-[#C8956C] hover:text-[#C8956C] transition-colors"
                    >
                      {hasGeminiKey ? 'Cambiar' : '✨ Activar IA'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => cameraRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 bg-[#C8956C] hover:bg-[#b07a54] active:scale-[0.98] text-white rounded-2xl py-5 shadow-md transition-all"
                  >
                    <span className="text-3xl">📸</span>
                    <span className="text-lg font-semibold">Toma la foto</span>
                  </button>
                  <div className="flex items-center gap-3 text-xs text-[#8B7E74]">
                    <span className="flex-1 h-px bg-[#E8E2D9]" />
                    o
                    <span className="flex-1 h-px bg-[#E8E2D9]" />
                  </div>
                  <button
                    onClick={() => galleryRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#1A1410] text-[#1A1410] hover:bg-[#FAF7F2] active:scale-[0.98] rounded-2xl py-4 transition-all"
                  >
                    <span className="text-2xl">📁</span>
                    <span className="text-base font-semibold">Subir foto</span>
                  </button>
                </div>

                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
                    <span className="text-[#8B7E74]">{progressLabel || 'Analizando...'}</span>
                    <span className="font-medium text-[#1A1410]">{progress}%</span>
                  </div>
                  <div className="w-full bg-[#E8E2D9] rounded-full h-2.5">
                    <div className="bg-[#C8956C] h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }} />
                  </div>
                  {usedEngine && (
                    <EngineBadge engine={usedEngine} fellBack={fellBack} className="mt-2" />
                  )}
                </div>
              </div>
            )}

            {/* STEP: review */}
            {step === 'review' && (
              <div className="space-y-3">
                {/* Badge del motor usado */}
                {usedEngine && <EngineBadge engine={usedEngine} fellBack={fellBack} />}

                {error && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                {scanned.length > 0 && (
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
                  onClick={() => setScanned((prev) => [...prev, { name: '', price: 0 }])}
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
                onClick={() => { onScan(validItems); onClose(); }}
                disabled={validItems.length === 0}
                className="w-full bg-[#1A1410] text-white rounded-xl py-3 font-medium hover:bg-[#2d2420] transition-colors disabled:opacity-40"
              >
                Agregar {validItems.length} ítem{validItems.length !== 1 ? 's' : ''} al ticket
              </button>
              <button onClick={reset} className="w-full text-sm text-[#8B7E74] hover:text-[#1A1410] py-1 transition-colors">
                Escanear otra foto
              </button>
            </div>
          )}
        </div>
      </div>

      {showKeyModal && (
        <GeminiKeyModal
          onClose={() => setShowKeyModal(false)}
          onSaved={() => setHasGeminiKey(true)}
        />
      )}
    </>
  );
}
