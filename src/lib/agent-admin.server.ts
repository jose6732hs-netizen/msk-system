import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AGENT_CHANNEL = "msk-agente";
const AGENT_PREFIX = "msk-agent";

export type AgentPlanRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  duration_label: string;
  duration_unit: string;
  duration_value: number;
  is_lifetime: boolean;
  max_devices: number;
  active: boolean;
  sort_order: number;
  image_url: string | null;
  affiliate_commission_rate: number;
};

export type AgentSaleRow = {
  id: string;
  identifier: string;
  amount: number;
  status: string;
  method: string | null;
  provider: string | null;
  created_at: string;
  paid_at: string | null;
  plan_name: string;
  plan_slug: string;
  buyer_email: string;
  buyer_name: string;
};

export async function loadAgentAdmin() {
  const { data: plansData, error: plansError } = await supabaseAdmin
    .from("plans")
    .select(
      "id,slug,name,description,price,duration_label,duration_unit,duration_value,is_lifetime,max_devices,active,sort_order,image_url,affiliate_commission_rate",
    )
    .like("slug", `${AGENT_PREFIX}%`)
    .order("sort_order", { ascending: true });
  if (plansError) throw new Error(plansError.message);

  const plans = (plansData ?? []) as unknown as AgentPlanRow[];
  const planIds = plans.map((p) => p.id);
  const planById = new Map(plans.map((p) => [p.id, p]));

  let sales: AgentSaleRow[] = [];
  let licenses: Array<Record<string, unknown>> = [];

  if (planIds.length) {
    const [txRes, licRes] = await Promise.all([
      supabaseAdmin
        .from("transactions")
        .select("id,user_id,identifier,amount,status,method,provider,plan_id,created_at,paid_at")
        .in("plan_id", planIds)
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("licenses")
        .select("id,user_id,token,status,plan_id,created_at,activated_at,expires_at")
        .in("plan_id", planIds)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (txRes.error) throw new Error(txRes.error.message);
    if (licRes.error) throw new Error(licRes.error.message);

    const txRows = (txRes.data ?? []) as Array<Record<string, any>>;
    const licRows = (licRes.data ?? []) as Array<Record<string, any>>;
    const userIds = [
      ...new Set([...txRows, ...licRows].map((r) => r["user_id"]).filter(Boolean) as string[]),
    ];

    const profiles = new Map<string, { email: string; name: string }>();
    if (userIds.length) {
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .in("id", userIds);
      (profileRows ?? []).forEach((p: any) => {
        profiles.set(p.id, { email: p.email ?? "—", name: p.display_name ?? "—" });
      });
    }

    sales = txRows.map((t) => {
      const plan = planById.get(t["plan_id"]);
      const profile = profiles.get(t["user_id"]);
      return {
        id: t["id"],
        identifier: t["identifier"],
        amount: Number(t["amount"] ?? 0),
        status: String(t["status"] ?? ""),
        method: t["method"] ?? null,
        provider: t["provider"] ?? null,
        created_at: t["created_at"],
        paid_at: t["paid_at"] ?? null,
        plan_name: plan?.name ?? "MSK Agente",
        plan_slug: plan?.slug ?? "",
        buyer_email: profile?.email ?? "—",
        buyer_name: profile?.name ?? "—",
      };
    });

    licenses = licRows.map((l) => ({
      ...l,
      plan_name: planById.get(l["plan_id"])?.name ?? "MSK Agente",
      buyer_email: profiles.get(l["user_id"])?.email ?? "—",
    }));
  }

  const { data: buildRows } = await supabaseAdmin
    .from("extension_builds")
    .select("id,version,file_name,size_bytes,is_published,release_notes,created_at,channel_slug")
    .eq("channel_slug", AGENT_CHANNEL)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: channel } = await supabaseAdmin
    .from("extension_channels")
    .select("slug,display_name,version,enabled")
    .eq("slug", AGENT_CHANNEL)
    .maybeSingle();

  const paid = sales.filter((s) => ["paid", "approved", "completed"].includes(s.status.toLowerCase()));
  const pending = sales.filter((s) => ["pending", "waiting_payment", "processing"].includes(s.status.toLowerCase()));

  return {
    plans,
    sales,
    licenses,
    builds: (buildRows ?? []) as Array<Record<string, unknown>>,
    channel: channel ?? null,
    metrics: {
      revenue: paid.reduce((sum, s) => sum + s.amount, 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      totalCount: sales.length,
      activeLicenses: licenses.filter((l) => l["status"] === "active").length,
    },
  };
}
