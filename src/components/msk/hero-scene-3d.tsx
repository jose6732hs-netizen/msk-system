import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function HeroFallback() {
  return (
    <div className="relative flex h-full min-h-[260px] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-primary/20 bg-black/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.14),transparent_55%)]" />
      <div className="absolute h-48 w-48 rounded-full border border-primary/30 shadow-[0_0_60px_rgba(57,255,20,0.12)]" />
      <div className="absolute h-32 w-32 rotate-45 rounded-3xl border border-fuchsia-500/40 bg-fuchsia-500/5" />
      <div className="relative z-10 rounded-2xl border border-primary/40 bg-background/70 px-6 py-4 text-center backdrop-blur-md">
        <div className="text-3xl font-black tracking-[0.18em] text-primary">MSK</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Sistema Inteligente</div>
      </div>
    </div>
  );
}

function supportsWebGL() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }))
    );
  } catch {
    return false;
  }
}

export const HeroScene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [mobile, setMobile] = useState(true);
  const [canWebGL, setCanWebGL] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 767px), (pointer: coarse)");
    const sync = () => {
      setMobile(query ? query.matches : window.innerWidth < 768);
      setCanWebGL(supportsWebGL());
    };
    sync();
    query?.addEventListener?.("change", sync);
    window.addEventListener("orientationchange", sync, { passive: true });
    return () => {
      query?.removeEventListener?.("change", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  useEffect(() => {
    if (mobile || !canWebGL || !containerRef.current) return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    const host = containerRef.current;

    try {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 320);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      camera.position.set(0, 0.5, 11);

      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "default",
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      host.replaceChildren(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const boxGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
      const boxEdges = new THREE.EdgesGeometry(boxGeometry);
      const wire = new THREE.LineSegments(
        boxEdges,
        new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.82 }),
      );
      group.add(wire);

      const knotGeometry = new THREE.TorusKnotGeometry(0.75, 0.13, 72, 10, 2, 3);
      const knotEdges = new THREE.EdgesGeometry(knotGeometry);
      const knot = new THREE.LineSegments(
        knotEdges,
        new THREE.LineBasicMaterial({ color: 0xff00a3, transparent: true, opacity: 0.9 }),
      );
      group.add(knot);

      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.3 + i * 0.65, 0.025, 8, 64),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xff00a3 : 0x39ff14,
            transparent: true,
            opacity: 0.22,
          }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -2.1;
        group.add(ring);
        rings.push(ring);
      }

      const clock = new THREE.Clock();
      const animate = () => {
        if (disposed || !renderer) return;
        const t = clock.getElapsedTime();
        group.rotation.y = t * 0.2;
        group.rotation.x = Math.sin(t * 0.45) * 0.08;
        knot.rotation.x = t * 0.35;
        knot.rotation.z = t * 0.18;
        rings.forEach((ring, index) => {
          ring.rotation.z = t * (0.05 + index * 0.025);
        });
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(animate);
      };
      animate();

      const resize = () => {
        if (!renderer || !host.isConnected) return;
        const w = Math.max(host.clientWidth, 320);
        const h = Math.max(host.clientHeight, 320);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      window.addEventListener("resize", resize, { passive: true });

      const lose = (event: Event) => {
        event.preventDefault?.();
        setFailed(true);
      };
      renderer.domElement.addEventListener("webglcontextlost", lose, false);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        renderer?.domElement.removeEventListener("webglcontextlost", lose, false);
        scene.traverse((object: any) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((m: any) => m.dispose?.());
          else object.material?.dispose?.();
        });
        renderer?.dispose();
        if (host.isConnected) host.replaceChildren();
      };
    } catch (error) {
      console.warn("[hero-3d] WebGL indisponível; usando fallback seguro.", error);
      renderer?.dispose();
      setFailed(true);
      return undefined;
    }
  }, [mobile, canWebGL]);

  if (mobile || failed || !canWebGL) return <HeroFallback />;
  return <div ref={containerRef} className="relative z-20 h-full min-h-[320px] w-full" aria-label="Visual 3D MSK" />;
};
