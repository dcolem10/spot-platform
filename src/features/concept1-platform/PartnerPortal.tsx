import { useMemo, memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_CAMPAIGNS, DEMO_OFFERS, DEMO_CAMPAIGN_REPORTS } from '../../data/demoData';
import PartnerOnboarding from '../onboarding/PartnerOnboarding';
import type { Campaign, Offer, CampaignReport, PosConnectionStatus, PosProvider, RedemptionSyncResult } from '../../types';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface PartnerDashboardData {
  campaigns: Campaign[];
  offers: Offer[];
  reports: CampaignReport[];
}

interface AnalyticsData {
  estimatedRevenue: number;
  totalBudgetSpent: number;
  roi: number;
  revenuePerDollarSpent: number;
  costPerAcquisition: number;
  activeCampaignCount: number;
  totalScans: number;
  totalRedemptions: number;
  scanToRedemptionRate: number;
  totalReach: number;
  totalImpressions: number;
  estimatedVisits: number;
  pendingProposalCount: number;
  expiringOfferCount: number;
  expiringProposalCount: number;
  topCampaigns: { campaignId: string; restaurantName: string; package: string; budget: number; redemptions: number }[];
  assumptions: { avgCheckValue: number; repeatVisitRate: number; note: string };
}

/* ─── Demo Analytics ───────────────────────────────────────────────────────── */

