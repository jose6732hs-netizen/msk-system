import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

export type ExtensionChannel = {
  id: string;
  slug: string;
  display_name: string;
  channel_number: number;
  channel_type: string;
  chrome_extension_id: string | null;
  enabled: boolean;
  version: string;
  message: string;
  api_base_url: string;
  updated_at: string | null;
};

export async function listExtensionChannels(): Promise<ExtensionChannel[]> {
  const { data, error } = await supabaseAdmin
    .from("extension_channels")
    .select("*")
    .order("channel_number");
  if (error) throw error;
  return (data ?? []).map(d => ({
    ...d,
    channel_number: Number(d.channel_number),
    channel_type: String(d.channel_type),
    enabled: Boolean(d.enabled),
    version: String(d.version),
    message: String(d.message),
    api_base_url: String(d.api_base_url)
  })) as ExtensionChannel[];
}

export async function getExtensionChannel(slug?: string | null): Promise<ExtensionChannel | null> {
  let query = supabaseAdmin.from("extension_channels").select("*");
  query = slug ? query.eq("slug", slug) : query.eq("slug", "lvbup-reserva-01");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    channel_number: Number(data.channel_number),
    channel_type: String(data.channel_type),
    enabled: Boolean(data.enabled),
    version: String(data.version),
    message: String(data.message),
    api_base_url: String(data.api_base_url)
  } as ExtensionChannel;
}

export async function getExtensionChannelByChromeId(chromeId: string): Promise<ExtensionChannel | null> {
  const { data, error } = await supabaseAdmin
    .from("extension_channels")
    .select("*")
    .eq("chrome_extension_id", chromeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    channel_number: Number(data.channel_number),
    channel_type: String(data.channel_type),
    enabled: Boolean(data.enabled),
    version: String(data.version),
    message: String(data.message),
    api_base_url: String(data.api_base_url)
  } as ExtensionChannel;
}

export async function saveExtensionChannel(
  input: {
    id: string;
    enabled: boolean;
    version?: string | undefined;
    message?: string | undefined;
    chromeExtensionId?: string | null | undefined;
  },
  actorId: string,
) {
  const patch: Record<string, unknown> = {
    enabled: input.enabled,
    updated_at: new Date().toISOString(),
  };
  if (input.version !== undefined) patch["version"] = input.version.trim();
  if (input.message !== undefined) patch["message"] = input.message.trim();
  if (input.chromeExtensionId !== undefined) {
    patch["chrome_extension_id"] = input.chromeExtensionId?.trim() || null;
  }

  const { data, error } = await supabaseAdmin
    .from("extension_channels")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw error;

  await logAudit({
    userId: actorId,
    action: input.enabled ? "extension.channel.enabled" : "extension.channel.disabled",
    resource: "extension_channels",
    resourceId: input.id,
    metadata: { slug: data.slug, version: data.version },
  });
  return {
    ...data,
    channel_number: Number(data.channel_number),
    channel_type: String(data.channel_type),
    enabled: Boolean(data.enabled),
    version: String(data.version),
    message: String(data.message),
    api_base_url: String(data.api_base_url)
  } as ExtensionChannel;
}