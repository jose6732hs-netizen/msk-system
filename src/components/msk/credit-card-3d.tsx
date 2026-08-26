import { CreditCard, Wifi } from "lucide-react";

type CardTheme = { gradient: string; accent: string; label: string };

const DEFAULT_THEME: CardTheme = {
  gradient: "from-zinc-900 via-zinc-700 to-zinc-500",
  accent: "bg-white/10",
  label: "CARD",
};

const THEMES: Record<string, CardTheme> = {
  visa: {
    gradient: "from-blue-800 via-blue-600 to-cyan-400",
    accent: "bg-blue-300/20",
    label: "VISA",
  },
  mastercard: {
    gradient: "from-orange-500 via-red-500 to-rose-800",
    accent: "bg-orange-200/20",
    label: "MASTERCARD",
  },
  amex: {
    gradient: "from-emerald-700 via-teal-500 to-cyan-400",
    accent: "bg-emerald-200/20",
    label: "AMEX",
  },
  elo: {
    gradient: "from-violet-800 via-fuchsia-600 to-sky-500",
    accent: "bg-fuchsia-200/20",
    label: "ELO",
  },
  hipercard: {
    gradient: "from-pink-800 via-rose-600 to-red-500",
    accent: "bg-pink-200/20",
    label: "HIPERCARD",
  },
};

function previewNumber(value: string) {
  const digits = value.replace(/\D+/g, "").slice(0, 16);
  const padded = digits.padEnd(16, "•");
  return padded.replace(/(.{4})/g, "$1 ").trim();
}

export function CreditCard3D({
  brand,
  number,
  holderName,
  expiry,
}: {
  brand: string;
  number: string;
  holderName: string;
  expiry: string;
}) {
  const theme = THEMES[brand] ?? DEFAULT_THEME;

  return (
    <div className="mx-auto w-full max-w-[430px] px-1 [perspective:1200px] sm:px-0">
      <div
        className={`relative min-h-[190px] w-full overflow-hidden rounded-[22px] border border-white/15 bg-gradient-to-br ${theme.gradient} p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.4)] transition-all duration-500 [transform:rotateX(3deg)_rotateY(-3deg)] [transform-style:preserve-3d] sm:min-h-[220px] sm:rounded-[28px] sm:p-6 sm:shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:[transform:rotateX(7deg)_rotateY(-10deg)]`}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-black/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.22),transparent_34%,transparent_62%,rgba(255,255,255,0.07))]" />

        <div className="relative flex min-h-[158px] flex-col justify-between sm:min-h-[172px]" style={{ transform: "translateZ(22px)" }}>
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className={`grid h-10 w-12 shrink-0 place-items-center rounded-xl border border-white/20 ${theme.accent} backdrop-blur-md sm:h-11 sm:w-14`}>
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <Wifi className="h-4 w-4 shrink-0 rotate-90 text-white/75 sm:h-5 sm:w-5" />
              <span className="max-w-[110px] truncate rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[8px] font-black tracking-[0.12em] backdrop-blur-md sm:max-w-none sm:px-3 sm:text-[10px] sm:tracking-[0.18em]">
                {theme.label}
              </span>
            </div>
          </div>

          <div className="mt-5 sm:mt-7">
            <p className="break-all font-mono text-base font-black tracking-[0.1em] drop-shadow sm:text-xl sm:tracking-[0.16em]">
              {previewNumber(number)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:mt-6 sm:gap-5">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/65 sm:text-[9px] sm:tracking-[0.2em]">Titular</p>
              <p className="truncate text-xs font-black uppercase tracking-wide sm:text-sm">
                {holderName.trim() || "SEU NOME"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/65 sm:text-[9px] sm:tracking-[0.2em]">Validade</p>
              <p className="font-mono text-xs font-black tracking-wider sm:text-sm sm:tracking-widest">{expiry || "MM/AA"}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-4 h-3 w-[68%] rounded-full bg-black/35 blur-md sm:mt-5 sm:w-[72%]" />
    </div>
  );
}
