import { useRef, useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { useTheme } from 'next-themes';

// Theme-specific color palettes (Ink Wash: #4A4A4A, #CBCBCB, #FFFFE3, #6D8196)
const colorPalettes = {
  dark: {
    color1: '#6D8196',
    color2: '#4A4A4A',
    color3: '#3A3A3A',
  },
  light: {
    color1: '#CBCBCB',
    color2: '#FFFFE3',
    color3: '#6D8196',
  },
};

// Define unique gradient states for each section
const sectionStates = {
  hero: {
    rotationX: 50,
    rotationZ: -60,
    cameraZoom: 9.1,
    cDistance: 2.81,
    cAzimuthAngle: 180,
    cPolarAngle: 80,
    uDensity: 3,
  },
  secondary: {
    rotationX: 46,
    rotationZ: -56,
    cameraZoom: 8.7,
    cDistance: 2.91,
    cAzimuthAngle: 186,
    cPolarAngle: 78,
    uDensity: 2.9,
  },
};

// Lerp helper function
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Interpolate between two section states
function interpolateStates(
  stateA: typeof sectionStates.hero,
  stateB: typeof sectionStates.hero,
  t: number
) {
  return {
    rotationX: lerp(stateA.rotationX, stateB.rotationX, t),
    rotationZ: lerp(stateA.rotationZ, stateB.rotationZ, t),
    cameraZoom: lerp(stateA.cameraZoom, stateB.cameraZoom, t),
    cDistance: lerp(stateA.cDistance, stateB.cDistance, t),
    cAzimuthAngle: lerp(stateA.cAzimuthAngle, stateB.cAzimuthAngle, t),
    cPolarAngle: lerp(stateA.cPolarAngle, stateB.cPolarAngle, t),
    uDensity: lerp(stateA.uDensity, stateB.uDensity, t),
  };
}

// Get interpolated state based on scroll progress (0-1)
function getInterpolatedState(progress: number) {
  const sections = [
    { start: 0, end: 0.5, from: sectionStates.hero, to: sectionStates.secondary },
    { start: 0.5, end: 1, from: sectionStates.secondary, to: sectionStates.secondary },
  ];

  for (const section of sections) {
    if (progress >= section.start && progress <= section.end) {
      const sectionProgress = (progress - section.start) / (section.end - section.start);
      return interpolateStates(section.from, section.to, sectionProgress);
    }
  }

  return sectionStates.hero;
}

export function UnifiedShaderGradient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: false,
    threshold: 0.01,
    rootMargin: '200px',
  });

  // State to hold the computed gradient parameters
  const [gradientParams, setGradientParams] = useState(sectionStates.hero);

  // Get theme-appropriate colors
  const colors = colorPalettes[resolvedTheme === 'light' ? 'light' : 'dark'];

  // Track scroll progress using window scroll
  useEffect(() => {
    let animationFrame: number;
    let currentProgress = 0;
    const targetProgress = { value: 0 };

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      targetProgress.value = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;
    };

    // Smooth animation loop — delta-time normalised so behaviour is
    // frame-rate independent.  smoothing ≈ 12 means ~83 ms half-life
    // (feels responsive without jitter).
    const smoothing = 12;
    let lastTime: number | null = null;

    const animate = (timestamp: number) => {
      if (lastTime === null) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100 ms to avoid jumps after tab switch
      lastTime = timestamp;
      const diff = targetProgress.value - currentProgress;
      // 1 - e^(-smoothing * dt) gives a frame-rate independent lerp factor
      const factor = 1 - Math.exp(-smoothing * dt);
      currentProgress += diff * factor;
      if (Math.abs(diff) > 0.0001) {
        const interpolated = getInterpolatedState(currentProgress);
        setGradientParams(interpolated);
      }
      animationFrame = requestAnimationFrame(animate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  // Respect reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        inViewRef(el);
      }}
      className="fixed inset-0 z-0" aria-hidden="true"
    >
      {inView && (
        <ShaderGradientCanvas
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          pixelDensity={1.5}
          fov={45}
          pointerEvents="none"
        >
          <ShaderGradient
            control="props"
            animate={prefersReducedMotion ? 'off' : 'on'}
            type="waterPlane"
            shader="defaults"
            color1={colors.color1}
            color2={colors.color2}
            color3={colors.color3}
            uSpeed={0.3}
            uStrength={1}
            uDensity={gradientParams.uDensity}
            uFrequency={0}
            uAmplitude={0}
            uTime={8}
            positionX={0}
            positionY={0}
            positionZ={0}
            rotationX={gradientParams.rotationX}
            rotationY={0}
            rotationZ={gradientParams.rotationZ}
            cAzimuthAngle={gradientParams.cAzimuthAngle}
            cPolarAngle={gradientParams.cPolarAngle}
            cDistance={gradientParams.cDistance}
            cameraZoom={gradientParams.cameraZoom}
            brightness={1}
            envPreset="city"
            lightType="3d"
            reflection={0.1}
            grain="off"
            wireframe={false}
          />
        </ShaderGradientCanvas>
      )}
    </div>
  );
}
