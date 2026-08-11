import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueStandaloneLicense } from "./commerce.server";
import { logAudit } from "./audit.server";

export type DurationKind =
  | "trial15"
  | "trial60"
  | "day1"
  | "day7"
  | "day30"
  | "day90"
  | "day365"
  | "lifetime"
  | "custom";

const DAYS: Partial<Record<DurationKind, number>> = {
  day1: 1,
  day7: 7,
  day30: 30,
  day90: 90,
  day365: 365,
};

const MINUTES: Partial<Record<DurationKind, number>> = {
  trial15: 15,
  trial60: 60,
};

/** Gera uma licença manualmente (exclusivo do Super Admin). */
export async function generateManualToken(
  input: {
    email?: string | undefined;
    standalone?: boolean | undefined;
    planId: string;
    duration: DurationKind;
    customDays?: number | undefined;
    customMinutes?: number | undefined;
    maxDevices?: number | undefined;
    note?: string | undefined;
  },
  adminId: string,
) {
  const email = (input.email ?? "").trim().toLowerCase();
  let standalone = input.standalone === true || email === "";
  let profile: { id: string; email: string | null; name: string | null } | null = null;

  if (!standalone) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id,email,name")
      .ilike("email", email)
      .maybeSingle();
    profile = data as typeof profile;

    if (!profile) {
      // Fallback: o perfil pode não existir/estar sem e-mail — buscar na base de autenticação.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUser = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (authUser) {
        const name =
          (authUser.user_metadata?.["name"] as string | undefined) ??
          (authUser.user_metadata?.["full_name"] as string | undefined) ??
          null;
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: authUser.id, email: authUser.email ?? email, name }, { onConflict: "id" });
        profile = { id: authUser.id, email: authUser.email ?? email, name };
      } else {
        // Nenhuma conta com esse e-mail: emite licença avulsa (uso em testes/pré-venda).
        standalone = true;
      }
    }
  }



  const durationDays =
    input.duration === "custom" ? (input.customDays ?? null) : (DAYS[input.duration] ?? null);
  const durationMinutes =
    input.duration === "custom" ? (input.customMinutes ?? null) : (MINUTES[input.duration] ?? null);

  if (input.duration === "custom" && !durationDays && !durationMinutes) {
    throw new Error("Informe a duração personalizada em dias ou minutos.");
  }

  const result = await issueStandaloneLicense({
    userId: profile?.id ?? null,
    planId: input.planId,
    type: standalone
      ? "test"
      : input.duration === "trial15" || input.duration === "trial60"
        ? "trial"
        : "manual",
    ...(input.duration === "lifetime" ? {} : { durationDays, durationMinutes }),
    ...(input.maxDevices ? { maxDevices: input.maxDevices } : {}),
  });

  if (input.duration === "lifetime") {
    await supabaseAdmin.from("licenses").update({ expires_at: null }).eq("id", result.licenseId);
  }

  await logAudit({
    userId: adminId,
    action: standalone ? "license.test_generated" : "license.manual_generated",
    resource: "licenses",
    resourceId: result.licenseId,
    metadata: {
      target: profile?.email ?? "sem-usuario",
      duration: input.duration,
      note: input.note ?? null,
    },
  });

  return {
    token: result.token,
    licenseId: result.licenseId,
    standalone,
    user: { email: profile?.email ?? null, name: profile?.name ?? null },
  };
}


export async function loadTokenPlans() {
  const { data: activePlans, error: activeError } = await supabaseAdmin
    .from("plans")
    .select("id,name,slug,is_lifetime,max_devices,active,price,currency,duration_label,duration_days")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  
  if (!activeError && activePlans?.length) {
    return activePlans;
  }

  // Fallback anti-travamento: admin sempre consegue gerar licença.
  const { data: all, error: allError } = await supabaseAdmin
    .from("plans")
    .select("id,name,slug,is_lifetime,max_devices,active,price,currency,duration_label,duration_days")
    .order("sort_order", { ascending: true });
  
  if (allError) {
    console.error("Error loading plans for manual token generation:", allError);
    return [];
  }
  
  return (all ?? []) as Record<string, any>[];
}