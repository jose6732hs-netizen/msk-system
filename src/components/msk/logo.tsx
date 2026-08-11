import logoAsset from "@/assets/logo.png.asset.json";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsContent } from "@/lib/cms.functions";

export function MskLogo({ size = 40 }: { size?: number }) {
  const getCms = useServerFn(getCmsContent);
  const { data: settings } = useQuery({ queryKey: ["cms-content"], queryFn: () => getCms() });
  const logoUrl = (settings as any)?.site_images?.logo || logoAsset.url;

  return (
    <span className="flex items-center gap-3">
      <img
        src={logoUrl}

        alt="MSK Logo"
        className="neon-glow rounded-xl object-cover"
        style={{
          width: size,
          height: size,
        }}
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-sm font-semibold tracking-[0.28em] text-foreground">
          MSK
        </span>
        <span className="font-display text-[0.65rem] tracking-[0.42em] text-muted-foreground">
          SISTEM
        </span>
      </span>
    </span>
  );
}