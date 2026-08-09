/**
 * Saldo de tokens do tenant, geração de tokens pagos e teste gratuito.
 * Somente servidor — o backend é a fonte de verdade.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, hashValue, logEvent } from "./license.server";
import { issueStandaloneLicense } from "./commerce.server";
import { logAudit } from "./audit.server";

export const TRIAL_MINUTES = 15;
export const TRIAL_COOLDOWN_HOURS = 24;

type Allowance = {
  id: string;
  plan_id: string | null;
  total: number;
  used: number;
  period_end: string | null;
  source: string;
};

/** Saldo agregado do tenant (isolado por user_id). */
export async function loadAllowances(userId: string) {
  const { data } = await supabaseAdmin
    .from("token_allowances")
    .select("id,plan_id,total,used,period_end,source")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const rows = ((data ?? []) as Allowance[]).filter(
    (a) => !a.period_end || new Date(a.period_end).getTime() > Date.now(),
  );
  const total = rows.reduce((s, a) => s + Number(a.total), 0);
  const used = rows.reduce((s, a) => s + Number(a.used), 0);
  const renewal =
    rows
      .map((a) => a.period_end)
      .filter(Boolean)
      .sort()[0] ?? null;
  return { rows, total, used, available: Math.max(0, total - used), renewal };
}

