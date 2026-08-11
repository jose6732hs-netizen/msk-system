import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent } from "./license.server";

export async function loadAdminOverview(search: string, userSearch: string = "") {
  const term = search.trim();
  const uTerm = userSearch.trim();

  let licenseQuery = supabaseAdmin
    .from("licenses")
    .select(
      "id,user_id,status,expires_at,created_at,max_devices,token_preview,token_last4,last_validation,plans(name,slug),profiles:user_id(name,email)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (term) licenseQuery = licenseQuery.ilike("token_last4", `%${term.slice(-4)}%`);
  const { data: licenses } = await licenseQuery;

  let profileQuery = supabaseAdmin
    .from("profiles")
    .select("id,name,email,created_at,status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (uTerm) profileQuery = profileQuery.or(`email.ilike.%${uTerm}%,name.ilike.%${uTerm}%`);
  const { data: users } = await profileQuery;

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
        .select("id,status,current_period_end,cancel_at_period_end,plans(name),profiles:user_id(email)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("payments")
        .select("id,amount,currency,status,provider,created_at,profiles:user_id(email)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("webhook_events")
        .select("id,provider,event_type,event_id,processed,created_at,error")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("license_events")
        .select("id,event_type,created_at,license_id,metadata")
        .order("created_at", { ascending: false })
        .limit(60),
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


  return {
    licenses: (licenses ?? []) as Record<string, any>[],
    users: (users ?? []) as Record<string, any>[],
    plans: (plans ?? []) as Record<string, any>[],
    subscriptions: (subs ?? []) as Record<string, any>[],
    payments: (payments ?? []) as Record<string, any>[],
    webhooks: (webhooks ?? []) as Record<string, any>[],
    events: (events ?? []) as Record<string, any>[],
    devices: (devices ?? []) as Record<string, any>[],
    affiliates: (affiliates ?? []) as Record<string, any>[],

    stats: {
      users: users?.length ?? 0,
      licenses: licenses?.length ?? 0,
      activeLicenses: (licenses ?? []).filter((l: any) => l.status === "active").length,
      devices: devices?.length ?? 0,
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
      // Invalidate existing device sessions for this license
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
      patch["expires_at"] = new Date(
        base.getTime() + (input.days ?? 30) * 86400000,
      ).toISOString();
      patch["status"] = "active";
      break;
    }
  }

  const { error } = await supabaseAdmin.from("licenses").update(patch as never).eq("id", license.id);
  if (error) throw error;

  // Real-time notification logic could be added here to force client refresh
  // but status updates are already reflected on next validation.

  await logEvent({
    license_id: license.id,
    user_id: license.user_id,
    event_type: `admin_${input.action}`,
    metadata: { admin_id: adminId, reason: input.reason ?? null, days: input.days ?? null },
  });
  return { ok: true };
}

export async function savePlan(plan: Record<string, any>) {
  const payload = { ...plan };
  if (payload["is_lifetime"]) payload["duration_days"] = null;
  if (payload["id"]) {
    const { id, ...rest } = payload;
    const { error } = await supabaseAdmin.from("plans").update(rest as never).eq("id", id);
    if (error) throw error;
    return { ok: true, id };
  }
  const { data, error } = await supabaseAdmin
    .from("plans")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  return { ok: true, id: data.id };
}