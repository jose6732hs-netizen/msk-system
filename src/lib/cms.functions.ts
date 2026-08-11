import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { uploadPublicFile } from "./storage.server";

export const getCmsContent = createServerFn({ method: "GET" })
  .handler(async () => {
    // We use a dynamic table name to bypass static type checking for a table that might not be in the types yet
    const { data, error } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("*");
    
    if (error) throw new Error(error.message);
    
    const settings: Record<string, any> = {};
    data?.forEach((item: any) => {
      settings[item.key] = item.value;
    });
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
    
    const { data: existing } = await (supabaseAdmin as any)
      .from("cms_drafts")
      .select("id")
      .eq("key", data.key)
      .eq("status", "draft")
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
    // In TanStack Start v1, server functions get the request from the global context or arguments
    // When using middleware, the second argument might contain the request if injected.
    // However, the standard way in .handler() for a multipart form is often accessed via context if properly typed,
    // or we can use the web-standard way if the framework provides it.
    const request = (context as any).request;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const key = formData.get("key") as string;
    
    if (!file) throw new Error("No file uploaded");

    const extension = file.name.split('.').pop();
    const fileName = `cms/${key}-${Date.now()}.${extension}`;
    
    const url = await uploadPublicFile(file, fileName, "extension-builds");
    
    return { url };
  });
