/**
 * Fonte única para identificar PARA QUE serve cada licença.
 * Usado no painel do cliente, na entrega pós-pagamento e no dashboard do super admin,
 * garantindo que uma compra com várias licenças (ex.: oferta + combo) fique separada
 * e identificada item a item.
 */
export type LicenseRole = "cloner" | "agent" | "extension" | "delivery" | "live";

export type LicensePurpose = {
  role: LicenseRole;
  label: string;
  description: string;
  /** Onde o cliente usa esta licença. */
  where: string;
  accent: string;
};

const PURPOSES: Record<LicenseRole, LicensePurpose> = {
  cloner: {
    role: "cloner",
    label: "MSK Clonador",
    description: "Licença do Clonador de Páginas (download do pacote privado).",
    where: "Área de clonagem do site",
    accent: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  },
  agent: {
    role: "agent",
    label: "MSK Agente",
    description: "Licença do assistente MSK Agente na extensão do navegador.",
    where: "Extensão MSK Agente",
    accent: "text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10",
  },
  extension: {
    role: "extension",
    label: "Extensão MSK",
    description: "Licença de créditos ilimitados / MODO MSK na extensão principal.",
    where: "Extensão MSK SISTEM",
    accent: "text-primary border-primary/40 bg-primary/10",
  },
  delivery: {
    role: "delivery",
    label: "Entrega digital",
    description: "Produto digital com liberação e instruções entregues diretamente no painel.",
    where: "Painel MSK",
    accent: "text-blue-300 border-blue-400/40 bg-blue-400/10",
  },
  live: {
    role: "live",
    label: "MSK LIVE",
    description: "Licença exclusiva do produto MSK LIVE para TikTok Live.",
    where: "MSK LIVE",
    accent: "text-primary border-primary/40 bg-primary/10",
  },
};

export function licenseRoleFromSlug(slug?: string | null): LicenseRole {
  const s = String(slug ?? "").toLowerCase();
  if (s.includes("chatgpt") || s.includes("chat-gpt") || s.includes("gpt-plus")) return "delivery";
  if (s === "msk-live" || s.startsWith("msk-live-")) return "live";
  if (s.includes("clon") || s.includes("cloner")) return "cloner";
  if (s.includes("agent")) return "agent";
  return "extension";
}

export function licensePurpose(input: {
  slug?: string | null;
  role?: string | null;
}): LicensePurpose {
  const known = input.role && input.role in PURPOSES ? (input.role as LicenseRole) : null;
  return PURPOSES[known ?? licenseRoleFromSlug(input.slug)];
}

/** Aceita a linha crua da tabela licenses (com plans embutido ou metadata). */
export function purposeForLicense(license: any): LicensePurpose {
  const meta = (license?.metadata ?? {}) as Record<string, unknown>;
  return licensePurpose({
    slug: license?.plans?.slug ?? (meta["plan_slug_snapshot"] as string) ?? null,
    role: (meta["license_role"] as string) ?? null,
  });
}
