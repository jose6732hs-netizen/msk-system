import { useEffect, useRef } from "react";

export type NightSkyConfig = {
  /** 0..1 overall opacity of the animated layer */
  intensity?: number;
  /** base star count (scaled by viewport + device) */
  starCount?: number;
  /** average seconds between meteors */
  meteorInterval?: number;
  /** meteor speed multiplier */
  meteorSpeed?: number;
  /** average seconds between bird flocks */
  birdInterval?: number;
  /** disable everything */
  enabled?: boolean;
  className?: string;
};

type Star = {
  x: number;
  y: number;
  r: number;
  layer: number;
  base: number;
  twinkle: number;
  phase: number;
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  ttl: number;
  w: number;
};

type Bird = { x: number; y: number; vx: number; size: number; phase: number; alpha: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Camada de fundo animada (céu noturno cinematográfico).
 * Renderizada atrás de todo o conteúdo, sem capturar cliques.
 */
export function NightSky({
  intensity = 1,
  starCount = 220,
  meteorInterval = 2.6,
  meteorSpeed = 1,
  birdInterval = 14,
  enabled = true,
  className = "",
}: NightSkyConfig) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];
    const birds: Bird[] = [];
    let raf = 0;
    let nextMeteor = rnd(0.3, meteorInterval);
    let nextFlock = rnd(4, birdInterval);
    let last = performance.now();

    const mobile = () => window.innerWidth < 768;
    const tablet = () => window.innerWidth >= 768 && window.innerWidth < 1280;

    const densityFactor = () => (mobile() ? 0.4 : tablet() ? 0.7 : 1);

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const total = Math.round(starCount * densityFactor() * Math.min(1.6, (w * h) / (1440 * 900)));
      stars = Array.from({ length: Math.max(40, total) }, () => {
        const layer = Math.random() < 0.6 ? 0 : Math.random() < 0.8 ? 1 : 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer === 0 ? rnd(0.3, 0.8) : layer === 1 ? rnd(0.6, 1.2) : rnd(1.1, 1.9),
          layer,
          base: layer === 0 ? rnd(0.12, 0.3) : layer === 1 ? rnd(0.28, 0.55) : rnd(0.5, 0.9),
          twinkle: layer === 2 ? rnd(0.25, 0.5) : rnd(0.05, 0.2),
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const spawnMeteor = () => {
      // origens variadas: topo (esquerda/centro/direita) e laterais
      const mode = Math.floor(rnd(0, 5));
      let x = 0;
      let y = 0;
      let angle = 0;
      if (mode === 0) {
        x = rnd(-0.1, 0.25) * w;
        y = rnd(-0.15, 0.1) * h;
        angle = rnd(0.35, 0.75);
      } else if (mode === 1) {
        x = rnd(0.3, 0.7) * w;
        y = rnd(-0.2, -0.02) * h;
        angle = rnd(0.9, 1.45);
      } else if (mode === 2) {
        x = rnd(0.8, 1.1) * w;
        y = rnd(-0.15, 0.1) * h;
        angle = rnd(Math.PI - 0.75, Math.PI - 0.35);
      } else if (mode === 3) {
        x = rnd(-0.1, -0.02) * w;
        y = rnd(0.05, 0.5) * h;
        angle = rnd(0.15, 0.45);
      } else {
        x = rnd(1.02, 1.1) * w;
        y = rnd(0.05, 0.5) * h;
        angle = rnd(Math.PI - 0.45, Math.PI - 0.15);
      }
      const speed = rnd(420, 1050) * meteorSpeed * (mobile() ? 0.8 : 1);
      meteors.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: rnd(90, 260),
        life: 0,
        ttl: rnd(0.7, 1.6),
        w: rnd(0.9, 2.1),
      });
    };

    const spawnFlock = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = Math.round(rnd(3, 7));
      const y0 = rnd(0.08, 0.45) * h;
      const speed = rnd(28, 70);
      const size = rnd(3, 7);
      for (let i = 0; i < n; i++) {
        birds.push({
          x: dir === 1 ? -rnd(20, 160) - i * rnd(18, 34) : w + rnd(20, 160) + i * rnd(18, 34),
          y: y0 + rnd(-26, 26),
          vx: dir * speed * rnd(0.9, 1.15),
          size: size * rnd(0.75, 1.2),
          phase: Math.random() * Math.PI * 2,
          alpha: rnd(0.12, 0.35),
        });
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // estrelas
      for (const s of stars) {
        s.phase += dt * (0.4 + s.layer * 0.5);
        const a = Math.max(0, s.base + Math.sin(s.phase) * s.twinkle) * intensity;
        if (a <= 0.01) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.layer === 2 ? "180,225,255" : "225,235,255"},${a.toFixed(3)})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.layer === 2 && a > 0.6) {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
          g.addColorStop(0, `rgba(150,210,255,${(a * 0.25).toFixed(3)})`);
          g.addColorStop(1, "rgba(150,210,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduced) {
        // meteoros
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          spawnMeteor();
          nextMeteor = rnd(meteorInterval * 0.35, meteorInterval * 1.8);
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i]!;
          m.life += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const p = m.life / m.ttl;
          if (p >= 1 || m.x < -400 || m.x > w + 400 || m.y > h + 400) {
            meteors.splice(i, 1);
            continue;
          }
          const fade = Math.sin(Math.PI * p);
          const a = fade * 0.9 * intensity;
          const nx = m.vx / Math.hypot(m.vx, m.vy);
          const ny = m.vy / Math.hypot(m.vx, m.vy);
          const tx = m.x - nx * m.len;
          const ty = m.y - ny * m.len;
          const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
          grad.addColorStop(0, `rgba(190,235,255,${a.toFixed(3)})`);
          grad.addColorStop(0.35, `rgba(120,190,255,${(a * 0.35).toFixed(3)})`);
          grad.addColorStop(1, "rgba(120,190,255,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = m.w;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.fillStyle = `rgba(225,245,255,${(a * 0.9).toFixed(3)})`;
          ctx.arc(m.x, m.y, m.w * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // pássaros
        ctx.globalCompositeOperation = "source-over";
        nextFlock -= dt;
        if (nextFlock <= 0) {
          if (!mobile()) spawnFlock();
          nextFlock = rnd(birdInterval * 0.7, birdInterval * 1.8);
        }
        for (let i = birds.length - 1; i >= 0; i--) {
          const b = birds[i]!;
          b.x += b.vx * dt;
          b.phase += dt * 6;
          if (b.x < -260 || b.x > w + 260) {
            birds.splice(i, 1);
            continue;
          }
          const flap = Math.sin(b.phase) * b.size * 0.5;
          ctx.strokeStyle = `rgba(200,215,240,${(b.alpha * intensity).toFixed(3)})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(b.x - b.size, b.y + flap);
          ctx.quadraticCurveTo(b.x - b.size * 0.4, b.y - flap * 0.6, b.x, b.y);
          ctx.quadraticCurveTo(b.x + b.size * 0.4, b.y - flap * 0.6, b.x + b.size, b.y + flap);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    build();
    raf = requestAnimationFrame(draw);

    const onResize = () => build();
    window.addEventListener("resize", onResize);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intensity, starCount, meteorInterval, meteorSpeed, birdInterval]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* céu / gradiente de profundidade */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(120% 80% at 15% -10%, oklch(0.65 0.28 320 / 0.15), transparent 60%), radial-gradient(100% 70% at 90% 0%, oklch(0.75 0.2 160 / 0.1), transparent 65%), radial-gradient(120% 90% at 50% 110%, oklch(0.65 0.28 320 / 0.12), transparent 70%)",
        }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {/* overlay sutil para legibilidade */}
      <div className="absolute inset-0 bg-background/25" />
    </div>
  );
}

export default NightSky;
