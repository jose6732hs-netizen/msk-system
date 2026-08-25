import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PlanOverride = {
  id: string;
  active: boolean;
  imageUrl?: string | null;
};

export async function saveClonerPlanOverrides(plans: PlanOverride[]) {
  for (const plan of plans) {
    const imageUrl = String(plan.imageUrl ?? "").trim();
    const { error } = await supabaseAdmin
      .from("plans")
      .update({
        active: !!plan.active,
        image_url: imageUrl || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", plan.id);
    if (error) throw new Error(error.message);
  }
}

export async function enrichClonerPlans<T extends { plans?: any[] }>(payload: T): Promise<T> {
  const ids = (payload.plans ?? []).map((plan: any) => plan?.id).filter(Boolean) as string[];
  if (!ids.length) return payload;

  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id,active,image_url")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((row: any) => [row.id, row]));
  return {
    ...payload,
    plans: (payload.plans ?? []).map((plan: any) => {
      const row = byId.get(plan.id) as any;
      return {
        ...plan,
        active: row ? !!row.active : !!plan.active,
        imageUrl: row?.image_url || defaultClonerImage(plan.slug),
      };
    }),
  };
}

function defaultClonerImage(slug?: string | null) {
  const value = String(slug ?? "");
  if (value.endsWith("daily")) return "/cloner-offers/cloner-daily.webp";
  if (value.endsWith("weekly")) return "/cloner-offers/cloner-weekly.webp";
  if (value.endsWith("monthly")) return "/cloner-offers/cloner-monthly.webp";
  return null;
}
