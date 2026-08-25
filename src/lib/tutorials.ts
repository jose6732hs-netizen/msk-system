export type TutorialVideo = {
  title?: string;
  description?: string;
  url: string;
  cover_url?: string;
  is_redirect?: boolean;
};

export type TutorialSection = {
  title?: string;
  description?: string;
  videos: TutorialVideo[];
};

/** Normalizes CMS tutorials data (legacy flat `videos` array or new `sections`). */
export function normalizeTutorials(tutorials: any): TutorialSection[] {
  if (!tutorials) return [];
  if (Array.isArray(tutorials.sections) && tutorials.sections.length > 0) {
    return tutorials.sections.map((s: any) => ({
      title: s?.title ?? "",
      description: s?.description ?? "",
      videos: Array.isArray(s?.videos)
        ? s.videos.filter((v: any) => v).map((v: any) => ({
            ...v,
            cover_url: v?.cover_url ?? v?.thumbnail_url ?? v?.poster ?? "",
          }))
        : [],
    }));
  }
  if (Array.isArray(tutorials.videos) && tutorials.videos.length > 0) {
    return [
      {
        title: "Vídeos de uso",
        description: "",
        videos: tutorials.videos.map((v: any) => ({
          ...v,
          cover_url: v?.cover_url ?? v?.thumbnail_url ?? v?.poster ?? "",
        })),
      },
    ];
  }
  return [];
}

/** Converts any video url into an embeddable src, or null when it should use <video>. */
export function embedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes("youtube.com/watch")) {
    const id = new URL(url).searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (url.includes("youtube.com/embed")) return url;
  if (url.includes("vimeo.com") && !url.includes("player.vimeo.com")) {
    const id = url.split("vimeo.com/")[1]?.split(/[?&/]/)[0];
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }
  if (url.includes("player.vimeo.com")) return url;
  return null;
}
