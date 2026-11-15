export type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: 'Foto' },
  { id: 2, label: 'Personas' },
  { id: 3, label: 'Gastos' },
];

interface Props {
  current: StepId;
  onGo: (step: StepId) => void;
}

export default function Stepper({ current, onGo }: Props) {
  return (
    <nav aria-label="Pasos" className="flex items-start justify-center px-2">
      {STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-start">
            {i > 0 && (
              <span
                className={`w-12 sm:w-16 h-[1.5px] mt-4 mx-1 transition-colors ${
                  s.id <= current ? 'bg-[#1A1410]' : 'bg-[#E8E2D9]'
                }`}
              />
            )}
            <button
              onClick={() => onGo(s.id)}
              aria-current={active ? 'step' : undefined}
              className="flex flex-col items-center gap-1.5 group"
            >
              <span
                className={`font-heading w-8 h-8 rounded-full flex items-center justify-center text-base leading-none transition-all ${
                  done || active
                    ? 'bg-[#1A1410] text-[#FAF7F2]'
                    : 'border-[1.5px] border-[#C9BFB3] text-[#8B7E74] group-hover:border-[#1A1410]'
                } ${active ? 'ring-4 ring-[#C8956C]/30' : ''}`}
              >
                {done ? '✓' : s.id}
              </span>
              <span className={`text-xs ${active ? 'font-semibold text-[#1A1410]' : 'text-[#8B7E74]'}`}>
                {s.label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
