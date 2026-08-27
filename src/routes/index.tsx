import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { Button } from "@/components/ui/button";
import { HeroCarousel } from "@/components/msk/hero-carousel";
import { HeroScene3D } from "@/components/msk/hero-scene-3d";
import { getCmsContent } from "@/lib/cms.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MSK SISTEM — Sua Assistente Premium para Lovable" },
      {
        name: "description",
        content: "A plataforma definitiva para gerenciar licenças, dispositivos e otimizar seu fluxo de trabalho com a MSK Suite.",
      },
      { property: "og:image", content: "https://msksystem.online/social-image.png" },
      { name: "twitter:image", content: "https://msksystem.online/social-image.png" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Index,
});

const benefits = [
  { title: "Créditos infinitos", desc: "Use sem medo de acabar" },
  { title: "Fluxo contínuo", desc: "Criação sem interrupções" },
  { title: "Mais entrega", desc: "Mais projetos no mesmo tempo" },
  { title: "Menos estresse", desc: "Foco total na execução" },
];

const partnerBenefits = [
  "Ganhos de até 60%",
  "Painel em tempo real",
  "Materiais prontos",
  "Suporte dedicado",
];

function Index() {
  const getCms = useServerFn(getCmsContent);
  const { data } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const cms = (data ?? {}) as Record<string, any>;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-background text-foreground">
      <SiteHeader />

      <main className="relative flex-1 overflow-x-hidden">
        <section className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:pt-12 lg:px-8">
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] max-w-[90vw] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

          <div className="relative z-10 grid min-w-0 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="min-w-0 space-y-6">
              <div className="w-full min-w-0">
                <HeroCarousel />
              </div>

              <h1 className="break-words bg-gradient-to-b from-primary to-primary/40 bg-clip-text py-2 text-center text-3xl font-black uppercase leading-[0.98] tracking-tighter text-transparent sm:text-5xl lg:text-left lg:text-7xl">
                {cms["hero"]?.title || "Pare de ser interrompido no meio da criação"}
              </h1>

              <p className="mx-auto max-w-xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0 lg:text-left">
                {cms["hero"]?.subtitle ||
                  "Acesso completo à extensão Lovable com créditos infinitos. Crie apps, landing pages e sistemas o dia inteiro sem travar, sem contar crédito e sem perder o ritmo."}
              </p>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button asChild variant="neon" size="lg" className="min-h-14 w-full whitespace-normal text-center sm:w-auto">
                  <Link to={cms["hero"]?.cta_link || "/auth"}>
                    {cms["hero"]?.cta_text || "Quero créditos infinitos agora"}
                  </Link>
                </Button>
                <Button asChild variant="neonOutline" size="lg" className="min-h-14 w-full whitespace-normal text-center sm:w-auto">
                  <Link to="/planos" preload="intent">Ver Planos e Preços</Link>
                </Button>
              </div>
            </div>

            <div className="min-h-[280px] min-w-0 sm:min-h-[360px] lg:min-h-[620px]">
              <HeroScene3D />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl space-y-14 px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center sm:p-10">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 bg-primary/10 blur-3xl" />
            <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-primary">
              PARA AFILIADOS E EMPRESAS
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tighter sm:text-4xl">
              {cms["partners_teaser"]?.title || "Revenda e ganhe comissões recorrentes"}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {cms["partners_teaser"]?.subtitle ||
                "Entre para o programa de parceiros Infinity e transforme sua audiência em renda. Estrutura simples, pagamentos via PIX e suporte total."}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-left min-[390px]:grid-cols-2 md:grid-cols-4">
              {partnerBenefits.map((text) => (
                <div key={text} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/5 bg-black/10 p-3 text-sm font-bold">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <span className="break-words">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="neon" size="lg"><Link to="/parceiros">Quero participar</Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/parceiros">Ver detalhes</Link></Button>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold uppercase tracking-tighter sm:text-3xl">
              A diferença não é talento. A diferença é não ter limite.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Enquanto a maioria para no meio do fluxo porque os créditos acabaram, quem tem acesso ilimitado continua criando, testando e entregando.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
            <div className="rounded-[2rem] border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <h2 className="text-2xl font-bold uppercase tracking-tighter text-primary sm:text-3xl">Você já passou por isso?</h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <p>Está no meio de um projeto promissor e os créditos acabam. A ideia estava fluindo… e de repente trava.</p>
                <p>Você perde o ritmo, precisa esperar, pagar novamente ou parar a entrega.</p>
                <p className="font-semibold text-foreground">A proposta do MSK é manter seu fluxo de criação contínuo.</p>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <h3 className="text-xl font-bold uppercase tracking-tighter">O Preço Invisível</h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Cada interrupção custa tempo, energia e oportunidade. Uma experiência estável precisa funcionar do celular ao desktop sem travar sua navegação.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold uppercase tracking-tighter text-primary">Liberdade Total para Criar</h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">Use quando precisar, com uma interface preparada para diferentes tamanhos de tela.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <h4 className="text-lg font-bold">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[2rem] border border-green-500/20 bg-green-500/5 p-6 sm:p-8">
              <h3 className="text-xl font-bold uppercase tracking-tighter text-green-500">É para você se:</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• Usa ou quer usar o Lovable com frequência</li>
                <li>• Precisa criar com velocidade e consistência</li>
                <li>• Quer acessar o serviço em celular e computador</li>
              </ul>
            </div>
            <div className="rounded-[2rem] border border-red-500/20 bg-red-500/5 p-6 sm:p-8">
              <h3 className="text-xl font-bold uppercase tracking-tighter text-red-500">Não é para você se:</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• Usa o Lovable só de vez em quando</li>
                <li>• Não precisa de fluxo contínuo</li>
                <li>• Prefere continuar limitado</li>
              </ul>
            </div>
          </div>

          <div className="rounded-[2rem] border border-primary/20 bg-primary/10 p-6 text-center sm:p-10">
            <h2 className="text-2xl font-bold uppercase tracking-tighter sm:text-3xl">As vagas são controladas.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Mantemos um número controlado de acessos para preservar a estabilidade do serviço.
            </p>
            <Button asChild variant="neon" size="lg" className="mt-7 min-h-14 w-full whitespace-normal text-center sm:w-auto">
              <Link to="/auth">Quero meu acesso agora</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
