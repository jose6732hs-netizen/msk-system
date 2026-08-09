import { createFileRoute, Link } from "@tanstack/react-router";
import { MskLogo } from "@/components/msk/logo";
import { Button } from "@/components/ui/button";
import { fetchResellerPage } from "@/lib/public-reseller.functions";

export const Route = createFileRoute("/r/$slug")({
  loader: ({ params }) => fetchResellerPage({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    const name = loaderData?.reseller.name ?? params.slug;
    const title = `${name} · Licenças Lovable MSK`;
    const description = `Compre sua licença da extensão Lovable MSK com ${name}. Ativação imediata e suporte oficial.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-5">
      <p className="text-muted-foreground">Não foi possível carregar esta página.</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-5">
      <p className="text-muted-foreground">Revendedor não encontrado.</p>
    </main>
  ),
  component: ResellerPublicPage,
});

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResellerPublicPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <p className="text-muted-foreground">Revendedor não encontrado.</p>
      </main>
    );
  }

  const branding = data.branding as Record<string, any> | null;
  const primary = branding?.["primary_color"] ?? undefined;

  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <header className="text-center">
        <div className="flex justify-center"><MskLogo /></div>
        <h1 className="mt-6 font-display text-4xl neon-text" style={primary ? { color: primary } : undefined}>
          {branding?.["extension_name"] ?? data.reseller.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {branding?.["description"] ??
            "Revendedor autorizado da extensão Lovable MSK. Compre com ativação imediata."}
        </p>
        {data.latestVersion && (
          <p className="mt-2 text-xs text-muted-foreground">Versão atual: {data.latestVersion}</p>
        )}
      </header>

      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {(data.plans as Record<string, any>[]).map((plan) => (
          <article key={plan["id"]} className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl">{plan["name"]}</h2>
            <p className="mt-2 text-3xl neon-text">{brl(plan["price"])}</p>
            <p className="text-xs text-muted-foreground">
              {plan["is_lifetime"] ? "Acesso vitalício" : plan["duration_label"]}
            </p>
            <Button variant="neon" className="mt-5 w-full" asChild>
              <Link to="/planos" search={{ rv: data.reseller.code } as never}>
                Assinar agora
              </Link>
            </Button>
          </article>
        ))}
      </section>

      <footer className="mt-16 text-center text-xs text-muted-foreground">
        Suporte:{" "}
        {branding?.["support_url"] ? (
          <a className="text-primary" href={branding["support_url"]}>
            {branding["support_url"]}
          </a>
        ) : (
          "contate seu revendedor"
        )}
      </footer>
    </main>
  );
}
