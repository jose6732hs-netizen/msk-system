import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/documentacao")({
  head: () => ({
    meta: [
      { title: "API de licenciamento — MSK SISTEM" },
      {
        name: "description",
        content:
          "Contrato da API REST usada pela extensão Chrome MSK SISTEM: ativação, validação, heartbeat e gerenciamento de dispositivos.",
      },
      { property: "og:title", content: "Documentação da API — MSK SISTEM" },
      {
        property: "og:description",
        content: "Endpoints de ativação, validação e heartbeat da licença.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Docs,
});

const endpoints = [
  {
    method: "POST",
    path: "/api/public/license/activate",
    desc: "Ativa a licença em um dispositivo e registra o fingerprint.",
    body: `{
  "token": "MSK-XXXX-XXXX-XXXX-XXXX",
  "device_id": "fingerprint-unico",
  "device_name": "Chrome — Windows",
  "browser": "Chrome 131",
  "os": "Windows 11",
  "extension_version": "1.0.0"
}`,
    res: `{
  "valid": true,
  "status": "active",
  "plan": "monthly",
  "expires_at": "2026-01-01T00:00:00Z",
  "features": ["ai_chat", "projects"],
  "device_slot": { "used": 1, "max": 2 }
}`,
  },
  {
    method: "POST",
    path: "/api/public/license/validate",
    desc: "Verificação periódica do status. Sempre no servidor — nunca em cache local confiável.",
    body: `{ "token": "MSK-...", "device_id": "fingerprint-unico" }`,
    res: `{ "valid": true, "status": "active", "expires_at": "...", "features": [] }`,
  },
  {
    method: "POST",
    path: "/api/public/license/heartbeat",
    desc: "Marca o dispositivo como vivo e devolve o estado atual da licença.",
    body: `{ "token": "MSK-...", "device_id": "fingerprint-unico" }`,
    res: `{ "valid": true, "status": "active", "next_check_in": 3600 }`,
  },
  {
    method: "GET",
    path: "/api/public/license/me?token=MSK-...",
    desc: "Dados do assinante e dispositivos vinculados à licença.",
    body: "—",
    res: `{ "user": { "name": "...", "email": "..." }, "devices": [] }`,
  },
  {
    method: "POST",
    path: "/api/public/license/deactivate",
    desc: "Desativa a licença no dispositivo atual (logout da extensão).",
    body: `{ "token": "MSK-...", "device_id": "fingerprint-unico" }`,
    res: `{ "ok": true }`,
  },
  {
    method: "POST",
    path: "/api/public/webhooks/payment",
    desc: "Recebe eventos do gateway com assinatura HMAC-SHA256 e processamento idempotente.",
    body: `{ "event_id": "...", "type": "payment.succeeded", "data": { } }`,
    res: `{ "received": true }`,
  },
];

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function Docs() {
  const { data: isAdmin } = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!role;
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-5">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Acesso restrito</h1>
            <p className="text-muted-foreground">Esta página é visível apenas para administradores do sistema.</p>
            <Button asChild variant="neon">
              <Link to="/">Voltar para Home</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="text-4xl font-bold">
          API de <span className="neon-text">licenciamento</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Toda validação acontece no backend. A extensão nunca decide sozinha se a
          licença é válida: ela envia o token e o fingerprint do dispositivo, e o
          servidor responde com o status, os recursos liberados e o prazo. Tokens são
          guardados com hash + pepper; não é possível recuperá-los do banco.
        </p>

        <div className="mt-10 space-y-5">
          {endpoints.map((e) => (
            <article key={e.path} className="glass rounded-2xl p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                  {e.method}
                </span>
                <code className="font-mono text-sm">{e.path}</code>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{e.desc}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Requisição
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-3 font-mono text-xs text-foreground/80">
                    {e.body}
                  </pre>
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                    Resposta
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-3 font-mono text-xs text-primary/80">
                    {e.res}
                  </pre>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="glass mt-10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Boas práticas na extensão</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Guarde apenas o token e o device_id no storage da extensão.</li>
            <li>Revalide a cada hora e em cada abertura do navegador.</li>
            <li>Se a resposta for <code>valid: false</code>, bloqueie os recursos pagos imediatamente.</li>
            <li>Nunca embuta preços, planos ou regras de licença no código da extensão.</li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}