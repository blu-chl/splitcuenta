'use client';
import type { SplitState } from '@/types';
import { encodeState } from '@/lib/calculations';
import { useState } from 'react';

interface Props {
  state: SplitState;
}

export default function Header({ state }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const encoded = encodeState(state);
    const url = `${window.location.origin}?s=${encoded}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1A1410] text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🍽️</span>
        <span className="font-heading text-xl tracking-tight">SplitCuenta</span>
      </div>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 bg-[#C8956C] hover:bg-[#b07a54] text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
      >
        {copied ? (
          <>✓ Copiado</>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Compartir
          </>
        )}
      </button>
    </header>
  );
}
