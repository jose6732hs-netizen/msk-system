/** Confirma o papel de admin usando o cliente do usuário (RLS aplicada). */
export async function assertAdmin(supabase: any, userId: string) {
  // Não filtre o enum por "super_admin" no SQL. Em ambientes que ainda estão
  // aplicando a migration do novo valor do enum, o PostgreSQL pode rejeitar a
  // consulta inteira e expulsar até usuários que continuam com role "admin".
  // Lemos as roles visíveis pela RLS e fazemos a comparação no servidor.
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;

  const allowed = (data ?? []).some((row: any) => {
    const role = String(row?.role ?? "");
    return role === "admin" || role === "super_admin";
  });
  if (!allowed) throw new Error("Acesso restrito a administradores");
}

/** Confirma o papel de super admin (RLS aplicada ao cliente do usuário). */
export async function assertSuperAdmin(supabase: any, userId: string) {
  // Mesma estratégia compatível do assertAdmin: evita enviar um valor novo do
  // enum na cláusula WHERE antes de a migration estar disponível no runtime.
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;

  const isSuperAdmin = (data ?? []).some((row: any) => String(row?.role ?? "") === "super_admin");
  if (!isSuperAdmin) throw new Error("Acesso restrito ao Super Admin");
}
