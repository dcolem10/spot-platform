import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import type { SpringOptions } from 'framer-motion';

interface SpotlightProps {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
  fill?: string;
}

/**
 * Mouse-tracking radial spotlight that follows the cursor within
 * its parent element. Uses framer-motion springs for smooth physics.
 * Adapted for Spot Platform's Dopamine Design system — uses CSS
 * custom properties for the glow color instead of Tailwind.
 */
export function Spotlight({
  className,
  size = 200,
  springOptions = { bounce: 0 },
  fill,
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null);

  const mouseX = useSpring(0, springOptions);
  const mouseY = useSpring(0, springOptions);

  const spotlightLeft = useTransform(mouseX, (x) => `${x - size / 2}px`);
  const spotlightTop = useTransform(mouseY, (y) => `${y - size / 2}px`);

  useEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';
        setParentElement(parent);
      }
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement) return;
      const { left, top } = parentElement.getBoundingClientRect();
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    },
    [mouseX, mouseY, parentElement]
  );

  useEffect(() => {
    if (!parentElement) return;

    const onEnter = () => setIsHovered(true);
    const onLeave = () => setIsHovered(false);

    parentElement.addEventListener('mousemove', handleMouseMove);
    parentElement.addEventListener('mouseenter', onEnter);
    parentElement.addEventListener('mouseleave', onLeave);

    return () => {
      parentElement.removeEventListener('mousemove', handleMouseMove);
      parentElement.removeEventListener('mouseenter', onEnter);
      parentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [parentElement, handleMouseMove]);

  // Default glow uses our accent color
  const glowColor = fill || 'rgba(249, 115, 22, 0.15)';

  return (
    <motion.div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        borderRadius: '50%',
        width: size,
        height: size,
        left: spotlightLeft,
        top: spotlightTop,
        background: `radial-gradient(circle at center, ${glowColor}, transparent 80%)`,
        filter: 'blur(20px)',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 200ms ease',
        zIndex: 1,
      }}
    />
  );
}
