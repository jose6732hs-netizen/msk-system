import { AlertTriangle } from "lucide-react";
import { normalizeLicenseGuides } from "@/lib/license-guides";

export function LicenseGuides({ cmsGuides }: { cmsGuides?: any }) {
  const guides = normalizeLicenseGuides(cmsGuides);
  if (guides.length === 0) return null;

  return (
    <section className="space-y-6 text-left">
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/40 bg-amber-400/[0.06] p-5 shadow-[0_0_60px_rgba(251,191,36,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-amber-400/20 blur-[70px]" />
        <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 animate-pulse place-items-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-300">
              Atenção — leia antes de usar
            </p>
            <h3 className="mt-1 text-xl font-black uppercase tracking-tighter text-white sm:text-2xl">
              Siga os passos de conexão na ordem
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Sua licença está liberada, mas o MSK só funciona 100% depois que você autorizar todas as
              permissões pedidas em cada etapa abaixo.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {guides.map((item, index) => (
          <article
            key={`${item.image}-${index}`}
            className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] transition-colors hover:border-primary/30"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 p-5 sm:p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-sm font-black text-primary ring-1 ring-primary/30">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h4 className="break-words text-lg font-black uppercase tracking-tight text-white">
                  {item.title}
                </h4>
                {item.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-white/50 sm:text-sm">{item.description}</p>
                ) : null}
              </div>
            </div>
            <a
              href={item.image}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-t border-white/5 bg-black/40"
            >
              <img
                src={item.image}
                alt={`Tutorial ${index + 1} — ${item.title}`}
                loading="lazy"
                className="h-auto w-full object-contain"
              />
            </a>
            <div className="border-t border-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/30">
              Toque na imagem para abrir em tamanho real
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
