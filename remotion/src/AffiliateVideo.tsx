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
import { Backdrop } from "./components/Backdrop";
import { displayFamily, fontFamily } from "./fonts";

const MAGENTA = "#D946EF";
const VIOLET = "#8B5CF6";
const MINT = "#34D399";
const TEXT = "#F5F3FF";

const EASE_OUT = (f: number, d: number) =>
  interpolate(f, [0, d], [0, 1], { extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });

/* ---------------------------------- atoms --------------------------------- */

const Photo: React.FC<{ src: string; from?: number; to?: number; pan?: number; tint?: string }> = ({
  src,
  from = 1.06,
  to = 1.18,
  pan = 0,
  tint,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / Math.max(1, durationInFrames);
  const scale = interpolate(p, [0, 1], [from, to]);
  const x = interpolate(p, [0, 1], [0, pan]);
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${x}px)` }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(5,3,10,0.72) 0%, rgba(5,3,10,0.15) 38%, rgba(5,3,10,0.88) 82%, #05030A 100%)`,
        }}
      />
      {tint ? <AbsoluteFill style={{ background: tint, mixBlendMode: "screen" }} /> : null}
    </AbsoluteFill>
  );
};

const Kicker: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({
  children,
  delay = 0,
  color = MINT,
}) => {
  const frame = useCurrentFrame();
  const a = EASE_OUT(frame - delay, 14);
  return (
    <div
      style={{
        opacity: a,
        transform: `translateY(${(1 - a) * 18}px)`,
        alignSelf: "flex-start",
        fontFamily,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 6,
        textTransform: "uppercase",
        color,
        border: `2px solid ${color}55`,
        background: `${color}14`,
        borderRadius: 999,
        padding: "12px 26px",
      }}
    >
      {children}
    </div>
  );
};

const Title: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({
  children,
  delay = 6,
  size = 92,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: displayFamily,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: -3,
        color: TEXT,
        textTransform: "uppercase",
        opacity: s,
        transform: `translateY(${(1 - s) * 46}px)`,
        textShadow: "0 20px 60px rgba(0,0,0,0.65)",
      }}
    >
      {children}
    </h1>
  );
};

const Sub: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 18 }) => {
  const frame = useCurrentFrame();
  const a = EASE_OUT(frame - delay, 18);
  return (
    <p
      style={{
        margin: 0,
        fontFamily,
        fontWeight: 500,
        fontSize: 38,
        lineHeight: 1.3,
        color: "rgba(245,243,255,0.72)",
        opacity: a,
        transform: `translateY(${(1 - a) * 20}px)`,
      }}
    >
      {children}
    </p>
  );
};

const Frame: React.FC<{ children: React.ReactNode; bottom?: boolean }> = ({ children, bottom = true }) => (
  <AbsoluteFill
    style={{
      padding: 84,
      display: "flex",
      flexDirection: "column",
      justifyContent: bottom ? "flex-end" : "center",
      gap: 26,
      paddingBottom: bottom ? 210 : 84,
    }}
  >
    {children}
  </AbsoluteFill>
);

/* --------------------------------- scenes --------------------------------- */

const S1: React.FC = () => (
  <AbsoluteFill>
    <Photo src="afl/hook.jpg" from={1.08} to={1.2} pan={-30} />
    <Frame>
      <Kicker>Programa de afiliados</Kicker>
      <Title size={100}>Você indica.{"\n"}O sistema vende.</Title>
      <Sub>E a comissão cai na sua conta.</Sub>
    </Frame>
  </AbsoluteFill>
);

const S2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <div
        style={{
          width: "100%",
          borderRadius: 44,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: `0 50px 140px ${VIOLET}55`,
          opacity: s,
          transform: `scale(${0.9 + s * 0.1}) rotate(${(1 - s) * -2}deg)`,
        }}
      >
        <Img src={staticFile("afl/banner-afiliado.png")} style={{ width: "100%", display: "block" }} />
      </div>
      <div style={{ height: 60 }} />
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 22 }}>
        <Title size={78} delay={26}>
          MSK SISTEM{"\n"}Afiliados
        </Title>
        <Sub delay={40}>Feito para quem quer ganhar de verdade.</Sub>
      </div>
    </AbsoluteFill>
  );
};

