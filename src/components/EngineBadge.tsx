import { GEMINI_MODEL } from '@/lib/geminiOcr';

export type Engine = 'gemini' | 'tesseract';

interface Props {
  engine: Engine;
  /** Gemini falló y se usó Tesseract de respaldo */
  fellBack?: boolean | string;
  className?: string;
}

const INFO: Record<Engine, { icon: string; name: string; detail: string }> = {
  gemini: {
    icon: '✨',
    name: `Gemini AI · ${GEMINI_MODEL}`,
    detail: 'IA de Google · la foto se envía a Google',
  },
  tesseract: {
    icon: '🔤',
    name: 'Tesseract OCR',
    detail: 'Local · la foto no sale de tu dispositivo',
  },
};

export default function EngineBadge({ engine, fellBack = false, className = '' }: Props) {
  const { icon, name, detail } = INFO[engine];
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${
        engine === 'gemini'
          ? 'bg-[#FFF8F1] border-[#E8C5A8]'
          : 'bg-[#FAF7F2] border-[#E8E2D9]'
      } ${className}`}
    >
      <span className="text-lg leading-none mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1A1410] leading-tight">{name}</p>
        <p className="text-xs text-[#8B7E74] leading-snug">{detail}</p>
        {fellBack && (
          <p className="text-xs text-amber-700 mt-0.5">
            Gemini falló{typeof fellBack === 'string' ? `: ${fellBack}` : ''} · se usó el OCR local de respaldo
          </p>
        )}
      </div>
    </div>
  );
}
