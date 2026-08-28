export function productImageFallback(slugValue?: unknown) {
  const slug = String(slugValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (slug.startsWith("msk-agent") || slug.startsWith("msk-agente")) {
    if (/^msk-agent(?:e)?-3(?:-|$)/.test(slug)) return "/agent-offers/agent-3.jpg";
    if (/^msk-agent(?:e)?-2(?:-|$)/.test(slug)) return "/agent-offers/agent-2.jpg";
    if (/^msk-agent(?:e)?-1(?:-|$)/.test(slug)) return "/agent-offers/agent-1.jpg";
    return "/msk-agente-banner.svg";
  }

  if (slug.startsWith("page-cloner") || slug.includes("clonagem") || slug.includes("clonador")) {
    if (slug.includes("month") || slug.includes("mensal")) return "/cloner-offers/cloner-monthly.webp";
    if (slug.includes("week") || slug.includes("semanal")) return "/cloner-offers/cloner-weekly.webp";
    return "/cloner-offers/cloner-daily.webp";
  }

  return "/favicon.png";
}

export function normalizeProductImage(imageValue?: unknown, slugValue?: unknown) {
  const value = String(imageValue ?? "").trim();
  const fallback = productImageFallback(slugValue);
  if (!value) return fallback;

  // URLs temporárias do editor Lovable e blobs locais não sobrevivem no site publicado.
  if (value.startsWith("blob:") || value.startsWith("/__l5e/assets-v1/")) return fallback;

  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/") || value.startsWith("/")) {
    return value;
  }

  return fallback;
}
