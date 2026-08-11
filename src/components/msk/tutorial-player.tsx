import { Play } from "lucide-react";
import { embedUrl, type TutorialVideo } from "@/lib/tutorials";

export function TutorialPlayer({ video }: { video: TutorialVideo }) {
  const url = video?.url ?? "";

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/40">
        <Play className="h-10 w-10 text-white/20" />
      </div>
    );
  }

  if (video.is_redirect) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-primary/5">
        <Play className="h-10 w-10 animate-pulse text-primary" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-primary px-6 py-2 text-xs font-black uppercase text-primary-foreground transition-transform hover:scale-105"
        >
          Assistir agora
        </a>
      </div>
    );
  }

  const embed = embedUrl(url);
  if (embed) {
    return (
      <iframe
        src={embed}
        className="h-full w-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        title={video.title || "Tutorial"}
      />
    );
  }

  return (
    <video
      src={url}
      controls
      preload="metadata"
      playsInline
      controlsList="nodownload"
      className="h-full w-full bg-black object-contain"
    />
  );
}
