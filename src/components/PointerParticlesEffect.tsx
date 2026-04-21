import { useEffect, useRef } from 'react';

interface PointerState {
  x: number;
  y: number;
  mx: number;
  my: number;
}

interface Particle {
  x: number;
  y: number;
  mx: number;
  my: number;
  size: number;
  decay: number;
  speed: number;
  spread: number;
  spreadX: number;
  spreadY: number;
  color: string;
}

interface ParticleTheme {
  hueBase: number;
  hueSpan: number;
}

const FPS = 60;
const MS_PER_FRAME = 1000 / FPS;
const MAX_PARTICLES = 900;

function getParticleTheme(): ParticleTheme {
  const styles = getComputedStyle(document.documentElement);
  const hueBase = Number(styles.getPropertyValue('--particle-hue-base').trim()) || 338;
  const hueSpan = Number(styles.getPropertyValue('--particle-hue-span').trim()) || 16;
  return { hueBase, hueSpan };
}

function createParticle(pointer: PointerState, spread: number, speed: number, theme: ParticleTheme): Particle {
  const normalizedSpeed = Math.max(0.6, speed) * 0.08;
  const normalizedSpread = spread * normalizedSpeed;
  const hue = theme.hueBase + Math.random() * theme.hueSpan;
  const saturation = 72 + Math.random() * 12;
  const lightness = 62 + Math.random() * 10;
  const alpha = 0.14 + Math.random() * 0.12;

  return {
    x: pointer.x,
    y: pointer.y,
    mx: pointer.mx * 0.1,
    my: pointer.my * 0.1,
    size: Math.random() + 1,
    decay: 0.015,
    speed: normalizedSpeed,
    spread: normalizedSpread,
    spreadX: (Math.random() - 0.5) * normalizedSpread - pointer.mx * 0.1,
    spreadY: (Math.random() - 0.5) * normalizedSpread - pointer.my * 0.1,
    color: `hsla(${hue} ${saturation}% ${lightness}% / ${alpha})`,
  };
}

export function PointerParticlesEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const pointer: PointerState = { x: 0, y: 0, mx: 0, my: 0 };
    const particles: Particle[] = [];
    let particleTheme = getParticleTheme();
    let previousTime = performance.now();
    let animationFrame = 0;

    const setCanvasSize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const pushParticles = (event: PointerEvent | MouseEvent, count: number, spread: number, speed: number) => {
      particleTheme = getParticleTheme();
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.mx = 'movementX' in event ? event.movementX : 0;
      pointer.my = 'movementY' in event ? event.movementY : 0;

      for (let index = 0; index < count; index += 1) {
        particles.push(createParticle(pointer, spread, speed, particleTheme));
      }

      if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const velocity = Math.floor(Math.hypot(event.movementX, event.movementY));
      pushParticles(event, 12, 1, velocity);
    };

    const handleClick = (event: MouseEvent) => {
      pushParticles(event, 180, Math.random() + 50, Math.random() + 1);
    };

    const animate = (currentTime: number) => {
      animationFrame = window.requestAnimationFrame(animate);

      const elapsed = currentTime - previousTime;
      if (elapsed < MS_PER_FRAME) {
        return;
      }

      previousTime = currentTime - (elapsed % MS_PER_FRAME);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();

        particle.x += particle.spreadX * particle.size;
        particle.y += particle.spreadY * particle.size;
        particle.size -= particle.decay;

        if (particle.size <= 0.12) {
          particles.splice(index, 1);
        }
      }
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', setCanvasSize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70"
    />
  );
}
