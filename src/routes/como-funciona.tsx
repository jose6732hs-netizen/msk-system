import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";
import { Play, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/msk/site-header";
import { SiteFooter } from "@/components/msk/site-footer";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como Funciona — MSK SISTEM" },
      {
        name: "description",
        content: "Aprenda a utilizar todo o potencial da MSK SISTEM com nossos tutoriais em vídeo.",
      },
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

  const videos = cms?.tutorials?.videos || [];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase neon-text">
            Como Funciona
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-medium">
            Assista aos vídeos abaixo para entender como dominar a ferramenta e ter resultados ilimitados.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {videos.length > 0 ? (
            videos.map((video: any, i: number) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-3xl overflow-hidden border border-white/10 group"
              >
                <div className="aspect-video bg-black/40 relative flex items-center justify-center">
                   {video.url.includes('youtube.com') || video.url.includes('youtu.be') ? (
                     <iframe
                        src={video.url.replace('watch?v=', 'embed/')}
                        className="w-full h-full"
                        allowFullScreen
                     />
                   ) : video.url.includes('vimeo.com') ? (
                     <iframe
                        src={video.url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                        className="w-full h-full"
                        allowFullScreen
                     />
                   ) : (
                     <video src={video.url} controls className="w-full h-full object-cover" />
                   )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold uppercase tracking-tighter mb-2">{video.title}</h3>
                  <p className="text-white/60 text-sm">{video.description}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center glass rounded-3xl border border-white/5">
              <Play className="mx-auto h-12 w-12 text-white/20 mb-4" />
              <p className="text-white/40">Nenhum tutorial disponível no momento.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}