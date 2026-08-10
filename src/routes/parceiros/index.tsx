import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { 
  Check, ArrowRight, Zap, TrendingUp, ShieldCheck, HeartHandshake, 
  Wallet, History, Users, MessageSquare, Flame, Rocket, Target,
  Eye, HelpCircle, Layout, Share2, DollarSign, PieChart, Activity
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/parceiros/")({
  validateSearch: (search: Record<string, unknown>): { mode?: string | undefined } => ({
    mode: (search['mode'] as string | undefined) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Programa de Afiliados Lovable - Ganhe Renda Extra com IA" },
      {
        name: "description",
        content: "Ganhe 60% de comissão (sujeito a aumento) indicando a plataforma Lovable. Mercado de IA em explosão, pagamentos via PIX e suporte completo para parceiros.",
      },
    ],
  }),
  component: PartnersPage,
});

function LiveSocialProof() {
  const [signups, setSignups] = useState(14);
  const [views, setViews] = useState(203);

  useEffect(() => {
    const signupInterval = setInterval(() => {
      setSignups(prev => prev < 40 ? prev + 1 : prev);
    }, 15000);

    const viewsInterval = setInterval(() => {
      setViews(prev => {
        const diff = Math.floor(Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1);
        const next = prev + diff;
        return next > 0 && next < 300 ? next : prev;
      });
    }, 3000);

    return () => {
      clearInterval(signupInterval);
      clearInterval(viewsInterval);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-12 py-4 px-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-white/80">🟢 {signups} pessoas se cadastrando agora mesmo</span>
      </div>
      <div className="hidden sm:block w-px h-4 bg-white/10" />
      <div className="flex items-center gap-2 text-sm font-bold">
        <Eye className="w-4 h-4 text-primary" />
        <span className="text-white/80">👁️ {views} pessoas visualizando esta página</span>
      </div>
    </div>
  );
}

function PartnersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background/40 text-foreground selection:bg-primary selection:text-primary-foreground">
      <SiteHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden border-b border-white/5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10" />
          
          <div className="container px-4 mx-auto text-center max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent uppercase leading-[0.9]">
              Ganhe renda extra todo mês indicando no mercado que mais cresce no mundo: Inteligência Artificial.
            </h1>
            
            <p className="text-xl md:text-2xl text-white font-medium mb-10 max-w-3xl mx-auto leading-relaxed">
              Entre no programa de parceiros Lovable e transforme sua audiência em comissões reais. Estrutura simples, pagamentos via PIX e suporte completo.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {[
                { label: "Ganhos de até 60%", icon: DollarSign },
                { label: "Painel em tempo real", icon: Activity },
                { label: "Materiais prontos", icon: Layout },
                { label: "Suporte dedicado", icon: HeartHandshake },
              ].map((feature, i) => (
                <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{feature.label}</span>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="neon" size="lg" className="h-16 px-12 text-xl font-black group rounded-2xl">
                <Link 
                  to={Route.useSearch()['mode'] === 'signup' ? '/auth' : '/parceiro'} 
                  search={{ next: '/parceiro', mode: 'signup' } as any}
                >
                  Quero me tornar afiliado agora
                  <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
                <button 
                  onClick={() => document.getElementById('detalhes')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center h-16 px-12 text-xl font-black rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                >
                  Ver como funciona
                </button>
            </div>

            <LiveSocialProof />
          </div>
        </section>

        {/* Why IA Section */}
        <section className="py-24 bg-black/60 relative overflow-hidden">
          <div className="container px-4 mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tighter">Por que se tornar afiliado Lovable?</h2>
              <p className="text-white/60 text-lg max-w-3xl mx-auto">
                O mercado de Inteligência Artificial é o que mais cresce no momento. Quem entra agora sai na frente.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: "Ganhos de até 60%", desc: "Ganhe em cada indicação convertida. Margem clara e recorrente. Sujeito a aumentar com o tempo.", icon: Flame },
                { title: "Revenda 100% automática", desc: "A plataforma entrega tudo direto para o cliente final. Você não precisa fazer nada manualmente.", icon: Zap },
                { title: "Lucro previsível e escalável", desc: "Quanto mais você indica, mais você ganha. Sem limite.", icon: TrendingUp },
                { title: "Painel completo em tempo real", desc: "Acompanhe suas indicações, comissões e resultados em um só lugar.", icon: PieChart },
                { title: "Materiais prontos", desc: "Receba links, textos e criativos prontos para divulgar.", icon: Share2 },
                { title: "Suporte prioritário", desc: "Atendimento exclusivo para afiliados.", icon: ShieldCheck },
                { title: "Campanhas e bônus", desc: "Participe de ações especiais e aumente ainda mais seus ganhos.", icon: Target },
              ].map((item, i) => (
                <div key={i} className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-primary/40 transition-all group">
                  <item.icon className="w-8 h-8 text-primary mb-6" />
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-white/60 leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="detalhes" className="py-24">
          <div className="container px-4 mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter">Como funciona</h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto">
                Do cadastro à primeira indicação em poucos minutos.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: "01", title: "Cadastre-se grátis", desc: "Preencha seus dados em menos de 1 minuto." },
                { step: "02", title: "Acesso imediato", desc: "Login e senha liberados automaticamente por e-mail." },
                { step: "03", title: "Comece a indicar", desc: "Compartilhe seu link e acompanhe tudo pelo painel." },
                { step: "04", title: "Receba suas comissões", desc: "Pagamentos via PIX de forma simples e rápida." },
              ].map((item, i) => (
                <div key={i} className="relative p-8 rounded-[2rem] bg-white/5 border border-white/10">
                  <span className="text-primary text-4xl font-black opacity-20 absolute top-4 right-6">{item.step}</span>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-primary/5">
          <div className="container px-4 mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black uppercase italic">Quem já está lucrando</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { text: "“Comecei indicando para conhecidos e em pouco tempo já estava gerando renda extra consistente. O painel é limpo e prático.”", author: "Lucas M.", sub: "Afiliado há 3 meses" },
                { text: "“Atendo clientes de projetos que precisam de créditos. Antes era tudo manual. Agora a entrega é automática e eu só acompanho.”", author: "Aline R.", sub: "Agência digital" },
                { text: "“Renda extra real. Faço várias vendas por semana sem sair do painel. Tudo roda sozinho.”", author: "Pedro S.", sub: "Freelancer" },
              ].map((t, i) => (
                <div key={i} className="glass p-8 rounded-[2rem] border border-white/10">
                  <p className="text-lg italic text-white/90 mb-6">{t.text}</p>
                  <div className="font-bold text-primary">{t.author}</div>
                  <div className="text-xs text-white/40 uppercase font-black">{t.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
          <div className="container px-4 mx-auto max-w-3xl">
            <h2 className="text-4xl font-black text-center mb-12 uppercase tracking-tighter">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {[
                { q: "Como recebo o acesso depois de me cadastrar?", a: "O acesso é liberado automaticamente por e-mail assim que o cadastro é concluído." },
                { q: "Preciso pagar alguma taxa para começar?", a: "Não. O programa é gratuito e por indicação." },
                { q: "Como funciona a entrega?", a: "A plataforma entrega automaticamente para o cliente final. Você não precisa fazer nada manualmente." },
                { q: "Quanto eu ganho por indicação?", a: "Você recebe comissão de 60% sobre cada venda realizada através do seu link, podendo aumentar com o tempo." },
                { q: "Tem suporte?", a: "Sim. Afiliados têm atendimento prioritário." },
                { q: "Posso parar quando quiser?", a: "Sim. Não existe fidelidade nem mensalidade." },
              ].map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="glass rounded-2xl border border-white/10 px-6">
                  <AccordionTrigger className="text-left font-bold py-6 hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-white/60 pb-6">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 relative">
          <div className="container px-4 mx-auto max-w-5xl">
            <div className="bg-primary p-12 md:p-20 rounded-[4rem] text-black text-center relative overflow-hidden">
              <h2 className="text-4xl md:text-7xl font-black mb-8 uppercase tracking-tighter leading-none italic">
                O mercado de Inteligência Artificial não para de crescer.
              </h2>
              <p className="text-2xl font-bold mb-12 opacity-80 uppercase tracking-tight">
                Quem indica agora, lucra nos próximos meses. Cadastro gratuito. Acesso imediato. Comissões via PIX.
              </p>
              
              <div className="flex flex-col items-center gap-8">
                <Button asChild variant="secondary" size="lg" className="h-20 md:h-24 px-6 md:px-20 text-xl md:text-3xl font-black bg-black text-white hover:scale-105 transition-all w-full sm:w-auto rounded-3xl shadow-2xl whitespace-normal leading-tight text-center">
                  <Link 
                    to={Route.useSearch()['mode'] === 'signup' ? '/auth' : '/parceiro'} 
                    search={{ next: '/parceiro', mode: 'signup' } as any}
                  >
                    Quero começar a indicar agora
                  </Link>
                </Button>
                
                <div className="flex flex-wrap justify-center gap-8">
                  {["CADASTRO GRATUITO", "LIBERAÇÃO IMEDIATA", "SEM MENSALIDADE", "COMISSÕES DE 60%"].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-black tracking-widest">
                      <Check className="w-4 h-4" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default PartnersPage;
