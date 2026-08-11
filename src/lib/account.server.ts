import { decryptToken } from "./license.server";

export type AccountData = Awaited<ReturnType<typeof loadAccount>>;

type Client = {
  from: (t: string) => any;
};

export async function loadAccount(supabase: Client, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,email,created_at")
    .eq("id", userId)
    .maybeSingle();

  // Busca as últimas licenças e prioriza uma ativa/pendente sobre expiradas
  // (ex.: licença emitida manualmente pelo admin logo após uma expirar).
  const { data: licenseRows } = await supabase
    .from("licenses")
    .select(
      "id,status,expires_at,activated_at,max_devices,token_preview,token_last4,last_validation,created_at,subscription_id,plans(id,slug,name,price,currency,duration_label,features,max_devices)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const list = (licenseRows ?? []) as Record<string, any>[];
  const license =
    list.find((l) => l["status"] === "active" || l["status"] === "inactive") ?? list[0] ?? null;

  let devices: Record<string, any>[] = [];
  if (license) {
    const { data } = await supabase
      .from("license_devices")
      .select("id,device_name,browser,os,first_seen,last_seen,status,extension_version")
      .eq("license['id']", license.id)
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
    license: license ?? null,
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