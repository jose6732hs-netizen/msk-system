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
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <NightSky />
      <SiteHeader />
      
      <main>
        <section className="relative z-10 pt-20 pb-12 sm:pt-32 sm:pb-20">
          <div className="container px-4 mx-auto text-center">
            <h1 className="text-5xl font-black tracking-tighter uppercase sm:text-8xl mb-6">
              SEJA <span className="neon-text">BEM-VINDO</span>
            </h1>
            <p className="max-w-2xl mx-auto text-sm sm:text-base font-medium text-muted-foreground uppercase tracking-[0.2em] mb-12">
              A MAIOR PLATAFORMA DE SOLUÇÕES DIGITAIS • MSK SISTEM
            </p>
          </div>
        </section>

        <section className="relative z-10 px-4 mb-20">
          <div className="max-w-6xl mx-auto">
            <HeroCarousel />
          </div>
        </section>

        <section className="relative z-10 py-20 bg-black/40 border-y border-white/5">
          <div className="container px-4 mx-auto text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="text-4xl font-black text-primary">100%</div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Automação</p>
              </div>
              <div className="space-y-4">
                <div className="text-4xl font-black text-primary">24/7</div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Suporte Ativo</p>
              </div>
              <div className="space-y-4">
                <div className="text-4xl font-black text-primary">+10k</div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Usuários Felizes</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
