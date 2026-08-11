import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";
import { DEFAULT_LANDING_BANNERS } from "@/lib/site-images";

export function HeroCarousel() {
  const getCms = useServerFn(getCmsContent);
  const { data: settings, isLoading } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  const allBanners = (settings as any)?.hero?.banners || DEFAULT_LANDING_BANNERS;
  const banners = allBanners
    .map((b: any, index: number) => ({ ...b, originalIndex: index }))
    .filter((b: any) => b.active !== false && b.url)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((curr) => (curr === banners.length - 1 ? 0 : curr + 1));
  }, [banners.length]);

  const prev = () => {
    setCurrent((curr) => (curr === 0 ? banners.length - 1 : curr - 1));
  };

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  if (isLoading) return null;
  if (!banners.length) return null;

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border border-primary/20 group aspect-video sm:aspect-[2.4/1]">
      <div 
        className="flex transition-transform duration-700 ease-in-out h-full"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner: any, i: number) => (
          <div key={i} className="min-w-full h-full relative p-0 sm:p-2">
            <div className="w-full h-full overflow-hidden rounded-[1rem] sm:rounded-[2rem]">
              <img 
                src={banner.url} 
                alt={banner.alt} 
                className="w-full h-full object-cover rounded-none bg-black/20"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-60 pointer-events-none" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-y-0 left-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <Button 
          size="icon" 
          variant="neonOutline" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            prev();
          }} 
          className="rounded-full w-10 h-10 bg-background/20 backdrop-blur-sm border-primary/50 hover:bg-primary/20"
        >
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Button>
      </div>

      <div className="absolute inset-y-0 right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <Button 
          size="icon" 
          variant="neon" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            next();
          }} 
          className="rounded-full w-10 h-10"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_: any, i: number) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              current === i ? "bg-primary w-6" : "bg-primary/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
