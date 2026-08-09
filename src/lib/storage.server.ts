import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function uploadPublicFile(file: File, path: string, bucket: string = "public") {
  const bytes = await file.arrayBuffer();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true
    });
  
  if (error) throw error;

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}
