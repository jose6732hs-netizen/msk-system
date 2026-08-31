import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

type Severity = "info" | "success" | "warning" | "critical";

export async function listExtensionMessageRecipients() {
  const [{ data: profiles, error: profileError }, { data: licenses, error: licenseError }, { data: installations, error: installationError }] =
    await Promise.all([
      db.from("profiles").select("id,name,email").order("email", { ascending: true }).limit(5000),
      db.from("licenses").select("user_id").not("user_id", "is", null).limit(10000),
      db.from("extension_installations").select("user_id,installation_id").not("user_id", "is", null).limit(10000),
    ]);
  if (profileError) throw profileError;
  if (licenseError) throw licenseError;
  if (installationError) throw installationError;

  const licensedUsers = new Set((licenses ?? []).map((row: any) => String(row.user_id ?? "")).filter(Boolean));
  const installationCounts = new Map<string, number>();
  for (const row of installations ?? []) {
    const id = String(row.user_id ?? "");
    if (!id) continue;
    installationCounts.set(id, (installationCounts.get(id) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((profile: any) => ({
    user_id: String(profile.id),
    name: profile.name ?? "Cliente",
    email: profile.email ?? "—",
    licensed: licensedUsers.has(String(profile.id)),
    installations: installationCounts.get(String(profile.id)) ?? 0,
  }));

  return {
    users,
    licensedUsers: users.filter((user: any) => user.licensed).length,
    installations: [...installationCounts.values()].reduce((sum, count) => sum + count, 0),
  };
}

export async function broadcastExtensionMessage(
  input: { title: string; message: string; severity: Severity },
  adminUserId: string,
) {
  const { data: licenses, error } = await db
    .from("licenses")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(10000);
  if (error) throw error;

  const userIds = [...new Set((licenses ?? []).map((row: any) => String(row.user_id ?? "")).filter(Boolean))];
  if (!userIds.length) return { ok: true, deliveries: 0, users: 0 };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const rows = userIds.map((userId) => ({
    user_id: userId,
    installation_id: null,
    command_type: "message",
    title: input.title.slice(0, 180),
    message: input.message.slice(0, 2000),
    severity: input.severity,
    status: "pending",
    created_by: adminUserId,
    expires_at: expiresAt,
  }));

  const { error: insertError } = await db.from("extension_remote_commands").insert(rows);
  if (insertError) throw insertError;

  return { ok: true, deliveries: rows.length, users: rows.length };
}
