import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountUpProps {
  value: number | string | null | undefined;
  /** formata como moeda BRL (começa em R$ 0,01 e sobe até o valor final) */
  currency?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

function toNumber(value: CountUpProps["value"]): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Valor animado: sempre inicia do zero (centavo a centavo) ao abrir a página
 * e sobe até o valor final com easing cinematográfico.
 */
export function CountUp({
  value,
  currency = false,
  decimals,
  prefix = "",
  suffix = "",
  duration = 1400,
  className,
}: CountUpProps) {
  const target = toNumber(value);
  const frac = decimals ?? (currency ? 2 : 0);
  const [display, setDisplay] = useState(target > 0 ? 0 : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce || target <= 0) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(from + (target - from) * easeOutExpo(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  const running = display < target;
  const text = display.toLocaleString("pt-BR", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
    ...(currency ? { style: "currency", currency: "BRL" } : {}),
  });

  return (
    <span
      className={cn("tabular-nums transition-colors", running && "text-primary", className)}
      style={running ? { textShadow: "0 0 18px color-mix(in oklab, var(--primary) 55%, transparent)" } : undefined}
    >
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

export default CountUp;
