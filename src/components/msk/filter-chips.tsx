import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

/** Filtro em trilho tecnológico com cápsulas neon, compartilhado pelos dashboards. */
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
      data-msk-filter-rail
      className={cn(
        "relative isolate flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto rounded-[1.45rem] border border-primary/30 p-[7px] backdrop-blur-2xl scrollbar-hide",
        "bg-[radial-gradient(circle_at_12%_0%,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--background)/0.96),hsl(var(--background)/0.68))]",
        "shadow-[0_24px_70px_-42px_hsl(var(--primary)/0.95),0_0_0_1px_hsl(var(--primary)/0.035),inset_0_1px_0_hsl(var(--foreground)/0.09),inset_0_0_36px_hsl(var(--primary)/0.055)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/90 to-transparent shadow-[0_0_18px_hsl(var(--primary)/0.9)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent shadow-[0_0_10px_hsl(var(--primary)/0.25)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-primary/12 to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-primary/50 bg-background shadow-[0_0_12px_hsl(var(--primary)/0.65)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-primary/50 bg-background shadow-[0_0_12px_hsl(var(--primary)/0.65)]"
      />

      {chips.map((chip, index) => {
        const active = value === chip.id;
        return (
          <div key={chip.id} className="relative flex shrink-0 items-center">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="mr-1.5 hidden h-px w-3 bg-gradient-to-r from-primary/10 via-primary/55 to-primary/10 shadow-[0_0_7px_hsl(var(--primary)/0.38)] sm:block"
              />
            ) : null}
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(chip.id)}
              className={cn(
                "group/chip relative isolate min-h-10 shrink-0 overflow-hidden rounded-[1rem] border px-3.5 py-2 text-[0.58rem] font-black uppercase tracking-[0.16em] outline-none transition-all duration-300 sm:px-4 sm:text-[0.61rem]",
                "focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "-translate-y-px border-primary/70 bg-[linear-gradient(135deg,hsl(var(--primary)/0.98),hsl(var(--primary)/0.7))] text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_0_30px_hsl(var(--primary)/0.62),0_12px_34px_-20px_hsl(var(--primary)/0.95),inset_0_1px_0_hsl(var(--foreground)/0.24),inset_0_-12px_28px_hsl(var(--background)/0.1)]"
                  : "border-white/[0.075] bg-[linear-gradient(145deg,hsl(var(--foreground)/0.035),transparent)] text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.045)] hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.085] hover:text-foreground hover:shadow-[0_0_22px_hsl(var(--primary)/0.2),inset_0_1px_0_hsl(var(--foreground)/0.08)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-all duration-300",
                  active ? "via-white/90 opacity-100" : "via-primary/35 opacity-60 group-hover/chip:via-primary/70 group-hover/chip:opacity-100",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -right-5 -top-8 h-16 w-16 rounded-full blur-2xl transition-opacity duration-300",
                  active ? "bg-white/30 opacity-100" : "bg-primary/25 opacity-0 group-hover/chip:opacity-80",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-current transition-all duration-300",
                  active ? "w-2/3 opacity-60 shadow-[0_0_8px_currentColor]" : "w-0 opacity-0 group-hover/chip:w-1/2 group-hover/chip:opacity-25",
                )}
              />

              <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                <span className="relative grid h-2.5 w-2.5 shrink-0 place-items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute h-2 w-2 rounded-full transition-all duration-300",
                      active
                        ? "bg-primary-foreground shadow-[0_0_10px_hsl(var(--primary-foreground)/0.95)]"
                        : "bg-primary/35 shadow-[0_0_7px_hsl(var(--primary)/0.3)] group-hover/chip:bg-primary/80",
                    )}
                  />
                  {active ? <span aria-hidden="true" className="absolute h-2.5 w-2.5 rounded-full border border-primary-foreground/55" /> : null}
                </span>
                {chip.label}
                {typeof chip.count === "number" && (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[0.54rem] font-black tabular-nums tracking-normal transition-colors",
                      active
                        ? "border-primary-foreground/20 bg-background/20 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]"
                        : "border-primary/20 bg-primary/10 text-primary",
                    )}
                  >
                    {chip.count}
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
