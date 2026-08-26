import React from "react";
import { AbsoluteFill } from "remotion";
import { MacBook } from "../components/MacBook";
import { Caption } from "../components/Caption";

type Props = {
  src: string;
  title: string;
  sub?: string;
  from?: number;
  to?: number;
  tilt?: number;
};

export const MacScene: React.FC<Props> = ({ src, title, sub, from = 0.02, to = 0.3, tilt = -5 }) => (
  <AbsoluteFill>
    <MacBook src={`shots/${src}`} from={from} to={to} tilt={tilt} y={-110} width={950} />
    <Caption text={title} sub={sub} size={68} bottom={210} />
  </AbsoluteFill>
);
