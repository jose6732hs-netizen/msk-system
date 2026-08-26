import { useEffect, useState } from "react";
import { Bell, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePushNotifications, needsIosInstall, pushPermission, pushSupported } from "@/lib/push-client";
import { toast } from "sonner";

export function PushPermissionPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    const dismissedIos = localStorage.getItem("msk_push_dismissed");
    if (needsIosInstall()) {
      if (!dismissedIos) {
        setIosMode(true);
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
      return undefined;
    }

    if (pushSupported()) {
      const perm = pushPermission();
      const dismissed = localStorage.getItem("msk_push_dismissed");
      const enabled = localStorage.getItem("msk_push_enabled");
      if (perm === "default" && !dismissed && !enabled) {
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
    } else if (res.reason === "denied") {
      toast.error("Permissão negada. Você pode ativar nas configurações do navegador.");
      setShow(false);
    } else {
      toast.error(res.message);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("msk_push_dismissed", new Date().toISOString());
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-[115] mx-auto w-auto max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-500 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[calc(100vw-3rem)]">
      <div className="glass neon-glow group relative min-w-0 overflow-hidden rounded-3xl border-primary/30 p-4 sm:p-6">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-all duration-700 group-hover:bg-primary/20" />

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:right-3 sm:top-3"
          aria-label="Fechar aviso de notificações"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 gap-3 pr-7 sm:gap-4 sm:pr-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary sm:h-12 sm:w-12">
            <Bell className="h-5 w-5 animate-bounce sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="flex min-w-0 items-start gap-2 break-words text-sm font-bold leading-tight text-foreground sm:text-base">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">
                {iosMode ? "Instale o app no iPhone" : "Ative as notificações"}
              </span>
            </h3>
            <p className="break-words text-xs leading-relaxed text-muted-foreground">
              {iosMode
                ? "No iOS as notificações só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone MSK para ativar."
                : "Receba atualizações importantes sobre pagamentos, vendas, comissões e sua conta em tempo real."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:mt-6">
          {iosMode ? (
            <Button
              variant="neon"
              className="min-h-11 w-full rounded-xl text-xs font-bold uppercase tracking-wider"
              onClick={handleDismiss}
            >
              Entendi
            </Button>
          ) : (
            <Button
              variant="neon"
              className="min-h-11 w-full rounded-xl text-xs font-bold uppercase tracking-wider"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ativar notificações
            </Button>
          )}
          <Button
            variant="ghost"
            className="min-h-11 w-full rounded-xl text-xs text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
