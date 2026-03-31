import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MembershipTier } from '../../types';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

const INSIDER_BENEFITS = [
  'Exclusive deals at partner restaurants',
  'Early access to new recommendations',
  'Save & organize unlimited lists',
  'AI-powered personalized recommendations',
  'Ad-free browsing experience',
] as const;

const PRICING = {
  monthly: { price: '$4.99', period: '/mo', planId: 'insider_monthly' },
  yearly: { price: '$39.99', period: '/yr', planId: 'insider_yearly', savings: 'Save 33%' },
} as const;

// ─── UpgradeCard ──────────────────────────────────────────────────────────────

interface UpgradeCardProps {
  variant?: 'full' | 'compact';
  onUpgrade?: (planId: string) => void;
}

export function UpgradeCard({ variant = 'full', onUpgrade }: UpgradeCardProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    setIsProcessing(true);
    setNotice(null);
    const plan = PRICING[selectedPlan];

    if (onUpgrade) {
      onUpgrade(plan.planId);
      setIsProcessing(false);
      return;
    }

    const result = await api.post<{ checkoutUrl?: string; status?: string; message?: string }>(
      '/api/insider/subscribe',
      { planId: plan.planId },
    );

    setIsProcessing(false);

    if (result.status === 'success' && result.data?.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
    } else if (result.status === 'success' && result.data?.status === 'coming_soon') {
      setNotice(result.data.message ?? 'Insider memberships are coming soon!');
    } else {
      setNotice('Something went wrong. Please try again later.');
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, var(--color-accentMuted) 100%)',
          textAlign: 'center',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ margin: '0 auto var(--space-3)' }}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <h3
          style={{
            fontSize: 'var(--font-base)',
            fontWeight: 600,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Unlock with Insider
        </h3>
        <p
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Starting at {PRICING.monthly.price}/mo
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleUpgrade}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Upgrade Now'}
        </button>
        {notice && (
          <p
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-textSecondary)',
              marginTop: 'var(--space-3)',
              textAlign: 'center',
            }}
          >
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: 'var(--space-8)',
        background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, var(--color-accentMuted) 100%)',
        border: '1px solid var(--color-accent)',
        textAlign: 'center',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-accentMuted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: 'var(--font-2xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Become an Insider
        </h2>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
          The best way to discover and save at restaurants you'll love.
        </p>
      </div>

      {/* Plan toggle */}
      <div
        style={{
          display: 'flex',
          background: 'var(--color-bgElevated)',
          borderRadius: 'var(--radius-full)',
          padding: 'var(--space-1)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <button
          onClick={() => setSelectedPlan('monthly')}
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: selectedPlan === 'monthly' ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
            background: selectedPlan === 'monthly' ? 'var(--color-bgSecondary)' : 'transparent',
            border: selectedPlan === 'monthly' ? '1px solid var(--color-border)' : '1px solid transparent',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
          }}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlan('yearly')}
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: selectedPlan === 'yearly' ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
            background: selectedPlan === 'yearly' ? 'var(--color-bgSecondary)' : 'transparent',
            border: selectedPlan === 'yearly' ? '1px solid var(--color-border)' : '1px solid transparent',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
          }}
        >
          Yearly
          {PRICING.yearly.savings && (
            <span
              style={{
                marginLeft: 'var(--space-2)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-success)',
                fontWeight: 700,
              }}
            >
              {PRICING.yearly.savings}
            </span>
          )}
        </button>
      </div>

      {/* Price display */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <span
          style={{
            fontSize: 'var(--font-4xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
          }}
        >
          {PRICING[selectedPlan].price}
        </span>
        <span
          style={{
            fontSize: 'var(--font-base)',
            color: 'var(--color-textMuted)',
          }}
        >
          {PRICING[selectedPlan].period}
        </span>
      </div>

      {/* Benefits */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 var(--space-6)',
          textAlign: 'left',
        }}
      >
        {INSIDER_BENEFITS.map((benefit) => (
          <li
            key={benefit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) 0',
              fontSize: 'var(--font-sm)',
              color: 'var(--color-textSecondary)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {benefit}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: 'var(--space-4) var(--space-6)',
          fontSize: 'var(--font-base)',
          fontWeight: 700,
        }}
        onClick={handleUpgrade}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
            Processing...
          </span>
        ) : (
          `Start Insider ${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'}`
        )}
      </button>

      <p
        style={{
          fontSize: 'var(--font-xs)',
          color: 'var(--color-textMuted)',
          marginTop: 'var(--space-3)',
        }}
      >
        Cancel anytime. No commitment.
      </p>
      {notice && (
        <p
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {notice}
        </p>
      )}
    </div>
  );
}

// ─── MembershipGate ───────────────────────────────────────────────────────────

interface MembershipGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function MembershipGate({ children, fallback }: MembershipGateProps) {
  const { isAuthenticated } = useAuth();
  const [membershipTier, setMembershipTier] = useState<MembershipTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setMembershipTier('free');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      setIsLoading(true);
      const result = await api.get<{ tier: MembershipTier }>('/api/insider/membership');

      if (cancelled) return;

      if (result.status === 'success' && result.data) {
        setMembershipTier(result.data.tier);
      } else {
        setMembershipTier('free');
      }
      setIsLoading(false);
    }

    fetchMembership();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  // Insider members see the content
  if (membershipTier === 'insider') {
    return <>{children}</>;
  }

  // Free tier sees the upgrade CTA overlay
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Blurred preview of children */}
      <div
        style={{
          filter: 'blur(6px)',
          opacity: 0.3,
          pointerEvents: 'none',
          userSelect: 'none',
          overflow: 'hidden',
          maxHeight: '400px',
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom, transparent 0%, var(--color-bgPrimary) 60%)',
          zIndex: 2,
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <UpgradeCard variant="compact" />
        </div>
      </div>
    </div>
  );
}

export default MembershipGate;
