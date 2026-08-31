import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent } from "./license.server";

const PAGE = 1000;
const MAX_ROWS = 10000;

async function fetchAll<T>(build: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function loadAdminOverview(search: string, userSearch: string = "") {
  const term = search.trim();
  const uTerm = userSearch.trim();

  const licensesRaw = await fetchAll<any>(() => {
    let q = supabaseAdmin
      .from("licenses")
      .select(
        "id,user_id,status,type,expires_at,activated_at,created_at,transaction_id,max_devices,token_preview,token_last4,last_validation,metadata,plans(name,slug,is_lifetime,duration_label,duration_days,duration_value,duration_unit)",
      )
      .order("created_at", { ascending: false });
    if (term) q = q.ilike("token_last4", `%${term.slice(-4)}%`);
    return q;
  });

  const users = await fetchAll<any>(() => {
    let q = supabaseAdmin
      .from("profiles")
      .select("id,name,email,created_at,phone")
      .order("created_at", { ascending: false });
    if (uTerm) q = q.or(`email.ilike.%${uTerm}%,name.ilike.%${uTerm}%`);
    return q;
  });


  const ownerIds = [...new Set((licensesRaw ?? []).map((l: any) => l.user_id).filter(Boolean))];
  const owners: any[] = [];
  for (let i = 0; i < ownerIds.length; i += 200) {
    const chunk = ownerIds.slice(i, i + 200);
    const { data } = await supabaseAdmin.from("profiles").select("id,name,email").in("id", chunk);
    owners.push(...(data ?? []));
  }
  const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o]));


  const { licensePurpose, licenseRoleFromSlug } = await import("./license-purpose");

  const now = Date.now();
  const licenses = (licensesRaw ?? []).map((l: any) => {
    const purpose = licensePurpose({
      slug: l.plans?.slug ?? null,
      role: l.metadata?.license_role ?? licenseRoleFromSlug(l.plans?.slug),
    });
    const expired = !!l.expires_at && new Date(l.expires_at).getTime() <= now;
    const pendingMs = Number(l.metadata?.pending_duration_ms ?? 0);
    const effectiveStatus =
      ["revoked", "suspended"].includes(String(l.status))
        ? l.status
        : expired
          ? "expired"
          : l.status === "inactive" && !l.activated_at
            ? "pending"
            : l.status;
    return {
      ...l,
      status: effectiveStatus,
      pending_duration_ms: pendingMs || null,
      purpose_role: purpose.role,
      purpose_label: purpose.label,
      purpose_where: purpose.where,
      purpose_accent: purpose.accent,
      item_label: l.metadata?.item_label ?? l.plans?.name ?? purpose.label,
      item_origin: l.metadata?.item_origin ?? null,
      profiles: l.user_id ? ownerMap.get(l.user_id) ?? null : null,
    };
  });

  const [
    { data: plans },
    { data: subs },
    { data: payments },
    { data: webhooks },
    { data: events },
    { data: devices },
    { data: affiliates },
  ] = await Promise.all([
    supabaseAdmin.from("plans").select("*").order("sort_order"),
    supabaseAdmin
      .from("subscriptions")
      .select("id,user_id,status,current_period_end,cancel_at_period_end,plans(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("transactions")
      .select("id,user_id,identifier,amount,currency,status,provider,method,purpose,created_at,paid_at")
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("webhook_events")
      .select("id,provider,event_type,event_id,processed,created_at,error")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("license_events")
      .select("id,event_type,created_at,license_id,metadata")
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("license_devices")
      .select("id,license_id,device_name,browser,os,last_seen,status")
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(60),
    supabaseAdmin
      .from("affiliates")
      .select("id,verification_status")
      .eq("verification_status", "PENDING")
      .limit(50),
  ]);

  const relatedIds = [
    ...new Set([...(subs ?? []), ...(payments ?? [])].map((r: any) => r.user_id).filter(Boolean)),
  ];
  const { data: relatedProfiles } = relatedIds.length
    ? await supabaseAdmin.from("profiles").select("id,name,email").in("id", relatedIds)
    : { data: [] as any[] };
  const emailMap = new Map((relatedProfiles ?? []).map((p: any) => [p.id, p]));
  const withProfile = (rows: any[] | null) =>
    (rows ?? []).map((r: any) => ({ ...r, profiles: r.user_id ? emailMap.get(r.user_id) ?? null : null }));
  const subsFull = withProfile(subs as any[]);
  const paymentsFull = withProfile(payments as any[]);

  const { data: commissions } = await supabaseAdmin
    .from("affiliate_commissions")
    .select("id,amount,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const isPaid = (t: any) =>
    ["PAID", "APPROVED", "COMPLETED"].includes(String(t.status ?? "").toUpperCase()) || !!t.paid_at;
  const paidTx = (payments ?? []).filter(isPaid);
  const revenue = paidTx.reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCommissions = (commissions ?? [])
    .filter((c: any) => new Date(c.created_at) >= monthStart)
    .reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);

  const { data: appSettings } = await (supabaseAdmin as any).from("app_settings").select("*");
  const cms = (appSettings || []).reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  return {
    cms_settings: cms,
    licenses: licenses as Record<string, any>[],
    users: (users ?? []) as Record<string, any>[],
    plans: (plans ?? []) as Record<string, any>[],
    subscriptions: subsFull as Record<string, any>[],
    payments: paymentsFull as Record<string, any>[],
    webhooks: (webhooks ?? []) as Record<string, any>[],
    events: (events ?? []) as Record<string, any>[],
    devices: (devices ?? []) as Record<string, any>[],
    affiliates: (affiliates ?? []) as Record<string, any>[],
    commissions: (commissions ?? []) as Record<string, any>[],
    server_time: new Date().toISOString(),
    stats: {
      users: users?.length ?? 0,
      licenses: licenses.length,
      activeLicenses: licenses.filter((l: any) => l.status === "active").length,
      devices: devices?.length ?? 0,
      revenue,
      monthCommissions,
      conversions: paidTx.length,
      transactions: (payments ?? []).length,
    },
  };
}