const DEMO_ANALYTICS: AnalyticsData = {
  estimatedRevenue: 18_225,
  totalBudgetSpent: 4_000,
  roi: 355.6,
  revenuePerDollarSpent: 4.56,
  costPerAcquisition: 11,
  activeCampaignCount: 3,
  totalScans: 1_077,
  totalRedemptions: 357,
  scanToRedemptionRate: 33.1,
  totalReach: 800_000,
  totalImpressions: 886_000,
  estimatedVisits: 620,
  pendingProposalCount: 2,
  expiringOfferCount: 1,
  expiringProposalCount: 1,
  topCampaigns: [
    { campaignId: 'c5', restaurantName: 'Rasika', package: 'Feature', budget: 4000, redemptions: 186 },
    { campaignId: 'c8', restaurantName: "Rose's Luxury", package: 'Feature', budget: 2500, redemptions: 123 },
    { campaignId: 'c6', restaurantName: 'The Dabney', package: 'Quick Bite', budget: 1200, redemptions: 48 },
  ],
  assumptions: {
    avgCheckValue: 45,
    repeatVisitRate: 0.35,
    note: 'Revenue estimates based on industry averages. Connect POS for real numbers.',
  },
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_BADGE: Record<string, string> = {
  inquiry: 'badge--info',
  negotiation: 'badge--warning',
  active: 'badge--success',
  completed: 'badge--accent',
  cancelled: 'badge--error',
};

/* ─── Main Component ───────────────────────────────────────────────────────── */

export default function PartnerPortal() {
  const { name, orgId } = useAuth();
  const queryClient = useQueryClient();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  // Fetch dashboard data
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['partner-dashboard', orgId],
    queryFn: async () => {
      if (isDemoMode()) {
        return {
          campaigns: DEMO_CAMPAIGNS,
          offers: DEMO_OFFERS,
          reports: DEMO_CAMPAIGN_REPORTS,
        } as PartnerDashboardData;
      }
      const [campaignsRes, offersRes, reportsRes] = await Promise.all([
        api.get<Campaign[]>('/api/partner/campaigns'),
        api.get<Offer[]>('/api/partner/offers'),
        api.get<CampaignReport[]>('/api/partner/reports'),
      ]);
      if (campaignsRes.error) throw new Error(campaignsRes.error);
      return {
        campaigns: campaignsRes.data ?? [],
        offers: offersRes.data ?? [],
        reports: reportsRes.data ?? [],
      } as PartnerDashboardData;
    },
  });

  // Fetch margin analytics
  const { data: analytics } = useQuery({
    queryKey: ['partner-analytics', orgId],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_ANALYTICS;
      const res = await api.get<AnalyticsData>('/api/partner/analytics');
      if (res.status !== 'success' || !res.data) return DEMO_ANALYTICS;
      return res.data;
    },
    staleTime: 5 * 60 * 1000,      // 5 min — analytics don't need real-time
    gcTime: 10 * 60 * 1000,         // Keep in cache 10 min
    refetchOnWindowFocus: false,
  });

  // Fetch POS status
  const { data: posStatus, refetch: refetchPosStatus } = useQuery({
    queryKey: ['pos-status', orgId],
    queryFn: async () => {
      if (isDemoMode()) return { connected: false } as PosConnectionStatus;
      const res = await api.get<PosConnectionStatus>('/api/pos/status');
      return res.data ?? { connected: false };
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch sync history
  const { data: syncHistory } = useQuery({
    queryKey: ['sync-history', orgId],
    queryFn: async () => {
      if (isDemoMode()) return [] as RedemptionSyncResult[];
      const res = await api.get<RedemptionSyncResult[]>('/api/pos/sync/history?limit=7');
      return res.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: posStatus?.connected === true,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/pos/sync', { restaurantId: orgId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-history', orgId] });
      queryClient.invalidateQueries({ queryKey: ['pos-status', orgId] });
    },
  });

  // Connect POS mutation (supports all providers)
  const connectMutation = useMutation({
    mutationFn: async (provider: PosProvider) => {
      if (provider === 'toast') {
        // Toast uses direct auth, no redirect
        const res = await api.post<{ status: string }>(`/api/pos/connect/toast`, { restaurantId: orgId });
        return res.data;
      }
      // Square and Clover use OAuth redirect
      const res = await api.post<{ authorizationUrl: string }>(`/api/pos/connect/${provider}`, { restaurantId: orgId });
      if (res.data?.authorizationUrl) {
        window.open(res.data.authorizationUrl, '_blank');
      }
      return res.data;
    },
    onSuccess: () => {
      refetchPosStatus();
      setShowProviderPicker(false);
    },
  });

  // Disconnect POS mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/pos/disconnect', { restaurantId: orgId });
      return null;
    },
    onSuccess: () => {
      setShowDisconnectConfirm(false);
      refetchPosStatus();
    },
  });

  const dashboard = data ?? (isDemoMode()
    ? { campaigns: DEMO_CAMPAIGNS, offers: DEMO_OFFERS, reports: DEMO_CAMPAIGN_REPORTS }
    : { campaigns: [], offers: [], reports: [] });
  const stats = analytics ?? DEMO_ANALYTICS;

  const needsOnboarding = dashboard.offers.length === 0 && dashboard.campaigns.length === 0;
  if (needsOnboarding && !isLoading) return <PartnerOnboarding />;

  const activeCampaigns = useMemo(
    () => dashboard.campaigns.filter((c) => c.status === 'active' || c.status === 'negotiation'),
    [dashboard.campaigns],
  );

  const activeOffers = useMemo(
    () => dashboard.offers.filter((o) => o.isActive),
    [dashboard.offers],
  );

  // Pending actions
  const pendingActions: { icon: string; label: string; link: string }[] = [];
  if (stats.pendingProposalCount > 0) {
    pendingActions.push({
      icon: '📩',
      label: `${stats.pendingProposalCount} proposal${stats.pendingProposalCount > 1 ? 's' : ''} awaiting review`,
      link: '/app/partner/proposals',
    });
  }
  if (stats.expiringOfferCount > 0) {
    pendingActions.push({
      icon: '⏰',
      label: `${stats.expiringOfferCount} offer${stats.expiringOfferCount > 1 ? 's' : ''} expiring in 7 days`,
      link: '/app/partner/offers',
    });
  }
  if (stats.expiringProposalCount > 0) {
    pendingActions.push({
      icon: '🔔',
      label: `${stats.expiringProposalCount} proposal${stats.expiringProposalCount > 1 ? 's' : ''} expiring soon`,
      link: '/app/partner/proposals',
    });
  }

  /* ─── Loading ─── */
  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '300px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '220px', height: '20px' }} />
        </div>
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="card"><LoadingSkeleton width="80%" height="48px" /></div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <LoadingSkeleton count={4} height="80px" />
        </div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (isError) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load partner dashboard</h3>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Your Partnerships at a Glance</h1>
        <p className="page-subtitle">
          Welcome back{name ? `, ${name}` : ''}. Here is what creator partnerships are doing for your business.
        </p>
      </div>

      {/* ─── Hero Metrics: The Numbers That Matter ─── */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Estimated Revenue — THE hero metric */}
          <div className="card" style={{
            gridColumn: 'span 1',
            background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, rgba(16, 185, 129, 0.06) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.2)',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
              Est. Revenue from Partnerships
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)', lineHeight: 1 }}>
              {fmtMoney(stats.estimatedRevenue)}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 'var(--space-2)' }}>
              {fmtMoney(stats.revenuePerDollarSpent)} return per $1 spent
            </div>
          </div>

          {/* Active Campaigns */}
          <HeroMetric
            label="Active Campaigns"
            value={String(stats.activeCampaignCount)}
            icon="📈"
            color="var(--color-info)"
          />

          {/* QR Scans */}
          <HeroMetric
            label="QR Scans"
            value={fmtNum(stats.totalScans)}
            sub={`${stats.scanToRedemptionRate}% conversion`}
            icon="📱"
            color="var(--color-accent)"
          />

          {/* Redemptions */}
          <HeroMetric
            label="Redemptions"
            value={fmtNum(stats.totalRedemptions)}
            sub={`${fmtMoney(stats.costPerAcquisition)} per customer`}
            icon="🎫"
            color="var(--color-warning)"
          />

          {/* ROI */}
          <HeroMetric
            label="ROI"
            value={`${stats.roi > 0 ? '+' : ''}${stats.roi}%`}
            sub={`on ${fmtMoney(stats.totalBudgetSpent)} spent`}
            icon="💰"
            color={stats.roi > 0 ? 'var(--color-success)' : 'var(--color-error)'}
          />
        </div>
      </section>

      {/* ─── POS Connection ─── */}
      <section style={{ marginBottom: 'var(--space-6)' }}>
        {(!posStatus?.connected || showProviderPicker) ? (
          <div className="card" style={{
            padding: 'var(--space-5)',
            background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, rgba(59, 130, 246, 0.06) 100%)',
            borderColor: 'rgba(59, 130, 246, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '24px', marginTop: 'var(--space-1)' }}>🔗</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-2)' }}>
                  Connect Your POS for Real Revenue Data
                </h3>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                  Replace industry estimates with actual transaction data.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => connectMutation.mutate('square')}
                    disabled={connectMutation.isPending}
                    style={{
                      background: 'white',
                      color: 'black',
                      border: '1px solid var(--color-border)',
                      fontWeight: 600,
                    }}
                  >
                    Square
                  </button>
                  <button
                    className="btn"
                    onClick={() => connectMutation.mutate('toast')}
                    disabled={connectMutation.isPending}
                    style={{
                      background: '#FF6900',
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    Toast
                  </button>
                  <button
                    className="btn"
                    onClick={() => connectMutation.mutate('clover')}
                    disabled={connectMutation.isPending}
                    style={{
                      background: '#43B02A',
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    Clover
                  </button>
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', lineHeight: 1.6 }}>
                  Currently using: Industry averages ($45 avg check, 35% repeat rate)
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{
              padding: 'var(--space-5)',
              background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, rgba(16, 185, 129, 0.06) 100%)',
              borderColor: 'rgba(16, 185, 129, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: '20px' }}>✅</span>
                    <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-success)' }}>
                      {posStatus.provider ? posStatus.provider.charAt(0).toUpperCase() + posStatus.provider.slice(1) : 'POS'} Connected
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>Merchant</div>
                      <div style={{ fontWeight: 500, color: 'var(--color-textPrimary)' }}>{posStatus.merchantName || 'Connected'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>Connected</div>
                      <div style={{ fontWeight: 500, color: 'var(--color-textPrimary)' }}>{posStatus.connectedAt ? fmtDate(posStatus.connectedAt) : '--'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>Last sync</div>
                      <div style={{ fontWeight: 500, color: 'var(--color-textPrimary)' }}>{posStatus.lastSyncedAt ? fmtDate(posStatus.lastSyncedAt) : 'Pending'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>Match rate</div>
                      <div style={{ fontWeight: 500, color: 'var(--color-textPrimary)' }}>
                        {syncHistory?.[0]?.matchRate ? `${syncHistory[0].matchRate}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    className="btn"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    style={{
                      background: 'var(--color-accent)',
                      color: 'white',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowProviderPicker(true)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    Switch Provider...
                  </button>
                  <button
                    className="btn"
                    onClick={() => setShowDisconnectConfirm(true)}
                    style={{
                      color: 'var(--color-error)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>

            {/* Sync History Table */}
            {syncHistory && syncHistory.length > 0 && (
              <div className="card" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)' }}>
                  Recent Sync History (last 7 days)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 'var(--font-sm)', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--color-textMuted)', fontWeight: 600, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--color-textMuted)', fontWeight: 600, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>Match%</th>
                        <th style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--color-textMuted)', fontWeight: 600, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>Matched</th>
                        <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-textMuted)', fontWeight: 600, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>Revenue</th>
                        <th style={{ textAlign: 'right', padding: 'var(--space-2)', color: 'var(--color-textMuted)', fontWeight: 600, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>Avg Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory.map((sync, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < syncHistory.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td style={{ padding: 'var(--space-2)', color: 'var(--color-textPrimary)', fontWeight: 500 }}>
                            {fmtDate(sync.syncedAt)}
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>
                            {sync.matchRate ?? 0}%
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'center', color: 'var(--color-textSecondary)' }}>
                            {sync.matchedRedemptions}/{sync.totalRedemptions}
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: 'var(--color-textPrimary)', fontWeight: 500 }}>
                            {fmtMoney(sync.totalRevenue)}
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'right', color: 'var(--color-textSecondary)' }}>
                            {fmtMoney(sync.avgTransactionValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="card" style={{ maxWidth: 400, padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              Disconnect {posStatus?.provider ? posStatus.provider.charAt(0).toUpperCase() + posStatus.provider.slice(1) : 'POS'}?
            </h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              You will return to using industry average estimates for revenue calculations. You can reconnect anytime.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={disconnectMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                style={{
                  background: 'var(--color-error)',
                  color: 'white',
                }}
              >
                {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Pending Actions ─── */}
      {pendingActions.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card" style={{
            padding: 'var(--space-4) var(--space-5)',
            background: 'linear-gradient(135deg, var(--color-bgSecondary) 0%, rgba(249, 115, 22, 0.04) 100%)',
            borderColor: 'rgba(249, 115, 22, 0.15)',
          }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-accent)', marginBottom: 'var(--space-3)' }}>
              Pending Actions ({pendingActions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {pendingActions.map((action, i) => (
                <Link
                  key={i}
                  to={action.link}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.03)',
                    textDecoration: 'none',
                    color: 'var(--color-textPrimary)',
                    fontSize: 'var(--font-sm)',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <span>{action.icon}</span>
                  <span style={{ flex: 1 }}>{action.label}</span>
                  <span style={{ color: 'var(--color-accent)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Review &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Top Performing Partnerships ─── */}
      {stats.topCampaigns.length > 0 && (
        <section className="section-card" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="section-card-header">
            <h2 className="section-card-title">Top Performing Partnerships</h2>
            <Link to="/app/reports" className="btn btn-ghost" style={{ fontSize: 'var(--font-sm)' }}>
              All Reports &rarr;
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            {stats.topCampaigns.map((c, i) => (
              <div
                key={c.campaignId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  background: i === 0 ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                  borderBottom: i < stats.topCampaigns.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span style={{
                  width: 28, height: 28,
                  borderRadius: 'var(--radius-full)',
                  background: i === 0 ? 'var(--color-successMuted)' : 'var(--color-bgElevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--font-xs)', fontWeight: 700,
                  color: i === 0 ? 'var(--color-success)' : 'var(--color-textMuted)',
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                    {c.restaurantName}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                    {c.package} &middot; {fmtMoney(c.budget)} budget
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-success)' }}>
                    {fmtNum(c.redemptions)}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                    redemptions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Active Campaigns ─── */}
      <section className="section-card" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-card-header">
          <h2 className="section-card-title">Active Campaigns ({activeCampaigns.length})</h2>
        </div>
        {activeCampaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-textMuted)' }}>
            No active campaigns right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            {activeCampaigns.map((campaign) => {
              const total = campaign.deliverables.length;
              const done = campaign.deliverables.filter((d) => d.completed).length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const report = dashboard.reports.find((r) => r.campaignId === campaign.campaignId);

              return (
                <div key={campaign.campaignId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
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
                        {campaign.package} &middot; {fmtMoney(campaign.budget)}
                      </span>
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
                        {fmtDate(campaign.startDate)} - {fmtDate(campaign.endDate)}
                      </span>
                    </div>
                  </div>
                  {total > 0 && (
                    <div style={{ width: 140, flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>Deliverables</span>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)' }}>{done}/{total}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--color-bgElevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)', borderRadius: 'var(--radius-full)', transition: 'width var(--transition-slow)' }} />
                      </div>
                    </div>
                  )}
                  {report && (
                    <Link to={`/app/reports/${campaign.campaignId}`} className="btn btn-secondary" style={{ flexShrink: 0 }}>
                      View Report
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Active Offers ─── */}
      <section className="section-card" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-card-header">
          <h2 className="section-card-title">Active Offers ({activeOffers.length})</h2>
          <Link to="/app/partner/offers" className="btn btn-ghost" style={{ fontSize: 'var(--font-sm)' }}>
            Manage Offers &rarr;
          </Link>
        </div>
        {activeOffers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-textMuted)' }}>
            No active offers. Create one to start tracking engagement.
          </div>
        ) : (
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginTop: 'var(--space-3)' }}>
            {activeOffers.map((offer) => (
              <div key={offer.offerId} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <span className={`badge ${offer.type === 'qr' ? 'badge--info' : offer.type === 'promo' ? 'badge--accent' : 'badge--success'}`} style={{ textTransform: 'uppercase' }}>
                    {offer.type}
                  </span>
                  {offer.approvalStatus === 'approved' && (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', fontWeight: 600 }}>Approved</span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                  {offer.description}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)' }}>{fmtNum(offer.scans)}</span>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>Scans</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-success)' }}>{fmtNum(offer.redemptions)}</span>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>Redemptions</span>
                  </div>
                  {offer.scans > 0 && (
                    <div>
                      <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-accent)' }}>{Math.round((offer.redemptions / offer.scans) * 100)}%</span>
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block' }}>Conv.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Assumptions Disclaimer ─── */}
      <div style={{
        fontSize: 'var(--font-xs)',
        color: 'var(--color-textMuted)',
        padding: 'var(--space-4)',
        borderTop: '1px solid var(--color-border)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        {posStatus?.connected && posStatus.provider
          ? `Revenue metrics powered by ${posStatus.provider.charAt(0).toUpperCase() + posStatus.provider.slice(1)} POS data`
          : 'Revenue estimates based on industry averages. Connect POS for real numbers.'
        } &middot; Avg check: {fmtMoney(stats.assumptions.avgCheckValue)} &middot; Repeat visit rate: {Math.round(stats.assumptions.repeatVisitRate * 100)}%
      </div>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

const HeroMetric = memo(function HeroMetric({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <div style={{
        width: 44, height: 44,
        borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
});
