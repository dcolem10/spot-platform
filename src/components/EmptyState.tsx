import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  secondaryLabel?: string;
  secondaryTo?: string;
}

export function EmptyState({ icon, title, description, ctaLabel, ctaTo, onCtaClick, secondaryLabel, secondaryTo }: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-12) var(--space-6)',
      textAlign: 'center',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{
        fontSize: '3rem',
        marginBottom: 'var(--space-4)',
        opacity: 0.8,
        lineHeight: 1,
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--font-xl)',
        fontWeight: 700,
        color: 'var(--color-textPrimary)',
        marginBottom: 'var(--space-2)',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 'var(--font-sm)',
        color: 'var(--color-textSecondary)',
        maxWidth: '360px',
        lineHeight: 1.6,
        marginBottom: ctaLabel ? 'var(--space-6)' : '0',
      }}>
        {description}
      </p>
      {(ctaLabel || secondaryLabel) && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {ctaLabel && (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (onCtaClick) onCtaClick();
                else if (ctaTo) navigate(ctaTo);
              }}
            >
              {ctaLabel}
            </button>
          )}
          {secondaryLabel && secondaryTo && (
            <button
              className="btn btn-secondary"
              onClick={() => navigate(secondaryTo)}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
