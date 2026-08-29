import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFamily, fontFamily } from "./fonts";
import timings from "./vs-timings.json";

const FPS = 30;
const NEON = "#22F58A";
const VIOLET = "#A855F7";

export const VS_TOTAL = Math.ceil(timings.total * FPS);

type Sfx = { f: string; at: number; vol?: number };

type SceneDef = {
  id: string;
  img: string;
  chip?: string;
  chipSub?: string;
  caption: { t: string; hi?: boolean }[];
  big?: string;
  captionTop?: boolean;
  label?: string;
  sfx?: Sfx[];
};

const SCENES: SceneDef[] = [
  {
    id: "s01",
    img: "img/scene01.jpg",
    big: "ISSO JÁ É O\nMSK AGENTE?",
    caption: [
      { t: "ChatGPT + GitHub + Lovable" },
      { t: "NÃO É", hi: true },
      { t: "a mesma coisa." },
    ],
  },
  {
    id: "s02",
    img: "img/scene02.jpg",
    chip: "SEM MSK",
    chipSub: "FLUXO FRAGMENTADO",
    caption: [
      { t: "Troca de aba," },
      { t: "COPIA CÓDIGO", hi: true },
      { t: "e explica o projeto de novo." },
    ],
  },
  {
    id: "s03",
    img: "img/scene03.jpg",
    big: "TUDO\nCONECTADO",
    caption: [
      { t: "Ferramentas separadas viram um" },
      { t: "FLUXO CONECTADO", hi: true },
    ],
  },
  {
    id: "s04",
    img: "img/scene04.jpg",
    chip: "CHATGPT",
    chipSub: "INTELIGÊNCIA",
    caption: [{ t: "O ChatGPT continua sendo a" }, { t: "INTELIGÊNCIA", hi: true }],
  },
  {
    id: "s05",
    img: "img/scene05.jpg",
    chip: "GITHUB",
    chipSub: "CÓDIGO",
    caption: [{ t: "O GitHub organiza o" }, { t: "CÓDIGO", hi: true }],
  },
  {
    id: "s06",
    img: "img/scene06.jpg",
    chip: "LOVABLE",
    chipSub: "PROJETO",
    caption: [{ t: "A Lovable é o" }, { t: "PROJETO", hi: true }],
  },
  {
    id: "s07",
    img: "img/scene07.jpg",
    chip: "SUPABASE",
    chipSub: "DADOS + BACKEND",
    caption: [
      { t: "Quando autorizado:" },
      { t: "BANCO E BACKEND", hi: true },
      { t: "no mesmo fluxo." },
    ],
  },
  {
    id: "s08",
    img: "img/scene08.jpg",
    chip: "COFRE MSK",
    chipSub: "SEGURANÇA",
    caption: [
      { t: "Credenciais em um" },
      { t: "COFRE", hi: true },
      { t: "não na conversa." },
    ],
  },
  {
    id: "s09",
    img: "img/scene09.jpg",
    chip: "APIs • CHECKOUT",
    chipSub: "INTEGRAÇÕES",
    caption: [
      { t: "APIs, checkouts e webhooks" },
      { t: "ORGANIZADOS", hi: true },
    ],
  },
  {
    id: "s10",
    img: "img/scene10.jpg",
    chip: "SEM MSK  ×  COM MSK",
    chipSub: "CONNECTED • AUTHORIZED • SECURE",
    caption: [
      { t: "Usar várias ferramentas" },
      { t: "×" },
      { t: "TER UMA ESTRUTURA", hi: true },
    ],
  },
  {
    id: "s11",
    img: "img/scene11.jpg",
    big: "MSK AGENTE",
    captionTop: true,
    caption: [
      { t: "Você não assina outro chat." },
      { t: "INTELIGÊNCIA EM EXECUÇÃO", hi: true },
    ],
  },
];

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 70% at 50% 0%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(90% 60% at 50% 100%, rgba(34,245,138,0.16), transparent 60%)",
      mixBlendMode: "screen",
      pointerEvents: "none",
    }}
  />
);

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(80% 55% at 50% 45%, transparent 40%, rgba(0,0,0,0.85) 100%)",
      pointerEvents: "none",
    }}
  />
);

const Scanline: React.FC = () => {
  const frame = useCurrentFrame();
  const y = ((frame * 14) % 2400) - 240;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        height: 240,
        background:
          "linear-gradient(180deg, transparent, rgba(34,245,138,0.10), transparent)",
        pointerEvents: "none",
      }}
    />
  );
};

