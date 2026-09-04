import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

export type ExtensionModelRow = {
  id: string;
  providerId: string;
  modelId: string;
  label: string;
  focus: string;
  isFree: boolean;
  visible: boolean;
  note: string | null;
  sortOrder: number;
};

function mapRow(row: Record<string, unknown>): ExtensionModelRow {
  return {
    id: String(row['id']),
    providerId: String(row['provider_id'] ?? ""),
    modelId: String(row['model_id'] ?? ""),
    label: String(row['label'] ?? row['model_id'] ?? ""),
    focus: String(row['focus'] ?? "general"),
    isFree: row['is_free'] === true,
    visible: row['visible'] === true,
    note: row['note'] ? String(row['note']) : null,
    sortOrder: Number(row['sort_order'] ?? 100),
  };
}

/** Catálogo completo (Super Admin): todos os modelos, visíveis ou não. */
export const extensionModelsList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("msk_extension_models")
      .select("id, provider_id, model_id, label, focus, is_free, visible, note, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { models: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
  });

/** Liga/desliga a exibição de um modelo na extensão. */
export const extensionModelToggle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), visible: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("msk_extension_models")
      .update({ visible: data.visible })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Liga/desliga em lote (ex.: todos os gratuitos da Groq). */
export const extensionModelsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ providerId: z.string().trim().min(2).max(40), visible: z.boolean(), onlyFree: z.boolean().optional().default(false) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("msk_extension_models").update({ visible: data.visible }).eq("provider_id", data.providerId);
    if (data.onlyFree) query = query.eq("is_free", true);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cadastra um modelo novo no catálogo da extensão. */
export const extensionModelAdd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      providerId: z.string().trim().min(2).max(40),
      modelId: z.string().trim().min(2).max(180),
      label: z.string().trim().max(120).optional().default(""),
      focus: z.enum(["code", "web", "general"]).optional().default("code"),
      isFree: z.boolean().optional().default(false),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("msk_extension_models").upsert(
      {
        provider_id: data.providerId,
        model_id: data.modelId,
        label: data.label.trim() || data.modelId,
        focus: data.focus,
        is_free: data.isFree,
        visible: true,
      },
      { onConflict: "provider_id,model_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove um modelo do catálogo. */
export const extensionModelDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("msk_extension_models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
