import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueStandaloneLicense } from "./commerce.server";
import { encryptToken, hashToken } from "./license.server";
import { logAudit } from "./audit.server";
import { savePlan } from "./admin.server";

export const LIVE_PRODUCT_SLUG = "msk-live";
export const LIVE_CHANNEL = "msk-live";
const LIVE_PLAN_PREFIX = "msk-live";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function isLivePlanSlug(slug: unknown) {
  const value = String(slug ?? "").trim().toLowerCase();
  return value === LIVE_PLAN_PREFIX || value.startsWith(`${LIVE_PLAN_PREFIX}-`);
}

function deliveryOf(features: unknown) {
  const root = features && typeof features === "object" && !Array.isArray(features)
    ? (features as Record<string, any>)
    : {};
  const delivery = root["delivery"] && typeof root["delivery"] === "object"
    ? root["delivery"] as Record<string, any>
    : {};
  return {
    method: String(delivery["method"] ?? "panel_email"),
    link: String(delivery["link"] ?? ""),
    instructions: String(delivery["instructions"] ?? ""),
  };
}

function makeLiveToken() {
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    let part = "";
    for (const byte of bytes) part += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
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
  const values = [
    row.last_validation,
    ...devices.map((device) => device.last_validation ?? device.last_seen),
  ]
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
      .select("id,slug,name,description,price,currency,duration_label,duration_days,duration_value,duration_unit,is_lifetime,auto_renew,max_devices,active,sort_order,image_url,affiliate_commission_rate,features")
      .like("slug", `${LIVE_PLAN_PREFIX}%`)
      .order("sort_order", { ascending: true }),
  ]);
  if (productError) throw productError;
  if (plansError) throw plansError;

  const plans = (plansData ?? [])
    .filter((plan: Loose) => isLivePlanSlug(plan.slug))
    .map((plan: Loose) => ({ ...plan, delivery: deliveryOf(plan.features) }));
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
  let txRows: Loose[] = [];
  if (planIds.length) {
    const [licenseRes, txRes] = await Promise.all([
      supabaseAdmin
        .from("licenses")
        .select("id,user_id,plan_id,product_id,token_preview,status,type,created_at,starts_at,activated_at,expires_at,last_validation,revoked_at,revocation_reason,max_devices,activation_count,metadata")
        .in("plan_id", planIds)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("transactions")
        .select("id,user_id,identifier,amount,currency,status,provider,method,plan_id,created_at,paid_at")
        .in("plan_id", planIds)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (licenseRes.error) throw licenseRes.error;
    if (txRes.error) throw txRes.error;
    licenseRows = (licenseRes.data ?? []) as Loose[];
    txRows = (txRes.data ?? []) as Loose[];
  }

  const userIds = [
    ...new Set(
      [...licenseRows, ...txRows]
        .map((row) => row.user_id)
        .filter(Boolean)
        .map(String),
    ),
  ];
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
      .select("id,license_id,device_name,browser,os,extension_version,installation_id,status,first_seen,last_seen,last_validation,activation_count")
      .in("license_id", licenseIds)
      .order("last_seen", { ascending: false });
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
      devices: devices.map((device) => {
        const deviceTime = activityTime({}, [device]);
        return {
          id: String(device.id),
          name: String(device.device_name ?? "Dispositivo"),
          browser: String(device.browser ?? "—"),
          os: String(device.os ?? "—"),
          extensionVersion: String(device.extension_version ?? "—"),
          installationId: String(device.installation_id ?? "—"),
          status: String(device.status ?? "active"),
          firstSeen: device.first_seen ? String(device.first_seen) : null,
          lastSeen: device.last_seen ? String(device.last_seen) : null,
          lastValidation: device.last_validation ? String(device.last_validation) : null,
          activationCount: Number(device.activation_count ?? 0),
          online: String(device.status ?? "active") === "active" && deviceTime > 0 && now - deviceTime <= ONLINE_WINDOW_MS,
        };
      }),
    };
  });

  const sales = txRows.map((row) => {
    const profile = row.user_id ? profiles.get(String(row.user_id)) : null;
    const plan = planById.get(String(row.plan_id)) ?? null;
    return {
      id: String(row.id),
      identifier: String(row.identifier ?? "—"),
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? "BRL"),
      status: String(row.status ?? ""),
      provider: row.provider ? String(row.provider) : null,
      method: row.method ? String(row.method) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      paidAt: row.paid_at ? String(row.paid_at) : null,
      planId: String(row.plan_id ?? ""),
      planName: String(plan?.name ?? "MSK LIVE"),
      email: profile?.email || "—",
      name: profile?.name || "",
    };
  });

  const { data: buildRows, error: buildError } = await supabaseAdmin
    .from("extension_builds")
    .select("id,version,file_name,size_bytes,is_published,release_notes,created_at,updated_at,channel_slug")
    .eq("channel_slug", LIVE_CHANNEL)
    .order("created_at", { ascending: false })
    .limit(50);
  if (buildError) throw buildError;
  const buildIds = (buildRows ?? []).map((row: any) => String(row.id));
  const downloadCounts = new Map<string, number>();
  if (buildIds.length) {
    const { data: downloadRows } = await supabaseAdmin
      .from("downloads")
      .select("id,build_id")
      .in("build_id", buildIds)
      .limit(5000);
    for (const row of downloadRows ?? []) {
      const key = String((row as any).build_id ?? "");
      if (key) downloadCounts.set(key, (downloadCounts.get(key) ?? 0) + 1);
    }
  }
  const builds = (buildRows ?? []).map((row: any) => ({
    ...row,
    downloads: downloadCounts.get(String(row.id)) ?? 0,
  }));

  const { data: channel, error: channelError } = await supabaseAdmin
    .from("extension_channels")
    .select("id,slug,display_name,channel_type,active,enabled,version,message,api_base_url,chrome_extension_id,updated_at")
    .eq("slug", LIVE_CHANNEL)
    .maybeSingle();
  if (channelError) throw channelError;

  const paidStatuses = new Set(["paid", "approved", "completed"]);
  const pendingStatuses = new Set(["pending", "waiting_payment", "processing"]);
  const paidSales = sales.filter((sale) => paidStatuses.has(sale.status.toLowerCase()));
  const pendingSales = sales.filter((sale) => pendingStatuses.has(sale.status.toLowerCase()));
  const onlineLicenses = licenses.filter((license) => license.online);
  const peopleKeys = new Set(onlineLicenses.map((license) => license.userId ? `user:${license.userId}` : `license:${license.id}`));
  const installations = licenses.flatMap((license) =>
    license.devices.map((device) => ({
      ...device,
      licenseId: license.id,
      licenseStatus: license.status,
      licenseOnline: license.online,
      email: license.email,
      name: license.name,
      planName: license.planName,
      planSlug: license.planSlug,
      tokenPreview: license.tokenPreview,
      maxDevices: license.maxDevices,
    })),
  );

  return {
    configured: Boolean(product?.id && plans.length >= 4),
    product: product ?? null,
    plans,
    offers,
    licenses,
    installations,
    sales,
    builds,
    channel: channel ?? null,
    stats: {
      revenue: paidSales.reduce((sum, sale) => sum + sale.amount, 0),
      paidSales: paidSales.length,
      pendingSales: pendingSales.length,
      totalSales: sales.length,
      conversionRate: sales.length ? Math.round((paidSales.length / sales.length) * 1000) / 10 : 0,
      totalLicenses: licenses.length,
      activeLicenses: licenses.filter((license) => license.status === "active").length,
      waitingLicenses: licenses.filter((license) => license.status === "inactive").length,
      expiredLicenses: licenses.filter((license) => license.status === "expired").length,
      revokedLicenses: licenses.filter((license) => license.status === "revoked").length,
      onlinePeople: peopleKeys.size,
      onlineDevices: installations.filter((installation) => installation.online).length,
      totalInstallations: installations.length,
      activeInstallations: installations.filter((installation) => installation.status === "active").length,
      linkedPeople: new Set(licenses.map((license) => license.userId).filter(Boolean)).size,
      publishedBuilds: builds.filter((build: any) => build.is_published).length,
      downloads: builds.reduce((sum: number, build: any) => sum + Number(build.downloads ?? 0), 0),
    },
  };
}

