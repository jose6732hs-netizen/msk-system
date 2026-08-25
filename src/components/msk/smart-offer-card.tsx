import { Check, Gift, Loader2, Percent, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dailyLicenseAsset from "@/assets/daily_license_card.jpg.asset.json";
import bannerOfferAsset from "@/assets/banner-offer.png.asset.json";
import cardSemanalImg from "@/assets/card-semanal.jpg";
import cardMensalImg from "@/assets/card-mensal.jpg";
import cardTrimestralImg from "@/assets/card-trimestral.jpg";

const PRIMARY_IMAGES: Record<string, string> = {
  daily: dailyLicenseAsset.url,
  weekly: cardSemanalImg,
  monthly: cardMensalImg,
  quarterly: cardTrimestralImg,
};

export function smartOfferImage(product?: any) {
  if (product?.imageUrl) return product.imageUrl;
  if (product?.image_url) return product.image_url;
  const slug = String(product?.slug ?? "");
  if (slug === "page-cloner-daily") return "/cloner-offers/cloner-daily.webp";
  if (slug === "page-cloner-weekly") return "/cloner-offers/cloner-weekly.webp";
  if (slug === "page-cloner-monthly") return "/cloner-offers/cloner-monthly.webp";
  return PRIMARY_IMAGES[slug] ?? bannerOfferAsset.url;
}

const brl = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value ?? 0));

export function SmartOfferCard({
  offer,
  accepted = false,
  busy = false,
  onAdd,
  onRemove,
}: {
  offer: any;
  accepted?: boolean;
  busy?: boolean;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  if (!offer?.available || !offer?.companion) return null;
  const item = offer.companion;
  const image = smartOfferImage(item);

  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl border ${accepted ? "border-emerald-400/30 bg-emerald-400/[.05]" : "border-amber-300/25 bg-amber-300/[.045]"}`}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/5 px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Gift className="h-4 w-4 shrink-0 text-amber-300" />
          <p className="min-w-0 truncate text-[9px] font-black uppercase tracking-[.16em] text-amber-200">
            {accepted ? "Adicionado ao seu pedido" : "Oferta para completar seu pedido"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase text-black">
          {offer.discountPercent}% OFF
        </span>
      </div>

      <div className="flex min-w-0 gap-3 p-3.5 sm:gap-4 sm:p-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black sm:h-28 sm:w-28">
          <img src={image} alt={item.name} className="h-full w-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-black uppercase leading-tight text-white sm:text-base">{item.name}</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.durationLabel}</p>

          <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs font-bold text-white/35 line-through">{brl(item.originalPrice, item.currency)}</span>
            <span className="text-xl font-black text-primary sm:text-2xl">{brl(item.discountedPrice, item.currency)}</span>
          </div>
          <p className="mt-1 text-[10px] font-bold text-emerald-400">Economize {brl(offer.savings, item.currency)}</p>

          <div className="mt-3 flex min-w-0 items-start gap-2 text-[10px] leading-relaxed text-white/45">
            <span className="mt-0.5 rounded-full bg-primary p-0.5 text-black"><Check className="h-2.5 w-2.5" /></span>
            <span className="min-w-0 break-words">Licença separada, mesma duração do plano escolhido e ativação somente quando for usada.</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 p-3.5 sm:p-4">
        {accepted ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-2 text-xs font-black text-emerald-400">
              <Percent className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">Desconto aplicado ao item adicional</span>
            </div>
            {onRemove ? (
              <Button type="button" variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-red-400 sm:w-auto" onClick={onRemove} disabled={busy}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover do pedido
              </Button>
            ) : null}
          </div>
        ) : (
          <Button type="button" variant="neon" className="min-h-12 w-full whitespace-normal rounded-xl text-xs font-black uppercase" onClick={onAdd} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar {item.name} por {brl(item.discountedPrice, item.currency)}
          </Button>
        )}
      </div>
    </section>
  );
}
