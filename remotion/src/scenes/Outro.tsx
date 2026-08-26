import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../theme";
import { displayFamily, fontFamily } from "../fonts";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const t1 = spring({ frame: frame - 14, fps, config: { damping: 200 }, durationInFrames: 34 });
  const t2 = spring({ frame: frame - 30, fps, config: { damping: 200 }, durationInFrames: 34 });
  const glow = 0.4 + Math.sin(frame / 12) * 0.18;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Img
        src={staticFile("shots/logo.png")}
        style={{
          width: 190,
          height: 190,
          borderRadius: 48,
          opacity: logo,
          transform: `scale(${interpolate(logo, [0, 1], [0.6, 1])})`,
          boxShadow: `0 0 ${120 * glow}px rgba(217,70,239,${glow})`,
        }}
      />
      <div
        style={{
          marginTop: 70,
          fontFamily: displayFamily,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.045em",
          color: COLORS.text,
          textAlign: "center",
          opacity: t1,
          transform: `translateY(${interpolate(t1, [0, 1], [36, 0])}px)`,
        }}
      >
        Comece hoje
      </div>
      <div
        style={{
          marginTop: 34,
          padding: "22px 48px",
          borderRadius: 999,
          border: `2px solid ${COLORS.magenta}`,
          background: "rgba(217,70,239,0.12)",
          boxShadow: `0 0 ${70 * glow}px rgba(217,70,239,0.55)`,
          fontFamily,
          fontSize: 44,
          fontWeight: 700,
          color: COLORS.text,
          opacity: t2,
          transform: `translateY(${interpolate(t2, [0, 1], [26, 0])}px)`,
        }}
      >
        msksystem.online
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily,
          fontSize: 30,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: COLORS.muted,
          opacity: t2,
        }}
      >
        MSK SISTEM
      </div>
    </AbsoluteFill>
  );
};
