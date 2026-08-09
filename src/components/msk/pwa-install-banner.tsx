import { useState, useEffect } from "react";
import { Download, X, Bell, Rocket, Wallet, Smartphone, ShieldCheck, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const rotativeTexts = [
  "📱 BAIXE O APP E FIQUE POR DENTRO DAS ATUALIZAÇÕES",
  "🔔 RECEBA NOTIFICAÇÕES EM TEMPO REAL",
  "🚀 NÃO PERCA NENHUMA NOVIDADE",
  "💰 RECEBA AVISOS DE VENDAS, PAGAMENTOS E NOVIDADES",
  "📲 TENHA NOSSO APP SEMPRE À MÃO"
];

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [textIndex, setTextIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [platform, setPlatform] = useState<{os: string, browser: string}>({os: 'unknown', browser: 'unknown'});
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
      return standalone;
    };

    const detectPlatform = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      let os = 'unknown';
      let browser = 'unknown';

      if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
      else if (/android/.test(ua)) os = 'android';
      else if (/win/.test(ua)) os = 'windows';
      else if (/mac/.test(ua)) os = 'macos';

      if (/chrome|crios/.test(ua) && !/edge|opr|brave/.test(ua)) browser = 'chrome';
      else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) browser = 'safari';
      else if (/edge/.test(ua)) browser = 'edge';

      setPlatform({ os, browser });
    };

    detectPlatform();
    const standalone = checkStandalone();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone && !localStorage.getItem('pwa_banner_dismissed')) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    // Fallback for iOS since it doesn't support beforeinstallprompt
    if (!standalone && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) && !localStorage.getItem('pwa_banner_dismissed')) {
      setIsVisible(true);
    }

    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % rotativeTexts.length);
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearInterval(interval);
    };
  }, []);

  if (isStandalone) return null;

  const handleInstallClick = () => {
    if (deferredPrompt && platform.os !== 'ios') {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(({ outcome }: any) => {
        if (outcome === "accepted") {
          setIsVisible(false);
          localStorage.setItem('pwa_installed', 'true');
        }
      });
    } else {
      setShowTutorial(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_banner_dismissed', Date.now().toString());
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="w-full bg-black relative z-[100] border-b border-orange-500/30 overflow-hidden"
          >
            {/* Linha de luz fluorescente percorrendo */}
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent blur-sm"
            />
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1.5 }}
              className="absolute bottom-0 left-0 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent blur-sm"
            />

            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
              <div className="flex-1 flex items-center min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={textIndex}
                    initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                    transition={{ duration: 0.5 }}
                    className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] truncate"
                  >
                    {rotativeTexts[textIndex]}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleInstallClick}
                  className="h-8 px-3 text-[10px] font-black uppercase bg-orange-500/10 border-orange-500/40 text-orange-500 hover:bg-orange-500 hover:text-black transition-all rounded-full shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                >
                  <Smartphone className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Baixar App</span>
                  <span className="sm:hidden">Baixar</span>
                </Button>
                <button onClick={handleDismiss} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
        <DialogContent className="bg-[#050508] border-white/10 text-white max-w-sm rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
              {platform.os === 'ios' ? '🍎 Instalar no iPhone' : 
               platform.os === 'android' ? '🤖 Instalar no Android' : 
               '💻 Instalar App'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {platform.os === 'ios' ? (
              <div className="space-y-4">
                <TutorialStep step="1" text="Abra o menu 'Compartilhar' do Safari." icon={<Share className="w-4 h-4" />} />
                <TutorialStep step="2" text="Procure e toque em 'Adicionar à Tela de Início'." icon={<Plus className="w-4 h-4" />} />
                <TutorialStep step="3" text="Toque em 'Adicionar' no canto superior." />
                <TutorialStep step="4" text="Abra o MSK SUIT pela sua tela inicial." />
              </div>
            ) : platform.os === 'android' ? (
              <div className="space-y-4">
                <TutorialStep step="1" text="Toque nos três pontos (⋮) do Chrome." />
                <TutorialStep step="2" text="Selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'." />
                <TutorialStep step="3" text="Confirme a instalação." />
              </div>
            ) : (
              <div className="space-y-4">
                <TutorialStep step="1" text="Clique no ícone de instalação na barra de endereços." />
                <TutorialStep step="2" text="Ou abra o menu do navegador e procure por 'Instalar MSK SUIT'." />
                <TutorialStep step="3" text="Confirme para ter acesso direto pelo desktop." />
              </div>
            )}

            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-5 h-5 text-primary" />
                <span className="font-bold uppercase text-xs">Ative as Notificações</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Após instalar, abra o app e aceite a permissão de notificações para receber avisos de vendas e atualizações em tempo real.
              </p>
            </div>

            <Button variant="neon" className="w-full h-12 rounded-xl uppercase font-black" onClick={() => setShowTutorial(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TutorialStep({ step, text, icon }: { step: string, text: string, icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-black">
        {step}
      </div>
      <div className="flex-1">
        <p className="text-sm text-white/80 leading-tight flex items-center gap-2">
          {text}
          {icon && <span className="inline-flex p-1 bg-white/10 rounded-md">{icon}</span>}
        </p>
      </div>
    </div>
  );
}