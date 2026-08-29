import tutorialLovable from "@/assets/tutorial-lovable-cloud.png.asset.json";
import tutorialGithub from "@/assets/tutorial-github.png.asset.json";
import tutorialSupabase from "@/assets/tutorial-supabase.png.asset.json";

export type LicenseGuide = {
  title: string;
  description?: string;
  image: string;
};

export const DEFAULT_LICENSE_GUIDES: LicenseGuide[] = [
  {
    title: "Conectar o Lovable Cloud",
    description: "Primeiro passo obrigatório: autorize a conta Lovable Cloud dentro do MSK Agente.",
    image: tutorialLovable.url,
  },
  {
    title: "Autorização correta do GitHub",
    description: "Libere leitura e escrita nos repositórios para o agente conseguir editar seu projeto.",
    image: tutorialGithub.url,
  },
  {
    title: "Conectar o Supabase no chat",
    description: "Autorize todas as permissões do banco para consultas, tabelas e Edge Functions.",
    image: tutorialSupabase.url,
  },
];

/** Reads the CMS `license_guides` key, falling back to the built-in guides. */
export function normalizeLicenseGuides(raw: any): LicenseGuide[] {
  const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : null;
  if (!list) return DEFAULT_LICENSE_GUIDES;
  const guides = list
    .filter((item: any) => item && (item.image || item.title))
    .map((item: any) => ({
      title: String(item.title ?? ""),
      description: item.description ? String(item.description) : "",
      image: String(item.image ?? item.url ?? ""),
    }))
    .filter((item: LicenseGuide) => item.image);
  return guides.length > 0 ? guides : DEFAULT_LICENSE_GUIDES;
}

/** True when at least one license is currently usable (active or awaiting activation). */
export function hasUsableLicense(licenses: any[]): boolean {
  return licenses.some((item) => {
    const status = String(item?.status ?? "").toLowerCase();
    if (status === "expired" || status === "revoked" || status === "suspended") return false;
    return status === "active" || status === "inactive" || status === "pending";
  });
}