const Chip: React.FC<{ title: string; sub?: string; delay: number }> = ({
  title,
  sub,
  delay,
}) => {
  const frame = useCurrentFrame();
  const s = spring({ frame: frame - delay, fps: FPS, config: { damping: 16, stiffness: 180 } });
  const x = interpolate(s, [0, 1], [-90, 0]);
  return (
    <div
      style={{
        transform: `translateX(${x}px)`,
        opacity: s,
        alignSelf: "flex-start",
        padding: "18px 34px",
        borderRadius: 999,
        border: `2px solid ${NEON}`,
        background: "rgba(6,10,8,0.55)",
        backdropFilter: undefined,
        boxShadow: `0 0 40px rgba(34,245,138,0.35)`,
      }}
    >
      <div
        style={{
          fontFamily: displayFamily,
          fontWeight: 800,
          fontSize: 46,
          letterSpacing: 2,
          color: NEON,
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 4,
            color: "#CFFBE4",
            opacity: 0.85,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

const BigTitle: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const lines = text.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lines.map((line, i) => {
        const s = spring({
          frame: frame - 4 - i * 6,
          fps: FPS,
          config: { damping: 18, stiffness: 140 },
        });
        const blur = interpolate(s, [0, 1], [18, 0]);
        return (
          <div
            key={i}
            style={{
              fontFamily: displayFamily,
              fontWeight: 800,
              fontSize: 108,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: "#FFFFFF",
              textShadow: `0 0 60px rgba(34,245,138,0.55), 0 0 120px rgba(168,85,247,0.35)`,
              transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
              filter: `blur(${blur}px)`,
              opacity: s,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

const Caption: React.FC<{ parts: SceneDef["caption"]; delay: number }> = ({
  parts,
  delay,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "14px 18px",
        alignItems: "center",
      }}
    >
      {parts.map((p, i) => {
        const s = spring({
          frame: frame - delay - i * 5,
          fps: FPS,
          config: { damping: 20, stiffness: 200 },
        });
        return (
          <span
            key={i}
            style={{
              fontFamily: p.hi ? displayFamily : fontFamily,
              fontWeight: p.hi ? 800 : 700,
              fontSize: p.hi ? 74 : 52,
              letterSpacing: p.hi ? 0 : -0.5,
              color: p.hi ? "#03150C" : "#EAFBF2",
              background: p.hi
                ? `linear-gradient(100deg, ${NEON}, #7CFFC4)`
                : "rgba(4,8,6,0.5)",
              padding: p.hi ? "10px 26px" : "8px 18px",
              borderRadius: 18,
              boxShadow: p.hi
                ? `0 0 60px rgba(34,245,138,0.55)`
                : "0 8px 30px rgba(0,0,0,0.5)",
              transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(
                s,
                [0, 1],
                [0.9, 1],
              )})`,
              opacity: s,
              display: "inline-block",
            }}
          >
            {p.t}
          </span>
        );
      })}
    </div>
  );
};

const Scene: React.FC<{ def: SceneDef; durationInFrames: number; index: number }> = ({
  def,
  durationInFrames,
  index,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const dir = index % 2 === 0 ? 1 : -1;
  const zoom = interpolate(frame, [0, durationInFrames], [1.06, 1.18]);
  const pan = interpolate(frame, [0, durationInFrames], [0, 40 * dir]);
  const enterX = interpolate(frame, [0, 12], [60 * dir, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#05030A", opacity }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom}) translateX(${pan + enterX}px)`,
        }}
      >
        <Img
          src={staticFile(def.img)}
          style={{ width, height, objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(2,4,3,0.30)" }} />
      <Grain />
      <Scanline />
      <Vignette />

      <AbsoluteFill
        style={{
          padding: "150px 70px 210px 70px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          {def.chip ? <Chip title={def.chip} sub={def.chipSub} delay={2} /> : null}
          {def.big ? <BigTitle text={def.big} /> : null}
          {def.captionTop ? <Caption parts={def.caption} delay={10} /> : null}
        </div>
        {def.captionTop ? <div /> : <Caption parts={def.caption} delay={10} />}
      </AbsoluteFill>

    </AbsoluteFill>
  );
};

const Frame: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.45 + 0.25 * Math.sin(frame / 9);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 26,
          border: `2px solid rgba(34,245,138,${pulse * 0.6})`,
          borderRadius: 34,
          boxShadow: `inset 0 0 90px rgba(34,245,138,${pulse * 0.18})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 62,
          fontFamily: displayFamily,
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: 8,
          color: "#EAFBF2",
          opacity: 0.85,
          textShadow: `0 0 30px ${VIOLET}`,
        }}
      >
        MSK AGENTE
      </div>
    </AbsoluteFill>
  );
};

const EndCta: React.FC<{ start: number; duration: number }> = ({ start, duration }) => {
  const frame = useCurrentFrame() - start;
  if (frame < 0) return null;
  const s = spring({ frame, fps: FPS, config: { damping: 14, stiffness: 160 } });
  const pulse = 1 + 0.03 * Math.sin(frame / 5);
  const out = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 300,
        opacity: Math.min(s, out),
      }}
    >
      <div
        style={{
          transform: `scale(${pulse})`,
          fontFamily: displayFamily,
          fontWeight: 800,
          fontSize: 58,
          letterSpacing: 1,
          padding: "26px 56px",
          borderRadius: 999,
          color: "#03150C",
          background: `linear-gradient(100deg, ${NEON}, #7CFFC4)`,
          boxShadow: `0 0 80px rgba(34,245,138,0.6)`,
        }}
      >
        ATIVE SEU MSK AGENTE
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: 3,
          color: "#EAFBF2",
        }}
      >
        msksystem.online
      </div>
    </AbsoluteFill>
  );
};

export const VsVideo: React.FC = () => {
  let cursor = 0;
  const sceneFrames = timings.scenes.map((s) => Math.round(s.dur * FPS));
  const lastStart = sceneFrames
    .slice(0, sceneFrames.length - 1)
    .reduce((a, b) => a + b, 0);
  const lastDur = sceneFrames[sceneFrames.length - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: "#05030A" }}>
      {SCENES.map((def, i) => {
        const from = cursor;
        const dur = sceneFrames[i];
        cursor += dur;
        return (
          <Sequence key={def.id} from={from} durationInFrames={dur}>
            <Scene def={def} durationInFrames={dur} index={i} />
            <Audio src={staticFile(`voiceover/msk/${def.id}.mp3`)} />
          </Sequence>
        );
      })}
      <Frame />
      <EndCta start={lastStart + 20} duration={lastDur - 20} />
    </AbsoluteFill>
  );
};
