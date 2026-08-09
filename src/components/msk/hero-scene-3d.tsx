import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const HeroScene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 1, 12);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    
    // Ensure instant display
    renderer.compile(scene, camera);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. FLOOR RINGS (Neon Rose/Pink)
    const ringGroup = new THREE.Group();
    ringGroup.position.y = -3.5;
    mainGroup.add(ringGroup);

    const ringCount = 3;
    const ringMaterials: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < ringCount; i++) {
      const ringGeo = new THREE.TorusGeometry(2 + i * 0.8, 0.03, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: 0xFF00A3, // Neon Rose
        transparent: true, 
        opacity: 0.5 - i * 0.1 
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ringGroup.add(ring);
      ringMaterials.push(ringMat);
    }

    // 2. CENTRAL HOLOGRAPHIC CUBE
    const coreGroup = new THREE.Group();
    mainGroup.add(coreGroup);

    // Outer wireframe box
    const boxGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ 
      color: 0x39FF14, // Neon Green
      transparent: true, 
      opacity: 0.8 
    });
    const wireframeBox = new THREE.LineSegments(boxEdges, boxMat);
    coreGroup.add(wireframeBox);

    // INFINITY SYMBOL (Wireframe style)
    const infinityCurve = new THREE.TorusKnotGeometry(0.7, 0.15, 128, 16, 2, 3);
    const infinityEdges = new THREE.EdgesGeometry(infinityCurve);
    const infinityMat = new THREE.LineBasicMaterial({ 
      color: 0xFF00A3, // Neon Rose
      transparent: true, 
      opacity: 0.9 
    });
    const infinity = new THREE.LineSegments(infinityEdges, infinityMat);
    coreGroup.add(infinity);

    // 3. FLOATING LABELS (Nodes) - Updated with custom icons/names
    const labels = [
      { name: 'Cérebro', icon: '🧠' }, 
      { name: 'Investimento', icon: '💰' }, 
      { name: 'Negócios', icon: '💼' }, 
      { name: 'Acordo', icon: '🤝' }, 
      { name: 'Automação', icon: '⚙️' }, 
      { name: 'Voz/IA', icon: '🎙️' }
    ];
    const labelData = labels.map((data, i) => {
      const angle = (i / labels.length) * Math.PI * 2;
      const radius = 5;
      return {
        ...data,
        basePos: new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5),
        angle
      };
    });

    const labelMeshes: THREE.Group[] = [];
    const connectionLines: THREE.Line[] = [];

    labelData.forEach(data => {
      const labelGroup = new THREE.Group();
      labelGroup.position.copy(data.basePos);
      mainGroup.add(labelGroup);
      labelMeshes.push(labelGroup);

      // Label background (Dark transparent)
      const plateGeo = new THREE.PlaneGeometry(1.6, 0.6);
      const plateMat = new THREE.MeshBasicMaterial({ 
        color: 0x0F0F0F, 
        transparent: true, 
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      labelGroup.add(plate);

      // Plate border
      const plateEdges = new THREE.EdgesGeometry(plateGeo);
      const plateLine = new THREE.LineSegments(plateEdges, new THREE.LineBasicMaterial({ color: 0xFF00A3, opacity: 0.4, transparent: true }));
      labelGroup.add(plateLine);

      // Label Text (Using Canvas Texture for emoji + name)
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#39FF14'; // Neon Green text on labels
        ctx.font = 'bold 40px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${data.icon} ${data.name}`, 128, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), textMat);
        textPlane.position.z = 0.01;
        labelGroup.add(textPlane);
      }

      // Connection Line to Core
      const points = [new THREE.Vector3(0,0,0), data.basePos.clone()];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x39FF14, transparent: true, opacity: 0.15 }));
      mainGroup.add(line);
      connectionLines.push(line);
    });

    // 4. ANIMATION & INTERACTIVITY
    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2();

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      const time = clock.getElapsedTime();

      // Smooth Parallax
      mainGroup.rotation.y += (mouse.x * 0.2 - mainGroup.rotation.y) * 0.05;
      mainGroup.rotation.x += (-mouse.y * 0.15 - mainGroup.rotation.x) * 0.05;

      // Core Animation
      coreGroup.rotation.y = time * 0.3;
      coreGroup.rotation.z = Math.sin(time * 0.5) * 0.1;
      const pulse = 1 + Math.sin(time * 2) * 0.05;
      coreGroup.scale.set(pulse, pulse, pulse);

      infinity.rotation.x = time * 0.5;
      
      // Nodes Floating & Lines Updating
      labelMeshes.forEach((mesh, i) => {
        const d = labelData[i]!;
        mesh.position.y = d.basePos.y + Math.sin(time + i) * 0.2;
        mesh.position.x = d.basePos.x + Math.cos(time * 0.8 + i) * 0.15;
        mesh.lookAt(camera.position); // Always face camera

        // Update line geometry
        const line = connectionLines[i];
        if (line) {
          const pos = line.geometry.attributes['position'];
          if (pos) {
            const arr = pos.array as Float32Array;
            arr[3] = mesh.position.x;
            arr[4] = mesh.position.y;
            arr[5] = mesh.position.z;
            pos.needsUpdate = true;
          }
        }
      });

      // Rings Rotation & Pulse
      ringGroup.rotation.y = time * 0.1;
      ringMaterials.forEach((mat, i) => {
        mat.opacity = (0.5 - i * 0.1) * (0.7 + Math.sin(time * 3 + i) * 0.3);
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full relative z-20" />;
};