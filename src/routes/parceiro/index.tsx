import React, { useState, useEffect } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { affiliateOverview } from "@/lib/affiliate.functions";
import { AffiliateHeader } from "@/components/parceiro/wallet-header";
import { WalletModal } from "@/components/parceiro/wallet-modal";
import { 
  BarChart3, 
  Users, 
  ShoppingCart, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  ExternalLink,
  Copy,
  FileText,
  Award
} from "lucide-react";
import { DocumentsTab } from "@/components/parceiro/documents-tab";
import { AffiliateWelcomeDialog } from "@/components/parceiro/affiliate-welcome-dialog";
import { PanelCarousel } from "@/components/msk/panel-carousel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AffiliateRequestCard } from "@/components/msk/affiliate-request-card";

export const Route = createFileRoute("/parceiro/")({
  component: AffiliateDashboard,
});

function AffiliateDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(affiliateOverview);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["affiliate-overview"],
    queryFn: () => fetchOverview({ data: {} }),
    retry: false,
    staleTime: 30_000,
  });

  // Expor função de abrir modal globalmente para o header
  useEffect(() => {
    (window as any).openWalletModal = () => setIsWalletOpen(true);
    return () => { delete (window as any).openWalletModal; };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["affiliate-overview"] });
    toast.success("Dados atualizados!");
    setIsRefreshing(false);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#050505]/70 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-white/40 font-medium animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!data.enrolled || (data.affiliate as any)?.status !== "active") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <AffiliateRequestCard />
        </div>
      </div>
    );
  }


  const { stats, affiliate, goal, sales } = data;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary selection:text-white flex flex-col overflow-hidden">
      <AffiliateHeader 
        balance={stats.availableBalance}
        goalCurrent={goal.current}
        goalTarget={goal.target}
        goalProgress={goal.progress}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      <AffiliateWelcomeDialog />

      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 overflow-y-auto scrollbar-hide min-w-0">
        <div className="space-y-10 focus:outline-none pb-32 md:pb-20">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10">
            {/* Carousel Banner */}
            <div className="w-full">
              <PanelCarousel />
            </div>

            {/* Welcome Section */}
            <section>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">Painel de Parceiro</h1>
                  <p className="text-white/40 text-lg">Acompanhe seu desempenho e gerencie seus lucros em tempo real.</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-[#0F0F0F] border border-white/10 p-3 px-5 rounded-2xl flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Seu Link</span>
                      <span className="text-sm font-medium truncate max-w-[150px]">{affiliate.link}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-white/5 text-white/40 hover:text-primary"
                      onClick={() => copyLink(affiliate.link)}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                label="Cliques Totais" 
                value={stats.clicks.toLocaleString()} 
                icon={<BarChart3 size={20} />} 
                color="blue"
              />
              <StatCard 
                label="Cadastros" 
                value={stats.signups.toLocaleString()} 
                icon={<Users size={20} />} 
                color="purple"
              />
              <StatCard 
                label="Vendas Aprovadas" 
                value={stats.approvedSales.toLocaleString()} 
                icon={<ShoppingCart size={20} />} 
                color="green"
              />
              <StatCard 
                label="Comissões Totais" 
                value={`R$ ${stats.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                icon={<TrendingUp size={20} />} 
                color="primary"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Main Activity */}
               <div className="lg:col-span-2 space-y-8">
                  <section className="bg-[#0F0F0F] border border-white/10 rounded-[2.5rem] p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="text-white/20" size={20} /> Últimas Atividades
                      </h3>
                      <Button variant="link" className="text-primary p-0 h-auto font-bold text-sm">Ver todas</Button>
                    </div>
                    
                    <div className="space-y-4">
                      {sales.length > 0 ? sales.map((sale: any) => (
                        <div key={sale.id} className="group p-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           <div className="flex items-center gap-4 min-w-0">
                              <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                                sale.status === 'PAID' ? "bg-green-500/10 text-green-500" : 
                                sale.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" : 
                                "bg-red-500/10 text-red-500"
                              )}>
                                 <ShoppingCart size={20} />
                              </div>
                              <div className="min-w-0">
                                 <p className="font-bold text-white group-hover:text-primary transition-colors truncate">{sale.plan}</p>
                                 <div className="flex flex-col gap-0.5 mt-1">
                                   <p className="text-[10px] font-bold text-white/60 truncate">{sale.customerName}</p>
                                   <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                     <p className="text-xs text-white/40">{new Date(sale.createdAt).toLocaleString('pt-BR')}</p>
                                     <span className="text-white/10 text-[8px] hidden sm:inline">•</span>
                                     <p className="text-xs text-white/40 font-mono italic truncate max-w-[120px] sm:max-w-none">{sale.customer}</p>
                                   </div>
                                 </div>
                              </div>
                           </div>
                           <div className="text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                              <div className="flex flex-col items-start sm:items-end order-1 sm:order-none">
                                 <p className="font-bold text-lg leading-none break-all">R$ {sale.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                 <p className="text-[9px] text-white/40 font-medium">Sua comissão ({sale.rate}%)</p>
                              </div>
                              <div className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap order-2 sm:order-none",
                                sale.status === 'PAID' ? "bg-green-500/20 text-green-500" : 
                                sale.status === 'PENDING' ? "bg-amber-500/20 text-amber-500" : 
                                "bg-red-500/20 text-red-500"
                              )}>
                                {sale.status === 'PAID' ? 'Aprovada' : 
                                 sale.status === 'PENDING' ? 'Pendente' : 
                                 'Expirada'}
                              </div>
                           </div>
                        </div>
                      )) : (
                        <div className="py-20 text-center">
                           <p className="text-white/20 font-medium">Nenhuma venda registrada recentemente.</p>
                        </div>
                      )}
                    </div>
                  </section>
               </div>

               {/* Sidebar Info */}
               <div className="space-y-8">
                  {/* Wallet Card Quick Access */}
                  <section className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                     
                     <div className="relative z-10 flex flex-col h-full">
                        <Wallet className="text-primary mb-4" size={32} />
                        <h3 className="text-2xl font-bold mb-1">Carteira Digital</h3>
                        <p className="text-white/40 text-sm mb-6">Solicite saques via PIX em poucos cliques.</p>
                        
                        <div className="space-y-4 mb-8">
                           <div>
                              <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest block mb-1">Disponível</span>
                              <span className="text-3xl font-black tracking-tighter">R$ {stats.availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </div>
                        </div>

                        <Button 
                          variant="neon" 
                          className="w-full h-12 rounded-xl font-bold gap-2"
                          onClick={() => setIsWalletOpen(true)}
                        >
                          Acessar Carteira <ArrowUpRight size={18} />
                        </Button>
                     </div>
                  </section>

                  {/* Goal Card */}
                  <section className="bg-[#0F0F0F] border border-white/10 rounded-[2.5rem] p-8">
                     <div className="flex items-center justify-between mb-6">
                       <h4 className="font-bold text-white/60 uppercase text-xs tracking-widest">Sua Meta</h4>
                       <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-lg">{goal.progress}%</span>
                     </div>
                     <div className="mb-4">
                        <div className="flex justify-between items-end mb-2">
                           <span className="text-xl font-bold">R$ {goal.current.toLocaleString('pt-BR')}</span>
                           <span className="text-sm text-white/20">de R$ {goal.target.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                           <div 
                             className="h-full bg-gradient-to-r from-primary to-primary/40 shadow-[0_0_10px_rgba(var(--primary),0.5)] transition-all duration-1000 ease-out"
                             style={{ width: `${goal.progress}%` }}
                           />
                        </div>
                     </div>
                     <p className="text-[10px] text-white/40 leading-relaxed italic">
                        Ao atingir sua meta, você pode desbloquear comissões exclusivas e bônus de performance.
                     </p>
                  </section>
               </div>
            </div>

            {/* Referrals Section */}
            <section id="referrals" className="scroll-mt-32">
              <div className="bg-[#0F0F0F] border border-white/10 rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="text-white/20" size={20} /> Suas Indicações
                  </h3>
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Total: {data.referrals?.length || 0}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {data.referrals && data.referrals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.referrals.map((ref: any) => (
                        <div key={ref.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                              <Users size={18} className="text-white/20" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{ref.name || 'Usuário'}</p>
                              <p className="text-[10px] text-white/40">{ref.email.split('@')[0]}***@{ref.email.split('@')[1]}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                            ref.status === 'customer' ? "bg-green-500/20 text-green-500" : "bg-white/10 text-white/40"
                          )}>
                            {ref.status === 'customer' ? 'Cliente' : 'Cadastro'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                       <p className="text-white/20 font-medium">Nenhuma indicação cadastrada ainda.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Documents Section */}
            <section id="docs" className="scroll-mt-32">
              <DocumentsTab status={(affiliate as any).verification_status || 'WAITING'} />
            </section>
            <RankingSection navigate={navigate} />
          </div>
        </div>
      </main>

      <WalletModal 
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        balance={stats.availableBalance}
        pendingBalance={stats.pendingCommission}
        pixKey={(affiliate as any).pix_key}
        pixKeyType={(affiliate as any).pix_key_type}
        hasPassword={!!(affiliate as any).withdrawal_password_hash}
      />
    </div>
  );
}

function RankingSection({ navigate }: { navigate: any }) {
  return (
    <Link to="/parceiro" className="group block mb-10">
      <div className="bg-[#0F0F0F] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-8 md:p-12 text-center space-y-6 md:space-y-8 hover:border-primary/40 transition-all relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors" />
        <div className="relative z-10">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5 md:mb-6 group-hover:scale-110 transition-transform">
            <TrendingUp className="text-primary w-8 h-8 md:w-10 md:h-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter mb-3 md:mb-4">Seu Ranking</h2>
          <p className="text-white/40 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-6 md:mb-8">
            Confira sua posição atual e o histórico de vendas. O reconhecimento é proporcional ao seu esforço constante.
          </p>
          <Button variant="neon" size="lg" className="h-12 md:h-14 w-full sm:w-auto px-6 md:px-10 rounded-xl font-black text-sm sm:text-base md:text-lg whitespace-normal leading-tight text-center justify-center">
            Ver meu ranking atual
          </Button>
        </div>
      </div>
    </Link>
  );
}


interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "purple" | "green" | "primary";
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    primary: "bg-primary/10 text-primary border-primary/20"
  };

  return (
    <div className="bg-[#0F0F0F] border border-white/10 p-5 sm:p-6 rounded-[2rem] hover:border-white/20 transition-all group overflow-hidden flex flex-col h-full">
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0 transition-transform group-hover:scale-110", colors[color])}>
         {icon}
       </div>
       <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 truncate w-full">{label}</p>
       <h4 className="text-xl sm:text-2xl font-bold tracking-tight break-words line-clamp-2">{value}</h4>
    </div>
  );
}
