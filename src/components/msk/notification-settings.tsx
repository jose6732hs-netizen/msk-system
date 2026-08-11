import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getMyNotificationPrefs,
  updateMyNotificationPrefs,
  getGlobalNotificationSettings,
  saveGlobalNotificationSettings,
  NOTIFICATION_KEYS,
} from "@/lib/notification-prefs.functions";
import { enablePushNotifications, pushPermission } from "@/lib/push-client";

const LABELS: Record<string, { title: string; desc: string; emoji: string }> = {
  sales: { title: "Vendas aprovadas", desc: "Avisar sempre que uma venda for paga.", emoji: "💰" },
  payments: { title: "Pagamentos gerados", desc: "PIX gerado, pendente ou expirado.", emoji: "🧾" },
  commissions: { title: "Comissões", desc: "Comissões liberadas, pagas ou estornadas.", emoji: "🤝" },
  messages: { title: "Mensagens do suporte", desc: "Respostas e avisos diretos da equipe.", emoji: "💬" },
  campaigns: { title: "Campanhas", desc: "Novas campanhas e materiais para divulgar.", emoji: "📣" },
  updates: { title: "Atualizações do sistema", desc: "Novas versões da extensão e do painel.", emoji: "🚀" },
  promotions: { title: "Promoções", desc: "Ofertas e descontos exclusivos.", emoji: "🔥" },
};

/**
 * Painel de notificações. `scope="user"` edita as preferências pessoais;
 * `scope="admin"` liga/desliga os disparos globais da plataforma.
 */
export function NotificationSettings({ scope = "user" }: { scope?: "user" | "admin" }) {
  const qc = useQueryClient();
  const isAdmin = scope === "admin";
  const loadUser = useServerFn(getMyNotificationPrefs);
  const saveUser = useServerFn(updateMyNotificationPrefs);
  const loadGlobal = useServerFn(getGlobalNotificationSettings);
  const saveGlobal = useServerFn(saveGlobalNotificationSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs", scope],
    queryFn: async () =>
      isAdmin
        ? ((await loadGlobal()).settings as Record<string, boolean>)
        : ((await loadUser()).prefs as unknown as Record<string, boolean>),
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>("default");
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    setPermission(pushPermission());
  }, []);

  async function toggle(key: string, value: boolean) {
    setSaving(key);
    try {
      const patch = { [key]: value };
      if (isAdmin) await saveGlobal({ data: patch });
      else await saveUser({ data: patch });
      qc.setQueryData(["notification-prefs", scope], (old: Record<string, boolean> | undefined) => ({
        ...(old ?? {}),
        [key]: value,
      }));
      toast.success(value ? "Notificação ativada" : "Notificação desativada");
    } catch (e) {
      toast.error((e as Error).message);
      qc.invalidateQueries({ queryKey: ["notification-prefs", scope] });
    } finally {
      setSaving(null);
    }
  }

  async function askPermission() {
    setEnabling(true);
    const res = await enablePushNotifications();
    setPermission(pushPermission());
    setEnabling(false);
    if (res.ok) toast.success("Notificações ativadas neste dispositivo! 🔔");
    else toast.error(res.message);
  }

  return (
    <div className="space-y-5">
      <div className="glass grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-primary/20 p-5 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black uppercase tracking-wide">
              Notificações neste dispositivo
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === "granted"
                ? "Permissão concedida — você receberá avisos mesmo fora do app."
                : permission === "denied"
                  ? "Bloqueado pelo navegador. Libere nas configurações do site."
                  : permission === "unsupported"
                    ? "Este navegador não suporta notificações push."
                    : "Ative para receber vendas, pagamentos e avisos fora do app."}
            </p>
          </div>
        </div>
        <Button
          variant={permission === "granted" ? "neonOutline" : "neon"}
          disabled={enabling || permission === "denied" || permission === "unsupported"}
          onClick={askPermission}
          className="shrink-0"
        >
          {enabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
          {permission === "granted" ? "Reativar" : "Permitir"}
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {NOTIFICATION_KEYS.map((key) => {
            const info = LABELS[key]!;
            const value = data?.[key] !== false;
            return (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/50 bg-black/20 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {info.emoji} {info.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{info.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {saving === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                  <Switch checked={value} onCheckedChange={(v) => void toggle(key, v)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Estes interruptores controlam os disparos de toda a plataforma. Cada usuário ainda pode
          desativar os tipos que não quiser receber no painel dele.
        </p>
      )}
    </div>
  );
}
