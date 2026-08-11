import { 
  LayoutDashboard, 
  ShoppingCart, 
  TrendingUp, 
  Wallet, 
  Users, 
  Award, 
  FileText,
  Settings
} from "lucide-react";

export const affiliateRoutes = [
  {
    label: "Painel",
    to: "/parceiro",
    icon: LayoutDashboard,
    description: "Acompanhe seu desempenho geral"
  },
  {
    label: "Ranking",
    to: "/admin", // Seguindo a lógica anterior de ver histórico de vendas/ranking
    icon: TrendingUp,
    description: "Veja sua posição no ranking"
  },
  {
    label: "Premiações",
    to: "/premiacoes",
    icon: Award,
    description: "Resgate prêmios por desempenho"
  },
  {
    label: "Indicações",
    to: "/parceiro",
    hash: "referrals",
    icon: Users,
    description: "Usuários cadastrados por você"
  },
  {
    label: "Documentos",
    to: "/parceiro",
    hash: "docs",
    icon: FileText,
    description: "Verificação de identidade"
  },
  {
    label: "Carteira",
    to: "/parceiro",
    icon: Wallet,
    action: "openWallet",
    description: "Saques e saldo disponível"
  }
];
