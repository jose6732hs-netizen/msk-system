import { useState, useEffect } from "react";
import { Bell, ShieldCheck, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePushNotifications, needsIosInstall, pushPermission, pushSupported } from "@/lib/push-client";
import { toast } from "sonner";

export function PushPermissionPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    const dismissedIos = localStorage.getItem("msk_push_dismissed");
    // iPhone/iPad fora do modo app: o iOS só entrega push depois de instalar na tela de início.
    if (needsIosInstall()) {
      if (!dismissedIos) {
        setIosMode(true);
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
      return undefined;
    }
    // Só mostra se for suportado e não tiver permissão
    if (pushSupported()) {
      const perm = pushPermission();
      const dismissed = localStorage.getItem("msk_push_dismissed");
      const enabled = localStorage.getItem("msk_push_enabled");
      
      // Removemos a verificação de sessão aqui para permitir que visitantes anônimos
      // também recebam notificações de "Campanhas" (marketing)
      if (perm === "default" && !dismissed && !enabled) {
        // Delay para não ser intrusivo logo no primeiro segundo
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, []);

  const handleEnable = async () => {
    if (iosMode) return;
    setLoading(true);
    const res = await enablePushNotifications();
    setLoading(false);
    
    if (res.ok) {
      setShow(false);
      localStorage.setItem("msk_push_enabled", "1");
      toast.success("Notificações ativadas com sucesso!");
    } else {
      if (res.reason === "denied") {
        toast.error("Permissão negada. Você pode ativar nas configurações do navegador.");
        setShow(false);
      } else {
        toast.error(res.message);
      }
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("msk_push_dismissed", new Date().toISOString());
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="glass neon-glow rounded-3xl p-6 border-primary/30 relative overflow-hidden group">
        {/* Background animation */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Bell className="h-6 w-6 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {iosMode ? "Instale o app no iPhone" : "Ative as notificações"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {iosMode
                ? "No iOS as notificações só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone MSK para ativar."
                : "Receba atualizações importantes sobre pagamentos, vendas, comissões e sua conta em tempo real."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {iosMode ? (
            <Button
              variant="neon"
              className="w-full rounded-xl font-bold uppercase tracking-wider text-xs h-11"
              onClick={handleDismiss}
            >
              Entendi
            </Button>
          ) : (
            <Button 
              variant="neon" 
              className="w-full rounded-xl font-bold uppercase tracking-wider text-xs h-11"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Ativar notificações
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="w-full rounded-xl text-xs text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
