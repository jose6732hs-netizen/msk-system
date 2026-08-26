import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Caption } from "../components/Caption";

type Props = {
  src: string;
  title: string;
  sub?: string;
  zoomFrom?: number;
  zoomTo?: number;
  panFrom?: number;
  panTo?: number;
  tint?: string;
};

export const PhotoScene: React.FC<Props> = ({
  src,
  title,
  sub,
  zoomFrom = 1.06,
  zoomTo = 1.18,
  panFrom = 0,
  panTo = -2,
  tint = "rgba(217,70,239,0.14)",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(p, [0, 1], [zoomFrom, zoomTo]);
  const x = interpolate(p, [0, 1], [panFrom, panTo]);
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fade }}>
      <Img
        src={staticFile(`shots/${src}`)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${x}%)`,
        }}
      />
      <AbsoluteFill style={{ background: tint }} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(5,3,10,0.72) 0%, rgba(5,3,10,0.05) 35%, rgba(5,3,10,0.9) 100%)",
        }}
      />
      <Caption text={title} sub={sub} size={72} bottom={210} />
    </AbsoluteFill>
  );
};
