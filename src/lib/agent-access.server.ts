type Client = { from: (t: string) => any };

export type AgentAccess = {
  status: "active" | "expired" | "none";
  license: { id: string; status: string; expires_at: string | null; activated_at: string | null } | null;
  plan: { id: string; slug: string; name: string; duration_label: string | null } | null;
  privileged: boolean;
};

/**
 * Autorização real do MSK Agente: sempre no servidor, com o cliente autenticado
 * (RLS aplicada). Nunca confia no frontend.
 */
export async function loadAgentAccess(supabase: Client, userId: string): Promise<AgentAccess> {
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: any) => String(r.role));
  const privileged = roles.includes("admin") || roles.includes("super_admin");

  const { data: rows } = await supabase
    .from("licenses")
    .select(
      "id,status,expires_at,activated_at,created_at,plans(id,slug,name,duration_label,features,active)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const agentLicenses = ((rows ?? []) as any[]).filter((row) => {
    const plan = row.plans;
    if (!plan) return false;
    const slug = String(plan.slug ?? "");
    const features = (plan.features ?? {}) as Record<string, unknown>;
    return slug.startsWith("msk-agent") || features["agent"] === true || features["product_type"] === "agent";
  });

  const now = Date.now();
  const isLive = (row: any) => {
    if (row.status === "revoked" || row.status === "suspended") return false;
    if (row.status === "expired") return false;
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) return false;
    return true;
  };

  const live = agentLicenses.find(isLive) ?? null;
  const chosen = live ?? agentLicenses[0] ?? null;

  const plan = chosen?.plans
    ? {
        id: String(chosen.plans.id),
        slug: String(chosen.plans.slug),
        name: String(chosen.plans.name),
        duration_label: chosen.plans.duration_label ?? null,
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