export async function runLicenseAction(
  input: { licenseId: string; action: string; reason?: string | undefined; days?: number | undefined },
  adminId: string,
) {
  const { data: license } = await supabaseAdmin
    .from("licenses")
    .select("id,user_id,expires_at")
    .eq("id", input.licenseId)
    .single();
  if (!license) throw new Error("Licença não encontrada");

  const patch: Record<string, unknown> = {};
  switch (input.action) {
    case "revoke":
      patch["status"] = "revoked";
      patch["revoked_at"] = new Date().toISOString();
      patch["revocation_reason"] = input.reason ?? "Desligado pelo administrador";
      await supabaseAdmin
        .from("license_devices")
        .update({ status: "removed" } as never)
        .eq("license_id", license.id);
      break;
    case "suspend":
      patch["status"] = "suspended";
      break;
    case "reactivate":
      patch["status"] = "active";
      patch["revoked_at"] = null;
      patch["revocation_reason"] = null;
      break;
    case "extend": {
      const base =
        license.expires_at && new Date(license.expires_at) > new Date()
          ? new Date(license.expires_at)
          : new Date();
      patch["expires_at"] = new Date(base.getTime() + (input.days ?? 30) * 86_400_000).toISOString();
      patch["status"] = "active";
      break;
    }
  }

  const { error } = await supabaseAdmin.from("licenses").update(patch as never).eq("id", license.id);
  if (error) throw error;
  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: `admin_${input.action}`,
    metadata: { admin_id: adminId, reason: input.reason ?? null, days: input.days ?? null },
  });
  return { ok: true };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Salva plano sem converter minutos/horas em dias por engano. */
export async function savePlan(plan: Record<string, any>) {
  const payload = { ...plan };

  const deliveryMethod = ["panel", "email", "panel_email", "email_link"].includes(
    String(payload["delivery_method"]),
  )
    ? String(payload["delivery_method"])
    : "panel_email";
  const deliveryLink = String(payload["delivery_link"] ?? "").trim();
  const deliveryInstructions = String(payload["delivery_instructions"] ?? "").trim();
  delete payload["delivery_method"];
  delete payload["delivery_link"];
  delete payload["delivery_instructions"];

  if (deliveryMethod === "email_link" && !/^https?:\/\//i.test(deliveryLink)) {
    throw new Error("Informe um link válido para a entrega por e-mail.");
  }

  let existingFeatures: Record<string, unknown> = {};
  if (payload["id"]) {
    const { data: current, error } = await supabaseAdmin
      .from("plans")
      .select("features")
      .eq("id", payload["id"])
      .maybeSingle();
    if (error) throw error;
    existingFeatures = objectValue(current?.features);
  }
  payload["features"] = {
    ...existingFeatures,
    delivery: {
      method: deliveryMethod,
      link: deliveryLink,
      instructions: deliveryInstructions,
    },
  };

  if (payload["is_lifetime"]) {
    payload["duration_days"] = null;
    payload["duration_unit"] = "lifetime";
    payload["duration_value"] = 1;
    payload["duration_label"] = payload["duration_label"] || "Vitalício";
  } else {
    const unit = String(payload["duration_unit"] ?? "days").toLowerCase();
    const validUnit = ["minutes", "hours", "days", "weeks", "months"].includes(unit) ? unit : "days";
    const value = Number(payload["duration_value"] ?? payload["duration_days"] ?? 1);
    if (!Number.isFinite(value) || value <= 0) throw new Error("A validade do plano deve ser maior que zero.");
    payload["duration_unit"] = validUnit;
    payload["duration_value"] = Math.round(value);
    payload["duration_days"] = validUnit === "days" ? Math.round(value) : null;
  }

  let planId: string;
  if (payload["id"]) {
    const { id, ...rest } = payload;
    const { error } = await supabaseAdmin.from("plans").update(rest as never).eq("id", id);
    if (error) throw error;
    planId = String(id);
  } else {
    const { data, error } = await supabaseAdmin.from("plans").insert(payload as never).select("id").single();
    if (error) throw error;
    planId = String(data.id);
  }

  const { syncPrimaryPlanOffer } = await import("./plan-offer-sync.server");
  await syncPrimaryPlanOffer(planId, payload);

  return { ok: true, id: planId };
}
