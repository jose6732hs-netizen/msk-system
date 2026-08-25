import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueStandaloneLicense } from "./commerce.server";
import { logAudit } from "./audit.server";
import { durationArgs, resolvePlanDuration } from "./plan-duration";

export type DurationKind =
  | "trial15"
  | "trial60"
  | "day1"
  | "day7"
  | "day30"
  | "day90"
  | "day365"
  | "lifetime"
  | "custom";

/**
 * Corrige trials antigos criados quando duration_value/duration_unit estavam
 * inconsistentes com o rótulo visível do plano (ex.: "15 minutos" + 30/days).
 * Nunca altera licenças pagas/manuais, revogadas ou suspensas.
 */
async function repairLegacyTrialDurations(plans: Record<string, any>[]) {
  const durations = new Map<string, ReturnType<typeof resolvePlanDuration>>();
  for (const plan of plans) {
    try {
      const resolved = resolvePlanDuration(plan);
      if (!resolved.lifetime && resolved.milliseconds) durations.set(String(plan.id), resolved);
    } catch {
      // Plano inválido continua visível para o admin corrigir manualmente.
    }
  }

  const planIds = [...durations.keys()];
  if (!planIds.length) return;

  const { data: licenses, error } = await supabaseAdmin
    .from("licenses")
    .select("id,plan_id,type,status,created_at,activated_at,expires_at,metadata")
    .in("plan_id", planIds)
    .in("type", ["trial", "test"])
    .not("status", "in", '("revoked","suspended")')
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[licenses] Falha ao reconciliar trials legados:", error.message);
    return;
  }

  const now = Date.now();
  for (const license of licenses ?? []) {
    const resolved = durations.get(String(license.plan_id));
    if (!resolved?.milliseconds) continue;

    const baseIso = license.activated_at ?? license.created_at;
    if (!baseIso) continue;

    const expectedMs = new Date(baseIso).getTime() + resolved.milliseconds;
    const currentMs = license.expires_at ? new Date(license.expires_at).getTime() : 0;
    const mismatch = !currentMs || Math.abs(currentMs - expectedMs) > 30_000;
    const expectedStatus = expectedMs <= now ? "expired" : "active";
    const statusMismatch = license.status !== expectedStatus;

    if (!mismatch && !statusMismatch) continue;

    const metadata = {
      ...((license.metadata ?? {}) as Record<string, any>),
      plan_duration_value_snapshot: resolved.value,
      plan_duration_unit_snapshot: resolved.unit,
      plan_duration_label_snapshot: resolved.label,
      repaired_duration_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("licenses")
      .update({
        expires_at: new Date(expectedMs).toISOString(),
        status: expectedStatus,
        metadata,
      } as never)
      .eq("id", license.id);

    if (updateError) {
      console.error(`[licenses] Falha ao corrigir trial ${license.id}:`, updateError.message);
    }
  }
}

/**
 * Lista todos os usuários que podem receber uma licença manual.
 * Combina profiles + Supabase Auth para não esconder contas criadas via Google/Apple
 * antes de o perfil ter sido totalmente preenchido.
 */
export async function loadTokenUsers() {
  const byId = new Map<string, { id: string; email: string; name: string | null }>();

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,name")
    .order("created_at", { ascending: false });
  if (profileError) throw profileError;

  for (const p of profiles ?? []) {
    const email = String(p.email ?? "").trim().toLowerCase();
    if (email) byId.set(p.id, { id: p.id, email, name: p.name ?? null });
  }

  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];

    for (const u of users) {
      const email = String(u.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const current = byId.get(u.id);
      const metaName =
        (u.user_metadata?.["name"] as string | undefined) ??
        (u.user_metadata?.["full_name"] as string | undefined) ??
        null;
      byId.set(u.id, {
        id: u.id,
        email,
        name: current?.name ?? metaName,
      });
    }

    if (users.length < perPage) break;
  }

  return [...byId.values()].sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
}

