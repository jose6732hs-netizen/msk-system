import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import banner1 from "@/assets/banner1.jpg.asset.json";
import banner2 from "@/assets/banner2.png.asset.json";

const BANNERS = [
  {
    url: banner1.url,
    alt: "MSK Sistem Lovable Ilimitado",
  },
  {
    url: banner2.url,
    alt: "MSK Sistem - O Mais Barato do Mercado",
  },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((curr) => (curr === BANNERS.length - 1 ? 0 : curr + 1));
  }, []);

  const prev = () => {
    setCurrent((curr) => (curr === 0 ? BANNERS.length - 1 : curr - 1));
  };

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden sm:rounded-[2.5rem] border-y sm:border border-primary/20 group aspect-[16/9] sm:aspect-[2.4/1]">
      <div 
        className="flex transition-transform duration-700 ease-in-out h-full"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {BANNERS.map((banner, i) => (
          <div key={i} className="min-w-full h-full relative p-0 sm:p-2">
            <div className="w-full h-full overflow-hidden sm:rounded-[2rem]">
              <img 
                src={banner.url} 
                alt={banner.alt} 
                className="w-full h-full object-cover rounded-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60 pointer-events-none" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-y-0 left-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="neonOutline" onClick={prev} className="rounded-full w-10 h-10 bg-background/20 backdrop-blur-sm">
          <ChevronLeft className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute inset-y-0 right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="neon" onClick={next} className="rounded-full w-10 h-10">
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {BANNERS.map((_, i) => (
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