/** Tokens (licenças) do tenant, sem expor o token em claro. Mantém histórico limpo. */
export async function loadTenantTokens(userId: string) {
  const nowIso = new Date().toISOString();
  const fewHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();

  const { data } = await supabaseAdmin
    .from("licenses")
    .select(
      "id,status,type,token_preview,token_last4,created_at,activated_at,expires_at,max_devices,plans(name,slug)",
    )
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${fewHoursAgo}`)
    .order("created_at", { ascending: false })
    .limit(3);

  const list = (data ?? []) as Record<string, any>[];
  if (list.length === 0) return [];

  const { data: devices } = await supabaseAdmin
    .from("license_devices")
    .select("license_id,installation_id,device_name,status")
    .in(
      "license_id",
      list.map((l) => l["id"] as string),
    )
    .eq("status", "active");

  const bound = new Map<string, string>();
  for (const d of devices ?? [])
    bound.set(d.license_id as string, (d.device_name as string) ?? "Dispositivo");

  const now = Date.now();
  return list.map((l) => {
    const expired = l["expires_at"] && new Date(l["expires_at"]).getTime() <= now;
    const device = bound.get(l["id"]);
    const status =
      l["status"] === "revoked" || l["status"] === "suspended"
        ? l["status"]
        : expired
          ? "expired"
          : device
            ? "active"
            : "available";
    return {
      id: l["id"],
      preview: l["token_preview"],
      type: l["type"],
      plan: l["plans"]?.name ?? null,
      status,
      device: device ?? null,
      created_at: l["created_at"],
      activated_at: l["activated_at"],
      expires_at: l["expires_at"],
      max_devices: l["max_devices"],
    };
  });
}

/** Gera um token pago consumindo 1 unidade do saldo contratado. */
export async function generateTenantToken(userId: string) {
  const { rows, available } = await loadAllowances(userId);
  if (available <= 0 || !slot) throw new Error("Nenhum token ativo ainda. Navegue pelo site e garanta a sua licença!");

  let planId = slot.plan_id;
  if (!planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    planId = plan?.id ?? null;
  }
  if (!planId) throw new Error("Nenhum plano disponível para gerar token.");

  const issued = await issueStandaloneLicense({
    userId,
    planId,
    type: "paid",
    ...(slot.period_end ? { expiresAtOverride: slot.period_end } : {}),
  });

  const { error } = await supabaseAdmin
    .from("token_allowances")
    .update({ used: Number(slot.used) + 1, updated_at: new Date().toISOString() })
    .eq("id", slot.id)
    .eq("used", slot.used);
  if (error) throw new Error("Não foi possível reservar o token. Tente novamente.");

  await logAudit({
    userId,
    action: "token.generated",
    resource: "licenses",
    resourceId: issued.licenseId,
  });
  return issued;
}

export async function revealTenantToken(userId: string, licenseId: string) {
  const { data } = await supabaseAdmin
    .from("licenses")
    .select("token_encrypted,user_id")
    .eq("id", licenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.token_encrypted) throw new Error("Token não encontrado.");
  await logEvent({ license_id: licenseId, user_id: userId, event_type: "token_revealed" });
  return decryptToken(data.token_encrypted);
}

/* --------------------------------- TESTE --------------------------------- */

async function identityHashes(userId: string, ip?: string | null, installationId?: string | null) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email,phone,document")
    .eq("id", userId)
    .maybeSingle();

  const digits = (v?: string | null) => (v ?? "").replace(/\D+/g, "");
  return {
    email_hash: profile?.email ? await hashValue(profile.email.trim().toLowerCase()) : null,
    phone_hash: digits(profile?.phone) ? await hashValue(digits(profile?.phone)) : null,
    document_hash: digits(profile?.document) ? await hashValue(digits(profile?.document)) : null,
    ip_hash: ip ? await hashValue(ip) : null,
    installation_id: installationId ?? null,
  };
}

/** Estado do teste gratuito do tenant (fonte de verdade: banco). */
export async function loadTrialStatus(userId: string) {
  const { data } = await supabaseAdmin
    .from("trials")
    .select("id,started_at,expires_at,status,used,license_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  if (!data) {
    return {
      state: "available" as const,
      duration_minutes: TRIAL_MINUTES,
      expires_at: null,
      license_id: null,
      next_available_at: null,
      server_time: new Date().toISOString(),
    };
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const running = expiresAt > now;
  const next = new Date(
    new Date(data.started_at).getTime() + TRIAL_COOLDOWN_HOURS * 3600000,
  ).toISOString();

  if (!running && data.status !== "expired") {
    await supabaseAdmin
      .from("trials")
      .update({ status: "expired", used: true, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (data.license_id) {
      await supabaseAdmin.from("licenses").update({ status: "expired" }).eq("id", data.license_id);
    }
  }

  return {
    state: running ? ("running" as const) : ("used" as const),
    duration_minutes: TRIAL_MINUTES,
    expires_at: data.expires_at,
    license_id: running ? data.license_id : null,
    next_available_at: next,
    server_time: new Date().toISOString(),
  };
}

/** Elegibilidade + criação do teste de 15 minutos. */
export async function startTrial(input: {
  userId: string;
  ip?: string | null;
  installationId?: string | null;
}) {
  const hashes = await identityHashes(input.userId, input.ip, input.installationId);
  const since = new Date(Date.now() - TRIAL_COOLDOWN_HOURS * 3600000).toISOString();

  const checks: [string, string | null][] = [
    ["user_id", input.userId],
    ["email_hash", hashes.email_hash],
    ["phone_hash", hashes.phone_hash],
    ["document_hash", hashes.document_hash],
    ["installation_id", hashes.installation_id],
    ["ip_hash", hashes.ip_hash],
  ];

  for (const [column, value] of checks) {
    if (!value) continue;
    const { count } = await supabaseAdmin
      .from("trials")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", since);
    if ((count ?? 0) > 0) {
      throw new Error(
        "Você já utilizou o teste gratuito nas últimas 24 horas. Tente novamente amanhã.",
      );
    }
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id")
    .eq("allow_trial", true)
    .eq("active", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  const planId =
    plan?.id ??
    (
      await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle()
    ).data?.id;
  if (!planId) throw new Error("Nenhum plano disponível para o teste.");

  const expiresAt = new Date(Date.now() + TRIAL_MINUTES * 60000).toISOString();
  const issued = await issueStandaloneLicense({
    userId: input.userId,
    planId,
    type: "trial",
    durationMinutes: TRIAL_MINUTES,
    maxDevices: 1,
  });

  await supabaseAdmin.from("trials").insert({
    user_id: input.userId,
    license_id: issued.licenseId,
    expires_at: expiresAt,
    status: "running",
    used: true,
    installation_id: hashes.installation_id,
    email_hash: hashes.email_hash,
    phone_hash: hashes.phone_hash,
    document_hash: hashes.document_hash,
    ip_hash: hashes.ip_hash,
  } as never);

  await logAudit({
    userId: input.userId,
    action: "trial.granted",
    resource: "licenses",
    resourceId: issued.licenseId,
  });

  return { token: issued.token, licenseId: issued.licenseId, expires_at: expiresAt };
}
