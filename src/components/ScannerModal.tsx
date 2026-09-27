'use client';
import { useState, useRef, useEffect } from 'react';
import type { ParsedReceipt, ScannedItem } from '@/types';
import { parseReceipt, linesFromBlocks } from '@/lib/receiptParser';
import { prepareReceiptImage, type PreparedImage } from '@/lib/receiptImage';
import CropTool from './CropTool';
import ReceiptReview from './ReceiptReview';

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
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // Recortar, enderezar y limpiar la foto → Tesseract → ordenar los datos
  const runScan = async (source: string) => {
    setStep('scanning');
    setError(null);
    setPrepared(null);
    setProgress(5);
    setStage('Buscando la boleta en la foto…');

    try {
      const prep = await asPrepared(source);
      setPrepared(prep);
      setProgress(20);
      setStage('Preparando el lector…');

      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('spa+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setStage('Leyendo el texto…');
            setProgress(25 + Math.round(m.progress * 70));
          }
        },
      });
      try {
        // PSM 4 = una columna de texto de tamaño variable (así son las boletas)
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        });
        const { data } = await worker.recognize(prep.dataUrl, {}, { text: true, blocks: true });
        setStage('Ordenando los datos…');
        const parsed = parseReceipt(linesFromBlocks(data.blocks));
        setReceipt(parsed);
        setProgress(100);
        setStep('review');
        if (parsed.items.length === 0) {
          setError('No se detectaron ítems. Toca las líneas descartadas en la foto o agrégalos a mano.');
        }
      } finally {
        await worker.terminate();
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

  const handleConfirm = (items: ScannedItem[], tipPercent?: number) => {
    onScan(items);
    if (tipPercent !== undefined) onTipChange(tipPercent);
    onClose();
  };

  const reset = () => {
    setStep('upload');
    setPhotoUrl(null);
    setPrepared(null);
    setReceipt(null);
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
            {step === 'review'   && 'Revisa la boleta'}
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
              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
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
                Se procesa en tu dispositivo · la foto no se sube a ningún lado
              </p>
              <p className="text-xs text-center text-[#8B7E74]">
                Tip: boleta estirada, con buena luz y ocupando buena parte de la foto
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

          {/* STEP: crop (plan B si la detección automática falla) */}
          {step === 'crop' && photoUrl && (
            <CropTool
              imageUrl={photoUrl}
              onCrop={(dataUrl) => runScan(dataUrl)}
              onSkip={() => runScan(photoUrl)}
            />
          )}

          {/* STEP: scanning */}
          {step === 'scanning' && (
            <div className="space-y-4 py-2">
              {prepared && (
                <div className="relative mx-auto w-40 max-h-56 overflow-hidden rounded-lg border border-[#E8E2D9] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prepared.dataUrl} alt="" className="w-full block" />
                  <div className="scan-line absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-[#C8956C]/40 to-transparent" />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B7E74]">{stage}</span>
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
          {step === 'review' && prepared && receipt && (
            <>
              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
              <ReceiptReview
                image={prepared}
                receipt={receipt}
                currency={currency}
                currentTip={tip}
                onConfirm={handleConfirm}
                onRetry={reset}
                onManualCrop={() => setStep('crop')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
