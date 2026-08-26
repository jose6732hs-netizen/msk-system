import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Backdrop } from "./components/Backdrop";
import { Outro } from "./scenes/Outro";
import { ShotScene } from "./scenes/ShotScene";
import { PhotoScene } from "./scenes/PhotoScene";
import { MacScene } from "./scenes/MacScene";

const T = 18;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

type SceneDef = { d: number; el: React.ReactNode; p: "fade" | "up" | "down" | "wipe" };

const SCENES: SceneDef[] = [
  {
    d: 110,
    p: "fade",
    el: (
      <PhotoScene
        src="gen-frustrated.jpg"
        title="Cansado de travar nas suas criações?"
        sub="Créditos acabam na melhor parte"
      />
    ),
  },
  {
    d: 92,
    p: "up",
    el: (
      <PhotoScene
        src="gen-frustrated.jpg"
        title="Limite atingido. De novo."
        zoomFrom={1.28}
        zoomTo={1.4}
        panFrom={-4}
        panTo={2}
        tint="rgba(239,68,68,0.16)"
      />
    ),
  },
  {
    d: 108,
    p: "wipe",
    el: (
      <PhotoScene
        src="gen-infinity.jpg"
        title="Agora existe a solução"
        sub="MSK SISTEM • MODO ILIMITADO"
        zoomFrom={1.0}
        zoomTo={1.12}
        panFrom={0}
        panTo={0}
      />
    ),
  },
  { d: 96, p: "up", el: <MacScene src="d2-home.png" title="A plataforma completa" sub="Licenças, painel e suporte" /> },
  {
    d: 92,
    p: "wipe",
    el: (
      <ShotScene
        src="m-planos.png"
        kind="mobile"
        title="Planos para todo bolso"
        chips={["Diário", "Semanal", "Mensal"]}
        from={0.08}
        to={0.42}
      />
    ),
  },
  {
    d: 90,
    p: "up",
    el: <ShotScene src="m-cart.png" kind="mobile" title="Pague no PIX e libere na hora" sub="Aprovação automática" from={0.05} to={0.3} />,
  },
  { d: 88, p: "down", el: <MacScene src="d2-como-funciona.png" title="Ativação guiada em 3 passos" tilt={5} /> },
  {
    d: 92,
    p: "fade",
    el: (
      <ShotScene
        src="m-painel.png"
        kind="mobile"
        title="Sua licença no seu painel"
        chips={["Token", "Validade", "Dispositivos"]}
        from={0.04}
        to={0.38}
      />
    ),
  },
  {
    d: 100,
    p: "wipe",
    el: <PhotoScene src="gen-success.jpg" title="Crie sem travar. Sem limite." sub="Do bloqueio ao lançamento" />,
  },
  { d: 120, p: "fade", el: <Outro /> },
];

const presentation = (p: SceneDef["p"]) => {
  if (p === "up") return slide({ direction: "from-bottom" });
  if (p === "down") return slide({ direction: "from-top" });
  if (p === "wipe") return wipe({ direction: "from-left" });
  return fade();
};

export const SALES_TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

export const SalesVideo: React.FC = () => (
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
