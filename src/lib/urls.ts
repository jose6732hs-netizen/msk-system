/**
 * Fonte única de verdade para caminhos e URLs do sistema.
 * Nada de domínio fixo espalhado pelo código: sempre use `buildUrl`.
 */
export const AFFILIATE_REF_KEY = "msk_ref";
export const RESELLER_REF_KEY = "msk_rv";
export const VISITOR_KEY = "msk_vid";

/** Caminhos internos da aplicação. */
export const paths = {
  home: "/",
  auth: "/auth",
  plans: "/planos",
  checkout: "/planos",
  docs: "/documentacao",
  panel: "/painel",
  admin: "/admin",
  affiliate: "/afiliado",
  reseller: "/revendedor",
  affiliateLink: (code: string) => `/afiliado/${code}`,
  resellerPage: (slug: string) => `/r/${slug}`,
} as const;

/** Concatena base + caminho sem barras duplicadas. */
export function buildUrl(base: string | null | undefined, path = "/") {
  const origin = (base ?? "").replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

export function affiliateLink(base: string | null | undefined, code: string) {
  return buildUrl(base, paths.affiliateLink(code.toUpperCase()));
}

/** Base do lado do cliente: usa o domínio configurado ou o origin atual. */
export function clientBase(configured?: string | null) {
  if (configured) return configured.replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Gera/recupera o identificador anônimo do visitante (rastreio de indicação). */
export function getVisitorId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function storeAffiliateRef(code: string) {
  if (typeof window === "undefined" || !code) return;
  const value = code.toUpperCase();
  localStorage.setItem(AFFILIATE_REF_KEY, value);
  sessionStorage.setItem(AFFILIATE_REF_KEY, value);
  document.cookie = `${AFFILIATE_REF_KEY}=${value};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
}

export function readAffiliateRef() {
  if (typeof window === "undefined") return null;
  const fromStorage =
    sessionStorage.getItem(AFFILIATE_REF_KEY) ?? localStorage.getItem(AFFILIATE_REF_KEY);
  if (fromStorage) return fromStorage;
  const match = document.cookie.match(new RegExp(`${AFFILIATE_REF_KEY}=([^;]+)`));
  return match?.[1] ?? null;
}

export function storeResellerRef(code: string) {
  if (typeof window === "undefined" || !code) return;
  const value = code.toUpperCase();
  localStorage.setItem(RESELLER_REF_KEY, value);
  sessionStorage.setItem(RESELLER_REF_KEY, value);
}

export function readResellerRef() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RESELLER_REF_KEY) ?? localStorage.getItem(RESELLER_REF_KEY);
}
