import { supabaseAdmin } from "@/integrations/supabase/client.server";

type EmailRecipient = {
  id: string;
  profileId: string;
  email: string;
  name: string | null;
};

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function searchEmailRecipients(query = "", limit = 100) {
  const db = supabaseAdmin as any;

  const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] = await Promise.all([
    db.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
    db.from("profiles").select("id,email,name").not("email", "is", null).limit(5000),
  ]);

  if (rolesError) throw rolesError;
  if (profilesError) throw profilesError;

  const adminIds = new Set((roles ?? []).map((row: any) => String(row.user_id)));
  const term = normalizeSearch(query);

  const recipients: EmailRecipient[] = (profiles ?? [])
    .map((row: any) => {
      const id = String(row.id ?? "");
      const email = normalizeEmail(row.email);
      if (!id || !email || adminIds.has(id)) return null;
      return {
        id,
        profileId: id,
        email,
        name: row.name ? String(row.name) : null,
      } satisfies EmailRecipient;
    })
    .filter(Boolean)
    .filter((recipient: any) => {
      if (!term) return true;
      const haystack = normalizeSearch(`${recipient.name ?? ""} ${recipient.email}`);
      return haystack.includes(term);
    })
    .sort((a: any, b: any) => (a.name || a.email).localeCompare(b.name || b.email, "pt-BR"));

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  return {
    recipients: recipients.slice(0, safeLimit),
    total: recipients.length,
    query: String(query ?? ""),
  };
}
