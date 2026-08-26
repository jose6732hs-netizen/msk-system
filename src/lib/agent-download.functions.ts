import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AGENT_BUILD = {
  bucket: "extension-builds",
  path: "official/2.4.41/1787784700132-MSK-Agente-v2.4.41.zip",
  fileName: "MSK-Agente-v2.4.41.zip",
  version: "2.4.41",
} as const;

/**
 * Gera um link temporário para o ZIP oficial do MSK Agente.
 * A URL nunca é pública/permanente e só é emitida para o dono de uma licença
 * utilizável cujo snapshot histórico pertença ao produto `agent`.
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

    // Mantém o bucket privado. O link expira rapidamente e é gerado somente no servidor.
    const storage = supabaseAdmin.storage.from(AGENT_BUILD.bucket) as any;
    const { data: signed, error: signedError } = await storage.createSignedUrl(
      AGENT_BUILD.path,
      90,
      { download: AGENT_BUILD.fileName },
    );

    if (signedError || !signed?.signedUrl) {
      console.error("[agent-download] falha ao assinar ZIP:", String(signedError?.message ?? "unknown").slice(0, 200));
      throw new Error("Não foi possível preparar o download agora. Tente novamente.");
    }

    await logEvent({
      license_id: license.id,
      user_id: context.userId,
      event_type: "agent_extension_download",
      metadata: { version: AGENT_BUILD.version, source: "painel" },
    });

    return {
      url: String(signed.signedUrl),
      fileName: AGENT_BUILD.fileName,
      version: AGENT_BUILD.version,
      expiresIn: 90,
    };
  });
