import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import confetti from "canvas-confetti";
import { useQuery } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  ChevronRight, 
  Copy, 
  CreditCard, 
  Download, 
  Gift, 
  Globe2, 
  Hexagon, 
  LockKeyhole, 
  Menu, 
  MessageSquare, 
  Moon, 
  ShieldCheck, 
  Sparkles, 
  Star, 
  Sun, 
  Twitter,
  Youtube,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MskLogo } from "@/components/msk/logo";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { SmartOfferModal } from "@/components/msk/smart-offer-modal";
import { SmartPixModal } from "@/components/msk/smart-pix-modal";
import { CardPaymentPanel } from "@/components/msk/card-payment-panel";
import { NotificationBell } from "@/components/msk/notification-bell";
import { PresenceTracker } from "@/components/msk/presence-tracker";
import { PushPermissionPrompt } from "@/components/msk/push-permission-prompt";
import { PwaInstallBanner } from "@/components/msk/pwa-install-banner";
import { WhatsappSupportButton } from "@/components/msk/whatsapp-support";
import { getPublicStats, getCmsSettings } from "@/lib/site.functions";
import { getVisitorId } from "@/lib/urls";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [stats, cms] = await Promise.all([getPublicStats({}), getCmsSettings({})]);
    return { stats, cms } as any;
  },
  head: () => {
    return {
      meta: [
        { title: "MSK SISTEM - Agente de IA com Extensão para Navegador" },
        {
          name: "description",
          content:
            "Agente de IA completo com extensão para Chrome e Edge. Automação, clonagem de sites, extração de leads e muito mais.",
        },
        { name: "theme-color", content: "#0a0a0a" },
      ],
    };
  },
  component: IndexComponent,
});

function IndexComponent() {
  const { cms, stats } = Route.useLoaderData() as any;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSmartOffer, setShowSmartOffer] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showCardPanel, setShowCardPanel] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const { data: publicStats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => getPublicStats({}),
    refetchInterval: 60_000,
  });

  const { data: cmsSettings } = useQuery({
    queryKey: ["cms-settings"],
    queryFn: () => getCmsSettings({}),
    staleTime: Infinity,
  });

  const handleOfferAccept = (offer: any) => {
    setCurrentOffer(offer);
    if (offer?.type === "pix") {
      setShowPixModal(true);
    } else if (offer?.type === "card") {
      setShowCardPanel(true);
    }
    setShowSmartOffer(false);
  };

  const handleConfetti = () => {
    setShowConfetti(true);
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  return (
    <>
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/5 blur-[120px]" style={{ animationDelay: "2s" }} />
        </div>

        <SiteHeader />

        <NotificationBell />
        <PresenceTracker />
        <WhatsappSupportButton />

        <main className="relative z-10">
          {/* Hero Section */}
          <section className="relative flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 pt-20 pb-16 sm:px-6 lg:px-8">
            <div className="relative z-10 mx-auto max-w-5xl text-center">
              <div className="mb-6 flex items-center justify-center gap-2">
                <span className="neon-text inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> O Futuro da Automação com IA
                </span>
              </div>
              <h1 className="text-4xl font-black uppercase leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                Sua Nova <span className="neon-text">IA Agente</span> <br className="hidden sm:block" />
                com Extensão
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Um agente de IA completo que vive no seu navegador. Automatize tarefas, extraia dados,
                clone sites e muito mais — tudo com a potência da inteligência artificial.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  variant="neon"
                  onClick={() => setShowSmartOffer(true)}
                  className="h-14 min-w-[280px] rounded-2xl text-base font-bold"
                >
                  <Globe2 className="mr-2 h-5 w-5" />
                  <span>Começar Agora</span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-14 min-w-[280px] rounded-2xl border-primary/30 text-base font-bold text-primary hover:bg-primary/10"
                >
                  <Link to="/como-funciona">
                    <Star className="mr-2 h-5 w-5" />
                    Como Funciona
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="relative z-10 border-t border-border/50 bg-background/50 py-12 backdrop-blur-sm">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                {[
                  { label: "Usuários Ativos", value: publicStats?.users ?? stats?.users ?? 0, icon: Globe2 },
                  { label: "Licenças Ativas", value: publicStats?.licenses ?? stats?.licenses ?? 0, icon: ShieldCheck },
                  { label: "Comunidade", value: publicStats?.affiliates ?? stats?.affiliates ?? 0, icon: MessageSquare },
                  { label: "Avaliação Média", value: "4.9", icon: Star, suffix: "/5" },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="flex items-center justify-center">
                      <stat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="mt-2 text-3xl font-black sm:text-4xl">
                      {stat.value}{stat.suffix}
                    </p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Grid */}
          <section className="relative z-10 py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center">
                <h2 className="text-3xl font-black uppercase sm:text-4xl">
                  Tudo que você precisa
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                  Ferramentas poderosas para automação completa do seu negócio
                </p>
              </div>
              <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Globe2,
                    title: "Agente de IA",
                    description: "Converse com uma IA avançada diretamente no navegador. Automatize tarefas complexas com prompts inteligentes.",
                  },
                  {
                    icon: Download,
                    title: "Extensão Universal",
                    description: "Funciona em Chrome, Edge, Brave e outros navegadores baseados em Chromium.",
                  },
                  {
                    icon: Copy,
                    title: "Clonador de Sites",
                    description: "Clone landing pages, páginas de venda e sites institucionais com um clique.",
                  },
                  {
                    icon: CreditCard,
                    title: "Gestão de Pagamentos",
                    description: "Acompanhe vendas, gere cobanças PIX e cartão, tudo integrado.",
                  },
                  {
                    icon: Gift,
                    title: "Programa de Afiliados",
                    description: "Ganhe comissões indicando o MSK SISTEM para outros empreendedores.",
                  },
                  {
                    icon: Hexagon,
                    title: "Suporte priority",
                    description: "Atendimento rápido via WhatsApp para resolver suas dúvidas.",
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-primary/30"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative z-10">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="mt-6 text-xl font-bold">{feature.title}</h3>
                      <p className="mt-3 text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative z-10 py-20">
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-12">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                <div className="relative z-10 text-center">
                  <h2 className="text-3xl font-black uppercase sm:text-4xl">
                    Pronto para transformar seu negócio?
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                    Junte-se a milhares de empreendedores que já usam o MSK SISTEM para automatizar suas operações.
                  </p>
                  <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <Button
                      size="lg"
                      variant="neon"
                      onClick={() => setShowSmartOffer(true)}
                      className="h-14 min-w-[240px] rounded-2xl text-base font-bold"
                    >
                      <span>Começar Agora</span>
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>

      <SmartOfferModal
        open={showSmartOffer}
        onOpenChange={setShowSmartOffer}
        onAccept={handleOfferAccept}
        visitorId={getVisitorId()}
      />
      <SmartPixModal
        open={showPixModal}
        onOpenChange={setShowPixModal}
        offer={currentOffer}
        visitorId={getVisitorId()}
      />
      <CardPaymentPanel
        open={showCardPanel}
        onOpenChange={setShowCardPanel}
        offer={currentOffer}
      />
    </>
  );
}