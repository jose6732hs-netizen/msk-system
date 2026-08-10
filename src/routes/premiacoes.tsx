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
import award1kAsset from "@/assets/award-1k.png.asset.json";
import award500kAsset from "@/assets/award-500k.png.asset.json";
import award1mAsset from "@/assets/award-1m.png.asset.json";
import award5mAsset from "@/assets/award-5m.png.asset.json";
import awardsHeroAsset from "@/assets/awards-hero.png.asset.json";
const award10kAsset = { url: "https://zjrrymncmiyftyogejjr.supabase.co/storage/v1/object/public/images/award-10k.png" };
const award100kAsset = { url: "https://zjrrymncmiyftyogejjr.supabase.co/storage/v1/object/public/images/award-100k.png" };

export const Route = createFileRoute("/premiacoes")({
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
    image: award1kAsset.url,
  },
  {
    threshold: "10K",
    title: "Barra de Ouro",
    description: "Já está no jogo de verdade.",
    icon: Target,
    color: "from-yellow-500/20 to-yellow-500/5",
    borderColor: "border-yellow-500/20",
    glowColor: "shadow-[0_0_20px_rgba(234,179,8,0.1)]",
    image: award10kAsset.url,
  },
  {
    threshold: "100K",
    title: "Rubi Natural",
    description: "Nível de quem leva a sério.",
    icon: Star,
    color: "from-red-500/20 to-red-500/5",
    borderColor: "border-red-500/20",
    glowColor: "shadow-[0_0_20px_rgba(239,68,68,0.1)]",
    image: award100kAsset.url,
  },
  {
    threshold: "500K",
    title: "Safira Azul",
    description: "Elite. Resultados consistentes.",
    icon: Gem,
    color: "from-blue-500/20 to-blue-500/5",
    borderColor: "border-blue-500/20",
    glowColor: "shadow-[0_0_20px_rgba(59,130,246,0.1)]",
    image: award500kAsset.url,
  },
  {
    threshold: "1M",
    title: "Diamante Brilhante",
    description: "Milhão conquistado. Nível máximo.",
    icon: Crown,
    color: "from-cyan-500/20 to-cyan-500/5",
    borderColor: "border-cyan-500/20",
    glowColor: "shadow-[0_0_20px_rgba(6,182,212,0.1)]",
    image: award1mAsset.url,
  },
  {
    threshold: "5M",
    title: "Diamante Raro",
    description: "Lenda. Quem chegou no topo.",
    icon: Trophy,
    color: "from-primary/20 to-primary/5",
    borderColor: "border-primary/20",
    glowColor: "shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]",
    image: award5mAsset.url,
  },
];

function AwardsPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % levels.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setActiveIndex((prev) => (prev + newDirection + levels.length) % levels.length);
  };

  const getVisibleLevels = () => {
    const prev = (activeIndex - 1 + levels.length) % levels.length;
    const next = (activeIndex + 1) % levels.length;
    return [prev, activeIndex, next];
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
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
          className="text-center mb-16 space-y-8"
        >
          <motion.img 
            src={awardsHeroAsset.url} 
            alt="Seu Resultado Tem Valor" 
            className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl shadow-primary/10"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7 }}
          />
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase neon-text">
              Central de Premiações
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto font-medium">
              Seu desempenho é reconhecido. Quanto maior o resultado, maior a recompensa.
            </p>
          </div>
        </motion.div>

        {/* Professional 3D Carousel Section */}
        <section className="relative h-[500px] mb-20 flex items-center justify-center perspective-1000">
          <div className="relative w-full max-w-4xl flex items-center justify-center">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              {getVisibleLevels().map((levelIdx, position) => {
                const level = levels[levelIdx];
                if (!level) return null;
                const isCenter = position === 1;
                const isLeft = position === 0;
                
                return (
                  <motion.div
                    key={`${levelIdx}-${position}`}
                    initial={{ 
                      opacity: 0, 
                      scale: 0.8,
                      x: direction > 0 ? (isCenter ? 100 : 200) : (isCenter ? -100 : -200),
                      rotateY: isLeft ? 45 : -45,
                      zIndex: 0
                    }}
                    animate={{ 
                      opacity: isCenter ? 1 : 0.4, 
                      scale: isCenter ? 1 : 0.75,
                      x: isCenter ? 0 : (isLeft ? -200 : 200),
                      rotateY: isCenter ? 0 : (isLeft ? 35 : -35),
                      zIndex: isCenter ? 20 : 10,
                    }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0.5,
                      x: direction > 0 ? -300 : 300,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                    className={`absolute w-[200px] md:w-[240px] aspect-[9/16] rounded-3xl overflow-hidden border border-white/10 glass-dark group cursor-pointer ${isCenter ? 'shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)]' : ''}`}
                    onClick={() => !isCenter && paginate(isLeft ? -1 : 1)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                    <img 
                      src={level.image} 
                      alt={level.title}
                      className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110"
                    />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-20 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-primary text-xs font-black px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          {level.threshold}
                        </span>
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tighter mb-1">{level.title}</h3>
                      <p className="text-white/60 text-[10px] font-medium leading-tight">
                        {level.description}
                      </p>
                    </div>

                    {!isCenter && (
                      <div className="absolute inset-0 bg-black/40 z-30 backdrop-blur-[2px] pointer-events-none" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-8 z-40">
            <button 
              onClick={() => paginate(-1)}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all text-white/50 hover:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex gap-2">
              {levels.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 transition-all duration-300 rounded-full ${i === activeIndex ? 'w-8 bg-primary' : 'w-2 bg-white/10'}`} 
                />
              ))}
            </div>

            <button 
              onClick={() => paginate(1)}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all text-white/50 hover:text-white"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </section>

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
