import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { 
  CheckCircle2, 
  Rocket, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard,
  ShoppingBag,
  Loader2,
  Lock,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLicenseForTransaction } from "@/lib/commerce.functions";
import { MskLogo } from "@/components/msk/logo";

export const Route = createFileRoute("/_authenticated/obrigado")({
  validateSearch: (search: Record<string, unknown>) => ({
    transactionId: (search["transactionId"] as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "Obrigado pela sua compra! — MSK SISTEM" },
      {
        name: "description",
        content: "Seu pagamento foi confirmado com sucesso. Sua licença já está disponível.",
      },
    ],
  }),
  component: ObrigadoPage,
});

function ObrigadoPage() {
  const { transactionId } = useSearch({ from: "/_authenticated/obrigado" });
  const navigate = useNavigate();
  const fetchLicense = useServerFn(getLicenseForTransaction);
  const [attempts, setAttempts] = useState(0);

  const { data: license, error, isLoading, refetch } = useQuery({
    queryKey: ["success-license", transactionId],
    queryFn: () => fetchLicense({ data: { transactionId } }),
    enabled: !!transactionId,
    retry: false,
  });

  // Polling se ainda não estiver pago ou licença não gerada
  useEffect(() => {
    if (isLoading || license) return undefined;
    
    // Tentar por até 30 segundos
    if (attempts < 10) {
      const timer = setTimeout(() => {
        setAttempts(prev => prev + 1);
        refetch();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [license, isLoading, attempts, refetch]);

  useEffect(() => {
    if (license) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [license]);

  if (!transactionId) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-5 text-center">
        <div className="max-w-md w-full glass p-10 rounded-[2.5rem] border-white/10">
          <Lock className="mx-auto h-12 w-12 text-primary mb-6" />
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Acesso Restrito</h2>
          <p className="text-white/40 mb-8">Esta página requer uma transação válida para ser acessada.</p>
          <Button asChild variant="neon" className="w-full h-12">
            <Link to="/painel">Ir para o Painel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] selection:bg-primary selection:text-white">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <header className="relative z-20 mx-auto max-w-6xl h-20 flex items-center justify-between px-5">
        <Link to="/">
          <MskLogo size={36} />
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex text-white/60">
            <Link to="/painel">Painel</Link>
          </Button>
          <Button asChild variant="neonOutline" size="sm">
            <Link to="/planos">Planos</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 py-12 sm:py-20 text-center">
        {!license && !error ? (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8 ring-4 ring-primary/5">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-tight">
              Confirmando seu <span className="neon-text">Pagamento</span>
            </h1>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Estamos processando sua transação via PIX. Assim que a confirmação for recebida, sua licença será liberada automaticamente.
            </p>
            <div className="max-w-xs mx-auto space-y-4">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-loading-bar" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                Aguardando Confirmação do Gateway...
              </p>
            </div>
          </div>
        ) : error || (!license && attempts >= 10) ? (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="h-24 w-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-8 ring-4 ring-red-500/5 text-red-500">
              <MessageSquare className="h-10 w-10" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-tight">
              Ops! <span className="text-red-500">Demora na Confirmação</span>
            </h1>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Seu pagamento ainda não foi detectado pelo nosso sistema. Se você já pagou, não se preocupe: a licença será liberada em instantes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="neon" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs" onClick={() => refetch()}>
                Tentar Novamente
              </Button>
              <Button asChild variant="ghost" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs">
                <Link to="/painel">Ir para Suporte</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in zoom-in-95 duration-1000">
            <div>
              <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8 ring-8 ring-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-bounce-slow">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <h1 className="text-4xl sm:text-7xl font-black tracking-tighter uppercase leading-[0.9] mb-4">
                🎉 LICENÇA GERADA <span className="neon-text">COM SUCESSO!</span>
              </h1>
              <p className="text-lg sm:text-2xl text-white/60 font-medium max-w-2xl mx-auto">
                Produto: <span className="text-primary font-black">MSK Suite - Extensão Premium</span>
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Gerador de Entrega Profissional</span>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
              <FeatureBox 
                icon={<Rocket className="text-primary" />} 
                title="Plano Ativo" 
                value={license.plans?.name} 
              />
              <FeatureBox 
                icon={<CreditCard className="text-primary" />} 
                title="Valor Pago" 
                value={`R$ ${Number((license as any).amount_paid || 99.90).toFixed(2).replace('.', ',')}`} 
              />
              <FeatureBox 
                icon={<ShoppingBag className="text-primary" />} 
                title="Pedido" 
                value={`#${transactionId.slice(0, 8).toUpperCase()}`} 
              />
            </div>

            <div className="p-8 sm:p-12 rounded-[3rem] bg-white/5 border border-white/10 max-w-2xl mx-auto space-y-8 text-left">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <Rocket className="text-primary" /> Passo a Passo de Ativação
                </h3>
                <ul className="space-y-4">
                  <li className="flex gap-4">
                    <span className="flex-none w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">1</span>
                    <p className="text-sm text-white/60 leading-relaxed">Baixe e instale a extensão MSK SISTEM no seu navegador Chrome.</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-none w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">2</span>
                    <p className="text-sm text-white/60 leading-relaxed">Clique no botão abaixo para ver sua licença e copiar seu <b>Token de Ativação</b>.</p>
                  </li>
                  <li className="flex gap-4">
                    <span className="flex-none w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">3</span>
                    <p className="text-sm text-white/60 leading-relaxed">Abra a extensão e cole o token para liberar o acesso ilimitado.</p>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/5">
                <Button 
                  variant="neon" 
                  size="lg" 
                  className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/20 group"
                  onClick={() => {
                    localStorage.setItem("msk_highlight_license", license.id);
                    navigate({ to: "/painel" });
                  }}
                >
                  🔑 Ver Minha Licença & Suporte <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                  <CheckCircle2 size={12} /> Entrega Automática Garantida
                </div>
                <a href="https://t.me/msksistem" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4">
                  Precisa de Ajuda? Falar com Suporte
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FeatureBox({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="glass p-6 rounded-3xl border border-white/5 text-left group hover:border-primary/20 transition-all">
      <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">{title}</h4>
      <p className="text-lg font-black text-white uppercase tracking-tighter truncate">{value}</p>
    </div>
  );
}
