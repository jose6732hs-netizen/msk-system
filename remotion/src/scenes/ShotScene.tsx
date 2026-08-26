import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Shot } from "../components/Shot";
import { Caption } from "../components/Caption";
import { COLORS } from "../theme";
import { fontFamily } from "../fonts";

type Props = {
  src: string;
  kind: "mobile" | "desktop";
  title: string;
  sub?: string;
  chips?: string[];
  from?: number;
  to?: number;
  y?: number;
  tilt?: number;
  zoomFrom?: number;
  zoomTo?: number;
};

const Chips: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 148,
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 14,
        padding: "0 80px",
      }}
    >
      {items.map((c, i) => {
        const s = spring({ frame: frame - 10 - i * 6, fps, config: { damping: 16, stiffness: 140 } });
        return (
          <div
            key={c}
            style={{
              fontFamily,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: COLORS.text,
              padding: "12px 26px",
              borderRadius: 999,
              border: `1px solid rgba(217,70,239,0.45)`,
              background: "rgba(217,70,239,0.12)",
              boxShadow: "0 0 40px rgba(217,70,239,0.25)",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [-22, 0])}px)`,
            }}
          >
            {c}
          </div>
        );
      })}
    </div>
  );
};

export const ShotScene: React.FC<Props> = ({
  src,
  kind,
  title,
  sub,
  chips,
  from = 0,
  to = 0.3,
  y = -40,
  tilt = 0,
  zoomFrom = 1.03,
  zoomTo = 1.14,
}) => {
  return (
    <AbsoluteFill>
      <Shot
        src={`shots/${src}`}
        kind={kind}
        from={from}
        to={to}
        y={y}
        tilt={tilt}
        zoomFrom={zoomFrom}
        zoomTo={zoomTo}
        width={kind === "mobile" ? 620 : 980}
        height={kind === "mobile" ? 1180 : 700}
      />
      {chips ? <Chips items={chips} /> : null}
      <Caption text={title} sub={sub} size={68} bottom={190} />
    </AbsoluteFill>
  );
};
