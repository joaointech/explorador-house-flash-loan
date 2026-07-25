"use client";

/** Horizontal (mobile) / vertical (lg) progress rail for the bridge wizard. */
export type StepMeta = { key: string; label: string };

export default function Stepper({
  steps,
  current,
  done,
  onSelect,
}: {
  steps: StepMeta[];
  current: number;
  done: Set<number>;
  /** Jump to a previously completed step. Only past (done) steps are selectable. */
  onSelect?: (i: number) => void;
}) {
  return (
    <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
      {steps.map((s, i) => {
        const isDone = done.has(i);
        const isCurrent = i === current;
        const canSelect = Boolean(onSelect) && isDone && !isCurrent;

        const inner = (
          <>
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
                isCurrent ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
                canSelect ? "group-hover:text-[var(--color-primary)]" : "",
              ].join(" ")}
            >
              {s.label}
            </span>
          </>
        );

        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center lg:flex-none">
            {canSelect ? (
              <button
                type="button"
                onClick={() => onSelect!(i)}
                title={`Go back to: ${s.label}`}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                {inner}
              </button>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-3 px-1 py-0.5">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
