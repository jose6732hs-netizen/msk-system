import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueStandaloneLicense } from "./commerce.server";
import { encryptToken, hashToken } from "./license.server";
import { logAudit } from "./audit.server";

const LIVE_PRODUCT_SLUG = "msk-live";
const LIVE_PLAN_PREFIX = "msk-live";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Loose = Record<string, any>;

function isLivePlanSlug(slug: unknown) {
  const value = String(slug ?? "").trim().toLowerCase();
  return value === LIVE_PLAN_PREFIX || value.startsWith(`${LIVE_PLAN_PREFIX}-`);
}

function makeLiveToken() {
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    let part = "";
    for (let index = 0; index < bytes.length; index += 1) {
      part += TOKEN_ALPHABET[bytes[index]! % TOKEN_ALPHABET.length];
    }
    groups.push(part);
  }
  return `MSKLIVE-${groups.join("-")}`;
}

function effectiveStatus(row: Loose, now: number) {
  const raw = String(row.status ?? "inactive").toLowerCase();
  if (!["revoked", "suspended"].includes(raw) && row.expires_at) {
    const expires = new Date(String(row.expires_at)).getTime();
    if (Number.isFinite(expires) && expires <= now) return "expired";
  }
  return raw;
}

function activityTime(row: Loose, devices: Loose[]) {
  const values = [row.last_validation, ...devices.map((device) => device.last_seen_at)]
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

async function resolveUserByEmail(email?: string | null) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,email,name")
    .ilike("email", normalized)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile) return profile as { id: string; email: string | null; name: string | null };

  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const user = users.find((candidate) => String(candidate.email ?? "").trim().toLowerCase() === normalized);
    if (user) {
      const name =
        (user.user_metadata?.["name"] as string | undefined) ??
        (user.user_metadata?.["full_name"] as string | undefined) ??
        null;
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: user.id, email: user.email ?? normalized, name }, { onConflict: "id" });
      if (upsertError) throw upsertError;
      return { id: user.id, email: user.email ?? normalized, name };
    }
    if (users.length < perPage) break;
  }

  throw new Error("Usuário não encontrado. Cadastre a conta antes de vincular a licença MSK LIVE.");
}

