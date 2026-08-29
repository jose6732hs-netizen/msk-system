import logoAsset from "@/assets/logo.png.asset.json";
import mainPromoAsset from "@/assets/main-promo.png.asset.json";
import bannerConquista from "@/assets/banner-afiliado-conquista.png.asset.json";
import banner1 from "@/assets/banner1.jpg.asset.json";
import banner2 from "@/assets/banner2.png.asset.json";
import bannerInf from "@/assets/banner_infinite.png.asset.json";
import bannerInt from "@/assets/banner_interrupted.png.asset.json";
import bannerNoC from "@/assets/banner_no_credits.png.asset.json";
import bannerAfiliado from "@/assets/banner-afiliado.png.asset.json";
import bannerAjudaIA from "@/assets/banner-ajuda-ia.png.asset.json";
import bannerOffer from "@/assets/banner-offer.png.asset.json";
import bannerCheap from "@/assets/banner-cheap.jpg.asset.json";
import bannerIlimited from "@/assets/banner-ilimited.jpg.asset.json";
import bannerAgenteMsk from "@/assets/banner-agente-msk-oficial.jpg.asset.json";
import cardDiario from "@/assets/card-diario.jpg.asset.json";
import dailyLicenseCard from "@/assets/daily_license_card.jpg.asset.json";
import awardsHero from "@/assets/awards-hero.png.asset.json";
import award1k from "@/assets/award-1k.png.asset.json";
import award10k from "@/assets/award-10k-new.png.asset.json";
import award100k from "@/assets/award-100k-new.png.asset.json";
import award500k from "@/assets/award-500k.png.asset.json";
import award1m from "@/assets/award-1m.png.asset.json";
import award5m from "@/assets/award-5m.png.asset.json";

export type SiteImageSlot = {
  key: string;
  label: string;
  group: string;
  hint: string;
  defaultUrl: string;
};

/** Todas as imagens usadas no site, editáveis pelo painel admin (chave CMS: site_images). */
export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  { key: "logo", label: "Logo principal", group: "Identidade", hint: "Header, painel e admin", defaultUrl: logoAsset.url },
  { key: "favicon", label: "Favicon", group: "Identidade", hint: "Ícone da aba do navegador", defaultUrl: "/favicon.ico" },

  { key: "hero_main", label: "Promo principal", group: "Landing", hint: "Primeiro banner do carrossel", defaultUrl: mainPromoAsset.url },
  { key: "hero_conquista", label: "Seu resultado tem valor", group: "Landing", hint: "Carrossel da landing", defaultUrl: bannerConquista.url },
  { key: "hero_banner1", label: "Banner 1", group: "Landing", hint: "Carrossel da landing", defaultUrl: banner1.url },
  { key: "hero_banner2", label: "Banner 2", group: "Landing", hint: "Carrossel da landing", defaultUrl: banner2.url },
  { key: "hero_infinite", label: "Créditos infinitos", group: "Landing", hint: "Carrossel da landing", defaultUrl: bannerInf.url },
  { key: "hero_interrupted", label: "Sem interrupções", group: "Landing", hint: "Carrossel da landing", defaultUrl: bannerInt.url },
  { key: "hero_nocredits", label: "Crie sem limites", group: "Landing", hint: "Carrossel da landing", defaultUrl: bannerNoC.url },

  { key: "panel_afiliado", label: "Programa de afiliados", group: "Painel / Tenants", hint: "Carrossel do painel", defaultUrl: bannerAfiliado.url },
  { key: "panel_ajuda_ia", label: "Ajude pessoas com IA", group: "Painel / Tenants", hint: "Carrossel do painel", defaultUrl: bannerAjudaIA.url },

  { key: "plans_extension_banner", label: "Banner — Extensão MSK", group: "Ofertas / Planos", hint: "Banner acima das ofertas da extensão principal", defaultUrl: bannerOffer.url },
  { key: "plans_cloner_banner", label: "Banner — Clonagem", group: "Ofertas / Planos", hint: "Banner acima das ofertas do Clonador MSK", defaultUrl: bannerCheap.url },
  { key: "plans_agent_banner", label: "Banner — MSK Agente", group: "Ofertas / Planos", hint: "Banner acima das ofertas do MSK Agente", defaultUrl: bannerAgenteMsk.url },
  { key: "plans_chatgpt_card", label: "Card — Conta ChatGPT 30 dias", group: "Ofertas / Planos", hint: "Imagem do card da oferta de conta ChatGPT (em breve)", defaultUrl: "" },
  { key: "offer_banner", label: "Banner de oferta", group: "Ofertas / Planos", hint: "Página de planos", defaultUrl: bannerOffer.url },
  { key: "offer_cheap", label: "Banner promocional", group: "Ofertas / Planos", hint: "Página de planos", defaultUrl: bannerCheap.url },
  { key: "offer_ilimited", label: "Banner ilimitado", group: "Ofertas / Planos", hint: "Página de planos", defaultUrl: bannerIlimited.url },
  { key: "card_diario", label: "Card diário", group: "Ofertas / Planos", hint: "Card de plano diário", defaultUrl: cardDiario.url },
  { key: "card_licenca_diaria", label: "Card licença diária", group: "Ofertas / Planos", hint: "Card de licença", defaultUrl: dailyLicenseCard.url },

  { key: "awards_hero", label: "Hero das premiações", group: "Premiações", hint: "Topo da Central de Premiações", defaultUrl: awardsHero.url },
  { key: "award_1k", label: "Placa 1K", group: "Premiações", hint: "Pulseira de silicone", defaultUrl: award1k.url },
  { key: "award_10k", label: "Placa 10K", group: "Premiações", hint: "Barra de ouro", defaultUrl: award10k.url },
  { key: "award_100k", label: "Placa 100K", group: "Premiações", hint: "Rubi natural", defaultUrl: award100k.url },
  { key: "award_500k", label: "Placa 500K", group: "Premiações", hint: "Safira azul", defaultUrl: award500k.url },
  { key: "award_1m", label: "Placa 1M", group: "Premiações", hint: "Diamante brilhante", defaultUrl: award1m.url },
  { key: "award_5m", label: "Placa 5M", group: "Premiações", hint: "Diamante raro", defaultUrl: award5m.url },
];

