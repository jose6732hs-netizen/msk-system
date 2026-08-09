/** Confirma o papel de admin usando o cliente do usuário (RLS aplicada). */
export async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (!data?.length) throw new Error("Acesso restrito a administradores");
}

/** Confirma o papel de super admin (RLS aplicada ao cliente do usuário). */
export async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito ao Super Admin");
}