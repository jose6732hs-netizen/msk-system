import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { fontFamily, displayFamily } from "../fonts";

export const Caption: React.FC<{
  text: string;
  sub?: string;
  delay?: number;
  align?: "center" | "left";
  size?: number;
  bottom?: number;
}> = ({ text, sub, delay = 0, align = "center", size = 74, bottom = 210 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const words = text.split(" ");
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        padding: "0 90px",
        opacity: out,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0 18px",
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {words.map((w, i) => {
          const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 18, stiffness: 160 } });
          return (
            <span
              key={i}
              style={{
                fontFamily: displayFamily,
                fontSize: size,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: COLORS.text,
                lineHeight: 1.05,
                textAlign: align,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [34, 0])}px)`,
                filter: `blur(${interpolate(s, [0, 1], [10, 0])}px)`,
                textShadow: "0 12px 60px rgba(0,0,0,0.85)",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 22,
            fontFamily,
            fontSize: size * 0.42,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: COLORS.magenta,
            opacity: spring({ frame: frame - delay - words.length * 3 - 4, fps, config: { damping: 20 } }),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
