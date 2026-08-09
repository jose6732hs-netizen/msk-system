import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureAffiliate, ensureReseller, getSetting } from "./commerce.server";

export async function loadAffiliateDashboard(userId: string) {
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!affiliate) return { enrolled: false as const };

  const [{ data: commissions }, { data: sales }, { data: withdrawals }] = await Promise.all([
    supabaseAdmin
      .from("affiliate_commissions")
      .select("id,amount,rate,status,created_at,transaction_id")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("transactions")
      .select("id,amount,status,created_at,plans(name)")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("withdrawals")
      .select("id,amount,status,created_at,pix_key_type")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    enrolled: true as const,
    affiliate: affiliate as Record<string, any>,
    commissions: (commissions ?? []) as Record<string, any>[],
    sales: (sales ?? []) as Record<string, any>[],
    withdrawals: (withdrawals ?? []) as Record<string, any>[],
  };
}

export async function loadResellerDashboard(userId: string) {
  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!reseller) return { enrolled: false as const };

  const [{ data: deposits }, { data: licenses }, { data: withdrawals }, { data: branding }, tiers] =
    await Promise.all([
      supabaseAdmin
        .from("reseller_deposits")
        .select("id,amount,status,created_at,credited_at")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("licenses")
        .select("id,status,type,expires_at,created_at,token_preview,plans(name)")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("withdrawals")
        .select("id,amount,status,created_at,pix_key_type")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin.from("extension_branding").select("*").eq("reseller_id", reseller.id).maybeSingle(),
      getSetting<{ slug: string; name: string; trials: number; min_deposit: number; discount: number }[]>(
        "reseller_tiers",
        [],
      ),
    ]);

  return {
    enrolled: true as const,
    reseller: reseller as Record<string, any>,
    deposits: (deposits ?? []) as Record<string, any>[],
    licenses: (licenses ?? []) as Record<string, any>[],
    withdrawals: (withdrawals ?? []) as Record<string, any>[],
    branding: (branding ?? null) as Record<string, any> | null,
    tiers,
  };
}

export async function saveResellerBranding(
  userId: string,
  input: {
    extensionName: string;
    description: string;
    primaryColor: string;
    titleColor: string;
    supportUrl?: string | undefined;
  },
) {
  const reseller = await ensureReseller(userId);
  const { error } = await supabaseAdmin.from("extension_branding").upsert(
    {
      reseller_id: reseller.id,
      extension_name: input.extensionName,
      description: input.description,
      primary_color: input.primaryColor,
      title_color: input.titleColor,
      support_url: input.supportUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "reseller_id" },
  );
  if (error) throw error;
  return { ok: true };
}

export async function enrollBoth(userId: string) {
  await ensureAffiliate(userId);
  await ensureReseller(userId);
}