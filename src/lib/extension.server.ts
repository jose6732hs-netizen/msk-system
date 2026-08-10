import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "./audit.server";

const BUCKET = "extension-builds";

export type BuildRow = {
  id: string;
  version: string;
  file_name: string;
  storage_path: string | null;
  size_bytes: number | null;
  status: string;
  is_official: boolean;
  is_published: boolean;
  release_notes: string | null;
  reseller_id: string | null;
  created_at: string;
};

export async function listBuilds() {
  const { data, error } = await supabaseAdmin
    .from("extension_builds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const { count: downloads } = await supabaseAdmin
    .from("downloads")
    .select("id", { count: "exact", head: true });

  return { builds: (data ?? []) as unknown as BuildRow[], downloads: downloads ?? 0 };
}

/** Gera uma URL assinada para o admin subir o ZIP direto no storage privado. */
export async function createUploadUrl(input: { version: string; fileName: string }) {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `official/${input.version}/${Date.now()}-${safe}`;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function registerBuild(
  input: {
    version: string;
    fileName: string;
    storagePath: string;
    sizeBytes: number;
    releaseNotes?: string | undefined;
    channelSlug?: string | undefined;
    publish: boolean;
  },
  adminId: string,
) {
  const channelSlug = input.channelSlug ?? "m3k-principal";
  if (input.publish) {
    await supabaseAdmin
      .from("extension_builds")
      .update({ is_published: false } as never)
      .eq("channel_slug", channelSlug as never);
  }

  const { data, error } = await supabaseAdmin
    .from("extension_builds")
    .insert({
      channel_slug: channelSlug,
      version: input.version,
      file_name: input.fileName,
      storage_path: input.storagePath,
      size_bytes: input.sizeBytes,
      status: "ready",
      is_official: true,
      is_published: input.publish,
      release_notes: input.releaseNotes ?? null,
      uploaded_by: adminId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAudit({
    userId: adminId,
    action: "extension.build.upload",
    resource: "extension_builds",
    resourceId: (data as { id: string }).id,
    metadata: { version: input.version, published: input.publish },
  });
  return { ok: true, id: (data as { id: string }).id };
}

export async function setPublished(buildId: string, publish: boolean, adminId: string) {
  if (publish) {
    await supabaseAdmin
      .from("extension_builds")
      .update({ is_published: false } as never)
      .eq("is_official", true as never);
  }
  const { error } = await supabaseAdmin
    .from("extension_builds")
    .update({ is_published: publish, updated_at: new Date().toISOString() } as never)
    .eq("id", buildId);
  if (error) throw new Error(error.message);
  await logAudit({
    userId: adminId,
    action: publish ? "extension.build.publish" : "extension.build.unpublish",
    resource: "extension_builds",
    resourceId: buildId,
  });
  return { ok: true };
}

export async function deleteBuild(buildId: string, adminId: string) {
  const { data } = await supabaseAdmin
    .from("extension_builds")
    .select("storage_path")
    .eq("id", buildId)
    .maybeSingle();
  const path = (data as { storage_path?: string | null } | null)?.storage_path;
  if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
  const { error } = await supabaseAdmin.from("extension_builds").delete().eq("id", buildId);
  if (error) throw new Error(error.message);
  await logAudit({
    userId: adminId,
    action: "extension.build.delete",
    resource: "extension_builds",
    resourceId: buildId,
  });
  return { ok: true };
}

/** Canais de extensão habilitados pelo admin (fonte de verdade do download). */
export async function listActiveChannels() {
  const { data, error } = await supabaseAdmin
    .from("extension_channels")
    .select("id,slug,display_name,channel_number,channel_type,enabled,active,version,message,metadata")
    .order("channel_number");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    id: string;
    slug: string;
    display_name: string;
    channel_number: number | null;
    channel_type: string | null;
    enabled: boolean | null;
    active: boolean | null;
    version: string | null;
    message: string | null;
    metadata: Record<string, unknown> | null;
  }[];
  return rows
    .filter((c) => c.enabled !== false && c.active !== false)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      display_name: c.display_name,
      channel_number: c.channel_number ?? 1,
      channel_type: c.channel_type ?? "stable",
      enabled: c.enabled ?? true,
      version: c.version ?? "1.0.0",
      message: c.message,
      public_zip: (c.metadata?.["public_zip"] as string | undefined) ?? null,
    }));
}

async function buildForChannel(slug: string) {
  const byChannel = await supabaseAdmin
    .from("extension_builds")
    .select("id,version,file_name,storage_path,release_notes,size_bytes,channel_slug")
    .eq("is_published", true as never)
    .eq("channel_slug", slug as never)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byChannel.data) return byChannel.data as unknown as BuildRow;

  // Fallback: último pacote publicado (build enviado sem canal definido).
  const { data } = await supabaseAdmin
    .from("extension_builds")
    .select("id,version,file_name,storage_path,release_notes,size_bytes,channel_slug")
    .eq("is_published", true as never)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as BuildRow | null) ?? null;
}

/** Download livre (sem exigir licença) — apenas do canal ativado no admin. */
export async function issueDownloadLink(userId: string, channelSlug?: string | null) {
  const channels = await listActiveChannels();
  const channel = channelSlug 
    ? channels.find((c) => c.slug === channelSlug) 
    : channels.find((c) => c.enabled !== false) || channels[0];

  const build = await buildForChannel(channel?.slug ?? channelSlug ?? "");

  if (build?.storage_path) {
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(build.storage_path, 300, { download: build.file_name });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("downloads").insert({ user_id: userId, build_id: build.id } as never);
    return {
      url: signed.signedUrl,
      version: build.version,
      fileName: build.file_name,
      releaseNotes: build.release_notes,
      channel: channel?.slug ?? "default",
      channelName: channel?.display_name ?? "Extensão",
    };
  }

  if (!channels.length) {
    throw new Error("Nenhuma extensão está ativa no momento. Fale com o suporte.");
  }
  if (!channel) throw new Error("Esta versão da extensão está desativada pelo administrador.");
  if (!channel.public_zip) {
    throw new Error(`Nenhum pacote publicado para "${channel.display_name}" ainda.`);
  }
  await supabaseAdmin.from("downloads").insert({ user_id: userId } as never);
  return {
    url: channel.public_zip,
    version: channel.version,
    fileName: channel.public_zip.replace(/^\//, ""),
    releaseNotes: channel.message ?? null,
    channel: channel.slug,
    channelName: channel.display_name,
  };
}


export async function latestPublishedBuild() {
  const { data } = await supabaseAdmin
    .from("extension_builds")
    .select("version,file_name,size_bytes,release_notes,created_at")
    .eq("is_official", true as never)
    .eq("is_published", true as never)
    .order("created_at", { ascending: false })
    .maybeSingle();
  return data ?? null;
}