const Counter: React.FC<{ to: number; delay?: number; size?: number; color?: string }> = ({
  to,
  delay = 0,
  size = 300,
  color = MINT,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 60 }, durationInFrames: 46 });
  const v = Math.round(s * to);
  return (
    <div
      style={{
        fontFamily: displayFamily,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.9,
        letterSpacing: -12,
        color,
        textShadow: `0 0 90px ${color}77`,
      }}
    >
      {v}
      <span style={{ fontSize: size * 0.42, letterSpacing: -4 }}>%</span>
    </div>
  );
};

const S3: React.FC = () => (
  <AbsoluteFill>
    <Photo src="afl/growth.jpg" from={1.1} to={1.02} />
    <Frame bottom={false}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
        <Kicker>Comissão inicial</Kicker>
        <Counter to={30} delay={10} />
        <Title size={70} delay={40}>
          Em toda venda{"\n"}da sua indicação
        </Title>
        <Sub delay={58}>Sem meta impossível. Começa alto.</Sub>
      </div>
    </Frame>
  </AbsoluteFill>
);

const TIERS = [
  { pct: 30, label: "Início" },
  { pct: 40, label: "Ativo" },
  { pct: 50, label: "Pro" },
  { pct: 60, label: "Elite" },
];

const S4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Photo src="afl/growth.jpg" from={1.02} to={1.14} pan={20} tint="rgba(52,211,153,0.10)" />
      <AbsoluteFill style={{ padding: 84, justifyContent: "center", gap: 46 }}>
        <Kicker>Escala de comissão</Kicker>
        <Title size={96}>Até 60% por venda</Title>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 14 }}>
          {TIERS.map((t, i) => {
            const s = spring({ frame: frame - 26 - i * 12, fps, config: { damping: 200 }, durationInFrames: 40 });
            const w = interpolate(t.pct, [0, 60], [0, 100]);
            const top = i === TIERS.length - 1;
            return (
              <div key={t.pct} style={{ opacity: s, transform: `translateX(${(1 - s) * -60}px)` }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily,
                    fontWeight: 700,
                    fontSize: 30,
                    color: top ? MINT : "rgba(245,243,255,0.75)",
                    textTransform: "uppercase",
                    letterSpacing: 3,
                    marginBottom: 10,
                  }}
                >
                  <span>{t.label}</span>
                  <span>{t.pct}%</span>
                </div>
                <div style={{ height: 26, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${w * s}%`,
                      borderRadius: 999,
                      background: top
                        ? `linear-gradient(90deg, ${VIOLET}, ${MINT})`
                        : `linear-gradient(90deg, ${VIOLET}aa, ${MAGENTA}aa)`,
                      boxShadow: top ? `0 0 40px ${MINT}88` : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Sub delay={80}>Quanto mais você vende, maior a sua faixa.</Sub>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; delay: number; accent?: string }> = ({
  label,
  value,
  delay,
  accent = TEXT,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 140 } });
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 30,
        padding: "30px 28px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        opacity: s,
        transform: `translateY(${(1 - s) * 40}px)`,
      }}
    >
      <div style={{ fontFamily, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: "rgba(245,243,255,0.5)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: displayFamily, fontWeight: 800, fontSize: 62, color: accent, letterSpacing: -2, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
};

const S5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const bar = (i: number) => spring({ frame: frame - 60 - i * 6, fps, config: { damping: 200 }, durationInFrames: 34 });
  const heights = [0.35, 0.5, 0.42, 0.68, 0.58, 0.82, 1];
  return (
    <AbsoluteFill style={{ padding: 74, justifyContent: "center", gap: 34 }}>
      <Kicker>Painel do afiliado</Kicker>
      <Title size={74}>Tudo em tempo real</Title>
      <div
        style={{
          borderRadius: 40,
          padding: 34,
          background: "linear-gradient(160deg, rgba(139,92,246,0.18), rgba(5,3,10,0.6))",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: `0 50px 130px ${VIOLET}44`,
          opacity: card,
          transform: `translateY(${(1 - card) * 50}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", gap: 18 }}>
          <Stat label="Cliques" value="4.812" delay={20} />
          <Stat label="Cadastros" value="937" delay={28} />
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <Stat label="Vendas" value="286" delay={36} accent={MINT} />
          <Stat label="Saldo" value="R$ 18.740" delay={44} accent={MINT} />
        </div>
        <div
          style={{
            height: 260,
            borderRadius: 28,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 24,
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          {heights.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100 * bar(i)}%`,
                borderRadius: 12,
                background: `linear-gradient(180deg, ${MINT}, ${VIOLET})`,
                boxShadow: `0 0 30px ${MINT}55`,
              }}
            />
          ))}
        </div>
      </div>
      <Sub delay={92}>Cliques, cadastros, vendas aprovadas e saldo.</Sub>
    </AbsoluteFill>
  );
};

const S6: React.FC = () => (
  <AbsoluteFill>
    <Photo src="afl/creator.jpg" from={1.05} to={1.16} pan={24} />
    <Frame>
      <Kicker color={MAGENTA}>Link exclusivo</Kicker>
      <Title size={82}>Divulgue em{"\n"}qualquer lugar</Title>
      <Sub>Link de indicação + banners prontos para usar.</Sub>
    </Frame>
  </AbsoluteFill>
);

const S7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 30, fps, config: { damping: 14, stiffness: 140 } });
  return (
    <AbsoluteFill>
      <Photo src="afl/pix.jpg" from={1.12} to={1.02} tint="rgba(52,211,153,0.08)" />
      <Frame>
        <div
          style={{
            alignSelf: "flex-start",
            borderRadius: 28,
            padding: "22px 34px",
            background: `${MINT}1c`,
            border: `2px solid ${MINT}66`,
            fontFamily: displayFamily,
            fontWeight: 800,
            fontSize: 56,
            color: MINT,
            opacity: s,
            transform: `scale(${0.85 + s * 0.15})`,
          }}
        >
          + R$ 1.480,00
        </div>
        <Title size={86}>Saque direto{"\n"}no PIX</Title>
        <Sub>A comissão entra na sua carteira.</Sub>
      </Frame>
    </AbsoluteFill>
  );
};

const S8: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70, gap: 40 }}>
      <Img
        src={staticFile("afl/awards-hero.png")}
        style={{
          width: "92%",
          objectFit: "contain",
          opacity: s,
          transform: `scale(${0.88 + s * 0.12})`,
          filter: `drop-shadow(0 40px 90px ${MAGENTA}66)`,
        }}
      />
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 18 }}>
        <Title size={84} delay={24}>
          Premiações oficiais
        </Title>
        <Sub delay={44}>Seu resultado vira reconhecimento.</Sub>
      </div>
    </AbsoluteFill>
  );
};

const PLAQUES = [
  { src: "afl/award-1k.png", label: "1K" },
  { src: "afl/award-10k-new.png", label: "10K" },
  { src: "afl/award-100k-new.png", label: "100K" },
  { src: "afl/award-500k.png", label: "500K" },
  { src: "afl/award-1m.png", label: "1M" },
  { src: "afl/award-5m.png", label: "5M" },
];

const S9: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ padding: 70, justifyContent: "center", gap: 36 }}>
      <Title size={72}>Cada marca batida,{"\n"}uma placa sua</Title>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
        {PLAQUES.map((p, i) => {
          const s = spring({ frame: frame - 20 - i * 14, fps, config: { damping: 16, stiffness: 130 } });
          return (
            <div
              key={p.label}
              style={{
                width: "calc(50% - 11px)",
                borderRadius: 32,
                padding: 20,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                opacity: s,
                transform: `scale(${0.82 + s * 0.18}) rotate(${(1 - s) * (i % 2 ? 4 : -4)}deg)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Img src={staticFile(p.src)} style={{ width: "100%", height: 300, objectFit: "contain" }} />
              <div
                style={{
                  fontFamily: displayFamily,
                  fontWeight: 800,
                  fontSize: 40,
                  color: MINT,
                  letterSpacing: 2,
                }}
              >
                {p.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const S10: React.FC = () => (
  <AbsoluteFill>
    <Photo src="afl/cta.jpg" from={1.06} to={1.16} />
    <Frame>
      <Kicker>Recorrência</Kicker>
      <Title size={82}>Ganho que{"\n"}se repete</Title>
      <Sub>Produto que o mercado procura, com renovação todo mês.</Sub>
    </Frame>
  </AbsoluteFill>
);

const S11: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 34, padding: 80 }}>
      <div
        style={{
          fontFamily: displayFamily,
          fontWeight: 800,
          fontSize: 118,
          letterSpacing: -5,
          textAlign: "center",
          lineHeight: 0.98,
          color: TEXT,
          opacity: s,
          transform: `scale(${0.9 + s * 0.1})`,
          textTransform: "uppercase",
        }}
      >
        Seja afiliado{"\n"}
        <span style={{ color: MINT }}>MSK SISTEM</span>
      </div>
      <Sub delay={22}>Crie sua conta, pegue seu link e comece hoje.</Sub>
      <div
        style={{
          marginTop: 20,
          padding: "30px 60px",
          borderRadius: 999,
          background: `linear-gradient(90deg, ${VIOLET}, ${MAGENTA})`,
          fontFamily: displayFamily,
          fontWeight: 800,
          fontSize: 52,
          color: "#0B0512",
          transform: `scale(${pulse})`,
          boxShadow: `0 30px 90px ${MAGENTA}66`,
          opacity: EASE_OUT(frame - 36, 16),
        }}
      >
        msksystem.online
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "rgba(245,243,255,0.55)",
          opacity: EASE_OUT(frame - 54, 16),
        }}
      >
        Comissões de 30% a 60%
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------- timeline -------------------------------- */

type Def = { el: React.ReactNode; audio: string; frames: number; sfx?: string };

const SCENES: Def[] = [
  { el: <S1 />, audio: "voa/s01.mp3", frames: 182, sfx: "sfx/riser.wav" },
  { el: <S2 />, audio: "voa/s02.mp3", frames: 246, sfx: "sfx/impact.wav" },
  { el: <S3 />, audio: "voa/s03.mp3", frames: 231, sfx: "sfx/whoosh.wav" },
  { el: <S4 />, audio: "voa/s04.mp3", frames: 266, sfx: "sfx/whoosh.wav" },
  { el: <S5 />, audio: "voa/s05.mp3", frames: 314, sfx: "sfx/connect.wav" },
  { el: <S6 />, audio: "voa/s06.mp3", frames: 223, sfx: "sfx/whoosh.wav" },
  { el: <S7 />, audio: "voa/s07.mp3", frames: 186, sfx: "sfx/blip.wav" },
  { el: <S8 />, audio: "voa/s08.mp3", frames: 214, sfx: "sfx/impact.wav" },
  { el: <S9 />, audio: "voa/s09.mp3", frames: 342, sfx: "sfx/whoosh.wav" },
  { el: <S10 />, audio: "voa/s10.mp3", frames: 171, sfx: "sfx/whoosh.wav" },
  { el: <S11 />, audio: "voa/s11.mp3", frames: 278, sfx: "sfx/logo_hit.wav" },
];

export const AFFILIATE_TOTAL = SCENES.reduce((a, s) => a + s.frames, 0);

const Fade: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const o = Math.min(
    interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [frames - 10, frames], [1, 0], { extrapolateLeft: "clamp" }),
  );
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const AffiliateVideo: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#05030A" }}>
      <Backdrop />
      {SCENES.map((s, i) => {
        const from = at;
        at += s.frames;
        return (
          <Sequence key={i} from={from} durationInFrames={s.frames}>
            <Fade frames={s.frames}>{s.el}</Fade>
            <Audio src={staticFile(s.audio)} />
            {s.sfx ? <Audio src={staticFile(s.sfx)} volume={0.28} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
