import { useState, useEffect, useRef, useCallback } from 'react';

interface StreamingTextProps {
  /** Full text to animate */
  text: string;
  /** Words per second (default: 24) */
  speed?: number;
  /** Whether to animate at all (false = show instantly) */
  animate?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** CSS class applied to the container span */
  className?: string;
}

/**
 * Reveals text word-by-word with a smooth animation.
 * Skips animation if the text was already fully visible (e.g. replayed events).
 * Uses requestAnimationFrame for 60fps-smooth word reveals.
 */
export function StreamingText({
  text,
  speed = 24,
  animate = true,
  onComplete,
  className,
}: StreamingTextProps) {
  const words = text.split(/\s+/);
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : words.length);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const tick = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const count = Math.min(Math.floor((elapsed / 1000) * speed) + 1, words.length);
      setVisibleCount(count);

      if (count < words.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onCompleteRef.current?.();
      }
    },
    [speed, words.length],
  );

  useEffect(() => {
    if (!animate) {
      setVisibleCount(words.length);
      return;
    }
    startTimeRef.current = null;
    setVisibleCount(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [text, animate, tick, words.length]);

  const visible = words.slice(0, visibleCount).join(' ');
  const done = visibleCount >= words.length;

  return (
    <span className={className}>
      {visible}
      {!done && (
        <span
          className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-text-bottom animate-pulse"
          aria-hidden="true"
        />
      )}
    </span>
  );
}