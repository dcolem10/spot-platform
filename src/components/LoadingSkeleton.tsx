import { type CSSProperties } from 'react';

interface Props {
  width?: string;
  height?: string;
  borderRadius?: string;
  count?: number;
}

export function LoadingSkeleton({
  width = '100%',
  height = '20px',
  borderRadius,
  count = 1,
}: Props) {
  const style: CSSProperties = {
    width,
    height,
    borderRadius: borderRadius ?? 'var(--radius-md)',
    background: 'var(--color-bgElevated)',
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  };

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ ...style, marginBottom: i < count - 1 ? 'var(--space-3)' : 0 }} />
      ))}
    </>
  );
}