export async function loadLiveAdmin() {
  const [{ data: product, error: productError }, { data: plansData, error: plansError }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,slug,name,description,active,sort_order")
      .eq("slug", LIVE_PRODUCT_SLUG)
      .maybeSingle(),
    supabaseAdmin
      .from("plans")
      .select("id,slug,name,description,price,currency,duration_label,duration_days,duration_value,duration_unit,is_lifetime,max_devices,active,sort_order")
      .like("slug", `${LIVE_PLAN_PREFIX}%`)
      .order("sort_order", { ascending: true }),
  ]);
  if (productError) throw productError;
  if (plansError) throw plansError;

  const plans = (plansData ?? []).filter((plan: Loose) => isLivePlanSlug(plan.slug));
  const planIds = plans.map((plan: Loose) => String(plan.id));
  const planById = new Map(plans.map((plan: Loose) => [String(plan.id), plan]));

  let offers: Loose[] = [];
  if (product?.id) {
    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("id,product_id,plan_id,slug,name,price,currency,active,recurring,periodicity,periodicity_type,sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    offers = (data ?? []) as Loose[];
  }

  let licenseRows: Loose[] = [];
  if (planIds.length) {
    const { data, error } = await supabaseAdmin
      .from("licenses")
      .select("id,user_id,plan_id,product_id,token_preview,status,type,created_at,starts_at,activated_at,expires_at,last_validation,revoked_at,revocation_reason,max_devices,activation_count,metadata")
      .in("plan_id", planIds)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    licenseRows = (data ?? []) as Loose[];
  }

  const userIds = [...new Set(licenseRows.map((row) => row.user_id).filter(Boolean).map(String))];
  const profiles = new Map<string, { email: string; name: string }>();
  if (userIds.length) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,name")
      .in("id", userIds);
    if (error) throw error;
    for (const profile of data ?? []) {
      profiles.set(String(profile.id), {
        email: String(profile.email ?? ""),
        name: String(profile.name ?? ""),
      });
    }
  }

  const licenseIds = licenseRows.map((row) => String(row.id));
  const devicesByLicense = new Map<string, Loose[]>();
  if (licenseIds.length) {
    const { data, error } = await supabaseAdmin
      .from("license_devices")
      .select("id,license_id,device_name,status,first_seen_at,last_seen_at")
      .in("license_id", licenseIds)
      .order("last_seen_at", { ascending: false });
    if (error) throw error;
    for (const device of data ?? []) {
      const key = String(device.license_id);
      const current = devicesByLicense.get(key) ?? [];
      current.push(device as Loose);
      devicesByLicense.set(key, current);
    }
  }

  const now = Date.now();
  const licenses = licenseRows.map((row) => {
    const id = String(row.id);
    const devices = devicesByLicense.get(id) ?? [];
    const activeDevices = devices.filter((device) => String(device.status ?? "active") === "active");
    const lastActivity = activityTime(row, activeDevices);
    const status = effectiveStatus(row, now);
    const online = status === "active" && lastActivity > 0 && now - lastActivity <= ONLINE_WINDOW_MS;
    const profile = row.user_id ? profiles.get(String(row.user_id)) : null;
    const plan = planById.get(String(row.plan_id)) ?? null;
    return {
      id,
      userId: row.user_id ? String(row.user_id) : null,
      email: profile?.email || "Sem usuário vinculado",
      name: profile?.name || "",
      planId: String(row.plan_id),
      planName: String(plan?.name ?? "Plano MSK LIVE"),
      planSlug: String(plan?.slug ?? ""),
      tokenPreview: String(row.token_preview ?? "—"),
      status,
      rawStatus: String(row.status ?? "inactive"),
      type: String(row.type ?? "paid"),
      createdAt: row.created_at ? String(row.created_at) : null,
      activatedAt: row.activated_at ? String(row.activated_at) : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      lastValidation: row.last_validation ? String(row.last_validation) : null,
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      maxDevices: Number(row.max_devices ?? plan?.max_devices ?? 1),
      activationCount: Number(row.activation_count ?? 0),
      online,
      devices: devices.map((device) => ({
        id: String(device.id),
        name: String(device.device_name ?? "Dispositivo"),
        status: String(device.status ?? "active"),
        firstSeenAt: device.first_seen_at ? String(device.first_seen_at) : null,
        lastSeenAt: device.last_seen_at ? String(device.last_seen_at) : null,
      })),
    };
  });

  const onlineLicenses = licenses.filter((license) => license.online);
  const peopleKeys = new Set(onlineLicenses.map((license) => license.userId ? `user:${license.userId}` : `license:${license.id}`));
  const configured = Boolean(product?.id && plans.length >= 3);

  return {
    configured,
    product: product ?? null,
    plans,
    offers,
    licenses,
    stats: {
      totalLicenses: licenses.length,
      activeLicenses: licenses.filter((license) => license.status === "active").length,
      waitingLicenses: licenses.filter((license) => license.status === "inactive").length,
      expiredLicenses: licenses.filter((license) => license.status === "expired").length,
      revokedLicenses: licenses.filter((license) => license.status === "revoked").length,
      onlinePeople: peopleKeys.size,
      onlineDevices: onlineLicenses.reduce(
        (total, license) => total + license.devices.filter((device) => device.status === "active" && device.lastSeenAt && now - new Date(device.lastSeenAt).getTime() <= ONLINE_WINDOW_MS).length,
        0,
      ),
      linkedPeople: new Set(licenses.map((license) => license.userId).filter(Boolean)).size,
    },
  };
}

