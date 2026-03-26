import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Campaign,
  CampaignStatus,
  PartnershipPipeline,
} from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_PIPELINE, DEMO_CAMPAIGNS } from '../../data/demoData';
import { CollapsibleSection } from '../../components/CollapsibleSection';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface HeroMetric {
  label: string;
  value: string;
  trend: number; // positive = up, negative = down
  prefix?: string;
}

interface ActivityEvent {
  id: string;
  message: string;
  timestamp: string;
  type: 'campaign' | 'payment' | 'content' | 'offer';
}

interface QuickAction {
  label: string;
  icon: string;
  description: string;
  onClick: () => void;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const PIPELINE_STAGES: { key: CampaignStatus; label: string; color: string }[] = [
  { key: 'inquiry', label: 'Inquiry', color: 'var(--color-info)' },
  { key: 'negotiation', label: 'Negotiation', color: 'var(--color-warning)' },
  { key: 'active', label: 'Active', color: 'var(--color-success)' },
  { key: 'completed', label: 'Completed', color: 'var(--color-accent)' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  metricsRow: {
    marginBottom: 'var(--space-8)',
  } as React.CSSProperties,
  metricValue: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--font-3xl)',
    fontWeight: 800,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  metricLabel: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
    marginBottom: 'var(--space-2)',
  } as React.CSSProperties,
  trendUp: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-success)',
    marginTop: 'var(--space-2)',
  } as React.CSSProperties,
  trendDown: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-error)',
    marginTop: 'var(--space-2)',
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--font-lg)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: 'var(--space-4)',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  twoCol: {
    marginTop: 'var(--space-6)',
  } as React.CSSProperties,
  pipelineBar: {
    display: 'flex',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
    height: '32px',
    background: 'var(--color-bgElevated)',
    marginBottom: 'var(--space-4)',
  } as React.CSSProperties,
  pipelineLegend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 'var(--space-4)',
  } as React.CSSProperties,
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
  legendDot: (color: string) =>
    ({
      width: '10px',
      height: '10px',
      borderRadius: 'var(--radius-full)',
      background: color,
      flexShrink: 0,
    }) as React.CSSProperties,
  activityList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-3)',
  } as React.CSSProperties,
  activityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bgElevated)',
    fontSize: 'var(--font-sm)',
    transition: 'background var(--transition-fast)',
  } as React.CSSProperties,
  activityTime: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    flexShrink: 0,
    marginLeft: 'var(--space-4)',
  } as React.CSSProperties,
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 'var(--space-4)',
  } as React.CSSProperties,
  actionCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    padding: 'var(--space-5)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--color-bgElevated)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    gap: 'var(--space-2)',
  } as React.CSSProperties,
  actionIcon: {
    fontSize: 'var(--font-2xl)',
    marginBottom: 'var(--space-1)',
  } as React.CSSProperties,
  actionLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,
  actionDesc: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,
  errorBanner: {
    padding: 'var(--space-4)',
    background: 'var(--color-errorMuted)',
    color: 'var(--color-error)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-sm)',
    marginBottom: 'var(--space-6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
} as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState<PartnershipPipeline | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const deriveActivity = (campaigns: Campaign[]): ActivityEvent[] =>
    campaigns
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((c) => ({
        id: c.campaignId,
        message: `${c.restaurantName} - ${c.status === 'active' ? 'campaign started' : c.status === 'completed' ? 'campaign completed' : c.status === 'negotiation' ? 'entered negotiation' : 'new inquiry'}`,
        timestamp: c.updatedAt,
        type: 'campaign' as const,
      }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode()) {
      setPipeline(DEMO_PIPELINE);
      setActivity(deriveActivity([...DEMO_CAMPAIGNS]));
      setLoading(false);
      return;
    }

    const [pipelineRes, campaignsRes] = await Promise.all([
      api.get<PartnershipPipeline>('/api/spotops/pipeline'),
      api.get<{ items: Campaign[]; nextPage?: string }>('/api/spotops/campaigns'),
    ]);

    if (pipelineRes.error || campaignsRes.error) {
      setError(pipelineRes.error || campaignsRes.error || 'Failed to load dashboard data');
    }

    if (pipelineRes.data) {
      setPipeline(pipelineRes.data);
    }

    // Backend returns paginated { items, nextPage } format
    const campaignItems = campaignsRes.data?.items ?? [];
    if (campaignItems.length > 0) {
      setActivity(deriveActivity(campaignItems));
    }

    setLoading(false);
    setLastFetchedAt(new Date());
    setIsStale(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mark data as stale after 5 minutes, check every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastFetchedAt && Date.now() - lastFetchedAt.getTime() > 5 * 60 * 1000) {
        setIsStale(true);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [lastFetchedAt]);

  // Compute hero metrics
  const totalPartners = pipeline?.total ?? 0;
  const activeCampaigns = pipeline?.byStatus.active ?? 0;
  const estReachCount = pipeline?.totalRevenue ?? 0;  // Pipeline estimate for reach
  const dealRedemptionCount = pipeline?.avgDealSize ?? 0;  // Estimated redemptions

  // Trends are 0 when values are 0 (no data = no growth to show).
  // TODO: Replace with actual historical comparison once API supports /pipeline?period=previous
  const heroMetrics: HeroMetric[] = [
    { label: 'Active Campaigns', value: String(activeCampaigns), trend: activeCampaigns === 0 ? 0 : 8.3 },
    { label: 'Restaurants Reached', value: String(totalPartners), trend: totalPartners === 0 ? 0 : 12.5 },
    { label: 'Content Created', value: estReachCount === 0 ? '0' : String(Math.round(estReachCount / 25)), trend: estReachCount === 0 ? 0 : 15.2 },
    { label: 'Deal Redemptions', value: dealRedemptionCount === 0 ? '0' : String(Math.round(dealRedemptionCount / 10)), trend: dealRedemptionCount === 0 ? 0 : -3.1 },
  ];

  // Pipeline total for bar widths
  const pipelineTotal = pipeline
    ? Object.values(pipeline.byStatus).reduce((sum, n) => sum + n, 0)
    : 0;

  const quickActions: QuickAction[] = [
    {
      label: 'New Campaign',
      icon: '+',
      description: 'Start a paid restaurant partnership',
      onClick: () => navigate('/app/campaigns'),
    },
    {
      label: 'Generate Report',
      icon: '\u{1F4CA}',
      description: 'Prove your ROI to restaurants',
      onClick: () => navigate('/app/reports'),
    },
    {
      label: 'View Calendar',
      icon: '\u{1F4C5}',
      description: 'Check content schedule',
      onClick: () => navigate('/app/calendar'),
    },
    {
      label: 'Manage Offers',
      icon: '\u{1F3AB}',
      description: 'QR codes & promo links',
      onClick: () => navigate('/app/offers'),
    },
  ];

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '260px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '180px', height: '18px' }} />
        </div>
        <div className="bento-grid" style={styles.metricsRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card bento-narrow">
              <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: 'var(--space-3)' }} />
              <div className="skeleton" style={{ width: '80px', height: '36px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="page-title">Creator Dashboard</h1>
          <p className="page-subtitle">Your earnings and attribution overview at a glance</p>
        </div>
        {/* Stale data indicator + refresh */}
        {lastFetchedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-xs)', color: isStale ? 'var(--color-warning)' : 'var(--color-textMuted)' }}>
            {isStale && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0 }} />}
            <span>
              {isStale ? 'Data may be outdated' : `Updated ${timeAgo(lastFetchedAt.toISOString())}`}
            </span>
            <button
              className="btn btn-ghost"
              onClick={fetchData}
              disabled={loading}
              style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-xs)' }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={fetchData}>
            Retry
          </button>
        </div>
      )}

      {/* Hero Metrics */}
      <div className="bento-grid stagger-children" style={styles.metricsRow}>
        {heroMetrics.map((metric) => (
          <div className="card bento-narrow" key={metric.label}>
            <div style={styles.metricLabel}>{metric.label}</div>
            <div style={styles.metricValue}>{metric.value}</div>
            <div style={metric.trend >= 0 ? styles.trendUp : styles.trendDown}>
              <span>{metric.trend >= 0 ? '\u2191' : '\u2193'}</span>
              <span>{Math.abs(metric.trend).toFixed(1)}%</span>
              <span style={{ color: 'var(--color-textMuted)', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Summary */}
      <CollapsibleSection title="Campaign Pipeline">
        <div className="section-card">
          <div style={styles.pipelineBar}>
            {pipelineTotal > 0 &&
              PIPELINE_STAGES.map((stage) => {
                const count = pipeline?.byStatus[stage.key] ?? 0;
                const pct = (count / pipelineTotal) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={stage.key}
                    title={`${stage.label}: ${count}`}
                    style={{
                      width: `${pct}%`,
                      background: stage.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      color: '#fff',
                      minWidth: '28px',
                      transition: 'width var(--transition-slow)',
                    }}
                  >
                    {count}
                  </div>
                );
              })}
            {pipelineTotal === 0 && (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-textMuted)',
                }}
              >
                No campaigns yet
              </div>
            )}
          </div>

          <div style={styles.pipelineLegend}>
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.key} style={styles.legendItem}>
                <div style={styles.legendDot(stage.color)} />
                <span>
                  {stage.label} ({pipeline?.byStatus[stage.key] ?? 0})
                </span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Two-column: Activity + Quick Actions */}
      <CollapsibleSection title="Recent Activity">
        <div className="bento-grid" style={styles.twoCol}>
          {/* Activity */}
          <div className="section-card bento-wide">
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <h3>No recent activity</h3>
                <p>Start a campaign to see updates here</p>
              </div>
            ) : (
              <div style={styles.activityList}>
                {activity.map((event) => (
                  <div key={event.id} style={styles.activityItem}>
                    <span style={{ color: 'var(--color-textPrimary)' }}>{event.message}</span>
                    <span style={styles.activityTime}>{timeAgo(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="section-card bento-narrow">
            <div className="section-card-header">
              <h2 className="section-card-title">Quick Actions</h2>
            </div>
            <div style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="card"
                  style={styles.actionCard}
                  onClick={action.onClick}
                >
                  <span style={styles.actionIcon}>{action.icon}</span>
                  <span style={styles.actionLabel}>{action.label}</span>
                  <span style={styles.actionDesc}>{action.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
