import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";
import { Play } from "lucide-react";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";
import { TutorialPlayer } from "@/components/msk/tutorial-player";
import { normalizeTutorials } from "@/lib/tutorials";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como Funciona — MSK SISTEM" },
      {
        name: "description",
        content: "Aprenda a utilizar todo o potencial da MSK SISTEM com nossos tutoriais em vídeo.",
      },
      { property: "og:title", content: "Como funciona — MSK SISTEM" },
      { property: "og:description", content: "Tutoriais em vídeo para dominar a extensão MSK SISTEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  const getCms = useServerFn(getCmsContent);
  const { data: cms } = useQuery({
    queryKey: ["cms-content"],
    queryFn: () => getCms(),
  });

  const sections = normalizeTutorials(cms?.["tutorials"]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14 space-y-4 text-center"
        >
          <h1 className="text-4xl font-black uppercase tracking-tighter neon-text md:text-6xl">
            Como Funciona
          </h1>
          <p className="mx-auto max-w-2xl text-base font-medium text-white/60 sm:text-xl">
            Assista aos vídeos abaixo para entender como dominar a ferramenta e ter resultados ilimitados.
          </p>
        </motion.div>

        {sections.length === 0 ? (
          <div className="glass rounded-3xl border border-white/5 py-20 text-center">
            <Play className="mx-auto mb-4 h-12 w-12 text-white/20" />
            <p className="text-white/40">Nenhum tutorial disponível no momento.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {sections.map((section, si) => (
              <section key={si} className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter sm:text-4xl">
                    {section.title || `Etapa ${si + 1}`}
                  </h2>
                  {section.description && (
                    <p className="max-w-3xl text-sm text-white/50 sm:text-base">{section.description}</p>
                  )}
                  <div className="h-1 w-16 rounded-full bg-primary" />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {section.videos.map((video, i) => (
                    <motion.article
                      key={i}
                      initial={{ opacity: 0, scale: 0.97 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="glass flex flex-col overflow-hidden rounded-3xl border border-white/10"
                    >
                      <div className="aspect-video bg-black/40">
                        <TutorialPlayer video={video} />
                      </div>
                      <div className="space-y-1 p-5">
                        <h3 className="text-base font-bold uppercase tracking-tighter">{video.title}</h3>
                        {video.description && <p className="text-sm text-white/60">{video.description}</p>}
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
