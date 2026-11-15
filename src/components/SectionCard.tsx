import type { ReactNode } from 'react';

interface Props {
  step: number;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  delay?: number;
}

export default function SectionCard({ step, title, hint, action, children, delay = 0 }: Props) {
  return (
    <section
      className="animate-rise bg-white rounded-3xl border border-[#E8E2D9] p-5 shadow-[0_1px_2px_rgba(26,20,16,0.04),0_8px_24px_-12px_rgba(26,20,16,0.12)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="font-heading w-8 h-8 shrink-0 rounded-full bg-[#1A1410] text-[#FAF7F2] flex items-center justify-center text-base leading-none">
          {step}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl leading-tight text-[#1A1410]">{title}</h2>
          {hint && <p className="text-xs text-[#8B7E74] mt-0.5">{hint}</p>}
        </div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
