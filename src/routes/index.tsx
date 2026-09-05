import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { getCmsContent } from "@/lib/cms.functions";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { Button } from "@/components/ui/button";
import { HeroCarousel } from "@/components/msk/hero-carousel";
import { HeroScene3D } from "@/components/msk/hero-scene-3d";
import agentBannerAsset from "@/assets/banner-agente-msk.png.asset.json";

// Animação: contagem animada de números (profissional, sobe do centavo ao valor total)
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setStarted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end * 100) / 100);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
}

// Framer Motion variants reutilizáveis
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
};

const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" },
};

const slideInRight = {
  initial: { opacity: 0, x: 50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" },
};

function Index() {
  const getCms = useServerFn(getCmsContent);
  const { data: cms } = useSuspenseQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-5 relative overflow-visible">
        {/* Glow decorativo centralizado */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] -z-10" />

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center w-full min-w-0 pt-8 md:pt-16 gap-8 lg:gap-12 text-left relative z-20">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="flex-1 min-w-0 w-full space-y-6 sm:space-y-8"
          >
            <motion.div variants={fadeInUp} className="w-full mb-4 sm:mb-8">
              <HeroCarousel />
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter text-yellow-400 uppercase leading-[0.95] break-words text-center lg:text-left py-2"
            >
              {cms["hero"]?.title || "Pare de ser interrompido no meio da criação"}
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed text-center lg:text-left mx-auto lg:mx-0 px-2"
            >
              {cms["hero"]?.subtitle ||
                "Acesso completo à extensão Lovable com créditos infinitos. Crie apps, landing pages e sistemas o dia inteiro sem travar, sem contar crédito e sem perder o ritmo."}
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full justify-center lg:justify-start"
            >
              <Button
                asChild
                size="lg"
                className="px-6 h-14 text-sm sm:text-lg w-full sm:w-auto whitespace-normal text-center leading-tight flex items-center justify-center bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.6)] hover:bg-pink-400 hover:shadow-[0_0_30px_rgba(236,72,153,0.8)] transition-all duration-300"
              >
                <Link to={cms["hero"]?.cta_link || "/auth"}>
                  {cms["hero"]?.cta_text || "Quero créditos infinitos agora"}
                </Link>
              </Button>
              <Button
                asChild
                variant="neonOutline"
                size="lg"
                className="px-6 h-14 text-sm sm:text-lg w-full sm:w-auto whitespace-normal text-center leading-tight flex items-center justify-center"
              >
                <Link to="/planos" preload="intent">
                  Ver Planos e Preços
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex-1 min-w-0 w-full h-[280px] sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[700px] relative mt-[-20px] lg:mt-0 flex items-center justify-center pointer-events-auto"
          >
            <HeroScene3D />
          </motion.div>
        </div>

        {/* Banner Agente */}
        <motion.section
          {...fadeInUp}
          id="msk-agente-destaque"
          aria-label="Destaque MSK Agente"
          className="relative z-20 mx-auto mt-10 sm:mt-12 w-full max-w-6xl overflow-hidden rounded-2xl sm:rounded-[2rem] border border-fuchsia-400/25 bg-black/60 shadow-[0_24px_90px_-35px_rgba(217,70,239,.65)]"
        >
          <Link to="/planos" preload="intent" className="block w-full">
            <img
              src={agentBannerAsset.url}
              alt="MSK Agente — método oficial Lovable"
              className="block h-auto w-full object-contain"
            />
          </Link>
        </motion.section>

        {/* Conteúdo principal */}
        <div className="max-w-4xl mx-auto w-full mt-16 sm:mt-20 text-left space-y-16 sm:space-y-20 relative z-20">

          {/* Seção Parceiros / Afiliados */}
          <motion.section
            {...fadeInUp}
            className="text-center bg-white/5 p-6 sm:p-10 md:p-12 rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -z-10" />

            <motion.span
              initial={{ opacity: 0, letterSpacing: "0.1em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.2em" }}
              transition={{ duration: 1 }}
              className="text-primary font-bold text-xs tracking-widest uppercase mb-4 block"
            >
              PARA AFILIADOS E EMPRESAS
            </motion.span>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 sm:mb-6 uppercase tracking-tighter">
              {cms["partners_teaser"]?.title || "Revenda e ganhe comissões recorrentes"}
            </h2>

            <p className="text-muted-foreground text-base sm:text-lg mb-8 sm:mb-10 max-w-2xl mx-auto">
              {cms["partners_teaser"]?.subtitle ||
                "Entre para o programa de parceiros e transforme sua audiência em renda. Estrutura simples, pagamentos via PIX e suporte total."}
            </p>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 text-left"
            >
              {[
                "Ganhos de até 60%",
                "Painel em tempo real",
                "Materiais prontos",
                "Suporte dedicado",
              ].map((text, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  {text}
                </motion.div>
              ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button asChild variant="neon" size="lg" className="px-6 sm:px-8">
                <Link to="/parceiros" preload="intent">
                  Quero participar
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-6 sm:px-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link to="/parceiros" preload="intent">
                  Ver detalhes
                </Link>
              </Button>
            </div>
          </motion.section>

          {/* Diferencial */}
          <motion.section {...fadeInUp} className="text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 uppercase tracking-tighter">
              A diferença não é talento. A diferença é não ter limite.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Enquanto a maioria das pessoas para no meio do fluxo porque os créditos acabaram, quem tem acesso ilimitado continua criando, testando e entregando.
            </p>
          </motion.section>

          {/* Problema */}
          <section className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <motion.div {...slideInLeft} className="space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary uppercase tracking-tighter">
                Você já passou por isso?
              </h2>
              <div className="space-y-4 text-muted-foreground text-sm sm:text-base">
                <p>
                  Está no meio de um projeto promissor e os créditos acabram. A ideia estava fluindo… e de repente trava.
                </p>
                <p>
                  Você perde o momentum, a motivação e às vezes até o cliente. Precisa esperar, pagar de novo ou aceitar que não vai conseguir terminar hoje.
                </p>
                <p className="text-foreground font-semibold">
                  Isso não é falta de capacidade. É falta de liberdade para criar.
                </p>
              </div>
            </motion.div>

            <motion.div
              {...slideInRight}
              className="bg-primary/5 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-primary/20"
            >
              <h3 className="text-lg sm:text-xl font-bold mb-4 uppercase tracking-tighter">
                O Preço Invisível
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Cada vez que os créditos acabram, você paga um preço invisível: tempo perdido, energia desperdiçada e oportunidades que esfriam.
              </p>
            </motion.div>
          </section>

          {/* Agitação */}
          <motion.section {...fadeInUp} className="text-center space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter">
              O pior é que isso vira um ciclo.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Você começa animado. Cria rápido. Sente que está rendendo. Aí o limite chega.
              E de novo você volta para a mesma frustração:{" "}
              <span className="text-foreground font-semibold italic">
                "Se eu tivesse mais créditos, eu terminava isso agora."
              </span>
            </p>
          </motion.section>

          {/* Solução */}
          <section className="space-y-8 sm:space-y-12">
            <motion.div {...fadeInUp} className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-primary uppercase tracking-tighter">
                Liberdade Total para Criar
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg">
                Use quanto quiser, quando quiser. Sem contagem regressiva. Sem bloqueio. Sem surpresas.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 gap-4 sm:gap-6"
            >
              {[
                { title: "Créditos infinitos", desc: "Use sem medo de acabar" },
                { title: "Fluxo contínuo", desc: "Criação sem interrupções" },
                { title: "Mais entrega", desc: "Mais projetos no mesmo tempo" },
                { title: "Menos estresse", desc: "Foco total na execução" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-white/5 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-primary/50 transition-colors group cursor-default"
                >
                  <h4 className="font-bold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* Para quem é */}
          <section className="grid md:grid-cols-2 gap-6 sm:gap-8">
            <motion.div
              {...slideInLeft}
              className="bg-green-500/5 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-green-500/20"
            >
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-green-500 uppercase tracking-tighter">
                É para você se:
              </h3>
              <ul className="space-y-3 text-muted-foreground text-sm sm:text-base">
                <li>• Já usa ou quer usar o Lovable com frequência</li>
                <li>• Se irrita quando os créditos acabram no meio do fluxo</li>
                <li>• Precisa criar com velocidade e consistência</li>
              </ul>
            </motion.div>

            <motion.div
              {...slideInRight}
              className="bg-red-500/5 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-red-500/20"
            >
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-red-500 uppercase tracking-tighter">
                Talvez não seja para você se:
              </h3>
              <ul className="space-y-3 text-muted-foreground text-sm sm:text-base">
                <li>• Só pretende usar uma vez ou raramente</li>
                <li>• Não tem interesse em criar sistematicamente</li>
                <li>• Prefere trabalhar com limites rígidos</li>
              </ul>
            </motion.div>
          </section>

          {/* CTA Final */}
          <motion.section
            {...fadeInUp}
            className="text-center bg-gradient-to-b from-primary/10 to-transparent p-8 sm:p-12 rounded-3xl sm:rounded-[3rem] border border-primary/20"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 sm:mb-6 uppercase tracking-tighter">
              Comece agora. Sem limites.
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-xl mx-auto">
              Acesso imediato, configuração simples e suporte para você não parar nunca mais.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="px-8 h-14 text-lg bg-pink-500 text-white shadow-[0_0_25px_rgba(236,72,153,0.5)] hover:bg-pink-400 hover:shadow-[0_0_40px_rgba(236,72,153,0.7)] transition-all duration-300"
              >
                <Link to="/auth">
                  Criar minha conta grátis
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-8 h-14 text-lg border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link to="/planos" preload="intent">
                  Ver planos
                </Link>
              </Button>
            </div>
          </motion.section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "MSK SISTEM — Sua Assistente Premium para Lovable",
      },
      {
        name: "description",
        content:
          "Extensão Chrome oficial para Lovable. Créditos infinitos, criação sem limites e entrega acelerada.",
      },
      { property: "og:title", content: "MSK SISTEM — Sua Assistente Premium para Lovable" },
      {
        property: "og:description",
        content: "Extensão Chrome oficial para Lovable. Créditos infinitos, criação sem limites e entrega acelerada.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});
