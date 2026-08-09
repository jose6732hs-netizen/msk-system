import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashValue } from "./license.server";

export async function logAudit(input: {
  userId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  result?: "success" | "failure";
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: input.userId ?? null,
      action: input.action,
      resource: input.resource ?? null,
      resource_id: input.resourceId ?? null,
      ip_hash: input.ip ? await hashValue(input.ip) : null,
      user_agent: input.userAgent?.slice(0, 250) ?? null,
      result: input.result ?? "success",
      metadata: (input.metadata ?? {}) as never,
    });
  } catch (e) {
    console.warn("[audit] falha ao registrar:", (e as Error).message);
  }
}