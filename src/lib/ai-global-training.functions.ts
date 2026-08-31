import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "./admin-guard";

const trainingId = z.string().uuid();
const trainingDraft = z.object({
  id: trainingId.optional().nullable(),
  title: z.string().trim().min(1).max(160),
  instruction: z.string().trim().min(1).max(20000),
  category: z.enum(["general", "coding", "security", "behavior", "quality", "support", "business"]).default("general"),
  priority: z.number().int().min(1).max(1000).default(100),
});

async function audit(db: any, row: any, action: "created" | "updated" | "previewed" | "published" | "disabled" | "archived", actorId: string) {
  await db.from("msk_ai_global_training_audit").insert({
    training_id: row?.id ?? null,
    version: row?.version ?? null,
    action,
    actor_id: actorId,
    snapshot: {
      title: row?.title ?? null,
      category: row?.category ?? null,
      priority: row?.priority ?? null,
      status: row?.status ?? null,
      instruction: row?.instruction ?? null,
      ai_acknowledgement: row?.ai_acknowledgement ?? null,
      published_at: row?.published_at ?? null,
      disabled_at: row?.disabled_at ?? null,
    },
  });
}

export const aiGlobalTrainingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const [trainings, auditRows] = await Promise.all([
      db.from("msk_ai_global_training").select("*").order("version", { ascending: false }).limit(200),
      db.from("msk_ai_global_training_audit").select("id,training_id,version,action,actor_id,created_at").order("created_at", { ascending: false }).limit(120),
    ]);
    if (trainings.error) throw trainings.error;
    if (auditRows.error) throw auditRows.error;
    const rows = trainings.data ?? [];
    return {
      trainings: rows,
      audit: auditRows.data ?? [],
      metrics: {
        active: rows.filter((row: any) => row.status === "active").length,
        drafts: rows.filter((row: any) => row.status === "draft").length,
        disabled: rows.filter((row: any) => row.status === "disabled").length,
        latestVersion: rows.reduce((max: number, row: any) => Math.max(max, Number(row.version || 0)), 0),
      },
    };
  });

export const aiGlobalTrainingSaveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trainingDraft.parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const payload = {
      title: data.title,
      instruction: data.instruction,
      category: data.category,
      priority: data.priority,
      scope: "all_users",
    };

    if (data.id) {
      const current = await db.from("msk_ai_global_training").select("id,status").eq("id", data.id).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) throw new Error("Treinamento não encontrado.");
      if (current.data.status !== "draft") throw new Error("Treinamentos publicados são imutáveis. Crie uma nova versão para corrigir a regra.");
      const updated = await db
        .from("msk_ai_global_training")
        .update({ ...payload, ai_acknowledgement: null })
        .eq("id", data.id)
        .eq("status", "draft")
        .select("*")
        .single();
      if (updated.error) throw updated.error;
      await audit(db, updated.data, "updated", context.userId);
      return updated.data;
    }

    const created = await db
      .from("msk_ai_global_training")
      .insert({ ...payload, status: "draft", created_by: context.userId })
      .select("*")
      .single();
    if (created.error) throw created.error;
    await audit(db, created.data, "created", context.userId);
    return created.data;
  });

export const aiGlobalTrainingPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: trainingId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const current = await db.from("msk_ai_global_training").select("*").eq("id", data.id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new Error("Treinamento não encontrado.");
    if (current.data.status !== "draft") throw new Error("Teste de entendimento é feito antes da publicação.");

    const { previewGlobalTrainingUnderstanding } = await import("./ai-global-training.server");
    const acknowledgement = await previewGlobalTrainingUnderstanding({
      title: String(current.data.title),
      instruction: String(current.data.instruction),
      category: String(current.data.category),
      priority: Number(current.data.priority),
    });

    const updated = await db
      .from("msk_ai_global_training")
      .update({ ai_acknowledgement: acknowledgement })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    await audit(db, updated.data, "previewed", context.userId);
    return { ok: true, acknowledgement, training: updated.data };
  });

export const aiGlobalTrainingPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: trainingId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const current = await db.from("msk_ai_global_training").select("*").eq("id", data.id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new Error("Treinamento não encontrado.");
    if (current.data.status !== "draft") throw new Error("Somente rascunhos podem ser publicados.");
    if (!String(current.data.ai_acknowledgement ?? "").trim()) throw new Error("Teste o entendimento da IA antes de publicar para todos.");

    const now = new Date().toISOString();
    const published = await db
      .from("msk_ai_global_training")
      .update({ status: "active", published_at: now, published_by: context.userId, disabled_at: null })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("*")
      .single();
    if (published.error) throw published.error;
    await audit(db, published.data, "published", context.userId);
    return { ok: true, training: published.data, appliesTo: "all_users" };
  });

export const aiGlobalTrainingDisable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: trainingId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const now = new Date().toISOString();
    const updated = await db
      .from("msk_ai_global_training")
      .update({ status: "disabled", disabled_at: now })
      .eq("id", data.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) throw new Error("Este treinamento não está ativo.");
    await audit(db, updated.data, "disabled", context.userId);
    return { ok: true, training: updated.data };
  });

export const aiGlobalTrainingArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: trainingId }).parse(input))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const current = await db.from("msk_ai_global_training").select("*").eq("id", data.id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw new Error("Treinamento não encontrado.");
    if (current.data.status === "active") throw new Error("Desative o treinamento antes de arquivar.");
    const updated = await db.from("msk_ai_global_training").update({ status: "archived" }).eq("id", data.id).select("*").single();
    if (updated.error) throw updated.error;
    await audit(db, updated.data, "archived", context.userId);
    return { ok: true, training: updated.data };
  });
