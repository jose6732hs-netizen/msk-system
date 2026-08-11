import { supabase } from "@/integrations/supabase/client";

const BUCKET = "cms-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .toLowerCase();
}

/**
 * Uploads a file (image or video) straight from the browser to storage,
 * reporting real 0-100% progress, and returns a long-lived public URL.
 */
export async function uploadMediaWithProgress(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const path = `${folder}/${Date.now()}-${slugify(file.name)}`;
  const baseUrl = import.meta.env['VITE_SUPABASE_URL'] as string;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Falha no upload (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Erro de rede durante o upload"));
    xhr.send(file);
  });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Falha ao gerar URL do arquivo");

  onProgress?.(100);
  return data.signedUrl;
}
