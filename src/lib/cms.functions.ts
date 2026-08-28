import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

declare global {
  interface Window {
    __mskCmsUploadFetchPatched?: boolean;
  }
}

// O editor envia imagens por fetch/FormData direto para a rota de upload.
// Diferente de useServerFn, fetch() não inclui automaticamente o Bearer da sessão,
// então a rota respondia UNAUTHORIZED mesmo com o admin logado. Centralizamos aqui
// a inclusão segura do token para todos os uploads do CMS (site, banners e ofertas).
if (typeof window !== "undefined" && !window.__mskCmsUploadFetchPatched) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const target = new URL(rawUrl, window.location.origin);
    const isCmsUpload =
      target.origin === window.location.origin && target.pathname === "/api/public/cms/upload";

    if (!isCmsUpload) return nativeFetch(input, init);

    const { supabase } = await import("@/integrations/supabase/client");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sessão expirada. Entre novamente para enviar imagens.");
    }

    const requestHeaders =
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init?.headers ?? requestHeaders);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    return nativeFetch(input, { ...init, headers });
  };
  window.__mskCmsUploadFetchPatched = true;
}

async function readPublishedWith(client: any) {
  return client.from("app_settings").select("*");
}

/**
 * Conteúdo publicado do CMS.
 *
 * A página pública NÃO deve depender da service-role. Primeiro tentamos o
 * cliente server com publishable key (RLS). Se a política exigir privilégio,
 * tentamos o cliente admin. No carregamento público, uma configuração ausente
 * nunca deve transformar o site inteiro em tela branca.
 */
async function loadPublishedCmsSettings(options: { publicSafe?: boolean } = {}) {
  let data: any[] | null = null;
  let lastError: unknown = null;

  try {
    const { supabaseServer } = await import("@/integrations/supabase/client.server");
    const result = await readPublishedWith(supabaseServer as any);
    data = (result.data ?? null) as any[] | null;
    lastError = result.error ?? null;
  } catch (error) {
    lastError = error;
  }

  if (lastError) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const result = await readPublishedWith(supabaseAdmin as any);
      data = (result.data ?? null) as any[] | null;
      lastError = result.error ?? null;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`[CMS] Falha ao carregar conteúdo publicado: ${message}`);
    if (options.publicSafe) return {};
    throw new Error(`Erro ao carregar conteúdo do CMS: ${message}`);
  }

  const settings: Record<string, any> = {};
  data?.forEach((item: any) => {
    if (options.publicSafe && item.key === "vapid_keys") return;
    settings[item.key] = item.value;
  });
  return settings;
}

/** Conteúdo publicado. Pode continuar sendo usado pelas telas públicas. */
export const getCmsContent = createServerFn({ method: "GET" })
  .handler(async () => loadPublishedCmsSettings({ publicSafe: true }));

/**
 * Conteúdo específico do editor administrativo.
 * Carrega o que está publicado e aplica por cima o rascunho mais recente de
 * cada chave. Assim um rascunho já salvo volta a aparecer ao reabrir o admin e
 * no Live Preview sem vazar conteúdo não publicado para o site público.
 */
export const getCmsEditorContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const settings = await loadPublishedCmsSettings();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drafts, error } = await (supabaseAdmin as any)
      .from("cms_drafts")
      .select("key,data,updated_at")
      .eq("status", "draft")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Erro ao carregar rascunhos do CMS: ${error.message}`);

    const seen = new Set<string>();
    for (const draft of drafts ?? []) {
      const key = String(draft.key ?? "");
      if (!key || seen.has(key)) continue;
      settings[key] = draft.data;
      seen.add(key);
    }

    return settings;
  });

export const saveCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    key: z.string(),
    data: z.any()
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await (supabaseAdmin as any)
      .from("cms_drafts")
      .select("id")
      .eq("key", data.key)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabaseAdmin as any)
        .from("cms_drafts")
        .update({
          data: data.data,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any)
        .from("cms_drafts")
        .insert({
          key: data.key,
          data: data.data,
          status: "draft"
        });
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

export const publishCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    key: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: draft, error: draftErr } = await (supabaseAdmin as any)
      .from("cms_drafts")
      .select("*")
      .eq("key", data.key)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftErr) throw new Error(`Database error fetching draft: ${draftErr.message}`);
    if (!draft) throw new Error(`Draft not found for key: ${data.key}. Certifique-se de "Salvar Rascunho" antes de publicar.`);

    const { error: setErr } = await (supabaseAdmin as any)
      .from("app_settings")
      .upsert({
        key: data.key,
        value: draft.data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (setErr) throw new Error(`Database error publishing to app_settings: ${setErr.message}`);

    await (supabaseAdmin as any)
      .from("cms_drafts")
      .update({
        status: "published",
        published_at: new Date().toISOString()
      })
      .eq("id", draft.id);

    return { success: true };
  });

export const getCmsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("cms_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (data || []) as any[];
  });

export const uploadCmsAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Esta função foi substituída pela rota /api/public/cms/upload para lidar melhor com FormData.
    throw new Error("Use a rota /api/public/cms/upload para uploads de arquivos.");
  });