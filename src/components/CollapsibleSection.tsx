import { useState, useRef, useEffect, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On desktop, always show content
  const showContent = !isMobile || isOpen;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <button
        onClick={() => isMobile && setIsOpen(!isOpen)}
        aria-expanded={isMobile ? isOpen : undefined}
        aria-label={isMobile ? `${isOpen ? 'Collapse' : 'Expand'} ${title} section` : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 'var(--space-3) 0',
          background: 'none',
          border: 'none',
          cursor: isMobile ? 'pointer' : 'default',
          color: 'var(--color-textPrimary)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-lg)',
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            margin: 0,
          }}
        >
          {title}
        </h2>
        {isMobile && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-textMuted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-base)',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      <div
        ref={contentRef}
        style={{
          display: 'grid',
          gridTemplateRows: showContent ? '1fr' : '0fr',
          transition: isMobile ? 'grid-template-rows var(--transition-slow)' : 'none',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
