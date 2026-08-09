// MSK SISTEM ATUALIZADA - MODO MSK ATIVO (NEON PURPLE + INFINITE CREDITS + CHAT LOCK)
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { Button } from "@/components/ui/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HeroCarousel } from "@/components/msk/hero-carousel";
import { Hero3D } from "@/components/msk/hero-3d";
import { HeroScene3D } from "@/components/msk/hero-scene-3d";
import bannerAsset from "@/assets/logo.png.asset.json";
import { MskLogo } from "@/components/msk/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MSK SISTEM — Sua Assistente Premium para Lovable" },
      {
        name: "description",
        content: "A plataforma definitiva para gerenciar licenças, dispositivos e otimizar seu fluxo de trabalho com a MSK SISTEMe.",
      },
      { property: "og:image", content: bannerAsset.url },
      { name: "twitter:image", content: bannerAsset.url },
    ],
  }),
  component: Index,
});

import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";

import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any }
};


const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } }
};

const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as any }
};

const slideInRight = {
  initial: { opacity: 0, x: 50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as any }
};


function Index() {
  const getCms = useServerFn(getCmsContent);
  const { data: cms } = useSuspenseQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">

      <header className="mobile-top-bar lg:hidden">
        <MskLogo size={32} />
      </header>
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center p-5 relative overflow-visible">
        {/* Neon glow behind everything */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] -z-10" />
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center w-full min-w-0 pt-8 md:pt-16 gap-12 text-left relative z-20">
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="flex-1 min-w-0 w-full space-y-8"
          >
            <motion.div variants={fadeInUp} className="w-full mb-8">
              <HeroCarousel />
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-3xl font-black tracking-tighter sm:text-6xl lg:text-7xl bg-gradient-to-b from-primary to-primary/40 bg-clip-text text-transparent uppercase leading-[0.95] break-words text-center md:text-left py-2">
              {cms['hero']?.title || "Pare de ser interrompido no meio da criação"}
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-xl leading-relaxed text-center md:text-left mx-auto md:mx-0">
              {cms['hero']?.subtitle || "Acesso completo à extensão Lovable com créditos infinitos. Crie apps, landing pages e sistemas o dia inteiro sem travar, sem contar crédito e sem perder o ritmo."}
            </motion.p>


            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 w-full justify-center md:justify-start">
              <Button asChild variant="neon" size="lg" className="px-6 h-14 text-sm sm:text-lg w-full sm:w-auto whitespace-normal text-center leading-tight flex items-center justify-center">
                <Link to={cms['hero']?.cta_link || "/auth"}>{cms['hero']?.cta_text || "Quero créditos infinitos agora"}</Link>
              </Button>
              <Button asChild variant="neonOutline" size="lg" className="px-6 h-14 text-sm sm:text-lg w-full sm:w-auto whitespace-normal text-center leading-tight flex items-center justify-center">
                <Link to="/planos" preload="intent">Ver Planos e Preços</Link>
              </Button>
            </motion.div>

          </motion.div>


          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex-1 min-w-0 w-full h-[300px] md:h-[600px] lg:h-[700px] relative mt-[-40px] md:mt-0 flex items-center justify-center pointer-events-auto"
          >
            <HeroScene3D />
          </motion.div>
        </div>


        <div className="max-w-4xl mx-auto w-full mt-20 text-left space-y-20 relative z-20">
            {/* Partners Section Teaser */}
            <motion.section 
              {...fadeInUp}
              className="text-center bg-white/5 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 relative overflow-hidden"
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
              <h2 className="text-3xl md:text-4xl font-black mb-6 uppercase tracking-tighter">
                {cms['partners_teaser']?.title || "Revenda e ganhe comissões recorrentes"}
              </h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
                {cms['partners_teaser']?.subtitle || "Entre para o programa de parceiros Infinity e transforme sua audiência em renda. Estrutura simples, pagamentos via PIX e suporte total."}
              </p>
              
              <motion.div 
                variants={staggerContainer}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 text-left"
              >
                {[
                  "Ganhos de até 60%",
                  "Painel em tempo real",
                  "Materiais prontos",
                  "Suporte dedicado"
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

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild variant="neon" size="lg" className="px-8">
                  <Link to="/parceiros" preload="intent">Quero participar</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="px-8 border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link to="/parceiros" preload="intent">Ver detalhes</Link>
                </Button>
              </div>
            </motion.section>


            {/* Subheadline section */}
            <motion.section {...fadeInUp} className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 uppercase tracking-tighter">A diferença não é talento. A diferença é não ter limite.</h2>
              <p className="text-muted-foreground text-lg">Enquanto a maioria das pessoas para no meio do fluxo porque os créditos acabaram, quem tem acesso ilimitado continua criando, testando e entregando.</p>
            </motion.section>

            {/* Problem Section */}
            <section className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div {...slideInLeft} className="space-y-6">
                <h2 className="text-3xl font-bold text-primary uppercase tracking-tighter">Você já passou por isso?</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>Está no meio de um projeto promissor e os créditos acabam. A ideia estava fluindo… e de repente trava.</p>
                  <p>Você perde o momentum, a motivação e às vezes até o cliente. Precisa esperar, pagar de novo ou aceitar que não vai conseguir terminar hoje.</p>
                  <p className="text-foreground font-semibold">Isso não é falta de capacidade. É falta de liberdade para criar.</p>
                </div>
              </motion.div>
              <motion.div {...slideInRight} className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20">
                <h3 className="text-xl font-bold mb-4 uppercase tracking-tighter">O Preço Invisível</h3>
                <p className="text-muted-foreground">Cada vez que os créditos acabam, você paga um preço invisível: tempo perdido, energia desperdiçada e oportunidades que esfriam.</p>
              </motion.div>
            </section>

            {/* Agitation Section */}
            <motion.section {...fadeInUp} className="text-center space-y-6">
              <h2 className="text-3xl font-bold uppercase tracking-tighter">O pior é que isso vira um ciclo.</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Você começa animado. Cria rápido. Sente que está rendendo. Aí o limite chega.
                E de novo você volta para a mesma frustração: <span className="text-foreground font-semibold italic">"Se eu tivesse mais créditos, eu terminava isso agora."</span>
              </p>
            </motion.section>

            {/* Solution & Benefits */}
            <section className="space-y-12">
              <motion.div {...fadeInUp} className="text-center">
                <h2 className="text-3xl font-bold mb-4 text-primary uppercase tracking-tighter">Liberdade Total para Criar</h2>
                <p className="text-muted-foreground text-lg">Use quanto quiser, quando quiser. Sem contagem regressiva. Sem bloqueio. Sem surpresas.</p>
              </motion.div>

              <motion.div 
                variants={staggerContainer}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true }}
                className="grid sm:grid-cols-2 gap-6"
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
                    className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:border-primary/50 transition-colors group cursor-default"
                  >
                    <h4 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </section>

            {/* For Who Section */}
            <section className="grid md:grid-cols-2 gap-8">
              <motion.div {...slideInLeft} className="bg-green-500/5 p-8 rounded-[2.5rem] border border-green-500/20">
                <h3 className="text-xl font-bold mb-4 text-green-500 uppercase tracking-tighter">É para você se:</h3>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  <li>• Já usa ou quer usar o Lovable com frequência</li>
                  <li>• Se irrita quando os créditos acabam no meio do fluxo</li>
                  <li>• Precisa criar com velocidade e consistência</li>
                </ul>
              </motion.div>
              <motion.div {...slideInRight} className="bg-red-500/5 p-8 rounded-[2.5rem] border border-red-500/20">
                <h3 className="text-xl font-bold mb-4 text-red-500 uppercase tracking-tighter">Não é para você se:</h3>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  <li>• Usa o Lovable só de vez em quando</li>
                  <li>• Não se importa em parar no meio da criação</li>
                  <li>• Prefere continuar limitado</li>
                </ul>
              </motion.div>
            </section>

            {/* Risk Reversal & Final CTA */}
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center bg-primary/10 p-12 rounded-[3rem] border border-primary/20 space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-bold uppercase tracking-tighter">As vagas são controladas.</h2>
                <p className="text-muted-foreground">Mantemos um número limitado de acessos ativos para preservar a estabilidade. Quem garante agora, usa agora.</p>
              </div>
              
              <div className="flex flex-col items-center gap-6 w-full">
                <Button asChild variant="neon" size="lg" className="px-6 sm:px-12 h-16 text-sm sm:text-xl w-full sm:w-auto whitespace-normal sm:whitespace-nowrap text-center leading-tight">
                  <Link to="/auth">Quero meu acesso ilimitado agora</Link>
                </Button>
                <p className="text-sm text-muted-foreground">Teste com tranquilidade. Se não fizer sentido, basta cancelar.</p>
              </div>
            </motion.section>

        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
