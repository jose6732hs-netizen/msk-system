import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../theme";

type Props = {
  src: string;
  from?: number;
  to?: number;
  width?: number;
  tilt?: number;
  y?: number;
  delay?: number;
};

/** MacBook Pro style mockup: aluminium lid, notch, hinge and base */
export const MacBook: React.FC<Props> = ({ src, from = 0, to = 0.3, width, tilt = 0, y = 0, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: cw } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 34 });
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const focus = interpolate(p, [0, 1], [from, to]);
  const zoom = interpolate(p, [0, 1], [1.03, 1.13]);

  const lidW = width ?? cw * 0.9;
  const lidH = lidW * 0.63;
  const bezel = lidW * 0.014;
  const notchW = lidW * 0.16;
  const notchH = bezel * 1.6;
  const baseW = lidW * 1.07;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${y}px)) perspective(2000px) rotateY(${tilt}deg) scale(${interpolate(
          enter,
          [0, 1],
          [0.93, 1],
        )})`,
        opacity: enter,
        width: baseW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* lid */}
      <div
        style={{
          width: lidW,
          height: lidH,
          borderRadius: lidW * 0.022,
          padding: bezel,
          paddingTop: notchH,
          background: "linear-gradient(150deg,#c9ccd2,#7d8189 40%,#e7e9ec 62%,#8a8e96)",
          boxShadow: "0 60px 150px rgba(0,0,0,0.85), 0 0 90px rgba(217,70,239,0.22)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: lidW * 0.012,
            overflow: "hidden",
            background: COLORS.bg,
            boxShadow: "inset 0 0 0 2px #0b0b10",
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
                "linear-gradient(115deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 25%, rgba(0,0,0,0.35) 100%)",
            }}
          />
        </div>
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: notchW,
            height: notchH,
            background: "#0b0b10",
            borderBottomLeftRadius: notchH,
            borderBottomRightRadius: notchH,
          }}
        />
      </div>
      {/* hinge + base */}
      <div
        style={{
          width: baseW,
          height: lidH * 0.035,
          background: "linear-gradient(180deg,#b9bdc4,#6f737b)",
          borderBottomLeftRadius: lidW * 0.03,
          borderBottomRightRadius: lidW * 0.03,
          boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: 0,
            width: baseW * 0.16,
            height: "48%",
            background: "#5c6068",
            borderBottomLeftRadius: 999,
            borderBottomRightRadius: 999,
          }}
        />
      </div>
    </div>
  );
};
