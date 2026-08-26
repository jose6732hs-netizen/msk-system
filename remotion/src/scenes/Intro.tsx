import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../theme";
import { displayFamily, fontFamily } from "../fonts";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const ring = interpolate(frame, [0, 90], [0, 1]);
  const titleS = spring({ frame: frame - 16, fps, config: { damping: 200 }, durationInFrames: 34 });
  const lineW = interpolate(spring({ frame: frame - 34, fps, config: { damping: 200 } }), [0, 1], [0, 460]);
  const subS = spring({ frame: frame - 44, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {[0, 1, 2].map((i) => {
          const size = 360 + i * 150 + ring * 90;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: size,
                height: size,
                borderRadius: "50%",
                border: `2px solid rgba(217,70,239,${0.32 - i * 0.09})`,
                opacity: interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" }),
                transform: `rotate(${frame * (0.6 + i * 0.3)}deg)`,
              }}
            />
          );
        })}
        <Img
          src={staticFile("shots/logo.png")}
          style={{
            width: 240,
            height: 240,
            borderRadius: 60,
            transform: `scale(${interpolate(logo, [0, 1], [0.4, 1])})`,
            opacity: logo,
            boxShadow: "0 0 120px rgba(217,70,239,0.6)",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 120,
          fontFamily: displayFamily,
          fontSize: 116,
          fontWeight: 800,
          letterSpacing: "-0.045em",
          color: COLORS.text,
          opacity: titleS,
          transform: `translateY(${interpolate(titleS, [0, 1], [40, 0])}px)`,
          textShadow: "0 0 90px rgba(217,70,239,0.5)",
        }}
      >
        MSK SISTEM
      </div>
      <div
        style={{
          marginTop: 26,
          width: lineW,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.magenta}, transparent)`,
        }}
      />
      <div
        style={{
          marginTop: 28,
          fontFamily,
          fontSize: 34,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color: COLORS.muted,
          opacity: subS,
        }}
      >
        Licenças · Vendas · Afiliados
      </div>
    </AbsoluteFill>
  );
};