export async function generateLiveLicense(
  input: { planId: string; email?: string | null; standalone?: boolean; note?: string | null },
  adminId: string,
) {
  const [{ data: product, error: productError }, { data: plan, error: planError }] = await Promise.all([
    supabaseAdmin.from("products").select("id,slug,active").eq("slug", LIVE_PRODUCT_SLUG).maybeSingle(),
    supabaseAdmin
      .from("plans")
      .select("id,slug,name,max_devices,active")
      .eq("id", input.planId)
      .maybeSingle(),
  ]);
  if (productError) throw productError;
  if (planError) throw planError;
  if (!product) throw new Error("MSK LIVE ainda não foi aplicado no banco. Aplique a migração do produto antes de gerar licenças.");
  if (!plan || !isLivePlanSlug(plan.slug)) throw new Error("O plano selecionado não pertence ao MSK LIVE.");

  const profile = input.standalone ? null : await resolveUserByEmail(input.email);
  const issued = await issueStandaloneLicense({
    userId: profile?.id ?? null,
    planId: plan.id,
    type: "manual",
    maxDevices: Number(plan.max_devices ?? 1),
    extraMetadata: {
      generated_by: "admin-live",
      product_slug: LIVE_PRODUCT_SLUG,
      token_namespace: "MSKLIVE",
      note: input.note?.trim() || null,
    },
  });

  const token = makeLiveToken();
  const tokenLast4 = token.slice(-4);
  const { error: updateError } = await supabaseAdmin
    .from("licenses")
    .update({
      product_id: product.id,
      token_hash: await hashToken(token),
      token_encrypted: await encryptToken(token),
      token_last4: tokenLast4,
      token_preview: `MSKLIVE-****-****-****-${tokenLast4}`,
    } as never)
    .eq("id", issued.licenseId);
  if (updateError) throw updateError;

  await logAudit({
    userId: adminId,
    action: "msk_live.license_generated",
    resource: "licenses",
    resourceId: issued.licenseId,
    metadata: {
      product_slug: LIVE_PRODUCT_SLUG,
      plan_id: plan.id,
      plan_slug: plan.slug,
      target: profile?.email ?? "sem-usuario",
      token_namespace: "MSKLIVE",
    },
  });

  return {
    licenseId: issued.licenseId,
    token,
    email: profile?.email ?? null,
    planName: plan.name,
  };
}

export async function runLiveLicenseAction(
  input: { licenseId: string; action: "revoke" | "restore" | "reset_devices" },
  adminId: string,
) {
  const { data: license, error } = await supabaseAdmin
    .from("licenses")
    .select("id,plan_id,status,plans(slug)")
    .eq("id", input.licenseId)
    .maybeSingle();
  if (error) throw error;
  const plan = Array.isArray((license as any)?.plans) ? (license as any)?.plans?.[0] : (license as any)?.plans;
  if (!license || !isLivePlanSlug(plan?.slug)) throw new Error("Esta licença não pertence ao MSK LIVE.");

  if (input.action === "reset_devices") {
    const { error: deviceError } = await supabaseAdmin
      .from("license_devices")
      .update({ status: "removed" })
      .eq("license_id", input.licenseId)
      .eq("status", "active");
    if (deviceError) throw deviceError;
  } else if (input.action === "revoke") {
    const { error: revokeError } = await supabaseAdmin
      .from("licenses")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revocation_reason: "Revogada pelo painel MSK LIVE",
      } as never)
      .eq("id", input.licenseId);
    if (revokeError) throw revokeError;
  } else {
    const { error: restoreError } = await supabaseAdmin
      .from("licenses")
      .update({ status: "inactive", revoked_at: null, revocation_reason: null } as never)
      .eq("id", input.licenseId);
    if (restoreError) throw restoreError;
  }

  await logAudit({
    userId: adminId,
    action: `msk_live.${input.action}`,
    resource: "licenses",
    resourceId: input.licenseId,
    metadata: { product_slug: LIVE_PRODUCT_SLUG },
  });

  return { ok: true };
}
