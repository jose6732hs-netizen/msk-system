import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadPublicFile(file: File, path: string, bucket: string = "public") {
  const bytes = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

  if (error) throw error;

  // Buckets privados (ex.: cms-media) não funcionam com getPublicUrl —
  // gera uma URL assinada de longa duração para a imagem carregar de verdade.
  const { data: signed } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, TEN_YEARS);

  if (signed?.signedUrl) return signed.signedUrl;

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}
