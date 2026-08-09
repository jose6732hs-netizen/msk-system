import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/.lovable/oauth/consent")({
    ssr: false,
    validateSearch: (s) => ({
        authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
    }),
    beforeLoad: async ({ search, location }) => {
        if (!search.authorization_id)
            throw new Error("Missing authorization_id");
        const { data } = await supabase.auth.getSession();
        const next = location.pathname + location.searchStr;
        if (!data.session)
            throw redirect({ to: "/auth", search: { next } });
    },
    loader: async ({ location }) => {
        const authorizationId = new URLSearchParams(location.search).get("authorization_id");
        // @ts-ignore - beta namespace
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        if (error)
            throw error;
        const details = data;
        const immediate = details?.redirect_url ?? details?.redirect_to;
        if (immediate && !details?.client)
            throw redirect({ href: immediate });
        return details;
    },
    component: Consent,
    errorComponent: ({ error }) => (<main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F0F0F] p-8 text-center">
        <h1 className="text-xl font-bold text-red-500 uppercase tracking-tighter mb-4">Erro de Autorização</h1>
        <p className="text-sm text-muted-foreground">{String(error?.message ?? error)}</p>
      </div>
    </main>),
});
function Consent() {
    const details = Route.useLoaderData();
    const { authorization_id } = Route.useSearch();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    async function decide(approve) {
        setBusy(true);
        // @ts-ignore - beta namespace
        const { data, error } = approve
            ? await supabase.auth.oauth.approveAuthorization(authorization_id)
            : await supabase.auth.oauth.denyAuthorization(authorization_id);
        if (error) {
            setBusy(false);
            setError(error.message);
            return;
        }
        const target = data?.redirect_url ?? data?.redirect_to;
        if (!target) {
            setBusy(false);
            setError("Nenhum redirecionamento retornado pelo servidor.");
            return;
        }
        window.location.href = target;
    }
    return (<main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#0F0F0F] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -z-10"/>
        
        <h1 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Conectar App</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Autorizar <span className="text-primary font-bold">{details?.client?.name ?? "um aplicativo"}</span> a acessar sua conta MSK SISTEM.
        </p>

        <div className="space-y-6 mb-10">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-primary"/>
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-tight">Ver seu perfil</p>
              <p className="text-xs text-muted-foreground">Nome, e-mail e funções atribuídas.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-primary"/>
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-tight">Gerenciar licenças</p>
              <p className="text-xs text-muted-foreground">Listar e visualizar detalhes de suas licenças ativas.</p>
            </div>
          </div>
        </div>

        {error && (<div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-bold uppercase">
            {error}
          </div>)}

        <div className="grid gap-3">
          <button disabled={busy} onClick={() => decide(true)} className="h-12 w-full rounded-2xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50">
            {busy ? "Processando..." : "Aprovar Conexão"}
          </button>
          <button disabled={busy} onClick={() => decide(false)} className="h-12 w-full rounded-2xl bg-white/5 border border-white/10 text-sm font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all disabled:opacity-50">
            Cancelar
          </button>
        </div>
      </div>
    </main>);
}