export const SITE_IMAGE_GROUPS = Array.from(new Set(SITE_IMAGE_SLOTS.map((s) => s.group)));

/** Banners padrão do carrossel da landing (usados como fallback e no botão "importar do site"). */
export const DEFAULT_LANDING_BANNERS = [
  { url: mainPromoAsset.url, alt: "Crie sites sem limitações", active: true, order: 0 },
  { url: bannerConquista.url, alt: "Seu resultado tem valor", active: true, order: 1 },
  { url: banner1.url, alt: "Banner 1", active: true, order: 2 },
  { url: banner2.url, alt: "Banner 2", active: true, order: 3 },
  { url: bannerInf.url, alt: "Créditos Infinitos", active: true, order: 4 },
  { url: bannerInt.url, alt: "Sem Interrupções", active: true, order: 5 },
  { url: bannerNoC.url, alt: "Crie sem Limites", active: true, order: 6 },
  { url: bannerAfiliado.url, alt: "Programa de Afiliados MSK", active: true, order: 7 },
  { url: bannerAjudaIA.url, alt: "Ajude pessoas a criar com IA", active: true, order: 8 },
];

/** Banners padrão exclusivos do painel dos tenants. */
export const DEFAULT_PANEL_BANNERS = [
  { url: mainPromoAsset.url, alt: "Crie sites sem limitações", active: true, order: 0 },
  { url: bannerConquista.url, alt: "Seu resultado tem valor", active: true, order: 1 },
  { url: bannerAfiliado.url, alt: "Programa de Afiliados MSK", active: true, order: 2 },
  { url: bannerAjudaIA.url, alt: "Ajude pessoas a criar com IA", active: true, order: 3 },
];

export function resolveSiteImage(settings: any, key: string): string {
  const fromCms = settings?.site_images?.[key];
  if (typeof fromCms === "string" && fromCms.trim()) return fromCms;
  return SITE_IMAGE_SLOTS.find((s) => s.key === key)?.defaultUrl ?? "";
}
