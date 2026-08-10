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

  const videos = cms?.['tutorials']?.videos || [];

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
                className="glass rounded-3xl overflow-hidden border border-white/10 group flex flex-col"
              >
                <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
                   {video.is_redirect ? (
                     <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-primary/5">
                        <Play className="w-12 h-12 text-primary animate-pulse" />
                        <a 
                          href={video.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-primary text-black font-black uppercase text-xs rounded-full hover:scale-105 transition-transform"
                        >
                          Assistir Agora
                        </a>
                     </div>
                   ) : (video.url.includes('youtube.com') || video.url.includes('youtu.be')) ? (
                     <iframe
                        src={video.url.replace('watch?v=', 'embed/').split('&')[0]}
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
                     <div className="w-full h-full relative group/video">
                       <video 
                         src={video.url} 
                         controls 
                         className="w-full h-full object-cover custom-video-player"
                         controlsList="nodownload"
                       />
                       <style>{`
                         .custom-video-player::-webkit-media-controls-panel {
                           background: linear-gradient(transparent, rgba(0,0,0,0.8));
                         }
                         .custom-video-player::-webkit-media-controls-play-button,
                         .custom-video-player::-webkit-media-controls-current-time-display,
                         .custom-video-player::-webkit-media-controls-time-remaining-display,
                         .custom-video-player::-webkit-media-controls-timeline,
                         .custom-video-player::-webkit-media-controls-volume-control-container,
                         .custom-video-player::-webkit-media-controls-fullscreen-button {
                           filter: invert(36%) sepia(85%) saturate(3500%) hue-rotate(260deg) brightness(90%) contrast(100%);
                         }
                       `}</style>
                     </div>
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