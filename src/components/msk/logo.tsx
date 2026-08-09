import logoAsset from "@/assets/logo.png.asset.json";

export function MskLogo({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src={logoAsset.url}
        alt="MSK Logo"
        className="neon-glow rounded-xl object-cover"
        style={{
          width: size,
          height: size,
        }}
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-sm font-semibold tracking-[0.28em] text-foreground">
          LOVABLE
        </span>
        <span className="font-display text-[0.65rem] tracking-[0.42em] text-muted-foreground">
          MSK SUITE
        </span>
      </span>
    </span>
  );
}