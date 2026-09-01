import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

const providerId = z.enum(["openai", "groq", "gemini"]);

export type AiProviderRow = {
  id: "openai" | "groq" | "gemini";
  label: string;
  api_base_url: string;
  model: string | null;
  configured: boolean;
  key_masked: string | null;
  enabled: boolean;
  is_primary: boolean;
  last_status: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
};

export const aiProvidersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("msk_ai_providers_status" as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AiProviderRow[];
  });

export const aiProviderSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: providerId,
        apiKey: z.string().trim().min(16).max(600).optional(),
        model: z.string().trim().max(120).optional(),
        baseUrl: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("msk_ai_providers_save" as never, {
      p_id: data.id,
      p_api_key: data.apiKey ?? null,
      p_model: data.model ?? null,
      p_base_url: data.baseUrl ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const aiProviderSetPrimary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("msk_ai_providers_set_primary" as never, {
      p_id: data.id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const aiProviderDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("msk_ai_providers_delete" as never, {
      p_id: data.id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Lista os modelos realmente disponíveis na conta do provedor. */
export const aiProviderModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: providerId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("msk_ai_providers_decrypt" as never, {
      p_id: data.id,
    } as never);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | { api_base_url: string; api_key: string | null }
      | undefined;
    if (!row?.api_key) {
      return { ok: false as const, error: "Cadastre a API key deste provedor primeiro." };
    }

    const base = row.api_base_url.replace(/\/+$/, "");
    const isGemini = data.id === "gemini" && !/openai/i.test(base);
    const headers: Record<string, string> = isGemini
      ? {}
      : { Authorization: `Bearer ${row.api_key}` };

    const collected: string[] = [];
    let pageToken: string | null = null;
    let guard = 0;

    do {
      const url = isGemini
        ? `${base}/models?key=${encodeURIComponent(row.api_key)}&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`
        : `${base}/models`;

      let response: Response;
      try {
        response = await fetch(url, { headers });
      } catch {
        return { ok: false as const, error: "Não foi possível falar com o provedor." };
      }
      if (!response.ok) {
        return {
          ok: false as const,
          error:
            response.status === 401 || response.status === 403
              ? "API key recusada pelo provedor."
              : `Provedor respondeu HTTP ${response.status}.`,
        };
      }

      const body = (await response.json()) as any;
      if (isGemini) {
        for (const m of body?.models ?? []) {
          const methods: string[] = m?.supportedGenerationMethods ?? [];
          if (methods.length && !methods.includes("generateContent")) continue;
          collected.push(String(m?.name ?? "").replace(/^models\//, ""));
        }
        pageToken = body?.nextPageToken ?? null;
      } else {
        for (const m of body?.data ?? []) collected.push(String(m?.id ?? ""));
        pageToken = null;
      }
      guard += 1;
    } while (pageToken && guard < 20);

    const list = Array.from(new Set(collected.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
    return { ok: true as const, models: list };
  });

