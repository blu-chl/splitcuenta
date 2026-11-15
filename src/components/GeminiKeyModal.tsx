'use client';
import { useState, useEffect } from 'react';
import { getGeminiKey, saveGeminiKey, clearGeminiKey } from '@/lib/geminiOcr';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function GeminiKeyModal({ onClose, onSaved }: Props) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const existing = getGeminiKey();
    setHasKey(!!existing);
    if (existing) setKey(existing);
  }, []);

  const handleSave = () => {
    if (!key.trim()) return;
    saveGeminiKey(key.trim());
    setSaved(true);
    setTimeout(() => { onSaved(); onClose(); }, 800);
  };

  const handleClear = () => {
    clearGeminiKey();
    setKey('');
    setHasKey(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4">

        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg">Configurar Gemini AI</h2>
          <button onClick={onClose} className="text-[#8B7E74] hover:text-[#1A1410] p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Instrucciones */}
        <div className="bg-[#FAF7F2] rounded-xl p-3 space-y-2 text-sm">
          <p className="font-medium text-[#1A1410]">Cómo obtener tu key gratis:</p>
          <ol className="text-[#8B7E74] space-y-1 list-decimal list-inside">
            <li>Entra a <span className="text-[#C8956C] font-medium">aistudio.google.com</span></li>
            <li>Inicia sesión con tu cuenta Google</li>
            <li>Clic en <strong>"Get API Key"</strong> → <strong>"Create API Key"</strong></li>
            <li>Copia y pega la key aquí abajo</li>
          </ol>
          <p className="text-xs text-[#8B7E74] pt-1">
            ✓ Gratis · ✓ Sin tarjeta · ✓ 1.500 escaneos/día
          </p>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full border border-[#E8E2D9] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8956C] bg-[#FAF7F2] font-mono"
          />
          <p className="text-xs text-[#8B7E74]">
            La key se guarda solo en este dispositivo. Nunca sale de tu celular.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          {hasKey && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              Eliminar key
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!key.trim() || saved}
            className="flex-1 bg-[#1A1410] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#2d2420] transition-colors disabled:opacity-40"
          >
            {saved ? '✓ Guardado' : 'Guardar key'}
          </button>
        </div>
      </div>
    </div>
  );
}
