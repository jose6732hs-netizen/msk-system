/** Domínio configurável da plataforma. Somente servidor. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildUrl } from "./urls";

let cache: { value: string; at: number } | null = null;

export async function getAppUrl(): Promise<string> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "app_url")
    .maybeSingle();
  const configured = ((data?.value as { url?: string } | null)?.url ?? "").trim();
  const value = (configured || process.env["APP_URL"] || "").replace(/\/+$/, "");
  cache = { value, at: Date.now() };
  return value;
}

export function clearAppUrlCache() {
  cache = null;
}

export async function absoluteUrl(path: string) {
  return buildUrl(await getAppUrl(), path);
}
