import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AGENT_BUCKET = "extension-builds";
const AGENT_CHANNEL = "msk-agente";

/**
 * Gera um link temporário para o ZIP oficial publicado do MSK Agente.
 * A versão não fica fixa no código: o download sempre usa o build oficial
 * atualmente publicado no canal `msk-agente`.
 */
export const getAgentExtensionDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ licenseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isUsableLicense, resolveLicenseSnapshot } = await import("./license-entitlements.server");
    const { logEvent } = await import("./license.server");

    const { data: license, error } = await supabaseAdmin
      .from("licenses")
      .select(
        "id,user_id,plan_id,status,expires_at,max_devices,metadata,plans(id,slug,name,price,currency,duration_label,duration_days,duration_value,duration_unit,is_lifetime,max_devices,features)",
      )
      .eq("id", data.licenseId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !license) throw new Error("Licença do MSK Agente não encontrada.");

    const snapshot = resolveLicenseSnapshot(license);
    if (!isUsableLicense(license) || snapshot.role !== "agent") {
      await logEvent({
        license_id: license.id,
        user_id: context.userId,
        event_type: "agent_download_denied",
        metadata: { role: snapshot.role, status: license.status },
      });
      throw new Error("Esta licença não libera o download do MSK Agente.");
    }

    const { data: build, error: buildError } = await supabaseAdmin
      .from("extension_builds")
      .select("id,version,file_name,storage_path,status,is_official,is_published,created_at")
      .eq("channel_slug", AGENT_CHANNEL as never)
      .eq("is_published", true as never)
      .eq("is_official", true as never)
      .eq("status", "ready" as never)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeBuild = build as unknown as {
      id: string;
      version: string;
      file_name: string;
      storage_path: string | null;
    } | null;

    if (buildError || !activeBuild?.storage_path) {
      console.error(
        "[agent-download] nenhum ZIP publicado disponível:",
        String(buildError?.message ?? "missing_build").slice(0, 200),
      );
      throw new Error("Nenhuma versão publicada do MSK Agente está disponível agora.");
    }

    // Mantém o bucket privado. O link expira rapidamente e é gerado somente no servidor.
    const storage = supabaseAdmin.storage.from(AGENT_BUCKET) as any;
    const { data: signed, error: signedError } = await storage.createSignedUrl(
      activeBuild.storage_path,
      90,
      { download: activeBuild.file_name },
    );

    if (signedError || !signed?.signedUrl) {
      console.error("[agent-download] falha ao assinar ZIP:", String(signedError?.message ?? "unknown").slice(0, 200));
      throw new Error("Não foi possível preparar o download agora. Tente novamente.");
    }

    await logEvent({
      license_id: license.id,
      user_id: context.userId,
      event_type: "agent_extension_download",
      metadata: {
        version: activeBuild.version,
        build_id: activeBuild.id,
        channel: AGENT_CHANNEL,
        source: "painel",
      },
    });

    return {
      url: String(signed.signedUrl),
      fileName: activeBuild.file_name,
      version: activeBuild.version,
      expiresIn: 90,
    };
  });
