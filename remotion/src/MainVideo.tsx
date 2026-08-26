import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Backdrop } from "./components/Backdrop";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { Features } from "./scenes/Features";
import { ShotScene } from "./scenes/ShotScene";

const T = 20;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

type SceneDef = { d: number; el: React.ReactNode; p: "fade" | "up" | "down" | "wipe" };

const SCENES: SceneDef[] = [
  { d: 100, p: "fade", el: <Intro /> },
  {
    d: 96,
    p: "up",
    el: (
      <ShotScene
        src="d2-home.png"
        kind="desktop"
        title="A plataforma completa"
        sub="MSK SISTEM"
        from={0}
        to={0.22}
        tilt={-6}
        y={-90}
      />
    ),
  },
  {
    d: 92,
    p: "wipe",
    el: (
      <ShotScene
        src="m-planos.png"
        kind="mobile"
        title="Planos que vendem sozinhos"
        chips={["Diário", "Semanal", "Mensal"]}
        from={0.08}
        to={0.42}
      />
    ),
  },
  {
    d: 86,
    p: "up",
    el: <ShotScene src="m-cart.png" kind="mobile" title="Checkout PIX em segundos" sub="Aprovação automática" from={0.05} to={0.3} />,
  },
  {
    d: 96,
    p: "fade",
    el: (
      <ShotScene
        src="m-painel.png"
        kind="mobile"
        title="Licença ativa na hora"
        chips={["Token", "Dispositivos", "Validade"]}
        from={0.04}
        to={0.38}
      />
    ),
  },
  {
    d: 88,
    p: "down",
    el: <ShotScene src="d2-como-funciona.png" kind="desktop" title="Ativação guiada passo a passo" from={0.05} to={0.3} tilt={5} y={-90} />,
  },
  {
    d: 94,
    p: "wipe",
    el: (
      <ShotScene
        src="d2-parceiros.png"
        kind="desktop"
        title="Programa de afiliados"
        sub="30% por venda"
        from={0.02}
        to={0.3}
        tilt={-5}
        y={-90}
      />
    ),
  },
  {
    d: 92,
    p: "up",
    el: (
      <ShotScene
        src="m-parceiro.png"
        kind="mobile"
        title="Carteira, comissões e saques"
        chips={["Saldo", "PIX", "Extrato"]}
        from={0.05}
        to={0.4}
      />
    ),
  },
  {
    d: 90,
    p: "fade",
    el: <ShotScene src="d2-premiacoes.png" kind="desktop" title="Central de premiações" sub="Metas e ranking" from={0.03} to={0.32} tilt={5} y={-90} />,
  },
  {
    d: 84,
    p: "down",
    el: <ShotScene src="m-auth.png" kind="mobile" title="Cadastro rápido e seguro" sub="Login social" from={0.02} to={0.24} />,
  },
  { d: 108, p: "wipe", el: <Features /> },
  { d: 120, p: "fade", el: <Outro /> },
];

const presentation = (p: SceneDef["p"]) => {
  if (p === "up") return slide({ direction: "from-bottom" });
  if (p === "down") return slide({ direction: "from-top" });
  if (p === "wipe") return wipe({ direction: "from-left" });
  return fade();
};

export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#05030A" }}>
    <Backdrop />
    <TransitionSeries>
      {SCENES.flatMap((s, i) => {
        const nodes = [
          <TransitionSeries.Sequence key={`s-${i}`} durationInFrames={s.d}>
            {s.el}
          </TransitionSeries.Sequence>,
        ];
        if (i > 0) {
          nodes.unshift(
            <TransitionSeries.Transition key={`t-${i}`} presentation={presentation(s.p)} timing={timing} />,
          );
        }
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
