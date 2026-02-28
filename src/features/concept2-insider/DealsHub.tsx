import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DealOffer, MembershipTier } from '../../types';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_DEALS } from '../../data/demoData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiration(expiresAt?: string): string | null {
  if (!expiresAt) return null;

  const expDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();

  if (diffMs < 0) return 'Expired';

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays <= 7) return `Expires in ${diffDays} days`;

  return `Expires ${expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DealCardProps {
  deal: DealOffer;
  membershipTier: MembershipTier;
  onRedeem: (dealId: string) => void;
}

function DealCard({ deal, membershipTier, onRedeem }: DealCardProps) {
  const [isRedeeming, setIsRedeeming] = useState(false);
  const isLocked = deal.insiderOnly && membershipTier === 'free';
  const expirationText = formatExpiration(deal.expiresAt);
  const isExpired = expirationText === 'Expired';

  const handleRedeem = useCallback(async () => {
    if (isLocked || isExpired) return;
    setIsRedeeming(true);
    await onRedeem(deal.dealId);
    setIsRedeeming(false);
  }, [deal.dealId, isLocked, isExpired, onRedeem]);

  return (
    <article
      className="card"
      style={{
        position: 'relative',
        opacity: isExpired ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Lock overlay for non-insiders */}
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 17, 23, 0.6)',
            backdropFilter: 'blur(3px)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            padding: 'var(--space-6)',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 'var(--space-3)' }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p
            style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              color: 'var(--color-textPrimary)',
              marginBottom: 'var(--space-3)',
              textAlign: 'center',
            }}
          >
            Insider members only
          </p>
          <a
            className="btn btn-primary"
            href="/app/deals"
            style={{ fontSize: 'var(--font-sm)', textDecoration: 'none' }}
          >
            Upgrade to Insider
          </a>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div>
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-textMuted)',
              fontWeight: 500,
            }}
          >
            {deal.restaurantName}
          </span>
          <h3
            style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 600,
              color: 'var(--color-textPrimary)',
              marginTop: 'var(--space-1)',
            }}
          >
            {deal.title}
          </h3>
        </div>
        {deal.insiderOnly && (
          <span className="badge badge--accent" style={{ flexShrink: 0 }}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '4px' }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Insider
          </span>
        )}
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--color-textSecondary)',
          lineHeight: 1.5,
          marginBottom: 'var(--space-4)',
          flex: 1,
        }}
      >
        {deal.description}
      </p>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {expirationText && (
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: isExpired ? 'var(--color-error)' : 'var(--color-textMuted)',
              fontWeight: 500,
            }}
          >
            {expirationText}
          </span>
        )}

        {!isLocked && !isExpired && (
          <button
            className="btn btn-primary"
            style={{ fontSize: 'var(--font-sm)', marginLeft: 'auto' }}
            onClick={handleRedeem}
            disabled={isRedeeming}
          >
            {isRedeeming ? (
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            ) : (
              'Redeem'
            )}
          </button>
        )}

        {isExpired && !isLocked && (
          <span
            className="badge badge--error"
            style={{ marginLeft: 'auto' }}
          >
            Expired
          </span>
        )}
      </div>
    </article>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-5)',
      }}
    >
      <h2
        style={{
          fontSize: 'var(--font-xl)',
          fontWeight: 700,
          color: 'var(--color-textPrimary)',
        }}
      >
        {title}
      </h2>
      <span
        style={{
          fontSize: 'var(--font-xs)',
          color: 'var(--color-textMuted)',
          background: 'var(--color-bgElevated)',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-full)',
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DealsHub() {
  const { isAuthenticated } = useAuth();

  const [deals, setDeals] = useState<DealOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipTier, setMembershipTier] = useState<MembershipTier>('free');

  // Fetch deals
  useEffect(() => {
    let cancelled = false;

    async function fetchDeals() {
      setIsLoading(true);
      setError(null);

      const result = await api.get<DealOffer[]>('/api/insider/deals', { public: true });

      if (cancelled) return;

      if (result.status === 'success' && result.data && result.data.length > 0) {
        setDeals(result.data);
      } else if (isDemoMode) {
        setDeals(DEMO_DEALS);
      } else if (result.error) {
        setError(result.error);
      }
      setIsLoading(false);
    }

    fetchDeals();
    return () => { cancelled = true; };
  }, []);

  // Fetch membership tier
  useEffect(() => {
    if (!isAuthenticated) {
      setMembershipTier('free');
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      const result = await api.get<{ tier: MembershipTier }>('/api/insider/membership');
      if (!cancelled && result.status === 'success' && result.data) {
        setMembershipTier(result.data.tier);
      }
    }

    fetchMembership();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const insiderDeals = useMemo(
    () => deals.filter((d) => d.insiderOnly),
    [deals]
  );

  const featuredDeals = useMemo(
    () => deals.filter((d) => !d.insiderOnly),
    [deals]
  );

  const navigate = useNavigate();

  const handleRedeem = useCallback(async (dealId: string) => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const result = await api.post(`/api/insider/deals/${dealId}/redeem`);

    if (result.status === 'success') {
      // Could show a toast/modal with the redemption code here
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Deals</h1>
        <p className="page-subtitle">
          Exclusive offers from restaurants we love.
        </p>
      </header>

      {/* Upgrade banner for free users */}
      {membershipTier === 'free' && (
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-accentMuted) 0%, var(--color-warningMuted) 100%)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <div>
              <p
                style={{
                  fontSize: 'var(--font-base)',
                  fontWeight: 600,
                  color: 'var(--color-textPrimary)',
                }}
              >
                Unlock all Insider deals
              </p>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                Get access to members-only discounts at partner restaurants.
              </p>
            </div>
          </div>
          <a
            className="btn btn-primary"
            href="/app/deals"
            style={{ textDecoration: 'none' }}
          >
            Upgrade to Insider
          </a>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div>
          <LoadingSkeleton height="24px" width="200px" />
          <div style={{ marginTop: 'var(--space-5)' }} className="card-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card">
                <LoadingSkeleton height="14px" width="40%" />
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <LoadingSkeleton height="20px" width="80%" />
                </div>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <LoadingSkeleton height="14px" width="100%" count={2} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="empty-state">
          <h3>Something went wrong</h3>
          <p style={{ color: 'var(--color-error)' }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && deals.length === 0 && (
        <div className="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-textMuted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 'var(--space-4)', opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>No deals available right now</h3>
          <p>Check back soon — new deals drop weekly.</p>
        </div>
      )}

      {/* Insider Deals Section */}
      {!isLoading && !error && insiderDeals.length > 0 && (
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <SectionHeader title="Insider Deals" count={insiderDeals.length} />
          <div className="card-grid stagger-children">
            {insiderDeals.map((deal) => (
              <DealCard
                key={deal.dealId}
                deal={deal}
                membershipTier={membershipTier}
                onRedeem={handleRedeem}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured Deals Section */}
      {!isLoading && !error && featuredDeals.length > 0 && (
        <section>
          <SectionHeader title="Featured Deals" count={featuredDeals.length} />
          <div className="card-grid stagger-children">
            {featuredDeals.map((deal) => (
              <DealCard
                key={deal.dealId}
                deal={deal}
                membershipTier={membershipTier}
                onRedeem={handleRedeem}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export { DealCard, SectionHeader };

export default DealsHub;
