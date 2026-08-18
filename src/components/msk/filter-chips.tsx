import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

/** Filtro em cápsulas com brilho neon, usado nos dashboards. */
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
        "flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-primary/20 bg-background/40 p-1.5 backdrop-blur-xl scrollbar-hide",
        "shadow-[inset_0_0_20px_hsl(var(--primary)/0.06)]",
        className,
      )}
    >
      {chips.map((chip) => {
        const active = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              "relative shrink-0 rounded-xl px-4 py-2 text-[0.6rem] font-black uppercase tracking-widest transition-all duration-300",
              active
                ? "bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.55)]"
                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              {chip.label}
              {typeof chip.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.55rem] font-black tabular-nums",
                    active ? "bg-background/25" : "bg-primary/10 text-primary",
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
