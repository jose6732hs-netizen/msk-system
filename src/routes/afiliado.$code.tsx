import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MskLogo } from "@/components/msk/logo";
import { trackAffiliateVisit } from "@/lib/affiliate.functions";
import { getVisitorId, paths, storeAffiliateRef } from "@/lib/urls";

export const Route = createFileRoute("/afiliado/$code")({
  head: ({ params }) => {
    const title = "Convite exclusivo — MSK SISTEM";
    const description = `Você foi convidado por um parceiro (${params.code}) para ativar a extensão MSK SISTEM com licença imediata.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: AffiliateLanding,
});

function AffiliateLanding() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const ref = code.toUpperCase();
    storeAffiliateRef(ref);
    const visitorId = getVisitorId();
    
    // Capturar UTMs da URL
    const searchParams = new URLSearchParams(window.location.search);
    const utm = {
      source: searchParams.get('utm_source'),
      medium: searchParams.get('utm_medium'),
      campaign: searchParams.get('utm_campaign'),
      content: searchParams.get('utm_content'),
      term: searchParams.get('utm_term'),
    };

    trackAffiliateVisit({
      data: {
        code: ref,
        visitorId,
        landingPath: window.location.pathname,
        referer: document.referrer.slice(0, 300),
        utm,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      },
    }).catch(() => undefined);
    const timer = setTimeout(() => navigate({ to: paths.plans, search: { ref } as any }), 700);
    return () => clearTimeout(timer);
  }, [code, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
      <MskLogo size={44} />
      <p className="text-sm text-muted-foreground">
        Convite <span className="text-primary">{code.toUpperCase()}</span> reconhecido. Levando você
        aos planos…
      </p>
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </main>
  );
}
