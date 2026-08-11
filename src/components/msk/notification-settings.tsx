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
} from "@/lib/notification-prefs.functions";
import { NOTIFICATION_GROUPS } from "@/lib/notification-keys";
import { enablePushNotifications, pushPermission } from "@/lib/push-client";


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

  async function toggle(groupId: string, keys: string[], value: boolean) {
    setSaving(groupId);
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, value]));
      if (isAdmin) await saveGlobal({ data: patch });
      else await saveUser({ data: patch });
      qc.setQueryData(["notification-prefs", scope], (old: Record<string, boolean> | undefined) => ({
        ...(old ?? {}),
        ...patch,
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
          {NOTIFICATION_GROUPS.map((group) => {
            const value = group.keys.some((k) => data?.[k] !== false);
            return (
              <div
                key={group.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/50 bg-black/20 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {group.emoji} {group.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{group.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {saving === group.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                  <Switch checked={value} onCheckedChange={(v) => void toggle(group.id, group.keys, v)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Estes interruptores controlam as notificações de administração. Notificações de comissão e promoções são exclusivas para o painel de usuários.
        </p>
      )}
    </div>
  );
}
