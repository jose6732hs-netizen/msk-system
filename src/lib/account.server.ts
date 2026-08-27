import { decryptToken } from "./license.server";
import { isUsableLicense, resolveLicenseSnapshot } from "./license-entitlements.server";

export type AccountData = Awaited<ReturnType<typeof loadAccount>>;

type Client = {
  from: (t: string) => any;
};

function meta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function moneyOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadAccount(supabase: Client, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,email,created_at")
    .eq("id", userId)
    .maybeSingle();

  const { data: licenseRows } = await supabase
    .from("licenses")
    .select(
      "id,plan_id,status,expires_at,activated_at,starts_at,type,metadata,transaction_id,max_devices,token_preview,token_last4,last_validation,created_at,subscription_id,plans(id,slug,name,price,currency,duration_label,duration_days,duration_value,duration_unit,features,max_devices,is_lifetime)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rawList = (licenseRows ?? []) as Record<string, any>[];
  const transactionIds = [
    ...new Set(rawList.map((row) => String(row["transaction_id"] ?? "")).filter(Boolean)),
  ];

  const txById = new Map<string, any>();
  if (transactionIds.length) {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id,amount,currency,method,status,paid_at,metadata")
      .in("id", transactionIds);
    for (const tx of transactions ?? []) txById.set(String(tx.id), tx);
  }

  const licenseCountByTransaction = new Map<string, number>();
  for (const row of rawList) {
    const txId = String(row["transaction_id"] ?? "");
    if (!txId) continue;
    licenseCountByTransaction.set(txId, (licenseCountByTransaction.get(txId) ?? 0) + 1);
  }

  const list = rawList.map((row) => {
    const resolvedPlan = resolveLicenseSnapshot(row);
    const txId = String(row["transaction_id"] ?? "");
    const tx = txId ? txById.get(txId) : null;
    const txMeta = meta(tx?.metadata);
    const totalPaid = tx
      ? moneyOrNull(txMeta["card_charged_total"]) ?? moneyOrNull(tx.amount)
      : null;

    return {
      ...row,
      resolved_plan: resolvedPlan,
      purchase: tx
        ? {
            base_amount: moneyOrNull(tx.amount),
            total_paid: totalPaid,
            currency: String(tx.currency ?? resolvedPlan.currency ?? "BRL"),
            method: String(tx.method ?? ""),
            status: String(tx.status ?? ""),
            paid_at: tx.paid_at ?? null,
            license_count: licenseCountByTransaction.get(txId) ?? 1,
          }
        : null,
    };
  });

  const usable = list.filter(isUsableLicense);
  const license =
    usable.find((row) => row.resolved_plan?.role === "extension") ??
    usable[0] ??
    list[0] ??
    null;

  let devices: Record<string, any>[] = [];
  if (license) {
    const { data } = await supabase
      .from("license_devices")
      .select("id,device_name,browser,os,first_seen,last_seen,status,extension_version")
      .eq("license_id", (license as any)["id"])
      .eq("status", "active")
      .order("last_seen", { ascending: false });
    devices = data ?? [];
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "id,status,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,plans(name,slug,price,currency)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: events } = await supabase
    .from("license_events")
    .select("id,event_type,created_at,metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15);

  return {
    profile: profile ?? null,
    license,
    licenses: list,
    devices,
    subscription: subscription ?? null,
    events: events ?? [],
  };
}

export async function revealToken(supabase: Client, userId: string, licenseId: string) {
  const { data } = await supabase
    .from("licenses")
    .select("token_encrypted,user_id")
    .eq("id", licenseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.token_encrypted) return null;
  return decryptToken(data.token_encrypted);
}
