import { isUsableLicense, resolveLicenseSnapshot } from "./license-entitlements.server";

type Client = { from: (t: string) => any };

export type AgentAccess = {
  status: "active" | "expired" | "none";
  license: { id: string; status: string; expires_at: string | null; activated_at: string | null } | null;
  plan: { id: string; slug: string; name: string; duration_label: string | null } | null;
  privileged: boolean;
};

/**
 * Autorização real do MSK Agente: usa o snapshot gravado na licença paga.
 * Alterar a oferta depois da compra não concede nem remove funções do cliente.
 */
export async function loadAgentAccess(supabase: Client, userId: string): Promise<AgentAccess> {
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: any) => String(r.role));
  const privileged = roles.includes("admin") || roles.includes("super_admin");

  const { data: rows } = await supabase
    .from("licenses")
    .select(
      "id,plan_id,status,expires_at,activated_at,created_at,max_devices,metadata,plans(id,slug,name,price,currency,duration_label,duration_days,duration_value,duration_unit,is_lifetime,max_devices,features)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const agentLicenses = ((rows ?? []) as any[]).filter(
    (row) => resolveLicenseSnapshot(row).role === "agent",
  );

  const live = agentLicenses.find(isUsableLicense) ?? null;
  const chosen = live ?? agentLicenses[0] ?? null;
  const snapshot = chosen ? resolveLicenseSnapshot(chosen) : null;

  const plan = snapshot
    ? {
        id: String(snapshot.id ?? chosen?.plan_id ?? ""),
        slug: String(snapshot.slug ?? ""),
        name: String(snapshot.name ?? "MSK Agente"),
        duration_label: snapshot.durationLabel,
      }
    : null;

  const license = chosen
    ? {
        id: String(chosen.id),
        status: String(chosen.status),
        expires_at: chosen.expires_at ?? null,
        activated_at: chosen.activated_at ?? null,
      }
    : null;

  let status: AgentAccess["status"] = "none";
  if (privileged || live) status = "active";
  else if (chosen) status = "expired";

  return { status, license, plan, privileged };
}
