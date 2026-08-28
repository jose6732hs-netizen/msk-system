import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

/** Filtro em cápsulas com trilho tecnológico e brilho neon, usado nos dashboards. */
export function FilterChips({
  chips,
  value,
  onChange,
  className,
}: {
  chips: FilterChip[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-[1.35rem] border border-primary/25 bg-[linear-gradient(135deg,hsl(var(--background)/0.88),hsl(var(--background)/0.56))] p-1.5 backdrop-blur-2xl scrollbar-hide",
        "shadow-[0_18px_46px_-30px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08),inset_0_0_30px_hsl(var(--primary)/0.07)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_0_14px_hsl(var(--primary)/0.85)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />

      {chips.map((chip) => {
        const active = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              "group/chip relative isolate shrink-0 overflow-hidden rounded-[0.95rem] border px-4 py-2.5 text-[0.6rem] font-black uppercase tracking-[0.16em] outline-none transition-all duration-300",
              "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "-translate-y-px border-primary/60 bg-[linear-gradient(135deg,hsl(var(--primary)/0.98),hsl(var(--primary)/0.72))] text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.14),0_0_24px_hsl(var(--primary)/0.58),0_10px_28px_-18px_hsl(var(--primary)/0.95),inset_0_1px_0_hsl(var(--foreground)/0.18)]"
                : "border-white/[0.06] bg-white/[0.025] text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.035)] hover:-translate-y-px hover:border-primary/35 hover:bg-primary/[0.08] hover:text-foreground hover:shadow-[0_0_18px_hsl(var(--primary)/0.16),inset_0_1px_0_hsl(var(--foreground)/0.07)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300",
                active ? "via-white/75 opacity-100" : "via-primary/30 opacity-60 group-hover/chip:opacity-100",
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -right-5 -top-8 h-16 w-16 rounded-full blur-2xl transition-opacity duration-300",
                active ? "bg-white/25 opacity-100" : "bg-primary/25 opacity-0 group-hover/chip:opacity-70",
              )}
            />

            <span className="relative z-10 flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300",
                  active
                    ? "bg-primary-foreground shadow-[0_0_8px_hsl(var(--primary-foreground)/0.95)]"
                    : "bg-primary/35 shadow-[0_0_6px_hsl(var(--primary)/0.28)] group-hover/chip:bg-primary/75",
                )}
              />
              {chip.label}
              {typeof chip.count === "number" && (
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[0.55rem] font-black tabular-nums tracking-normal transition-colors",
                    active
                      ? "border-primary-foreground/15 bg-background/20 text-primary-foreground"
                      : "border-primary/15 bg-primary/10 text-primary",
                  )}
                >
                  {chip.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