/** Gera uma licença manualmente (exclusivo do Super Admin). */
export async function generateManualToken(
  input: {
    email?: string | undefined;
    standalone?: boolean | undefined;
    planId: string;
    // Mantido apenas para compatibilidade com builds antigos do painel.
    // A validade normal é SEMPRE a do plano escolhido.
    duration?: DurationKind | undefined;
    customDays?: number | undefined;
    customMinutes?: number | undefined;
    maxDevices?: number | undefined;
    note?: string | undefined;
  },
  adminId: string,
) {
  const email = (input.email ?? "").trim().toLowerCase();
  const standalone = input.standalone === true;
  let profile: { id: string; email: string | null; name: string | null } | null = null;

  if (!standalone) {
    if (!email) throw new Error("Selecione o e-mail do usuário que receberá a licença.");

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id,email,name")
      .ilike("email", email)
      .maybeSingle();
    profile = data as typeof profile;

    if (!profile) {
      // Conta social pode existir no Auth antes do profile.
      const perPage = 1000;
      let authUser: any = null;
      for (let page = 1; !authUser; page += 1) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const users = list?.users ?? [];
        authUser = users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
        if (users.length < perPage) break;
      }

      if (!authUser) {
        throw new Error("Usuário não encontrado. Escolha um e-mail cadastrado ou marque licença sem usuário.");
      }

      const name =
        (authUser.user_metadata?.["name"] as string | undefined) ??
        (authUser.user_metadata?.["full_name"] as string | undefined) ??
        null;
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: authUser.id, email: authUser.email ?? email, name }, { onConflict: "id" });
      if (upsertError) throw upsertError;
      profile = { id: authUser.id, email: authUser.email ?? email, name };
    }
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .select(
      "id,name,slug,price,is_lifetime,allow_trial,max_devices,duration_label,duration_days,duration_value,duration_unit",
    )
    .eq("id", input.planId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) throw new Error("Plano selecionado não foi encontrado.");

  // Fonte de verdade: o PLANO. O dropdown antigo de validade não pode mais
  // transformar uma diária em 30 dias ou uma mensal em vitalícia.
  const resolved = resolvePlanDuration(plan);
  const duration = durationArgs(resolved);
  const planText = `${plan.name ?? ""} ${plan.slug ?? ""}`.toLowerCase();
  const isTrialPlan =
    plan.allow_trial === true ||
    (Number(plan.price ?? 0) === 0 && /free|gr[aá]tis|teste|trial/.test(planText));

  const result = await issueStandaloneLicense({
    userId: profile?.id ?? null,
    planId: input.planId,
    type: isTrialPlan ? "trial" : "manual",
    ...duration,
    ...(input.maxDevices ? { maxDevices: input.maxDevices } : {}),
  });

  // Grava também o snapshot resolvido, não os campos legados conflitantes.
  const { data: createdLicense } = await supabaseAdmin
    .from("licenses")
    .select("metadata")
    .eq("id", result.licenseId)
    .maybeSingle();
  await supabaseAdmin
    .from("licenses")
    .update({
      metadata: {
        ...((createdLicense?.metadata ?? {}) as Record<string, any>),
        plan_duration_value_snapshot: resolved.value,
        plan_duration_unit_snapshot: resolved.unit,
        plan_duration_label_snapshot: resolved.label,
      },
    } as never)
    .eq("id", result.licenseId);

  await logAudit({
    userId: adminId,
    action: standalone ? "license.standalone_generated" : "license.manual_generated",
    resource: "licenses",
    resourceId: result.licenseId,
    metadata: {
      target: profile?.email ?? "sem-usuario",
      plan_id: plan.id,
      plan_name: plan.name,
      duration_label: resolved.label,
      duration_ms: resolved.milliseconds,
      lifetime: resolved.lifetime,
      note: input.note ?? null,
    },
  });

  return {
    token: result.token,
    licenseId: result.licenseId,
    standalone,
    durationLabel: resolved.label,
    user: { email: profile?.email ?? null, name: profile?.name ?? null },
  };
}

export async function loadTokenPlans() {
  const select =
    "id,name,slug,is_lifetime,allow_trial,max_devices,active,price,currency,duration_label,duration_days,duration_value,duration_unit";

  const { data: activePlans, error: activeError } = await supabaseAdmin
    .from("plans")
    .select(select)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (!activeError && activePlans?.length) {
    await repairLegacyTrialDurations(activePlans as Record<string, any>[]);
    return activePlans;
  }

  const { data: all, error: allError } = await supabaseAdmin
    .from("plans")
    .select(select)
    .order("sort_order", { ascending: true });

  if (allError) {
    console.error("Error loading plans for manual token generation:", allError);
    return [];
  }

  const plans = (all ?? []) as Record<string, any>[];
  await repairLegacyTrialDurations(plans);
  return plans;
}
