import { CountUp } from "@/components/msk/animated-number";

/** Valor monetário animado do zero até o total (padrão em todo o sistema). */
export function Money({ value, duration = 1200, className }: { value: unknown; duration?: number; className?: string }) {
  return <CountUp value={Number(value ?? 0)} currency duration={duration} {...(className ? { className } : {})} />;
}

export default Money;
