import { useState, useEffect } from 'react';

import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface AmbassadorStatus {
  tier: 'bronze' | 'silver' | 'gold';
  referralCount: number;
  commissionEarned: number;
  referralCode: string | null;
}

interface Referral {
  referredUserId: string;
  referrerId: string;
  referralCode: string;
  createdAt: string;
}

type TierLevel = 'bronze' | 'silver' | 'gold';

/* ─── Tier Configuration ────────────────────────────────────────────────────── */

const TIER_CONFIG: Record<TierLevel, { color: string; badge: string; nextThreshold: number; description: string; commissionRate: number; benefits: string[] }> = {
  bronze: {
    color: '#CD7F32',
    badge: '🥉',
    nextThreshold: 5,
    description: '0-4 referrals',
    commissionRate: 10,
    benefits: [
      '10% commission on each referred creator\'s monthly subscription',
      'Ambassador badge on your profile',
      'Access to the Spot creator community',
    ],
  },
  silver: {
    color: '#C0C0C0',
    badge: '🥈',
    nextThreshold: 15,
    description: '5-14 referrals',
    commissionRate: 15,
    benefits: [
      '15% commission on each referred creator\'s monthly subscription',
      'Silver ambassador badge + featured profile placement',
      'Priority support (24-hour response SLA)',
      'Early access to new platform features',
    ],
  },
  gold: {
    color: '#FFD700',
    badge: '🥇',
    nextThreshold: Infinity,
    description: '15+ referrals',
    commissionRate: 20,
    benefits: [
      '20% commission on each referred creator\'s monthly subscription',
      'Gold ambassador badge + top placement in creator directory',
      'Dedicated account manager',
      'Exclusive access to premium restaurant partnerships',
      'Co-marketing opportunities with the Spot team',
    ],
  },
};

/* ─── Demo Data ─────────────────────────────────────────────────────────────── */

const DEMO_AMBASSADOR_STATUS: AmbassadorStatus = {
  tier: 'silver',
  referralCount: 8,
  commissionEarned: 2400,
  referralCode: 'REF-ABC12345',
};

