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

type PublishedBuild = {
  id: string;
  channel_slug: string | null;
  version: string;
  file_name: string;
  created_at: string;
};

function extensionNameFromFile(fileName: string, version?: string | null) {
  let name = String(fileName || "")
    .replace(/\.zip$/i, "")
    .trim();

  if (version) {
    const escapedVersion = String(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp(`[\\s._-]*v?${escapedVersion}$`, "i"), "");
  }

  return (
    name
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Extensão MSK"
  );
}

function normalizeChannel(data: Record<string, any>): ExtensionChannel {
  return {
    ...data,
    channel_number: Number(data.channel_number),
    channel_type: String(data.channel_type),
    enabled: Boolean(data.enabled),
    version: String(data.version ?? ""),
    message: String(data.message ?? ""),
    api_base_url: String(data.api_base_url ?? ""),
  } as ExtensionChannel;
}

export async function listExtensionChannels(): Promise<ExtensionChannel[]> {
  const [{ data, error }, { data: builds, error: buildsError }] = await Promise.all([
    supabaseAdmin
      .from("extension_channels")
      .select("*")
      .order("channel_number"),
    supabaseAdmin
      .from("extension_builds")
      .select("id,channel_slug,version,file_name,created_at")
      .eq("is_published", true as never)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (error) throw error;
  if (buildsError) throw buildsError;

  // O build publicado é a fonte de verdade para nome/versão exibidos no card.
  // Antes o card lia somente extension_channels e ficava preso aos valores seed
  // (ex.: M3K Principal / v35.1.0), mesmo depois de um novo ZIP ser publicado.
  const latestBuildByChannel = new Map<string, PublishedBuild>();
  for (const raw of (builds ?? []) as unknown as PublishedBuild[]) {
    const slug = raw.channel_slug || "m3k-principal";
    if (!latestBuildByChannel.has(slug)) latestBuildByChannel.set(slug, raw);
  }

  const rows = ((data ?? []) as Record<string, any>[]).map((row) => {
    const latest = latestBuildByChannel.get(String(row.slug));
    if (!latest) return normalizeChannel(row);

    return normalizeChannel({
      ...row,
      version: latest.version,
      display_name: extensionNameFromFile(latest.file_name, latest.version),
    });
  });

  // Repara metadados antigos de forma idempotente para que, depois do primeiro
  // carregamento do Admin, nome e versão também fiquem persistidos no banco.
  await Promise.all(
    rows.map(async (channel) => {
      const original = (data ?? []).find((r: any) => r.id === channel.id) as Record<string, any> | undefined;
      if (!original) return;
      if (String(original.display_name) === channel.display_name && String(original.version) === channel.version) return;

      const { error: syncError } = await supabaseAdmin
        .from("extension_channels")
        .update({
          display_name: channel.display_name,
          version: channel.version,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", channel.id);

      if (syncError) throw syncError;
    }),
  );

  return rows;
}

export async function getExtensionChannel(slug?: string | null): Promise<ExtensionChannel | null> {
  let query = supabaseAdmin.from("extension_channels").select("*");
  query = slug ? query.eq("slug", slug) : query.eq("slug", "lvbup-reserva-01");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeChannel(data as Record<string, any>);
}

export async function getExtensionChannelByChromeId(chromeId: string): Promise<ExtensionChannel | null> {
  const { data, error } = await supabaseAdmin
    .from("extension_channels")
    .select("*")
    .eq("chrome_extension_id", chromeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeChannel(data as Record<string, any>);
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
  return normalizeChannel(data as Record<string, any>);
}
