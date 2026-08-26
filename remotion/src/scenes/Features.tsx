import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../theme";
import { displayFamily, fontFamily } from "../fonts";

const ITEMS: { k: string; v: string; d: string }[] = [
  { k: "PIX", v: "Aprovação", d: "em segundos" },
  { k: "30%", v: "Comissão", d: "para afiliados" },
  { k: "24/7", v: "Licenças", d: "validadas online" },
  { k: "∞", v: "Modo MSK", d: "créditos ilimitados" },
];

export const Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleS = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 90px" }}>
      <div
        style={{
          fontFamily: displayFamily,
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: COLORS.text,
          textAlign: "center",
          opacity: titleS,
          transform: `translateY(${interpolate(titleS, [0, 1], [30, 0])}px)`,
        }}
      >
        Tudo integrado
      </div>

      <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, width: "100%" }}>
        {ITEMS.map((it, i) => {
          const s = spring({ frame: frame - 14 - i * 8, fps, config: { damping: 15, stiffness: 130 } });
          const float = Math.sin((frame - i * 12) / 26) * 8;
          return (
            <div
              key={it.k}
              style={{
                borderRadius: 40,
                padding: "44px 34px",
                background: "linear-gradient(160deg, rgba(217,70,239,0.16), rgba(139,92,246,0.05))",
                border: "1px solid rgba(217,70,239,0.32)",
                boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [60, float])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
              }}
            >
              <div
                style={{
                  fontFamily: displayFamily,
                  fontSize: 86,
                  fontWeight: 800,
                  color: i % 2 ? COLORS.mint : COLORS.magenta,
                  letterSpacing: "-0.05em",
                  textShadow: `0 0 60px ${i % 2 ? "rgba(52,211,153,0.5)" : "rgba(217,70,239,0.5)"}`,
                }}
              >
                {it.k}
              </div>
              <div style={{ marginTop: 12, fontFamily, fontSize: 38, fontWeight: 700, color: COLORS.text }}>{it.v}</div>
              <div style={{ marginTop: 4, fontFamily, fontSize: 28, color: COLORS.muted }}>{it.d}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