const DEMO_REFERRALS: Referral[] = [
  {
    referredUserId: 'user-001',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-002',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-003',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-004',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-005',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-006',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-007',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    referredUserId: 'user-008',
    referrerId: 'user-demo',
    referralCode: 'REF-ABC12345',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

/* ─── Helper Functions ──────────────────────────────────────────────────────── */

function getProgressToNextTier(count: number, tier: TierLevel): { progress: number; needed: number } {
  const thresholds = { bronze: 0, silver: 5, gold: 15 };
  const currentMin = thresholds[tier];
  const nextMin = tier === 'gold' ? Infinity : TIER_CONFIG[tier].nextThreshold;

  if (tier === 'gold') {
    return { progress: 100, needed: 0 };
  }

  const progress = Math.min(100, Math.round(((count - currentMin) / (nextMin - currentMin)) * 100));
  const needed = Math.max(0, nextMin - count);

  return { progress, needed };
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  return `${months}mo ago`;
}

/* ─── Styles ────────────────────────────────────────────────────────────────── */

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 16px',
  } as React.CSSProperties,

  header: {
    marginBottom: '32px',
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    marginBottom: '8px',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,

  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  tierContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    marginBottom: '32px',
  } as React.CSSProperties,

  tierBadgeCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    padding: '32px 24px',
    background: 'linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%)',
    borderRadius: '12px',
    border: '2px solid #e8e8e8',
  } as React.CSSProperties,

  tierBadge: {
    fontSize: '64px',
    marginBottom: '16px',
  } as React.CSSProperties,

  tierName: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    marginBottom: '8px',
  } as React.CSSProperties,

  tierDescription: {
    fontSize: '14px',
    color: 'var(--color-textMuted)',
    marginBottom: '24px',
  } as React.CSSProperties,

  progressBar: {
    width: '100%',
    height: '8px',
    background: 'var(--color-bgElevated)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '12px',
  } as React.CSSProperties,

  progressFill: (progress: number, color: string) => ({
    height: '100%',
    width: `${progress}%`,
    background: color,
    transition: 'width 0.3s ease',
  } as React.CSSProperties),

  progressText: {
    fontSize: '12px',
    color: 'var(--color-textSecondary)',
    fontWeight: 500,
  } as React.CSSProperties,

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,

  metricBox: {
    padding: '16px',
    background: 'var(--color-bgSurface)',
    borderRadius: '8px',
    border: '1px solid #e8e8e8',
  } as React.CSSProperties,

  metricLabel: {
    fontSize: '12px',
    color: 'var(--color-textMuted)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as React.CSSProperties,

  metricValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--color-accent)',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    marginBottom: '16px',
    marginTop: '32px',
  } as React.CSSProperties,

  referralLinkContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  } as React.CSSProperties,

  referralLinkInput: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    background: 'var(--color-bgSurface)',
  } as React.CSSProperties,

  copyButton: {
    padding: '12px 20px',
    background: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,

  copyButtonHover: {
    background: 'var(--color-accentHover)',
  } as React.CSSProperties,

  referralsList: {
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e8e8e8',
  } as React.CSSProperties,

  referralItem: {
    padding: '16px',
    borderBottom: '1px solid #e8e8e8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,

  referralItemLast: {
    borderBottom: 'none',
  } as React.CSSProperties,

  referralUserName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,

  referralDate: {
    fontSize: '12px',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 24px',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,

  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  } as React.CSSProperties,

  emptyStateText: {
    fontSize: '14px',
  } as React.CSSProperties,

  generateButton: {
    padding: '12px 20px',
    background: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,

  loadingSpinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid #e8e8e8',
    borderTopColor: 'var(--color-accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  errorMessage: {
    padding: '12px 16px',
    background: 'var(--color-errorMuted)',
    color: 'var(--color-error)',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,

  successMessage: {
    padding: '12px 16px',
    background: 'var(--color-successMuted)',
    color: 'var(--color-success)',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
};

/* ─── Components ────────────────────────────────────────────────────────────── */

function TierBadge({ tier, count }: { tier: TierLevel; count: number }) {
  const config = TIER_CONFIG[tier];
  const { progress, needed } = getProgressToNextTier(count, tier);

  return (
    <div style={styles.tierBadgeCard}>
      <div style={styles.tierBadge}>{config.badge}</div>
      <div style={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Ambassador</div>
      <div style={styles.tierDescription}>{config.description}</div>

      {tier !== 'gold' && (
        <>
          <div style={styles.progressBar}>
            <div style={styles.progressFill(progress, config.color)} />
          </div>
          <div style={styles.progressText}>
            {needed} more referrals to reach {TIER_CONFIG[tier === 'bronze' ? 'silver' : 'gold'].description?.split('-')[0].trim() || 'next tier'}
          </div>
        </>
      )}

      {tier === 'gold' && (
        <div style={{ ...styles.progressText, color: config.color }}>
          You've reached the top tier!
        </div>
      )}
    </div>
  );
}

function ReferralLinkShare({
  referralCode,
  onGenerateCode,
  isGenerating,
}: {
  referralCode: string | null;
  onGenerateCode: () => void;
  isGenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!referralCode) {
    return (
      <button
        onClick={onGenerateCode}
        disabled={isGenerating}
        style={styles.generateButton}
        onMouseEnter={(e) => {
          if (!isGenerating) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accentHover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent)';
        }}
      >
        {isGenerating ? (
          <>
            <div style={styles.loadingSpinner} /> Generating...
          </>
        ) : (
          'Generate Referral Link'
        )}
      </button>
    );
  }

  return (
    <div style={styles.referralLinkContainer}>
      <input
        type="text"
        readOnly
        value={referralCode}
        style={styles.referralLinkInput}
      />
      <button
        onClick={handleCopy}
        style={styles.copyButton}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accentHover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent)';
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function ReferralsList({ referrals }: { referrals: Referral[] }) {
  if (!referrals.length) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyStateIcon}>👥</div>
        <div style={styles.emptyStateText}>No referrals yet. Share your code to get started!</div>
      </div>
    );
  }

  return (
    <div style={styles.referralsList}>
      {referrals.map((ref, idx) => (
        <div
          key={ref.referredUserId}
          style={{
            ...styles.referralItem,
            ...(idx === referrals.length - 1 ? styles.referralItemLast : {}),
          }}
        >
          <div>
            <div style={styles.referralUserName}>{ref.referredUserId}</div>
            <div style={styles.referralDate}>{formatDate(ref.createdAt)}</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-textMuted)' }}>Joined</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export default function AmbassadorDashboard() {
  const [ambassadorStatus, setAmbassadorStatus] = useState<AmbassadorStatus | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (isDemoMode()) {
          setAmbassadorStatus(DEMO_AMBASSADOR_STATUS);
          setReferrals(DEMO_REFERRALS);
          setIsLoading(false);
          return;
        }

        const [statusRes, referralsRes] = await Promise.all([
          api.get<AmbassadorStatus>('/api/ambassador/status'),
          api.get<Referral[]>('/api/ambassador/referrals'),
        ]);

        if (statusRes.status === 'success' && statusRes.data) {
          setAmbassadorStatus(statusRes.data);
        } else {
          setError(statusRes.error || 'Failed to load ambassador status');
        }

        if (referralsRes.status === 'success' && referralsRes.data) {
          setReferrals(referralsRes.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleGenerateCode = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setSuccess(null);

      const res = await api.post<AmbassadorStatus>('/api/ambassador/generate-link');

      if (res.status === 'success' && res.data) {
        setAmbassadorStatus(res.data);
        setSuccess('Referral code generated successfully!');
      } else {
        setError(res.error || 'Failed to generate referral code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Ambassador Program</div>
        </div>
        <div style={styles.card}>
          <div style={styles.emptyState}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!ambassadorStatus) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Ambassador Program</div>
        </div>
        <div style={styles.card}>
          <div style={styles.errorMessage}>
            {error || 'Failed to load ambassador information'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={styles.header}>
        <div style={styles.title}>Ambassador Program</div>
        <div style={styles.subtitle}>
          Earn rewards by referring creators to the Spot Platform
        </div>
      </div>

      {error && <div style={styles.errorMessage}>{error}</div>}
      {success && <div style={styles.successMessage}>{success}</div>}

      <div style={styles.tierContainer}>
        <TierBadge tier={ambassadorStatus.tier} count={ambassadorStatus.referralCount} />
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Share Your Referral Code</div>
          <ReferralLinkShare
            referralCode={ambassadorStatus.referralCode}
            onGenerateCode={handleGenerateCode}
            isGenerating={isGenerating}
          />
          <div style={styles.metricsGrid}>
            <div style={styles.metricBox}>
              <div style={styles.metricLabel}>Total Referrals</div>
              <div style={styles.metricValue}>{ambassadorStatus.referralCount}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricLabel}>Commission Earned</div>
              <div style={styles.metricValue}>
                ${ambassadorStatus.commissionEarned.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-textMuted)', marginTop: '4px' }}>
                {TIER_CONFIG[ambassadorStatus.tier].commissionRate}% rate · {ambassadorStatus.tier} tier
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Your Referrals</div>
        <ReferralsList referrals={referrals} />
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Tier Benefits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {((['bronze', 'silver', 'gold'] as TierLevel[])).map((tier) => {
            const config = TIER_CONFIG[tier];
            const isCurrentTier = ambassadorStatus.tier === tier;
            return (
              <div
                key={tier}
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${isCurrentTier ? config.color : '#e8e8e8'}`,
                  background: isCurrentTier ? `${config.color}12` : 'var(--color-bgSurface)',
                  position: 'relative',
                }}
              >
                {isCurrentTier && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '12px',
                    background: config.color,
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Current
                  </div>
                )}
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{config.badge}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-textPrimary)', marginBottom: '4px' }}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-textMuted)', marginBottom: '12px' }}>
                  {config.description}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: config.color, marginBottom: '12px' }}>
                  {config.commissionRate}% commission
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', listStyle: 'none' }}>
                  {config.benefits.map((benefit, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--color-textSecondary)', marginBottom: '6px', display: 'flex', gap: '6px' }}>
                      <span style={{ color: config.color, flexShrink: 0 }}>✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--color-textMuted)', lineHeight: '1.6' }}>
          Commission is paid monthly on active subscriptions of creators you referred. Payouts require a minimum balance of $50 and are processed via Stripe.
        </div>
      </div>
    </div>
  );
}
