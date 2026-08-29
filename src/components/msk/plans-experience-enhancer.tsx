import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function pauseForInteraction(el: HTMLElement, ms = 7000) {
  el.dataset["mskPauseUntil"] = String(Date.now() + ms);
}

function paused(el: HTMLElement) {
  return Number(el.dataset["mskPauseUntil"] ?? 0) > Date.now();
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sectionForSlug(slug: string) {
  if (slug.startsWith("msk-agent")) return "msk-agente";
  if (slug.startsWith("page-cloner")) return "clonagem-msk";
  return "extensao-msk";
}

export function PlansExperienceEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== "/planos") return;

    const timers: number[] = [];
    let raf = 0;
    let sharedLookupStarted = false;
    let sharedPlan: { name: string; slug: string } | null = null;
    let focusedSharedOffer = "";

    const sharedOffer = new URLSearchParams(window.location.search).get("offer")?.trim() ?? "";

    const bindInteraction = (el: HTMLElement) => {
      if (el.dataset["mskInteractionBound"] === "1") return;
      el.dataset["mskInteractionBound"] = "1";
      const pause = () => pauseForInteraction(el);
      el.addEventListener("pointerdown", pause, { passive: true });
      el.addEventListener("touchstart", pause, { passive: true });
      el.addEventListener("wheel", pause, { passive: true });
    };

    const styleBanner = (section: HTMLElement) => {
      const wrapper = section.firstElementChild as HTMLElement | null;
      if (!wrapper) return null;

      wrapper.style.minHeight = "0";
      wrapper.style.overflow = "visible";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.gap = "18px";
      wrapper.style.border = "0";
      wrapper.style.background = "transparent";
      wrapper.style.borderRadius = "0";

      const directChildren = Array.from(wrapper.children) as HTMLElement[];
      const baseImage = directChildren.find((child) => child.tagName === "IMG") as HTMLImageElement | undefined;
      const gradient = directChildren.find((child) => child.className?.includes?.("bg-gradient-to-r"));
      const textLayer = directChildren.find((child) => child.className?.includes?.("z-10"));

      if (gradient) gradient.style.display = "none";

      if (textLayer) {
        textLayer.style.position = "relative";
        textLayer.style.inset = "auto";
        textLayer.style.minHeight = "0";
        textLayer.style.padding = "0";
        textLayer.style.order = "1";
        textLayer.style.alignItems = "flex-start";
        textLayer.style.zIndex = "1";
      }

      if (baseImage) {
        baseImage.style.position = "relative";
        baseImage.style.inset = "auto";
        baseImage.style.order = "2";
        baseImage.style.display = "block";
        baseImage.style.width = "100%";
        baseImage.style.height = "auto";
        baseImage.style.maxHeight = "420px";
        baseImage.style.objectFit = "contain";
        baseImage.style.borderRadius = "22px";
        baseImage.style.background = "#080808";
        baseImage.style.border = "1px solid rgba(255,255,255,.10)";
      }

      return { wrapper, baseImage };
    };

    const enhancePlanCarousel = (section: HTMLElement) => {
      const carousel = section.querySelector<HTMLElement>("[id$='-carousel']");
      if (!carousel) return;

      carousel.style.touchAction = "pan-x pan-y";
      carousel.style.overscrollBehaviorX = "contain";
      carousel.style.scrollBehavior = "smooth";
      bindInteraction(carousel);

      carousel.querySelectorAll<HTMLImageElement>("article img").forEach((img) => {
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";
        const holder = img.parentElement as HTMLElement | null;
        if (holder) {
          holder.style.display = "flex";
          holder.style.alignItems = "center";
          holder.style.justifyContent = "center";
          holder.style.background = "#050505";
          holder.style.padding = "10px";
        }
      });

      if (carousel.dataset["mskAutoPlay"] === "1") return;
      carousel.dataset["mskAutoPlay"] = "1";

      const timer = window.setInterval(() => {
        if (!carousel.isConnected || document.hidden || paused(carousel)) return;
        const card = carousel.querySelector<HTMLElement>("article");
        if (!card) return;
        const step = card.offsetWidth + 16;
        const nearEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - step * 0.6;
        carousel.scrollTo({ left: nearEnd ? 0 : carousel.scrollLeft + step, behavior: "smooth" });
      }, 4200);
      timers.push(timer);
    };

    const enhanceAgentBanner = (section: HTMLElement) => {
      // O banner da seção MSK Agente usa SEMPRE a imagem oficial configurada
      // no painel (plans_agent_banner). Nunca substituir por imagens das ofertas.
      const styled = styleBanner(section);
      if (!styled) return;
      const { wrapper, baseImage } = styled;

      // Remove um eventual carrossel antigo montado com imagens de ofertas.
      const legacy = wrapper.querySelector<HTMLElement>("[data-msk-agent-banner-carousel]");
      legacy?.remove();

      if (baseImage) baseImage.style.display = "block";
    };

    const putAgentFirst = () => {
      const extension = document.getElementById("extensao-msk") as HTMLElement | null;
      const agent = document.getElementById("msk-agente") as HTMLElement | null;
      if (!extension || !agent || extension.parentElement !== agent.parentElement) return;
      if (agent.nextElementSibling === extension) return;
      extension.parentElement?.insertBefore(agent, extension);
    };

    const focusSharedOffer = () => {
      if (!sharedPlan || focusedSharedOffer === sharedPlan.slug) return;
      const section = document.getElementById(sectionForSlug(sharedPlan.slug)) as HTMLElement | null;
      if (!section) return;

      const wantedName = normalizeText(sharedPlan.name);
      const cards = Array.from(section.querySelectorAll<HTMLElement>("article"));
      const target = cards.find((card) => normalizeText(card.textContent).includes(wantedName));
      if (!target) return;

      focusedSharedOffer = sharedPlan.slug;
      const safeSlug = sharedPlan.slug.replace(/[^a-zA-Z0-9_-]/g, "-");
      target.id = `oferta-${safeSlug}`;
      target.dataset["mskSharedOffer"] = "1";
      target.style.borderColor = "rgba(57,255,20,.95)";
      target.style.boxShadow = "0 0 0 2px rgba(57,255,20,.25), 0 0 55px rgba(57,255,20,.22)";
      target.style.transition = "border-color .25s ease, box-shadow .25s ease";
      target.style.scrollMarginTop = "120px";

      const carousel = target.closest<HTMLElement>("[id$='-carousel']");
      if (carousel) pauseForInteraction(carousel, 15_000);

      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }, 180);
    };

    const enhanceAll = () => {
      putAgentFirst();

      const extension = document.getElementById("extensao-msk") as HTMLElement | null;
      const cloner = document.getElementById("clonagem-msk") as HTMLElement | null;
      const agent = document.getElementById("msk-agente") as HTMLElement | null;

      [extension, cloner].forEach((section) => {
        if (!section) return;
        styleBanner(section);
        enhancePlanCarousel(section);
      });

      if (agent) {
        enhanceAgentBanner(agent);
        enhancePlanCarousel(agent);
      }

      focusSharedOffer();
    };

    const scheduleEnhance = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(enhanceAll);
    };

    const resolveSharedOffer = async () => {
      if (!sharedOffer || sharedLookupStarted) return;
      sharedLookupStarted = true;

      const bySlug = await supabase
        .from("plans")
        .select("id,name,slug")
        .eq("slug", sharedOffer)
        .maybeSingle();
      let data = bySlug.data;

      if (!data && /^[0-9a-f-]{36}$/i.test(sharedOffer)) {
        const byId = await supabase
          .from("plans")
          .select("id,name,slug")
          .eq("id", sharedOffer)
          .maybeSingle();
        data = byId.data;
      }

      if (data?.name && data?.slug) {
        sharedPlan = { name: String(data.name), slug: String(data.slug) };
        scheduleEnhance();
      }
    };

    enhanceAll();
    void resolveSharedOffer();

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearInterval(timer));
    };
  }, []);

  return null;
}
