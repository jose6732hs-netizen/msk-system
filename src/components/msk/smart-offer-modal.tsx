import { Gift, Loader2, Percent, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const brl = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export function SmartOfferModal({ offer, busy, onAccept, onSkip, onClose }: {
  offer: any;
  busy?: boolean;
  onAccept: () => void;
  onSkip: () => void;
  onClose?: () => void;
}) {
  if (!offer?.available) return null;
  const companion = offer.companion;
  const main = offer.main;

  return (
    <div className="fixed inset-0 z-[100020] flex items-end justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="relative w-full max-w-xl overflow-hidden rounded-t-[2rem] border border-primary/20 bg-[#0B0B0B] shadow-2xl sm:rounded-[2rem]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-[90px]" />
        <div className="relative max-h-[92dvh] overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-primary"><Sparkles className="h-3.5 w-3.5 shrink-0" /> Oferta inteligente</div>
              <h2 className="mt-4 break-words text-2xl font-black uppercase leading-tight sm:text-3xl">Complete seu acesso com {offer.discountPercent}% OFF</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/50">Você escolheu <b className="text-white">{main.name}</b>. Adicione <b className="text-primary">{companion.name}</b> com o mesmo período e desconto exclusivo neste checkout.</p>
            </div>
            <button type="button" aria-label="Fechar oferta" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/50 transition hover:bg-white/5 hover:text-white" onClick={onClose ?? onSkip} disabled={busy}><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sua escolha</p>
              <p className="mt-2 break-words text-sm font-black uppercase">{main.name}</p>
              <p className="mt-2 text-xl font-black">{brl(main.price, main.currency)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{main.durationLabel}</p>
            </div>
            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-primary/[.06] p-4">
              <div className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-[8px] font-black uppercase text-black">-{offer.discountPercent}%</div>
              <div className="flex items-center gap-2 text-primary"><Gift className="h-4 w-4" /><span className="text-[9px] font-black uppercase tracking-widest">Adicionar agora</span></div>
              <p className="mt-2 break-words pr-14 text-sm font-black uppercase">{companion.name}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-xs text-white/35 line-through">{brl(companion.originalPrice, companion.currency)}</span><span className="text-2xl font-black text-primary">{brl(companion.discountedPrice, companion.currency)}</span></div>
              <p className="mt-1 text-[10px] text-muted-foreground">{companion.durationLabel}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Você economiza</span><span className="font-black text-emerald-400">{brl(offer.savings)}</span></div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-white/5 pt-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total do combo</span><span className="text-3xl font-black text-primary">{brl(offer.total)}</span></div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="neon" className="min-h-14 w-full whitespace-normal rounded-2xl px-4 text-center text-xs font-black uppercase leading-tight tracking-wider" onClick={onAccept} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Percent className="mr-2 h-4 w-4" />}Adicionar com {offer.discountPercent}% OFF</Button>
            <Button type="button" variant="ghost" className="min-h-14 w-full whitespace-normal rounded-2xl border border-white/10 px-4 text-center text-xs font-bold leading-tight text-muted-foreground" onClick={onSkip} disabled={busy}>Continuar só com {main.name}</Button>
          </div>
          <p className="mt-4 text-center text-[9px] leading-relaxed text-white/25">O desconto é aplicado somente à ferramenta complementar e não acumula duas vezes no mesmo item.</p>
        </div>
      </div>
    </div>
  );
}
