import { useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatPrice(price: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

export function OfferCarouselSection({
  sectionId,
  eyebrow,
  title,
  description,
  bannerUrl,
  plans,
  highlightSlug,
  loadingPlan,
  planImage,
  onAdd,
  onShare,
}: {
  sectionId: string;
  eyebrow: string;
  title: string;
  description: string;
  bannerUrl: string;
  plans: any[];
  highlightSlug?: string;
  loadingPlan: string | null;
  planImage: (plan: any) => string;
  onAdd: (plan: any) => void;
  onShare: (plan: any) => void;
}) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const interactionUntil = useRef(0);

  useEffect(() => {
    if (plans.length <= 1) return;
    const timer = window.setInterval(() => {
      const el = carouselRef.current;
      if (!el || document.hidden || Date.now() < interactionUntil.current) return;
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-plan-card]"));
      const step = cards[0]?.offsetWidth ? cards[0].offsetWidth + 16 : Math.min(346, el.clientWidth * 0.86);
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - step * 0.6;
      el.scrollTo({ left: nearEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [plans.length]);

  if (!plans.length) return null;

  const markInteraction = () => {
    interactionUntil.current = Date.now() + 7000;
  };

  const scrollByCard = (direction: 1 | -1) => {
    const el = carouselRef.current;
    if (!el) return;
    markInteraction();
    const card = el.querySelector<HTMLElement>("[data-plan-card]");
    const step = card?.offsetWidth ? card.offsetWidth + 16 : 346;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section id={sectionId} className="mt-14 min-w-0 scroll-mt-24 sm:mt-16">
      <div className="mb-5 max-w-3xl sm:mb-7">
        <p className="text-[9px] font-black uppercase tracking-[.24em] text-primary sm:text-[10px]">{eyebrow}</p>
        <h2 className="mt-2 break-words text-3xl font-black uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-xs font-medium leading-relaxed text-white/65 sm:text-sm">{description}</p>
      </div>

      <div className="w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#080808] p-2 shadow-2xl sm:p-3">
        <div className="relative flex min-h-[170px] w-full items-center justify-center overflow-hidden rounded-[1.35rem] bg-black/50 sm:min-h-[220px] lg:min-h-[270px]">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={`Banner ${title}`}
              loading="lazy"
              className="max-h-[360px] h-auto w-full object-contain"
            />
          ) : null}
        </div>
      </div>

      <div className="relative mt-6 min-w-0 sm:mt-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 hidden items-center justify-between lg:flex">
          <button type="button" aria-label={`Ofertas anteriores de ${title}`} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-black/85 text-primary shadow-xl" onClick={() => scrollByCard(-1)}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label={`Próximas ofertas de ${title}`} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-black/85 text-primary shadow-xl" onClick={() => scrollByCard(1)}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div
          ref={carouselRef}
          onPointerDown={markInteraction}
          onTouchStart={markInteraction}
          onWheel={markInteraction}
          onScroll={markInteraction}
          style={{ touchAction: "pan-x pan-y" }}
          className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:px-8"
        >
          {plans.map((plan: any) => {
            const highlighted = String(plan.slug ?? "") === highlightSlug;
            const isFree = Number(plan.price) === 0;
            return (
              <article data-plan-card key={plan.id} className={`relative flex w-[82vw] max-w-[330px] shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] border bg-[#0A0A0A] sm:w-[45vw] lg:w-[310px] ${highlighted ? "border-primary/60 shadow-[0_0_60px_rgba(57,255,20,.12)]" : "border-white/10"}`}>
                <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-black/60 p-2 sm:h-56 sm:p-3">
                  <img src={planImage(plan)} alt={plan.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[8px] font-black uppercase text-black">{highlighted ? "Mais popular" : isFree ? "Teste" : "Oferta"}</span>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="break-words text-[10px] font-black uppercase tracking-[.18em] text-primary">{plan.name}</p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-black text-white">{formatPrice(Number(plan.price), plan.currency)}</span>
                    {!plan.is_lifetime ? <span className="text-[10px] font-bold uppercase text-muted-foreground">/{plan.duration_label}</span> : null}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {(plan.highlights ?? []).map((h: string) => (
                      <li key={h} className="flex min-w-0 items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="mt-0.5 rounded-full bg-primary p-0.5 text-black"><Check className="h-2.5 w-2.5" /></span>
                        <span className="min-w-0 break-words">{h}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Button className="min-h-14 w-full whitespace-normal rounded-2xl bg-[#22C55E] px-3 text-center text-[10px] font-black uppercase leading-tight text-white hover:bg-[#28D56A] sm:text-xs" disabled={loadingPlan === plan.id} onClick={() => onAdd(plan)}>
                      {loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isFree ? "Testar grátis" : "Adicionar"}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-14 w-full whitespace-normal rounded-2xl border border-white/10 px-3 text-center text-[10px] font-black uppercase text-white/70 hover:border-primary/30 hover:text-primary sm:text-xs" onClick={() => onShare(plan)}>
                      <Share2 className="mr-2 h-4 w-4 shrink-0" /> Compartilhar
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
