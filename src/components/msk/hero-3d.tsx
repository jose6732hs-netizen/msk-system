import React, { useEffect, useRef, useMemo } from 'react';
import { useLocation } from '@tanstack/react-router';

interface Hero3DProps {
  intensity?: number;
}

export const Hero3D: React.FC<Hero3DProps> = ({ intensity = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const location = useLocation();

  // Optimization: reduce elements on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const countMultiplier = isMobile ? 0.5 : 1.0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = 600; // Fixed height for hero section

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = 600;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) - 0.5,
        y: (e.clientY / window.innerHeight) - 0.5
      };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Orbital Elements Definition
    interface OrbitalElement {
      label: string;
      icon: string;
      angle: number;
      distance: number;
      speed: number;
      z: number; // For parallax and scale
      rotation: number;
      rotationSpeed: number;
      color: string;
      energyPath?: number[]; // Path sequence
    }

    const elements: OrbitalElement[] = [
      { label: 'Código', icon: '</>', angle: 0, distance: 200, speed: 0.005, z: 1.2, rotation: 0, rotationSpeed: 0.01, color: '#3B82F6' },
      { label: 'IA', icon: 'IA', angle: Math.PI / 3, distance: 250, speed: -0.004, z: 0.8, rotation: 0, rotationSpeed: -0.005, color: '#8B5CF6' },
      { label: 'Resultados', icon: '📈', angle: (2 * Math.PI) / 3, distance: 180, speed: 0.006, z: 1.5, rotation: 0, rotationSpeed: 0.008, color: '#10B981' },
      { label: 'Trabalho', icon: '💼', angle: Math.PI, distance: 220, speed: -0.003, z: 0.7, rotation: 0, rotationSpeed: -0.003, color: '#F59E0B' },
      { label: 'Estudo', icon: '📖', angle: (4 * Math.PI) / 3, distance: 150, speed: 0.007, z: 1.1, rotation: 0, rotationSpeed: 0.012, color: '#EC4899' },
      { label: 'Financeiro', icon: '$', angle: (5 * Math.PI) / 3, distance: 280, speed: -0.002, z: 0.5, rotation: 0, rotationSpeed: -0.002, color: '#FACC15' },
    ];

    // Core Pulse State
    let pulse = 0;
    let energyActive = false;
    let energyProgress = 0;
    let currentPath = [0, 1, 2, 3]; // Indices of elements for the path

    const drawCore = (x: number, y: number, scale: number) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 60 * scale);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 80 * scale * (1 + Math.sin(pulse) * 0.1), 0, Math.PI * 2);
      ctx.fill();

      // Core details
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Orbital rings
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 / (i + 1)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, (50 + i * 40) * scale, (20 + i * 15) * scale, pulse * (0.1 * (i + 1)), 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawElement = (el: OrbitalElement, centerX: number, centerY: number) => {
      // Parallax effect with mouse
      const offsetX = mouseRef.current.x * 30 * el.z;
      const offsetY = mouseRef.current.y * 30 * el.z;
      
      const x = centerX + Math.cos(el.angle) * el.distance + offsetX;
      const y = centerY + Math.sin(el.angle) * (el.distance * 0.4) + offsetY; // Elliptical orbit
      const scale = (el.z * 0.5 + 0.5) * (1 + Math.sin(pulse) * 0.05);

      // Element glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30 * scale);
      gradient.addColorStop(0, el.color + '33');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 30 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Element content
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(el.rotation);
      ctx.scale(scale, scale);
      
      ctx.fillStyle = el.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = el.color;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.icon, 0, 0);
      
      ctx.restore();

      // Label (only if not moving too fast)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(el.label, x, y + 25 * scale);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      pulse += 0.02;

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw connections
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      elements.forEach((el, i) => {
        const nextEl = elements[(i + 1) % elements.length];
        if (!el || !nextEl) return;

        const x1 = centerX + Math.cos(el.angle) * el.distance + mouseRef.current.x * 30 * el.z;
        const y1 = centerY + Math.sin(el.angle) * (el.distance * 0.4) + mouseRef.current.y * 30 * el.z;
        const x2 = centerX + Math.cos(nextEl.angle) * nextEl.distance + mouseRef.current.x * 30 * nextEl.z;
        const y2 = centerY + Math.sin(nextEl.angle) * (nextEl.distance * 0.4) + mouseRef.current.y * 30 * nextEl.z;
        
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(centerX, centerY);
      });
      ctx.stroke();

      // Draw energy path if active
      if (Math.random() < 0.01 && !energyActive) {
        energyActive = true;
        energyProgress = 0;
      }

      if (energyActive) {
        energyProgress += 0.01;
        if (energyProgress >= 1) {
          energyActive = false;
        } else {
          // Draw energy bolt
          const el = elements[0];
          if (el) {
            ctx.beginPath();
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#8B5CF6';
            
            const xStart = centerX;
            const yStart = centerY;
            const xEnd = centerX + Math.cos(el.angle) * el.distance + mouseRef.current.x * 30 * el.z;
            const yEnd = centerY + Math.sin(el.angle) * (el.distance * 0.4) + mouseRef.current.y * 30 * el.z;
            
            const curX = xStart + (xEnd - xStart) * energyProgress;
            const curY = yStart + (yEnd - yStart) * energyProgress;
            
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(curX, curY);
            ctx.stroke();
          }
        }
      }

      drawCore(centerX, centerY, intensity);

      // Update and draw elements
      elements.forEach(el => {
        el.angle += el.speed * intensity;
        el.rotation += el.rotationSpeed * intensity;
        drawElement(el, centerX, centerY);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-70"
      style={{ filter: 'blur(0.5px)' }}
    />
  );
};
