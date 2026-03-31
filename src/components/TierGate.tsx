import { useSubscriptionTier, type SubscriptionTier } from '../hooks/useSubscriptionTier';

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
};

const TIER_PRICES: Record<SubscriptionTier, string> = {
  free: '',
  starter: '$49/mo',
  pro: '$99/mo',
  scale: '$149/mo',
};

interface TierGateProps {
  minTier: SubscriptionTier;
  children: React.ReactNode;
  /** Feature name shown in the upgrade prompt */
  featureName?: string;
}

/**
 * Gates content behind a minimum subscription tier.
 * Shows an upgrade prompt if the user's tier is insufficient.
 * In demo mode, all tiers are granted.
 */
export function TierGate({ minTier, children, featureName }: TierGateProps) {
  const { tier, isLoading, meetsMinTier } = useSubscriptionTier();

  if (isLoading) return null;

  if (meetsMinTier(minTier)) {
    return <>{children}</>;
  }

  return (
    <div className="page-container">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
        gap: '16px',
      }}>
        <div style={{ fontSize: '48px', lineHeight: 1 }}>🔒</div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem',
          color: 'var(--color-textPrimary)',
          margin: 0,
        }}>
          {featureName ? `${featureName} requires ` : 'Upgrade to '}
          {TIER_LABELS[minTier]} {TIER_PRICES[minTier]}
        </h2>
        <p style={{
          color: 'var(--color-textSecondary)',
          maxWidth: '400px',
          margin: 0,
          lineHeight: 1.6,
        }}>
          {minTier === 'pro'
            ? 'Unlock unlimited campaigns, AI insights, ROI reporting, and the editorial calendar.'
            : 'Unlock multi-creator collaborations, the ambassador program, and API access.'}
        </p>
        <p style={{ color: 'var(--color-textMuted)', fontSize: '0.875rem', margin: 0 }}>
          You are on the <strong style={{ color: 'var(--color-textSecondary)' }}>{TIER_LABELS[tier]}</strong> plan.
        </p>
        <a
          href="/app/dashboard"
          style={{
            marginTop: '8px',
            display: 'inline-block',
            padding: '12px 28px',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          Upgrade your plan
        </a>
      </div>
    </div>
  );
}
