'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import { getGeminiKey } from '@/lib/geminiOcr';
import EngineBadge from './EngineBadge';
import GeminiKeyModal from './GeminiKeyModal';
import SectionCard from './SectionCard';

interface Props {
  onFile: (file: File) => void;
  onManual: () => void;
}

const noopSubscribe = () => () => {};

export default function PhotoStep({ onFile, onManual }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [, bump] = useState(0);
  // Seguro para hidratación: en el servidor siempre es false
  const hasKey = useSyncExternalStore(noopSubscribe, () => !!getGeminiKey(), () => false);

  return (
    <SectionCard title="Sube la boleta" hint="Leemos los ítems por ti">
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

        <div className="flex items-stretch gap-2 pt-2">
          <EngineBadge engine={hasKey ? 'gemini' : 'tesseract'} className="flex-1" />
          <button
            onClick={() => setShowKeyModal(true)}
            className="shrink-0 text-xs font-medium px-3 rounded-xl border border-[#E8E2D9] text-[#8B7E74] hover:border-[#C8956C] hover:text-[#C8956C] transition-colors"
          >
            {hasKey ? 'Cambiar' : '✨ Activar IA'}
          </button>
        </div>

        <button
          onClick={onManual}
          className="w-full text-sm text-[#8B7E74] hover:text-[#1A1410] py-2 transition-colors"
        >
          Prefiero agregar los gastos a mano →
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      {showKeyModal && (
        <GeminiKeyModal
          onClose={() => { setShowKeyModal(false); bump((n) => n + 1); }}
          onSaved={() => bump((n) => n + 1)}
        />
      )}
    </SectionCard>
  );
}
