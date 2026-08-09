import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "API de Licenciamento — MSK SISTEM" },
      {
        name: "description",
        content:
          "Documentação interativa (OpenAPI/Swagger) da API pública de licenciamento da extensão MSK SISTEM.",
      },
      { property: "og:title", content: "API de Licenciamento — MSK SISTEM" },
      {
        property: "og:description",
        content: "Referência completa dos endpoints de licença, dispositivos e status da extensão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      const ui = (window as unknown as { SwaggerUIBundle?: (o: unknown) => void })
        .SwaggerUIBundle;
      ui?.({ url: "/api/public/openapi", dom_id: "#swagger", docExpansion: "list" });
    };
    document.body.appendChild(script);

    return () => {
      css.remove();
      script.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-background/50">
      <header className="border-b border-primary/20 px-6 py-6">
        <h1 className="font-display text-2xl text-foreground">API de Licenciamento</h1>
        <p className="text-sm text-muted-foreground">
          Especificação OpenAPI 3.1 —{" "}
          <a className="text-primary underline" href="/api/public/openapi">
            /api/public/openapi
          </a>
        </p>
      </header>
      <div id="swagger" className="bg-white" />
    </main>
  );
}