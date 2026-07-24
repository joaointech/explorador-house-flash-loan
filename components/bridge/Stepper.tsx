"use client";

/** Horizontal (mobile) / vertical (lg) progress rail for the bridge wizard. */
export type StepMeta = { key: string; label: string };

export default function Stepper({
  steps,
  current,
  done,
}: {
  steps: StepMeta[];
  current: number;
  done: Set<number>;
}) {
  return (
    <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
      {steps.map((s, i) => {
        const isDone = done.has(i);
        const isCurrent = i === current;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <span
              className={[
                "flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold transition-colors",
                isDone
                  ? "bg-[var(--color-primary)] text-white"
                  : isCurrent
                    ? "bg-[#DBEAFE] text-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20 dark:bg-[var(--color-primary)]/20"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
              ].join(" ")}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span
              className={[
                "truncate text-sm font-medium lg:whitespace-normal",
                isCurrent
                  ? "text-slate-800 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400",
              ].join(" ")}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
