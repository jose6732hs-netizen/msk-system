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
    label: "Visão Geral",
    to: "/parceiro",
    icon: LayoutDashboard,
    description: "Acompanhe seu desempenho geral"
  },
  {
    label: "Premiações",
    to: "/premiacoes",
    icon: Award,
    description: "Resgate prêmios por desempenho"
  },
  {
    label: "Vendas",
    to: "/parceiro",
    hash: "sales", // In case we want to jump to sections
    icon: ShoppingCart,
    description: "Histórico de vendas indicadas"
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
