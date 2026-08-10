import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Trophy, 
  Target, 
  Zap, 
  Crown, 
  Star, 
  Gem, 
  ChevronRight,
  ArrowLeft,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MskLogo } from "@/components/msk/logo";

export const Route = createFileRoute("/_authenticated/painel/premiacoes")({
  head: () => ({
    meta: [
      { title: "Central de Premiações — MSK SISTEM" },
      {
        name: "description",
        content: "Seu desempenho é reconhecido. Quanto maior o resultado, maior a recompensa.",
      },
    ],
  }),
  component: AwardsPage,
});

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const levels = [
  {
    threshold: "1K",
    title: "Pulseira de Silicone",
    description: "Primeiro passo. Você começou.",
    icon: Zap,
    color: "from-green-500/20 to-green-500/5",
    borderColor: "border-green-500/20",
    glowColor: "shadow-[0_0_20px_rgba(34,197,94,0.1)]",
    image: "/images/award-10k.png", // Usando a 10k como placeholder já que não veio a 1k
  },
  {
    threshold: "10K",
    title: "Barra de Ouro",
    description: "Já está no jogo de verdade.",
    icon: Target,
    color: "from-yellow-500/20 to-yellow-500/5",
    borderColor: "border-yellow-500/20",
    glowColor: "shadow-[0_0_20px_rgba(234,179,8,0.1)]",
    image: "/images/award-10k.png",
  },
  {
    threshold: "100K",
    title: "Rubi Natural",
    description: "Nível de quem leva a sério.",
    icon: Star,
    color: "from-red-500/20 to-red-500/5",
    borderColor: "border-red-500/20",
    glowColor: "shadow-[0_0_20px_rgba(239,68,68,0.1)]",
    image: "/images/award-100k.png",
  },
  {
    threshold: "500K",
    title: "Safira Azul",
    description: "Elite. Resultados consistentes.",
    icon: Gem,
    color: "from-blue-500/20 to-blue-500/5",
    borderColor: "border-blue-500/20",
    glowColor: "shadow-[0_0_20px_rgba(59,130,246,0.1)]",
    image: "/images/award-500k.png",
  },
  {
    threshold: "1M",
    title: "Diamante Brilhante",
    description: "Milhão conquistado. Nível máximo.",
    icon: Crown,
    color: "from-cyan-500/20 to-cyan-500/5",
    borderColor: "border-cyan-500/20",
    glowColor: "shadow-[0_0_20px_rgba(6,182,212,0.1)]",
    image: "/images/award-1m.png",
  },
  {
    threshold: "5M",
    title: "Diamante Raro",
    description: "Lenda. Quem chegou no topo.",
    icon: Trophy,
    color: "from-primary/20 to-primary/5",
    borderColor: "border-primary/20",
    glowColor: "shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]",
    image: "/images/award-5m.png",
  },
];

function AwardsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/painel" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Voltar</span>
          </Link>
          <MskLogo size={30} />
          <div className="w-20" /> {/* Spacer */}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 md:py-20">
        {/* Hero Section */}
        <motion.div 
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          className="text-center mb-16 space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase neon-text">
            Central de Premiações
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-medium">
            Seu desempenho é reconhecido. Quanto maior o resultado, maior a recompensa.
          </p>
        </motion.div>

        {/* Copy Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-[2.5rem] p-8 md:p-12 mb-20 border-primary/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full -mr-32 -mt-32" />
          <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-3xl font-medium italic">
            "Faça parte do time MSK SISTEM e transforme seus resultados em premiações reais. 
            Aqui o ranking é justo e transparente. Cada nível conquistado libera uma recompensa exclusiva. 
            Do primeiro passo ao topo, o reconhecimento é proporcional ao seu desempenho."
          </p>
        </motion.div>

        {/* Levels Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-20">
          {levels.map((level, idx) => (
            <motion.div
              key={level.threshold}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              className={`group relative overflow-hidden rounded-[2rem] border ${level.borderColor} bg-gradient-to-br ${level.color} p-8 hover:border-primary/40 transition-all duration-500 ${level.glowColor}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-white/5 rounded-2xl p-4 group-hover:bg-primary/10 transition-colors">
                  <level.icon size={32} className="text-primary" />
                </div>
                <span className="text-2xl font-black text-primary/40 group-hover:text-primary transition-colors">
                  {level.threshold}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">{level.title}</h3>
              <p className="text-white/40 text-sm font-medium leading-relaxed">
                {level.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-primary/5 p-12 rounded-[3rem] border border-primary/20 space-y-8"
        >
          <div className="space-y-4">
            <h2 className="text-3xl font-bold uppercase tracking-tighter">Quer subir de nível?</h2>
            <p className="text-white/60 max-w-xl mx-auto text-lg">
              Continue divulgando, aumente seus resultados e desbloqueie as próximas premiações. O topo está reservado para quem age.
            </p>
          </div>
          
          <Button asChild variant="neon" size="lg" className="px-10 h-14 text-lg">
            <Link to="/parceiro">Ver meu ranking atual</Link>
          </Button>
        </motion.section>
      </main>

      <footer className="border-t border-white/5 py-12 text-center">
        <div className="flex justify-center mb-4 opacity-40">
          <MskLogo size={24} />
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/20 font-black">
          © 2026 MSK SISTEM · Premium Recognition System
        </p>
      </footer>
    </div>
  );
}
