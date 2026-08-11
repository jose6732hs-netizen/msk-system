import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { HeroCarousel } from "@/components/msk/hero-carousel";
import { NightSky } from "@/components/msk/night-sky";

export const Route = createFileRoute("/")({
  head: () => ({
    title: "MSK SISTEM — Tecnologia e Performance",
    meta: [
      {
        name: "description",
        content: "A plataforma definitiva para automação e gestão de licenças com alta performance.",
      },
      { property: "og:title", content: "MSK SISTEM" },
      { property: "og:description", content: "Automação e gestão de licenças premium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-foreground overflow-hidden font-sans">
      <NightSky intensity={0.4} />
      <SiteHeader />
      
      <main>
        {/* Hero Section - Estilo MSK Original */}
        <section className="relative z-10 pt-24 pb-16 sm:pt-40 sm:pb-32">
          <div className="container px-4 mx-auto text-center">
            <div className="inline-block px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.3em] uppercase bg-primary/10 border border-primary/20 text-primary rounded-full animate-pulse">
              Tecnologia de Alta Performance
            </div>
            <h1 className="text-6xl font-black tracking-tighter uppercase sm:text-9xl mb-8 leading-none">
              SEJA <span className="neon-text drop-shadow-[0_0_15px_rgba(255,0,229,0.5)]">BEM-VINDO</span>
            </h1>
            <p className="max-w-3xl mx-auto text-sm sm:text-lg font-bold text-muted-foreground uppercase tracking-[0.25em] mb-12 opacity-80">
              A MAIOR PLATAFORMA DE SOLUÇÕES DIGITAIS • <span className="text-white">MSK SISTEM</span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary/50 hidden sm:block"></div>
              <div className="px-6 py-3 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl text-[11px] font-bold tracking-widest uppercase text-white/70">
                Performance • Gestão • Resultados
              </div>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary/50 hidden sm:block"></div>
            </div>
          </div>
        </section>

        {/* Banner Carousel Section */}
        <section className="relative z-10 px-4 mb-24">
          <div className="max-w-6xl mx-auto p-1 bg-gradient-to-b from-primary/20 to-transparent rounded-[2rem] sm:rounded-[3rem]">
            <HeroCarousel />
          </div>
        </section>

        {/* Stats Section - Premium Dark */}
        <section className="relative z-10 py-24 bg-gradient-to-b from-black/0 via-white/5 to-black/0 border-y border-white/5">
          <div className="container px-4 mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
              <div className="text-center group">
                <div className="text-5xl sm:text-6xl font-black text-white mb-2 group-hover:text-primary transition-colors">100%</div>
                <div className="h-1 w-8 bg-primary mx-auto mb-4"></div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-black">Automação Inteligente</p>
              </div>
              <div className="text-center group border-y md:border-y-0 md:border-x border-white/10 py-12 md:py-0">
                <div className="text-5xl sm:text-6xl font-black text-white mb-2 group-hover:text-primary transition-colors">24/7</div>
                <div className="h-1 w-8 bg-primary mx-auto mb-4"></div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-black">Suporte Especializado</p>
              </div>
              <div className="text-center group">
                <div className="text-5xl sm:text-6xl font-black text-white mb-2 group-hover:text-primary transition-colors">+10k</div>
                <div className="h-1 w-8 bg-primary mx-auto mb-4"></div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-black">Usuários Ativos</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
