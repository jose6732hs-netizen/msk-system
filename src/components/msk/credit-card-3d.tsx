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
    <div className="mx-auto w-full max-w-[430px] [perspective:1200px]">
      <div
        className={`relative min-h-[220px] w-full overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br ${theme.gradient} p-6 text-white shadow-[0_28px_80px_rgba(0,0,0,0.45)] transition-all duration-500`}
        style={{ transform: "rotateX(7deg) rotateY(-10deg)", transformStyle: "preserve-3d" }}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-black/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.22),transparent_34%,transparent_62%,rgba(255,255,255,0.07))]" />

        <div className="relative flex min-h-[172px] flex-col justify-between" style={{ transform: "translateZ(26px)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className={`grid h-11 w-14 place-items-center rounded-xl border border-white/20 ${theme.accent} backdrop-blur-md`}>
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 rotate-90 text-white/75" />
              <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1 text-[10px] font-black tracking-[0.18em] backdrop-blur-md">
                {theme.label}
              </span>
            </div>
          </div>

          <div className="mt-7">
            <p className="break-all font-mono text-lg font-black tracking-[0.16em] drop-shadow sm:text-xl">
              {previewNumber(number)}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-5">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/65">Titular</p>
              <p className="truncate text-sm font-black uppercase tracking-wide">
                {holderName.trim() || "SEU NOME"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/65">Validade</p>
              <p className="font-mono text-sm font-black tracking-widest">{expiry || "MM/AA"}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 h-3 w-[72%] rounded-full bg-black/35 blur-md" />
    </div>
  );
}
