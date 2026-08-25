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
const TRIAL_DURATION_MS = TRIAL_MINUTES * 60_000;

type Allowance = {
  id: string;
  plan_id: string | null;
  total: number;
  used: number;
  period_end: string | null;
  source: string;
};

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
  const renewal = rows.map((a) => a.period_end).filter(Boolean).sort()[0] ?? null;
  return { rows, total, used, available: Math.max(0, total - used), renewal };
}

/** Tokens do usuário com todos os campos usados pelo contador da interface. */
export async function loadTenantTokens(userId: string) {
  const fewHoursAgo = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data } = await supabaseAdmin
    .from("licenses")
    .select(
      "id,status,type,token_preview,token_last4,created_at,activated_at,expires_at,last_validation,max_devices,metadata,plans(name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit)",
    )
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${fewHoursAgo}`)
    .order("created_at", { ascending: false })
    .limit(10);

  const list = (data ?? []) as Record<string, any>[];
  if (list.length === 0) return [];

  const ids = list.map((l) => l["id"] as string);
  const { data: devices } = await supabaseAdmin
    .from("license_devices")
    .select("license_id,device_name,status")
    .in("license_id", ids)
    .eq("status", "active");

  const firstDevice = new Map<string, string>();
  const deviceCounts = new Map<string, number>();
  for (const d of devices ?? []) {
    const id = d.license_id as string;
    if (!firstDevice.has(id)) firstDevice.set(id, (d.device_name as string) ?? "Dispositivo");
    deviceCounts.set(id, (deviceCounts.get(id) ?? 0) + 1);
  }

  // Corrige em leitura trials antigos que foram marcados como ativos apenas por
  // terem sido gerados. Sem validação e sem dispositivo não houve uso real.
  for (const license of list) {
    const isTrial = license["type"] === "trial" || license["type"] === "test";
    const hasRealUse = !!license["last_validation"] || (deviceCounts.get(license["id"] as string) ?? 0) > 0;
    if (!isTrial || hasRealUse) continue;

    const metadata = {
      ...((license["metadata"] ?? {}) as Record<string, any>),
      pending_duration_ms: TRIAL_DURATION_MS,
      plan_duration_value_snapshot: TRIAL_MINUTES,
      plan_duration_unit_snapshot: "minutes",
      plan_duration_label_snapshot: "15 minutos",
    };

    if (
      license["status"] !== "inactive" ||
      license["activated_at"] ||
      license["expires_at"] ||
      Number((license["metadata"] as any)?.["pending_duration_ms"] ?? 0) !== TRIAL_DURATION_MS
    ) {
      await supabaseAdmin
        .from("licenses")
        .update({
          status: "inactive",
          activated_at: null,
          expires_at: null,
          last_validation: null,
          metadata,
        } as never)
        .eq("id", license["id"] as string);
    }

    license["status"] = "inactive";
    license["activated_at"] = null;
    license["expires_at"] = null;
    license["last_validation"] = null;
    license["metadata"] = metadata;
  }

  const now = Date.now();
  return list.map((l) => {
    const expired = !!l["expires_at"] && new Date(l["expires_at"]).getTime() <= now;
    const pendingMs = Number((l["metadata"] as any)?.["pending_duration_ms"] ?? 0);
    const awaiting = l["status"] === "inactive" && !l["activated_at"];
    const rawStatus = String(l["status"] ?? "inactive");
    const status =
      rawStatus === "revoked" || rawStatus === "suspended"
        ? rawStatus
        : expired
          ? "expired"
          : awaiting
            ? "pending"
            : rawStatus === "active"
              ? "active"
              : "available";

    const planName = l["plans"]?.name ?? null;
    return {
      id: l["id"],
      preview: l["token_preview"],
      type: l["type"],
      plan: planName,
      plan_name: planName,
      plan_slug: l["plans"]?.slug ?? null,
      status,
      device: firstDevice.get(l["id"]) ?? null,
      created_at: l["created_at"],
      activated_at: l["activated_at"],
      expires_at: l["expires_at"],
      last_validation: l["last_validation"],
      max_devices: l["max_devices"],
      active_devices: deviceCounts.get(l["id"]) ?? 0,
      pending_duration_ms: pendingMs || null,
      is_lifetime: !!l["plans"]?.is_lifetime,
      duration_label: l["plans"]?.duration_label ?? null,
    };
  });
}

export async function generateTenantToken(userId: string) {
  const { rows, available } = await loadAllowances(userId);
  const slot = rows.find((a) => Number(a.used) < Number(a.total));
  if (available <= 0 || !slot) {
    throw new Error("Você não possui saldo de tokens disponível. Garanta seu acesso premium na aba Planos.");
  }

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

  await logAudit({ userId, action: "token.generated", resource: "licenses", resourceId: issued.licenseId });
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

export async function loadTrialStatus(userId: string) {
  const { data } = await supabaseAdmin
    .from("trials")
    .select("id,created_at,started_at,expires_at,status,used,license_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const next = new Date(new Date(data.created_at ?? data.started_at).getTime() + TRIAL_COOLDOWN_HOURS * 3_600_000).toISOString();

  if (data.license_id) {
    const { data: license } = await supabaseAdmin
      .from("licenses")
      .select("id,status,activated_at,expires_at,last_validation,metadata")
      .eq("id", data.license_id)
      .maybeSingle();

    if (license) {
      const { count: deviceCount } = await supabaseAdmin
        .from("license_devices")
        .select("id", { count: "exact", head: true })
        .eq("license_id", license.id)
        .eq("status", "active");
      const hasRealUse = !!license.last_validation || (deviceCount ?? 0) > 0;

      if (!hasRealUse) {
        const metadata = {
          ...((license.metadata ?? {}) as Record<string, any>),
          pending_duration_ms: TRIAL_DURATION_MS,
          plan_duration_value_snapshot: TRIAL_MINUTES,
          plan_duration_unit_snapshot: "minutes",
          plan_duration_label_snapshot: "15 minutos",
        };

        await supabaseAdmin
          .from("licenses")
          .update({
            status: "inactive",
            activated_at: null,
            expires_at: null,
            last_validation: null,
            metadata,
          } as never)
          .eq("id", license.id);
        await supabaseAdmin
          .from("trials")
          .update({ status: "pending", used: false, updated_at: new Date().toISOString() } as never)
          .eq("id", data.id);

        return {
          state: "pending" as const,
          duration_minutes: TRIAL_MINUTES,
          expires_at: null,
          license_id: license.id,
          next_available_at: next,
          server_time: new Date().toISOString(),
        };
      }

      const base = license.activated_at ?? license.last_validation;
      const expectedExpiry = base
        ? new Date(new Date(base).getTime() + TRIAL_DURATION_MS).toISOString()
        : license.expires_at;
      const expiryMs = expectedExpiry ? new Date(expectedExpiry).getTime() : 0;
      const running = license.status === "active" && expiryMs > Date.now();

      if (expectedExpiry && license.expires_at !== expectedExpiry) {
        await supabaseAdmin
          .from("licenses")
          .update({ expires_at: expectedExpiry, status: running ? "active" : "expired" } as never)
          .eq("id", license.id);
      }

      await supabaseAdmin
        .from("trials")
        .update({
          status: running ? "running" : "expired",
          used: true,
          ...(expectedExpiry ? { expires_at: expectedExpiry } : {}),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.id);

      return {
        state: running ? ("running" as const) : ("used" as const),
        duration_minutes: TRIAL_MINUTES,
        expires_at: running ? expectedExpiry : expectedExpiry,
        license_id: running ? license.id : null,
        next_available_at: next,
        server_time: new Date().toISOString(),
      };
    }
  }

  return {
    state: "used" as const,
    duration_minutes: TRIAL_MINUTES,
    expires_at: data.expires_at,
    license_id: null,
    next_available_at: next,
    server_time: new Date().toISOString(),
  };
}

export async function startTrial(input: {
  userId: string;
  ip?: string | null;
  installationId?: string | null;
}) {
  const hashes = await identityHashes(input.userId, input.ip, input.installationId);
  const since = new Date(Date.now() - TRIAL_COOLDOWN_HOURS * 3_600_000).toISOString();

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
      throw new Error("Você já gerou uma licença gratuita nas últimas 24 horas. Tente novamente amanhã.");
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

  const issued = await issueStandaloneLicense({
    userId: input.userId,
    planId,
    type: "trial",
    durationMinutes: TRIAL_MINUTES,
    maxDevices: 1,
  });

  // A emissão não inicia o teste. A duração fica guardada no metadata e será
  // convertida em expires_at somente quando /activate ou /validate receber o
  // primeiro uso real da extensão.
  const { data: createdLicense, error: createdError } = await supabaseAdmin
    .from("licenses")
    .select("metadata")
    .eq("id", issued.licenseId)
    .maybeSingle();
  if (createdError) throw createdError;

  const { error: pendingError } = await supabaseAdmin
    .from("licenses")
    .update({
      status: "inactive",
      activated_at: null,
      expires_at: null,
      last_validation: null,
      metadata: {
        ...((createdLicense?.metadata ?? {}) as Record<string, any>),
        pending_duration_ms: TRIAL_DURATION_MS,
        plan_duration_value_snapshot: TRIAL_MINUTES,
        plan_duration_unit_snapshot: "minutes",
        plan_duration_label_snapshot: "15 minutos",
      },
    } as never)
    .eq("id", issued.licenseId);
  if (pendingError) throw pendingError;

  // A coluna trials.expires_at é legada e não aceita NULL. Guardamos um valor
  // técnico, mas status=pending faz com que ele nunca seja usado como contador.
  const placeholderExpiry = new Date(Date.now() + TRIAL_DURATION_MS).toISOString();
  const { error: trialError } = await supabaseAdmin.from("trials").insert({
    user_id: input.userId,
    license_id: issued.licenseId,
    expires_at: placeholderExpiry,
    status: "pending",
    used: false,
    installation_id: hashes.installation_id,
    email_hash: hashes.email_hash,
    phone_hash: hashes.phone_hash,
    document_hash: hashes.document_hash,
    ip_hash: hashes.ip_hash,
  } as never);
  if (trialError) throw trialError;

  await logAudit({
    userId: input.userId,
    action: "trial.generated_pending_activation",
    resource: "licenses",
    resourceId: issued.licenseId,
  });

  return { token: issued.token, licenseId: issued.licenseId, expires_at: null };
}
