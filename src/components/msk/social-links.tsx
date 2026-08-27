import { cn } from "@/lib/utils";

const DISCORD_URL = "https://discord.gg/msksystem";
const YOUTUBE_URL = "https://youtube.com/@msksystem";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.54 5.34A16.9 16.9 0 0 0 15.3 4l-.2.42a12.6 12.6 0 0 1 3.75 1.9 13.4 13.4 0 0 0-11.7 0A12.6 12.6 0 0 1 10.9 4.4L10.7 4a16.9 16.9 0 0 0-4.24 1.34C3.55 9.64 2.77 13.83 3.16 17.96A17 17 0 0 0 8.3 20.5l1.03-1.44a11 11 0 0 1-1.74-.84l.43-.33a12.1 12.1 0 0 0 10.36 0l.43.33c-.55.33-1.13.61-1.74.84l1.03 1.44a17 17 0 0 0 5.14-2.54c.46-4.78-.78-8.93-3.7-12.62ZM9.2 15.4c-1 0-1.83-.93-1.83-2.06 0-1.14.81-2.07 1.83-2.07s1.85.93 1.83 2.07c0 1.13-.81 2.06-1.83 2.06Zm5.6 0c-1 0-1.83-.93-1.83-2.06 0-1.14.81-2.07 1.83-2.07s1.85.93 1.83 2.07c0 1.13-.81 2.06-1.83 2.06Z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.5 6.9a3 3 0 0 0-2.12-2.12C19.5 4.27 12 4.27 12 4.27s-7.5 0-9.38.51A3 3 0 0 0 .5 6.9C0 8.78 0 12 0 12s0 3.22.5 5.1a3 3 0 0 0 2.12 2.12c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3 3 0 0 0 2.12-2.12C24 15.22 24 12 24 12s0-3.22-.5-5.1ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z" />
    </svg>
  );
}

type Variant = "compact" | "full";

export function SocialLinks({
  variant = "compact",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Discord do MSK SISTEM"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-black/30 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <DiscordIcon className="h-4 w-4" />
        </a>
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="YouTube do MSK SISTEM"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-black/30 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <YoutubeIcon className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-black/30 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <DiscordIcon className="h-4 w-4" />
        Discord
      </a>
      <a
        href={YOUTUBE_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-black/30 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <YoutubeIcon className="h-4 w-4" />
        YouTube
      </a>
    </div>
  );
}
