import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_CAMPAIGNS, DEMO_OFFERS, DEMO_CAMPAIGN_REPORTS } from '../../data/demoData';
import type { Campaign, Offer, CampaignReport } from '../../types';

interface PartnerDashboardData {
  campaigns: Campaign[];
  offers: Offer[];
  reports: CampaignReport[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_BADGE: Record<string, string> = {
  inquiry: 'badge--info',
  negotiation: 'badge--warning',
  active: 'badge--success',
  completed: 'badge--accent',
  cancelled: 'badge--error',
};

export default function PartnerPortal() {
  const { name, orgId } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['partner-dashboard', orgId],
    queryFn: async () => {
      const [campaignsRes, offersRes, reportsRes] = await Promise.all([
        api.get<Campaign[]>('/api/partner/campaigns'),
        api.get<Offer[]>('/api/partner/offers'),
        api.get<CampaignReport[]>('/api/partner/reports'),
      ]);
      if (campaignsRes.error) throw new Error(campaignsRes.error);
      if (offersRes.error) throw new Error(offersRes.error);
      if (reportsRes.error) throw new Error(reportsRes.error);
      return {
        campaigns: campaignsRes.data ?? [],
        offers: offersRes.data ?? [],
        reports: reportsRes.data ?? [],
      } as PartnerDashboardData;
    },
  });

  const dashboard = data ?? (isDemoMode
    ? { campaigns: DEMO_CAMPAIGNS, offers: DEMO_OFFERS, reports: DEMO_CAMPAIGN_REPORTS }
    : { campaigns: [], offers: [], reports: [] });

  // Aggregate metrics from all reports
  const metrics = useMemo(() => {
    const totals = {
      totalReach: 0,
      totalImpressions: 0,
      qrScans: 0,
      offerRedemptions: 0,
    };
    dashboard.reports.forEach((r) => {
      totals.totalReach += r.metrics.totalReach;
      totals.totalImpressions += r.metrics.totalImpressions;
      totals.qrScans += r.metrics.qrScans;
      totals.offerRedemptions += r.metrics.offerRedemptions;
    });
    return totals;
  }, [dashboard.reports]);

  const activeCampaigns = useMemo(
    () => dashboard.campaigns.filter((c) => c.status === 'active' || c.status === 'negotiation'),
    [dashboard.campaigns],
  );

  const activeOffers = useMemo(
    () => dashboard.offers.filter((o) => o.isActive),
    [dashboard.offers],
  );

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '300px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '220px', height: '20px' }} />
        </div>
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card">
              <LoadingSkeleton width="60%" height="14px" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <LoadingSkeleton width="80%" height="32px" />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <LoadingSkeleton count={4} height="80px" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load partner dashboard</h3>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Partner Dashboard</h1>
        <p className="page-subtitle">
          Welcome back{name ? `, ${name}` : ''}. Here is your partnership overview.
        </p>
      </div>

      {/* Performance Metrics */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textPrimary)' }}>
          Performance Summary
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <MetricCard label="Total Reach" value={formatNumber(metrics.totalReach)} icon="&#x1F4E3;" color="var(--color-info)" bg="var(--color-infoMuted)" />
          <MetricCard label="Impressions" value={formatNumber(metrics.totalImpressions)} icon="&#x1F441;" color="var(--color-accent)" bg="var(--color-accentMuted)" />
          <MetricCard label="QR Scans" value={formatNumber(metrics.qrScans)} icon="&#x1F4F1;" color="var(--color-success)" bg="var(--color-successMuted)" />
          <MetricCard label="Offer Redemptions" value={formatNumber(metrics.offerRedemptions)} icon="&#x1F3AB;" color="var(--color-warning)" bg="var(--color-warningMuted)" />
        </div>
      </section>

      {/* Active Campaigns */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
            Active Campaigns ({activeCampaigns.length})
          </h2>
        </div>

        {activeCampaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-textMuted)' }}>
            <p>No active campaigns right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activeCampaigns.map((campaign) => {
              const totalDeliverables = campaign.deliverables.length;
              const completedDeliverables = campaign.deliverables.filter((d) => d.completed).length;
              const progressPct = totalDeliverables === 0 ? 0 : Math.round((completedDeliverables / totalDeliverables) * 100);

              // Find matching report if any
              const report = dashboard.reports.find((r) => r.campaignId === campaign.campaignId);

              return (
                <div key={campaign.campaignId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
                  {/* Left: Campaign info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                      <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                        {campaign.restaurantName}
                      </h3>
                      <span className={`badge ${STATUS_BADGE[campaign.status] ?? ''}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                        Package: <strong>{campaign.package}</strong>
                      </span>
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                        {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Deliverable progress */}
                  {totalDeliverables > 0 && (
                    <div style={{ width: '140px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>Deliverables</span>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)' }}>
                          {completedDeliverables}/{totalDeliverables}
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--color-bgElevated)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background: progressPct === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width var(--transition-slow)',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Right: Report link */}
                  {report && (
                    <Link
                      to={`/app/reports/${campaign.campaignId}`}
                      className="btn btn-secondary"
                      style={{ flexShrink: 0 }}
                    >
                      View Report
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Offers */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
            Active Offers ({activeOffers.length})
          </h2>
          <Link to="/app/offers" className="btn btn-ghost" style={{ fontSize: 'var(--font-sm)' }}>
            Manage Offers &#8594;
          </Link>
        </div>

        {activeOffers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-textMuted)' }}>
            <p>No active offers. Create one to start tracking engagement.</p>
            <Link to="/app/offers" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}>
              Create Offer
            </Link>
          </div>
        ) : (
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {activeOffers.map((offer) => (
              <div key={offer.offerId} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <span
                    className={`badge ${offer.type === 'qr' ? 'badge--info' : offer.type === 'promo' ? 'badge--accent' : 'badge--success'}`}
                    style={{ textTransform: 'uppercase' }}
                  >
                    {offer.type}
                  </span>
                  {offer.expiresAt && (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                      Expires {formatDate(offer.expiresAt)}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                  {offer.description}
                </p>

                <div style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-textSecondary)',
                  fontFamily: 'monospace',
                  background: 'var(--color-bgElevated)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--space-3)',
                  display: 'inline-block',
                }}>
                  {offer.code}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)' }}>
                      {formatNumber(offer.scans)}
                    </span>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>
                      Scans
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatNumber(offer.redemptions)}
                    </span>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>
                      Redemptions
                    </span>
                  </div>
                  {offer.scans > 0 && (
                    <div>
                      <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                        {Math.round((offer.redemptions / offer.scans) * 100)}%
                      </span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>
                        Conv. Rate
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Metric Card ──────────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: 'var(--radius-md)',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--font-xl)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-1)' }}>
          {label}
        </p>
        <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </p>
      </div>
    </div>
  );
}
