import { Image as ImageIcon, MessageCircle, Palette, Trophy } from "lucide-react";
import { DEFAULT_LANDING_BANNERS, DEFAULT_PANEL_BANNERS, SITE_IMAGE_SLOTS } from "@/lib/site-images";

type Section =
  | "hero"
  | "banners"
  | "panel"
  | "images"
  | "partners"
  | "features"
  | "copy"
  | "branding"
  | "tutorials"
  | "awards"
  | "splits"
  | "recovery";

type BannerItem = { url?: string; alt?: string; active?: boolean; order?: number };

function text(value: unknown, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function PreviewEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
      <div>
        <ImageIcon className="mx-auto h-7 w-7 text-white/20" />
        <p className="mt-3 text-xs font-bold text-white/50">{children}</p>
      </div>
    </div>
  );
}

function BannerPreview({ banners }: { banners: BannerItem[] }) {
  const active = [...banners]
    .filter((banner) => banner.active !== false && Boolean(banner.url))
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  if (!active.length) return <PreviewEmpty>Nenhum banner ativo nesta etapa.</PreviewEmpty>;

  return (
    <div className="space-y-3">
      {active.map((banner, index) => (
        <div key={`${banner.url}-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <img src={banner.url} alt={banner.alt || `Banner ${index + 1}`} className="aspect-video w-full object-cover" />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="truncate text-[0.6rem] font-bold text-white/60">{banner.alt || `Banner ${index + 1}`}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.5rem] font-black uppercase text-emerald-400">Ativo</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <div className="mt-1 break-words text-sm font-black text-white">{value}</div>
    </div>
  );
}

export function AdminLivePreview({
  activeSection,
  settings,
  initialSettings,
}: {
  activeSection: Section;
  settings: any;
  initialSettings?: any;
}) {
  const current = settings ?? {};
  const initial = initialSettings ?? {};
  const hero = { ...(initial.hero ?? {}), ...(current.hero ?? {}) };
  const partners = { ...(initial.partners_teaser ?? {}), ...(current.partners_teaser ?? {}) };
  const branding = { ...(initial.branding ?? {}), ...(current.branding ?? {}) };
  const awards = { ...(initial.awards ?? {}), ...(current.awards ?? {}) };
  const config = { ...(initial.config ?? {}), ...(current.config ?? {}) };
  const splits = { ...(initial.splits ?? {}), ...(current.splits ?? {}) };
  const recovery = {
    ...(initial.recovery_messages ?? {}),
    ...(current.recovery_messages ?? {}),
    ...((current.recovery_messages?.value && typeof current.recovery_messages.value === "object")
      ? current.recovery_messages.value
      : {}),
  };

  if (activeSection === "hero") {
    return (
      <div className="space-y-5">
        <div className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[0.5rem] font-black uppercase tracking-widest text-primary">
          Visualização ao vivo
        </div>
        <h1 className="text-3xl font-black leading-[0.98] text-white">
          {text(hero.title, "Pare de ser interrompido no meio da criação")}
        </h1>
        <p className="text-sm leading-relaxed text-white/55">
          {text(hero.subtitle, "Acesso completo à extensão com uma experiência contínua.")}
        </p>
        <div className="rounded-xl bg-primary px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.25)]">
          {text(hero.cta_text, "Quero acessar agora")}
        </div>
        {(hero.banners?.length ?? 0) > 0 && (
          <div className="pt-2">
            <BannerPreview banners={hero.banners} />
          </div>
        )}
      </div>
    );
  }

  if (activeSection === "banners") {
    return <BannerPreview banners={(current.hero?.banners ?? initial.hero?.banners ?? DEFAULT_LANDING_BANNERS) as BannerItem[]} />;
  }

  if (activeSection === "panel") {
    return <BannerPreview banners={(current.panel?.banners ?? initial.panel?.banners ?? DEFAULT_PANEL_BANNERS) as BannerItem[]} />;
  }

  if (activeSection === "images") {
    const rows = SITE_IMAGE_SLOTS.map((slot) => ({
      ...slot,
      url: current.site_images?.[slot.key] ?? initial.site_images?.[slot.key] ?? slot.defaultUrl,
    })).filter((slot) => Boolean(slot.url));

    if (!rows.length) return <PreviewEmpty>Nenhuma imagem configurada.</PreviewEmpty>;

    return (
      <div className="grid grid-cols-2 gap-3">
        {rows.map((slot) => (
          <div key={slot.key} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            <div className="grid aspect-[4/3] place-items-center bg-black/30 p-2">
              <img src={slot.url} alt={slot.label} className="max-h-full max-w-full object-contain" />
            </div>
            <p className="truncate px-3 py-2 text-[0.55rem] font-black uppercase tracking-wider text-white/55">{slot.label}</p>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === "partners") {
    return (
      <div className="space-y-5 pt-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <span className="text-xl font-black">%</span>
        </div>
        <h2 className="text-2xl font-black uppercase italic leading-tight text-white">
          {text(partners.title, "Revenda e ganhe comissões recorrentes")}
        </h2>
        <p className="text-xs leading-relaxed text-white/50">
          {text(partners.subtitle, "Entre para o programa de parceiros MSK.")}
        </p>
        <div className="rounded-xl border border-primary/30 px-4 py-3 text-xs font-black uppercase tracking-wider text-primary">Seja um Parceiro</div>
      </div>
    );
  }

  if (activeSection === "branding") {
    const color = text(branding.primary_color, "#39ff14");
    return (
      <div className="space-y-5">
        {branding.banner_url ? (
          <img src={branding.banner_url} alt="Banner da extensão" className="aspect-video w-full rounded-2xl border border-white/10 object-cover" />
        ) : null}
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {branding.icon_url ? <img src={branding.icon_url} alt="Ícone" className="h-full w-full object-cover" /> : <Palette className="h-6 w-6 text-white/25" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{text(branding.brand_name, "MSK SISTEM")}</p>
            <p className="text-[0.55rem] font-bold uppercase tracking-widest text-white/35">Branding da extensão</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <span className="text-[0.6rem] font-black uppercase tracking-wider text-white/40">Cor primária</span>
          <span className="flex items-center gap-2 text-xs font-mono font-bold text-white">
            <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: color }} />
            {color}
          </span>
        </div>
      </div>
    );
  }

  if (activeSection === "awards") {
    const awardKeys = [
      ["award_1k", "Placa 1K"],
      ["award_10k", "Placa 10K"],
      ["award_100k", "Placa 100K"],
      ["award_500k", "Placa 500K"],
      ["award_1m", "Placa 1M"],
      ["award_5m", "Placa 5M"],
    ] as const;

    return (
      <div className="space-y-4">
        {awards.hero_url && <img src={awards.hero_url} alt="Premiações" className="aspect-video w-full rounded-2xl border border-white/10 object-cover" />}
        <div className="grid grid-cols-2 gap-3">
          {awardKeys.map(([key, label]) => (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center">
              <div className="mx-auto grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-black/30">
                {awards[key] ? <img src={awards[key]} alt={label} className="h-full w-full object-contain" /> : <Trophy className="h-6 w-6 text-white/20" />}
              </div>
              <p className="mt-2 text-[0.55rem] font-black uppercase tracking-wider text-white/50">{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === "copy") {
    return (
      <div className="space-y-3 pt-4">
        <InfoCard label="WhatsApp de suporte" value={text(config.support_whatsapp)} />
        <InfoCard label="URL de suporte" value={<span className="text-xs text-primary">{text(config.support_url)}</span>} />
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-black text-emerald-400">
          <MessageCircle className="h-4 w-4" /> Botão de suporte
        </div>
      </div>
    );
  }

  if (activeSection === "recovery") {
    const messages = [
      ["Boas-vindas", recovery.welcome],
      ["Recuperação", recovery.recovery],
      ["Urgência", recovery.urgency],
    ];
    return (
      <div className="space-y-3">
        {messages.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
            <p className="text-[0.5rem] font-black uppercase tracking-widest text-emerald-400/70">{label}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/70">{text(value, "Mensagem ainda não configurada.")}</p>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === "splits") {
    const affSuffix = splits.affiliate_type === "fixed" ? "BRL" : "%";
    const resellerSuffix = splits.reseller_type === "fixed" ? "BRL" : "%";
    return (
      <div className="space-y-4 pt-6">
        <InfoCard label="Comissão padrão afiliados" value={`${text(splits.affiliate_value, "10")} ${affSuffix}`} />
        <InfoCard label="Comissão padrão revendedores" value={`${text(splits.reseller_value, "5")} ${resellerSuffix}`} />
      </div>
    );
  }

  if (activeSection === "tutorials") {
    const tutorialData = current.tutorials ?? initial.tutorials ?? {};
    const sections = Array.isArray(tutorialData) ? tutorialData : tutorialData.sections ?? [];
    if (!sections.length) return <PreviewEmpty>Nenhum tutorial cadastrado.</PreviewEmpty>;
    return (
      <div className="space-y-3">
        {sections.map((section: any, index: number) => (
          <div key={section.id ?? index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black text-white">{text(section.title ?? section.name, `Tutorial ${index + 1}`)}</p>
            {section.description && <p className="mt-1 text-[0.65rem] text-white/45">{section.description}</p>}
            {Array.isArray(section.items) && <p className="mt-2 text-[0.55rem] font-bold uppercase tracking-wider text-primary">{section.items.length} item(ns)</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InfoCard label="Etapa ativa" value={activeSection} />
      <PreviewEmpty>Esta etapa não possui uma composição visual específica, mas os dados continuam sendo salvos normalmente.</PreviewEmpty>
    </div>
  );
}
