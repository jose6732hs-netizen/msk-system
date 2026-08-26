import React from "react";
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

  const scale = interpolate(enter, [0, 1], [0.92, 1]);

  const screenMedia = (radius: number) => (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        borderRadius: radius,
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
  );

  if (kind === "mobile") {
    // iPhone 17 style mockup: titanium rail, thin bezels, Dynamic Island
    const bodyW = width ?? cw * 0.58;
    const bodyH = height ?? bodyW * 2.06;
    const bodyRadius = bodyW * 0.155;
    const rail = Math.max(6, bodyW * 0.014);
    const bezel = Math.max(8, bodyW * 0.022);
    const screenRadius = bodyRadius - rail - bezel;
    const islandW = bodyW * 0.3;
    const islandH = bodyW * 0.082;

    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, calc(-50% + ${y}px)) perspective(1800px) rotateY(${tilt}deg) scale(${scale})`,
          opacity: enter,
          width: bodyW,
          height: bodyH,
          borderRadius: bodyRadius,
          background:
            "linear-gradient(145deg, #d7d9de 0%, #8f939c 18%, #f2f3f5 34%, #6f737c 55%, #c9ccd2 74%, #7c8089 100%)",
          padding: rail,
          boxShadow:
            "0 60px 160px rgba(0,0,0,0.85), 0 0 90px rgba(217,70,239,0.22), inset 0 0 2px rgba(255,255,255,0.9)",
        }}
      >
        {/* side buttons */}
        <div
          style={{
            position: "absolute",
            left: -rail * 0.7,
            top: bodyH * 0.17,
            width: rail * 0.9,
            height: bodyH * 0.035,
            borderRadius: rail,
            background: "linear-gradient(90deg,#9aa0a8,#e6e8ec)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -rail * 0.7,
            top: bodyH * 0.235,
            width: rail * 0.9,
            height: bodyH * 0.06,
            borderRadius: rail,
            background: "linear-gradient(90deg,#9aa0a8,#e6e8ec)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -rail * 0.7,
            top: bodyH * 0.31,
            width: rail * 0.9,
            height: bodyH * 0.06,
            borderRadius: rail,
            background: "linear-gradient(90deg,#9aa0a8,#e6e8ec)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -rail * 0.7,
            top: bodyH * 0.26,
            width: rail * 0.9,
            height: bodyH * 0.09,
            borderRadius: rail,
            background: "linear-gradient(270deg,#9aa0a8,#e6e8ec)",
          }}
        />

        {/* black bezel */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: bodyRadius - rail,
            background: "#050507",
            padding: bezel,
            boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.08)",
          }}
        >
          {screenMedia(screenRadius)}

          {/* Dynamic Island */}
          <div
            style={{
              position: "absolute",
              top: bezel + bodyH * 0.014,
              left: "50%",
              transform: "translateX(-50%)",
              width: islandW,
              height: islandH,
              borderRadius: islandH,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: islandH * 0.42,
              zIndex: 3,
            }}
          >
            <div
              style={{
                width: islandH * 0.36,
                height: islandH * 0.36,
                borderRadius: 999,
                background: "radial-gradient(circle at 35% 30%, #2b3a52, #05070c 70%)",
                boxShadow: "0 0 4px rgba(80,140,255,0.55)",
              }}
            />
          </div>

          {/* home indicator */}
          <div
            style={{
              position: "absolute",
              bottom: bezel + bodyH * 0.012,
              left: "50%",
              transform: "translateX(-50%)",
              width: bodyW * 0.32,
              height: Math.max(4, bodyW * 0.012),
              borderRadius: 999,
              background: "rgba(255,255,255,0.75)",
              zIndex: 3,
            }}
          />

          {/* glass glare */}
          <div
            style={{
              position: "absolute",
              inset: bezel,
              borderRadius: screenRadius,
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 22%, rgba(255,255,255,0) 46%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </div>
      </div>
    );
  }

  const frameW = width ?? cw * 0.92;
  const frameH = height ?? frameW * 0.62;
  const radius = 26;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${y}px)) perspective(1800px) rotateY(${tilt}deg) scale(${scale})`,
        opacity: enter,
        width: frameW,
        height: frameH,
        borderRadius: radius,
        background: "linear-gradient(160deg, rgba(217,70,239,0.55), rgba(139,92,246,0.15))",
        boxShadow: `0 60px 160px rgba(0,0,0,0.85), 0 0 90px rgba(217,70,239,0.28)`,
      }}
    >
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
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "calc(100% - 46px)",
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
