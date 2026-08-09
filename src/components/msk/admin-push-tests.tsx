import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, CheckCircle2, KeyRound, Loader2, RefreshCw, Send, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminGenerateVapidKeys,
  adminPushConfig,
  adminSaveVapidKeys,
  adminSendTestPush,
  adminSentNotifications,
  adminTestVapid,
  getPushPublicKey,
  registerPushDevice,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function AdminPushTestsTab() {
  const qc = useQueryClient();
  const configFn = useServerFn(adminPushConfig);
  const saveFn = useServerFn(adminSaveVapidKeys);
  const genFn = useServerFn(adminGenerateVapidKeys);
  const testFn = useServerFn(adminTestVapid);
  const sendFn = useServerFn(adminSendTestPush);
  const sentFn = useServerFn(adminSentNotifications);
  const publicKeyFn = useServerFn(getPushPublicKey);
  const registerFn = useServerFn(registerPushDevice);

  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [title, setTitle] = useState("Teste de notificação");
  const [body, setBody] = useState("Se você recebeu isto, o push está funcionando.");
  const [emoji, setEmoji] = useState("🔔");
  const [link, setLink] = useState("/painel");
  const [target, setTarget] = useState<"me" | "all">("me");

  const { data: config, isLoading } = useQuery({ queryKey: ["push-config"], queryFn: () => configFn() });
  const { data: history } = useQuery({ queryKey: ["push-sent"], queryFn: () => sentFn() });

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function subscribeThisBrowser() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Este navegador não suporta notificações push.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Permissão de notificações negada pelo navegador.");
      return;
    }
    const { publicKey: vapid } = await publicKeyFn();
    if (!vapid) {
      toast.error("Configure as chaves VAPID antes de inscrever este navegador.");
      return;
    }
    const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      }));
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    await registerFn({
      data: {
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? bufToB64url(sub.getKey("p256dh")),
        auth: json.keys?.auth ?? bufToB64url(sub.getKey("auth")),
        deviceId: `${navigator.platform}-${Math.abs(navigator.userAgent.length * 7919)}`,
        browser: navigator.userAgent.split(") ").pop() ?? "desconhecido",
        platform: navigator.platform,
        userAgent: navigator.userAgent.slice(0, 380),
      },
    });
    toast.success("Este navegador foi inscrito para receber push.");
    qc.invalidateQueries({ queryKey: ["push-sent"] });
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Chaves VAPID", value: isLoading ? "..." : config?.configured ? "Configuradas" : "Ausentes", Icon: KeyRound },
          { label: "Dispositivos ativos", value: String(history?.devices ?? 0), Icon: Smartphone },
          { label: "Enviadas (últimas 50)", value: String(history?.totalSent ?? 0), Icon: Bell },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="glass rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
            <p className="mt-2 break-words text-xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {/* Chaves VAPID */}
      <div className="glass space-y-4 rounded-2xl border border-border/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest">Chaves VAPID</h3>
          {config?.source && (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
              {config.source === "database" ? "cadastradas" : "servidor"}
            </span>
          )}
        </div>

        {config?.publicKey && (
          <p className="break-all rounded-xl bg-white/5 p-3 text-[0.7rem] text-muted-foreground">
            Pública atual: {config.publicKey}
          </p>
        )}

        <div className="grid gap-3">
          <Input placeholder="Chave pública (base64url)" value={publicKey} onChange={(e) => setPublicKey(e.target.value)} />
          <Input
            placeholder="Chave privada (PKCS8 base64)"
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
          />
          <Input placeholder="Assunto (mailto:suporte@seudominio.com)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-w-0 flex-1 whitespace-normal leading-tight sm:flex-none"
            disabled={busy === "gen"}
            onClick={() =>
              run("gen", async () => {
                const pair = await genFn();
                setPublicKey(pair.publicKey);
                setPrivateKey(pair.privateKey);
                toast.success("Par de chaves gerado. Clique em salvar para aplicar.");
              })
            }
          >
            {busy === "gen" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 shrink-0" />}
            Gerar par
          </Button>

          <Button
            className="min-w-0 flex-1 whitespace-normal leading-tight sm:flex-none"
            disabled={busy === "save" || !publicKey || !privateKey}
            onClick={() =>
              run("save", async () => {
                await saveFn({ data: { publicKey, privateKey, subject: subject || undefined } });
                toast.success("Chaves salvas com segurança (privada criptografada).");
                setPrivateKey("");
                qc.invalidateQueries({ queryKey: ["push-config"] });
              })
            }
          >
            Salvar chaves
          </Button>

          <Button
            variant="secondary"
            className="min-w-0 flex-1 whitespace-normal leading-tight sm:flex-none"
            disabled={busy === "test"}
            onClick={() =>
              run("test", async () => {
                const res = await testFn();
                if (res.ok) toast.success(res.message);
                else toast.error(res.message);
              })
            }
          >
            {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />}
            Testar conexão
          </Button>
        </div>
      </div>

      {/* Teste de push */}
      <div className="glass space-y-4 rounded-2xl border border-border/50 p-4 sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-widest">🧪 Testar push</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          <Input placeholder="Mensagem" value={body} onChange={(e) => setBody(e.target.value)} className="sm:col-span-2" />
          <Input placeholder="Link ao clicar" value={link} onChange={(e) => setLink(e.target.value)} className="sm:col-span-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["me", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                target === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {t === "me" ? "Meus dispositivos" : "Todos inscritos"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-w-0 flex-1 whitespace-normal leading-tight sm:flex-none"
            disabled={busy === "sub"}
            onClick={() => run("sub", subscribeThisBrowser)}
          >
            <Smartphone className="mr-2 h-4 w-4 shrink-0" />
            Inscrever este navegador
          </Button>
          <Button
            className="min-w-0 flex-1 whitespace-normal leading-tight sm:flex-none"
            disabled={busy === "send"}
            onClick={() =>
              run("send", async () => {
                const res = await sendFn({ data: { title, body, emoji, link, target } });
                if (res.sent > 0) toast.success(res.message);
                else toast.error(res.message);
                qc.invalidateQueries({ queryKey: ["push-sent"] });
              })
            }
          >
            {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 shrink-0" />}
            Enviar teste
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div className="glass rounded-2xl border border-border/50 p-4 sm:p-6">
        <h3 className="mb-4 text-sm font-black uppercase tracking-widest">Enviadas</h3>
        {!history?.notifications.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">🔔 Nenhuma notificação enviada por enquanto.</p>
        ) : (
          <div className="space-y-2">
            {history.notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-xl border border-border/40 p-3">
                {n.status === "sent" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")} · {n.push_status ?? n.status}
                    {n.push_error ? ` · ${n.push_error}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