export async function saveLiveOffer(input: Record<string, any>, adminId: string) {
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("slug", LIVE_PRODUCT_SLUG)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("O produto MSK LIVE ainda não existe no banco ativo.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = { ...input } as any;
  if (payload.id) {
    const { data: current, error } = await supabaseAdmin
      .from("plans")
      .select("id,slug")
      .eq("id", payload.id)
      .maybeSingle();
    if (error) throw error;
    if (!current || !isLivePlanSlug(current.slug)) throw new Error("Este plano não pertence ao MSK LIVE.");
    payload.slug = current.slug;
  } else {
    const raw = String(payload.slug || payload.name || "oferta")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^msk-live-/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `oferta-${Date.now()}`;
    payload.slug = `msk-live-${raw}`.slice(0, 40);
    payload.sort_order = Number(payload.sort_order || 400 + Date.now() % 500);
  }

  if (payload.active === true && Number(payload.price ?? 0) <= 0) {
    throw new Error("Defina um preço maior que zero antes de colocar a oferta MSK LIVE no ar.");
  }

  const result = await savePlan(payload);
  const { data: saved } = await supabaseAdmin
    .from("plans")
    .select("features")
    .eq("id", result.id)
    .maybeSingle();
  const features = saved?.features && typeof saved.features === "object" ? saved.features as Record<string, any> : {};
  await supabaseAdmin
    .from("plans")
    .update({
      features: { ...features, product_type: "live", live: true },
    } as never)
    .eq("id", result.id);

  await logAudit({
    userId: adminId,
    action: payload.id ? "msk_live.offer_updated" : "msk_live.offer_created",
    resource: "plans",
    resourceId: result.id,
    metadata: { product_slug: LIVE_PRODUCT_SLUG, slug: payload.slug, active: payload.active, price: payload.price },
  });
  return result;
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
  if (!product) throw new Error("MSK LIVE ainda não foi aplicado no banco.");
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
