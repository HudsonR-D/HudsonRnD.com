'use client';

interface StepIndicatorProps {
  current: number;  // 1-based
  total?: number;
  labels?: string[];
}

const DEFAULT_LABELS = ['Details', 'Upload ID', 'Sign', 'Review & Pay', 'Done'];

export default function StepIndicator({
  current,
  total = 5,
  labels = DEFAULT_LABELS,
}: StepIndicatorProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      {/* Mobile: simple text */}
      <p className="text-xs text-zinc-500 text-center mb-3 md:hidden">
        Step {current} of {total} — {labels[current - 1]}
      </p>

      {/* Desktop: full step bar */}
      <div className="hidden md:flex items-center justify-between">
        {Array.from({ length: total }).map((_, i) => {
          const step = i + 1;
          const isDone = step < current;
          const isCurrent = step === current;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-all duration-200
                    ${isDone
                      ? 'bg-teal-500 text-slate-950'
                      : isCurrent
                      ? 'bg-white text-slate-950 ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950'
                      : 'bg-zinc-800 text-zinc-500'}
                  `}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`
                    mt-1 text-xs whitespace-nowrap
                    ${isCurrent ? 'text-white font-medium' : 'text-zinc-500'}
                  `}
                >
                  {labels[i]}
                </span>
              </div>

              {/* Connector line */}
              {step < total && (
                <div
                  className={`
                    h-px flex-1 mx-2 mb-4 transition-all duration-200
                    ${isDone ? 'bg-teal-500' : 'bg-zinc-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
