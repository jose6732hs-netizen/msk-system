import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../theme";

type Props = {
  src: string;
  kind: "mobile" | "desktop";
  /** vertical focus at scene start / end (0 = top, 1 = bottom) */
  from?: number;
  to?: number;
  zoomFrom?: number;
  zoomTo?: number;
  width?: number;
  height?: number;
  tilt?: number;
  y?: number;
  delay?: number;
};

export const Shot: React.FC<Props> = ({
  src,
  kind,
  from = 0,
  to = 0.35,
  zoomFrom = 1.02,
  zoomTo = 1.12,
  width,
  height,
  tilt = 0,
  y = 0,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: cw } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 34 });
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const focus = interpolate(p, [0, 1], [from, to]);
  const zoom = interpolate(p, [0, 1], [zoomFrom, zoomTo]);

  const frameW = width ?? (kind === "mobile" ? cw * 0.56 : cw * 0.92);
  const frameH = height ?? (kind === "mobile" ? frameW * 2.02 : frameW * 0.62);
  const radius = kind === "mobile" ? 62 : 26;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${y}px)) perspective(1800px) rotateY(${tilt}deg) scale(${interpolate(
          enter,
          [0, 1],
          [0.92, 1],
        )})`,
        opacity: enter,
        width: frameW,
        height: frameH,
        borderRadius: radius,
        padding: kind === "mobile" ? 14 : 0,
        background:
          kind === "mobile"
            ? "linear-gradient(160deg, rgba(217,70,239,0.75), rgba(52,211,153,0.35))"
            : "linear-gradient(160deg, rgba(217,70,239,0.55), rgba(139,92,246,0.15))",
        boxShadow: `0 60px 160px rgba(0,0,0,0.85), 0 0 90px rgba(217,70,239,0.28)`,
      }}
    >
      {kind === "desktop" ? (
        <div
          style={{
            height: 46,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 22px",
            background: "rgba(10,7,20,0.95)",
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 999, background: c, opacity: 0.85 }} />
          ))}
          <div
            style={{
              marginLeft: 20,
              flex: 1,
              height: 22,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: kind === "desktop" ? "calc(100% - 46px)" : "100%",
          borderRadius: kind === "mobile" ? radius - 12 : 0,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
          background: COLORS.bg,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            position: "absolute",
            left: "50%",
            top: `${-focus * 100}%`,
            width: "100%",
            transform: `translateX(-50%) scale(${zoom})`,
            transformOrigin: "top center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};
