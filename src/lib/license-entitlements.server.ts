import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { licenseRoleFromSlug, type LicenseRole } from "./license-purpose";

function meta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type LicenseSnapshot = {
  id: string | null;
  slug: string | null;
  name: string | null;
  price: number | null;
  currency: string;
  durationLabel: string | null;
  durationDays: number | null;
  durationValue: number | null;
  durationUnit: string | null;
  isLifetime: boolean;
  maxDevices: number | null;
  features: Record<string, unknown>;
  role: LicenseRole;
};

/**
 * Resolve o produto comprado priorizando o snapshot gravado na licença.
 * A tabela plans serve apenas como fallback para licenças antigas.
 */
export function resolveLicenseSnapshot(row: any): LicenseSnapshot {
  const metadata = meta(row?.metadata);
  const plan = row?.plans ?? {};
  const snapshotFeatures = meta(metadata["features_snapshot"]);
  const currentFeatures = meta(plan?.features);
  const features = Object.keys(snapshotFeatures).length ? snapshotFeatures : currentFeatures;

  const slug = String(metadata["plan_slug_snapshot"] ?? plan?.slug ?? "").trim() || null;
  const explicitRole = String(metadata["license_role"] ?? "").trim();
  let role: LicenseRole;
  if (explicitRole === "agent" || explicitRole === "cloner" || explicitRole === "extension") {
    role = explicitRole;
  } else if (features["agent"] === true || features["product_type"] === "agent") {
    role = "agent";
  } else if (features["page_cloner"] === true || features["product_type"] === "cloner") {
    role = "cloner";
  } else {
    role = licenseRoleFromSlug(slug);
  }

  const lifetimeSnapshot = metadata["plan_is_lifetime_snapshot"];
  const isLifetime =
    typeof lifetimeSnapshot === "boolean" ? lifetimeSnapshot : Boolean(plan?.is_lifetime);

  return {
    id: String(row?.plan_id ?? plan?.id ?? "").trim() || null,
    slug,
    name: String(metadata["plan_name_snapshot"] ?? plan?.name ?? "").trim() || null,
    price: numberOrNull(metadata["item_unit_price"] ?? metadata["plan_price_snapshot"] ?? plan?.price),
    currency: String(metadata["plan_currency_snapshot"] ?? plan?.currency ?? "BRL"),
    durationLabel:
      String(metadata["plan_duration_label_snapshot"] ?? plan?.duration_label ?? "").trim() || null,
    durationDays: numberOrNull(metadata["plan_duration_snapshot"] ?? plan?.duration_days),
    durationValue: numberOrNull(metadata["plan_duration_value_snapshot"] ?? plan?.duration_value),
    durationUnit:
      String(metadata["plan_duration_unit_snapshot"] ?? plan?.duration_unit ?? "").trim() || null,
    isLifetime,
    maxDevices: numberOrNull(metadata["plan_max_devices_snapshot"] ?? row?.max_devices ?? plan?.max_devices),
    features,
    role,
  };
}

export function isUsableLicense(row: any) {
  const status = String(row?.status ?? "").toLowerCase();
  if (["revoked", "suspended", "expired", "cancelled", "canceled"].includes(status)) return false;
  if (row?.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return status === "active" || status === "inactive" || status === "pending" || status === "available";
}

export async function hasUsableLicenseRole(
  userId: string,
  role: LicenseRole,
  options?: { allowPrivileged?: boolean },
) {
  if (options?.allowPrivileged) {
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => String(r.role));
    if (roles.includes("admin") || roles.includes("super_admin")) return true;
  }

  const { data } = await supabaseAdmin
    .from("licenses")
    .select(
      "id,plan_id,status,expires_at,max_devices,metadata,plans(id,slug,name,price,currency,duration_label,duration_days,duration_value,duration_unit,is_lifetime,max_devices,features)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as any[]).some(
    (row) => isUsableLicense(row) && resolveLicenseSnapshot(row).role === role,
  );
}
