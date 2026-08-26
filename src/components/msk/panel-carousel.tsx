import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";
import { DEFAULT_PANEL_BANNERS } from "@/lib/site-images";

export function PanelCarousel() {
  const [current, setCurrent] = useState(0);
  const getCms = useServerFn(getCmsContent);

  const { data: settings } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  const allBanners =
    (settings as any)?.panel?.banners ||
    (settings as any)?.hero?.banners ||
    DEFAULT_PANEL_BANNERS;
  const banners = allBanners
    .filter((b: any) => b.active !== false && b.url)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const next = useCallback(() => {
    setCurrent((curr) => (curr >= banners.length - 1 ? 0 : curr + 1));
  }, [banners.length]);

  const prev = () => {
    setCurrent((curr) => (curr === 0 ? banners.length - 1 : curr - 1));
  };

  useEffect(() => {
    if (banners.length > 0) {
      const timer = setInterval(next, 5000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [next, banners.length]);

  if (!banners || banners.length === 0) return null;

  return (
    <div className="group relative mx-auto aspect-video w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-primary/20 sm:aspect-[2.4/1] sm:rounded-[2.5rem]">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner: any, i: number) => (
          <div key={i} className="relative h-full min-w-full p-0 sm:p-2">
            <div className="h-full w-full overflow-hidden rounded-[1rem] sm:rounded-[2rem]">
              <img
                src={banner.url}
                alt={banner.alt}
                className="h-full w-full rounded-none bg-black/20 object-contain"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-60" />
            </div>
          </div>
        ))}
      </div>

      {banners.length > 1 ? (
        <>
          <div className="absolute inset-y-0 left-2 z-30 flex items-center opacity-100 transition-opacity sm:left-4 sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              size="icon"
              variant="neonOutline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                prev();
              }}
              className="h-10 w-10 rounded-full border-primary/50 bg-background/40 backdrop-blur-sm hover:bg-primary/20"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </Button>
          </div>

          <div className="absolute inset-y-0 right-2 z-30 flex items-center opacity-100 transition-opacity sm:right-4 sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              size="icon"
              variant="neon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                next();
              }}
              className="h-10 w-10 rounded-full"
              aria-label="Próximo banner"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>

          <div className="absolute bottom-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0 sm:bottom-2">
            {banners.map((_: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className="grid h-8 w-8 place-items-center rounded-full"
                aria-label={`Ir para banner ${i + 1}`}
                aria-current={current === i ? "true" : undefined}
              >
                <span
                  className={`h-2 rounded-full transition-all ${
                    current === i ? "w-5 bg-primary" : "w-2 bg-primary/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
