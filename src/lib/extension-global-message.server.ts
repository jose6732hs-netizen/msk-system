import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

type Severity = "info" | "success" | "warning" | "critical";

export async function broadcastExtensionMessage(
  input: { title: string; message: string; severity: Severity },
  adminUserId: string,
) {
  const { data: installations, error } = await db
    .from("extension_installations")
    .select("user_id,installation_id,last_seen_at")
    .not("user_id", "is", null)
    .not("installation_id", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const seen = new Set<string>();
  const targets = (installations ?? []).filter((row: any) => {
    const userId = String(row.user_id ?? "");
    const installationId = String(row.installation_id ?? "");
    if (!userId || !installationId) return false;
    const key = `${userId}:${installationId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!targets.length) return { ok: true, deliveries: 0, users: 0 };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const rows = targets.map((row: any) => ({
    user_id: row.user_id,
    installation_id: row.installation_id,
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

  return {
    ok: true,
    deliveries: rows.length,
    users: new Set(rows.map((row: any) => String(row.user_id))).size,
  };
}
