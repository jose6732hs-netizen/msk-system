import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../theme";

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;

  const blob = (x: number, y: number, size: number, color: string, speed: number, phase: number) => ({
    position: "absolute" as const,
    left: x * width - size / 2 + Math.sin(t * speed + phase) * width * 0.06,
    top: y * height - size / 2 + Math.cos(t * speed * 0.8 + phase) * height * 0.04,
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    filter: "blur(160px)",
    opacity: 0.5,
  });

  const gridShift = interpolate(frame, [0, 900], [0, 120]);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${COLORS.bgDeep} 0%, ${COLORS.bg} 60%, #030208 100%)` }}>
      <div style={blob(0.2, 0.2, width * 1.1, COLORS.violet, 0.25, 0)} />
      <div style={blob(0.85, 0.35, width * 0.9, COLORS.magenta, 0.19, 2)} />
      <div style={blob(0.4, 0.9, width * 1.0, COLORS.mint, 0.15, 4)} />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(217,70,239,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(217,70,239,0.07) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          backgroundPosition: `${gridShift}px ${gridShift}px`,
          maskImage: "radial-gradient(70% 60% at 50% 45%, black 20%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 45%, black 20%, transparent 90%)",
          opacity: 0.8,
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(75% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
