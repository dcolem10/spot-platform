import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Campaign, CampaignReport, PostMetrics } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_CAMPAIGNS, DEMO_CAMPAIGN_REPORTS } from '../../data/demoData';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  campaignPicker: {
    display: 'flex',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-8)',
    overflowX: 'auto' as const,
    paddingBottom: 'var(--space-2)',
  } as React.CSSProperties,
  campaignCard: (isSelected: boolean) =>
    ({
      flex: '0 0 auto',
      minWidth: '220px',
      maxWidth: '280px',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      border: isSelected
        ? '2px solid var(--color-accent)'
        : '1px solid var(--color-border)',
      background: isSelected
        ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bgSecondary))'
        : 'var(--color-bgSecondary)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    }) as React.CSSProperties,
  campaignCardName: {
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: '2px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  } as React.CSSProperties,
  campaignCardMeta: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginTop: 'var(--space-1)',
  } as React.CSSProperties,
  campaignCardBudget: {
    fontSize: 'var(--font-lg)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    marginTop: 'var(--space-2)',
  } as React.CSSProperties,
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  metricCard: {
    background: 'var(--color-bgElevated)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-4)',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  metricValue: {
    fontSize: 'var(--font-2xl)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.2,
  } as React.CSSProperties,
  metricLabel: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    marginTop: 'var(--space-1)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontWeight: 600,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 'var(--font-lg)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: 'var(--space-4)',
  } as React.CSSProperties,
  chartPlaceholder: {
    width: '100%',
    height: '240px',
    background: 'var(--color-bgElevated)',
    border: '1px dashed var(--color-border)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    color: 'var(--color-textMuted)',
    fontSize: 'var(--font-sm)',
  } as React.CSSProperties,
  chartBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-3)',
  } as React.CSSProperties,
  chartBarLabel: {
    width: '100px',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-textSecondary)',
    textAlign: 'right' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  chartBarTrack: {
    flex: 1,
    height: '24px',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
    position: 'relative' as const,
  } as React.CSSProperties,
  chartBarFill: (pct: number, color: string) =>
    ({
      width: `${Math.min(100, pct)}%`,
      height: '100%',
      background: color,
      borderRadius: 'var(--radius-full)',
      transition: 'width 0.5s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 'var(--space-2)',
      fontSize: '10px',
      fontWeight: 700,
      color: '#fff',
      minWidth: pct > 5 ? '30px' : 0,
    }) as React.CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-6)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  postsTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 'var(--font-sm)',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-textMuted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--color-border)',
  } as React.CSSProperties,
  td: {
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,
  benchmarkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-3) 0',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 'var(--font-sm)',
  } as React.CSSProperties,
  benchmarkLabel: {
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
  benchmarkValues: {
    display: 'flex',
    gap: 'var(--space-6)',
    alignItems: 'center',
  } as React.CSSProperties,
  benchmarkCampaign: {
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    minWidth: '80px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  benchmarkAvg: {
    color: 'var(--color-textMuted)',
    minWidth: '80px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  benchmarkDelta: (positive: boolean) =>
    ({
      fontWeight: 600,
      fontSize: 'var(--font-xs)',
      color: positive ? 'var(--color-success)' : 'var(--color-error)',
      minWidth: '60px',
      textAlign: 'right' as const,
    }) as React.CSSProperties,
  attributionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    padding: 'var(--space-4)',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    marginBottom: 'var(--space-3)',
  } as React.CSSProperties,
  attributionIcon: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-accentMuted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-xl)',
    flexShrink: 0,
  } as React.CSSProperties,
  attributionInfo: {
    flex: 1,
  } as React.CSSProperties,
  attributionValue: {
    fontSize: 'var(--font-xl)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,
  attributionLabel: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
    marginTop: 'var(--space-6)',
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
  reportPeriod: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
} as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function ROIReporter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [allReports, setAllReports] = useState<CampaignReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'done'>('idle');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode()) {
      setCampaigns(DEMO_CAMPAIGNS.filter((c) => c.status === 'active' || c.status === 'completed'));
      setAllReports(DEMO_CAMPAIGN_REPORTS);
      setLoading(false);
      return;
    }

    const [campaignRes, reportsRes] = await Promise.all([
      api.get<Campaign[]>('/api/spotops/campaigns'),
      api.get<CampaignReport[]>('/api/spotops/reports'),
    ]);
    if (campaignRes.error) {
      setError(campaignRes.error);
    }
    if (campaignRes.data && campaignRes.data.length > 0) {
      const completedOrActive = campaignRes.data.filter(
        (c) => c.status === 'active' || c.status === 'completed'
      );
      setCampaigns(completedOrActive);
    }
    if (reportsRes.data && reportsRes.data.length > 0) {
      setAllReports(reportsRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Auto-select first campaign once loaded
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      handleCampaignSelect(campaigns[0].campaignId);
    }
  }, [campaigns]);

  const fetchReport = useCallback(async (campaignId: string) => {
    setReportLoading(true);
    setReport(null);

    if (isDemoMode()) {
      const demoReport = DEMO_CAMPAIGN_REPORTS.find((r) => r.campaignId === campaignId) ?? null;
      setReport(demoReport);
      setReportLoading(false);
      return;
    }

    const res = await api.get<CampaignReport>(`/api/spotops/reports/${campaignId}`);
    if (res.data) {
      setReport(res.data);
    } else {
      setError(res.error || 'Failed to load report');
    }
    setReportLoading(false);
  }, []);

  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setShareStatus('idle');
    if (campaignId) {
      fetchReport(campaignId);
    } else {
      setReport(null);
    }
  };

  // Compute creator averages from all reports for benchmark
  const creatorAverages = useMemo(() => {
    if (allReports.length === 0) {
      return {
        avgReach: 0,
        avgImpressions: 0,
        avgSaves: 0,
        avgShares: 0,
        avgEngagementRate: 0,
        avgQRScans: 0,
        avgRedemptions: 0,
        avgEstimatedVisits: 0,
      };
    }
    const n = allReports.length;
    return {
      avgReach: Math.round(allReports.reduce((s, r) => s + r.metrics.totalReach, 0) / n),
      avgImpressions: Math.round(allReports.reduce((s, r) => s + r.metrics.totalImpressions, 0) / n),
      avgSaves: Math.round(allReports.reduce((s, r) => s + r.metrics.totalSaves, 0) / n),
      avgShares: Math.round(allReports.reduce((s, r) => s + r.metrics.totalShares, 0) / n),
      avgEngagementRate: allReports.reduce((s, r) => s + r.metrics.engagementRate, 0) / n,
      avgQRScans: Math.round(allReports.reduce((s, r) => s + r.metrics.qrScans, 0) / n),
      avgRedemptions: Math.round(allReports.reduce((s, r) => s + r.metrics.offerRedemptions, 0) / n),
      avgEstimatedVisits: Math.round(allReports.reduce((s, r) => s + r.metrics.estimatedVisits, 0) / n),
    };
  }, [allReports]);

  const handleGenerateShare = async () => {
    if (!report) return;
    setShareStatus('generating');
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setShareStatus('done');
  };

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '200px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '180px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ height: '44px', width: '400px', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  /* ─── Engagement Breakdown Data ────────────────────────────────────────── */

  const engagementBars = report
    ? [
        { label: 'Reach', value: report.metrics.totalReach, color: 'var(--color-info)' },
        { label: 'Impressions', value: report.metrics.totalImpressions, color: 'var(--color-accent)' },
        { label: 'Saves', value: report.metrics.totalSaves, color: 'var(--color-success)' },
        { label: 'Shares', value: report.metrics.totalShares, color: 'var(--color-warning)' },
        { label: 'Comments', value: report.metrics.totalComments, color: 'var(--color-error)' },
      ]
    : [];

  const maxEngagement = engagementBars.length > 0 ? Math.max(...engagementBars.map((b) => b.value)) : 1;

  /* ─── Benchmark Rows ──────────────────────────────────────────────────── */

  const benchmarkRows = report
    ? [
        { label: 'Total Reach', campaign: report.metrics.totalReach, avg: creatorAverages.avgReach },
        { label: 'Total Impressions', campaign: report.metrics.totalImpressions, avg: creatorAverages.avgImpressions },
        { label: 'Saves', campaign: report.metrics.totalSaves, avg: creatorAverages.avgSaves },
        { label: 'Shares', campaign: report.metrics.totalShares, avg: creatorAverages.avgShares },
        { label: 'Engagement Rate', campaign: report.metrics.engagementRate, avg: creatorAverages.avgEngagementRate, isRate: true },
        { label: 'QR Scans', campaign: report.metrics.qrScans, avg: creatorAverages.avgQRScans },
        { label: 'Offer Redemptions', campaign: report.metrics.offerRedemptions, avg: creatorAverages.avgRedemptions },
      ]
    : [];

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">ROI Reporter</h1>
        <p className="page-subtitle">Generate and share campaign performance reports</p>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={fetchCampaigns}>
            Retry
          </button>
        </div>
      )}

      {/* Campaign Picker */}
      {campaigns.length > 0 && (
        <div style={styles.campaignPicker}>
          {campaigns.map((c) => (
            <div
              key={c.campaignId}
              style={styles.campaignCard(selectedCampaignId === c.campaignId)}
              onClick={() => handleCampaignSelect(c.campaignId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCampaignSelect(c.campaignId); }}
            >
              <div style={styles.campaignCardName}>{c.restaurantName}</div>
              <div style={styles.campaignCardMeta}>
                <span className={`badge badge--${c.status === 'active' ? 'success' : c.status === 'completed' ? 'accent' : 'info'}`}>
                  {c.status}
                </span>
                <span>{c.package}</span>
              </div>
              <div style={styles.campaignCardBudget}>{formatCurrency(c.budget)}</div>
            </div>
          ))}
        </div>
      )}

      {/* No campaigns */}
      {campaigns.length === 0 && !loading && (
        <div className="empty-state">
          <h3>No Campaigns</h3>
          <p>Create active or completed campaigns to generate ROI reports</p>
        </div>
      )}

      {/* Report loading */}
      {reportLoading && (
        <div>
          <div style={styles.metricsGrid}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: '90px', borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      )}

      {/* Report content */}
      {report && !reportLoading && (
        <div className="stagger-children">
          {/* Period */}
          <div style={styles.reportPeriod}>
            Report for <strong>{report.restaurantName}</strong> &middot;{' '}
            {formatDate(report.period.start)} - {formatDate(report.period.end)} &middot;{' '}
            Generated {formatDate(report.generatedAt)}
          </div>

          {/* Metrics Grid */}
          <div style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatNumber(report.metrics.totalReach)}</div>
              <div style={styles.metricLabel}>Total Reach</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatNumber(report.metrics.totalImpressions)}</div>
              <div style={styles.metricLabel}>Impressions</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatNumber(report.metrics.totalSaves)}</div>
              <div style={styles.metricLabel}>Saves</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatNumber(report.metrics.totalShares)}</div>
              <div style={styles.metricLabel}>Shares</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatNumber(report.metrics.totalComments)}</div>
              <div style={styles.metricLabel}>Comments</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>{formatPct(report.metrics.engagementRate)}</div>
              <div style={styles.metricLabel}>Engagement Rate</div>
            </div>
          </div>

          {/* Performance Chart Placeholder + Engagement Breakdown */}
          <div style={styles.twoCol}>
            {/* Chart placeholder */}
            <div className="card">
              <div style={styles.sectionTitle}>Performance Over Time</div>
              <div style={styles.chartPlaceholder}>
                <span style={{ fontSize: 'var(--font-2xl)' }}>{'\u{1F4C8}'}</span>
                <span>Chart visualization</span>
                <span style={{ fontSize: 'var(--font-xs)' }}>
                  Connect analytics to see daily reach & engagement trends
                </span>
              </div>
            </div>

            {/* Engagement Breakdown */}
            <div className="card">
              <div style={styles.sectionTitle}>Engagement Breakdown</div>
              {engagementBars.map((bar) => (
                <div key={bar.label} style={styles.chartBarRow}>
                  <div style={styles.chartBarLabel}>{bar.label}</div>
                  <div style={styles.chartBarTrack}>
                    <div style={styles.chartBarFill((bar.value / maxEngagement) * 100, bar.color)}>
                      {formatNumber(bar.value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QR / Offer Attribution */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={styles.sectionTitle}>QR & Offer Attribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={styles.attributionCard}>
                <div style={styles.attributionIcon}>{'\u{1F4F1}'}</div>
                <div style={styles.attributionInfo}>
                  <div style={styles.attributionValue}>{formatNumber(report.metrics.qrScans)}</div>
                  <div style={styles.attributionLabel}>QR Code Scans</div>
                </div>
              </div>
              <div style={styles.attributionCard}>
                <div style={{ ...styles.attributionIcon, background: 'var(--color-successMuted)' }}>{'\u2705'}</div>
                <div style={styles.attributionInfo}>
                  <div style={styles.attributionValue}>{formatNumber(report.metrics.offerRedemptions)}</div>
                  <div style={styles.attributionLabel}>Offer Redemptions</div>
                </div>
              </div>
              <div style={styles.attributionCard}>
                <div style={{ ...styles.attributionIcon, background: 'var(--color-infoMuted)' }}>{'\u{1F6B6}'}</div>
                <div style={styles.attributionInfo}>
                  <div style={styles.attributionValue}>{formatNumber(report.metrics.estimatedVisits)}</div>
                  <div style={styles.attributionLabel}>Estimated Visits</div>
                </div>
              </div>
              <div style={styles.attributionCard}>
                <div style={{ ...styles.attributionIcon, background: 'var(--color-warningMuted)' }}>{'\u{1F4B0}'}</div>
                <div style={styles.attributionInfo}>
                  <div style={styles.attributionValue}>
                    {report.metrics.qrScans > 0
                      ? formatPct(report.metrics.offerRedemptions / report.metrics.qrScans)
                      : '0%'}
                  </div>
                  <div style={styles.attributionLabel}>Scan-to-Redemption Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Benchmark Comparison */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={styles.sectionTitle}>Benchmark Comparison</div>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-4)' }}>
              This campaign vs. your average across all campaigns
            </p>

            {/* Column headers */}
            <div style={{ ...styles.benchmarkRow, borderBottom: '2px solid var(--color-border)' }}>
              <span style={{ ...styles.benchmarkLabel, fontWeight: 600, color: 'var(--color-textPrimary)' }}>Metric</span>
              <div style={styles.benchmarkValues}>
                <span style={{ ...styles.benchmarkCampaign, fontSize: 'var(--font-xs)', textTransform: 'uppercase' as const }}>This Campaign</span>
                <span style={{ ...styles.benchmarkAvg, fontSize: 'var(--font-xs)', textTransform: 'uppercase' as const }}>Your Avg</span>
                <span style={{ fontSize: 'var(--font-xs)', minWidth: '60px', textAlign: 'right' as const, color: 'var(--color-textMuted)' }}>Delta</span>
              </div>
            </div>

            {benchmarkRows.map((row) => {
              const delta = row.avg > 0 ? ((row.campaign - row.avg) / row.avg) * 100 : 0;
              const isPositive = delta >= 0;
              return (
                <div key={row.label} style={styles.benchmarkRow}>
                  <span style={styles.benchmarkLabel}>{row.label}</span>
                  <div style={styles.benchmarkValues}>
                    <span style={styles.benchmarkCampaign}>
                      {'isRate' in row && row.isRate ? formatPct(row.campaign) : formatNumber(row.campaign)}
                    </span>
                    <span style={styles.benchmarkAvg}>
                      {'isRate' in row && row.isRate ? formatPct(row.avg) : formatNumber(row.avg)}
                    </span>
                    <span style={styles.benchmarkDelta(isPositive)}>
                      {isPositive ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Individual Posts */}
          {report.posts.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
              <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-3)' }}>
                <div style={styles.sectionTitle}>Individual Post Performance</div>
              </div>
              <table style={styles.postsTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Platform</th>
                    <th style={styles.th}>Posted</th>
                    <th style={styles.th}>Reach</th>
                    <th style={styles.th}>Likes</th>
                    <th style={styles.th}>Saves</th>
                    <th style={styles.th}>Shares</th>
                    <th style={styles.th}>Comments</th>
                    <th style={styles.th}>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {report.posts.map((post: PostMetrics) => (
                    <tr key={post.postId}>
                      <td style={styles.td}>
                        <span className={`badge ${post.platform === 'instagram' ? 'badge--accent' : 'badge--info'}`}>
                          {post.platform === 'instagram' ? 'IG' : 'TikTok'}
                        </span>
                      </td>
                      <td style={styles.td}>{formatDate(post.postedAt)}</td>
                      <td style={styles.td}>{formatNumber(post.reach)}</td>
                      <td style={styles.td}>{formatNumber(post.likes)}</td>
                      <td style={styles.td}>{formatNumber(post.saves)}</td>
                      <td style={styles.td}>{formatNumber(post.shares)}</td>
                      <td style={styles.td}>{formatNumber(post.comments)}</td>
                      <td style={styles.td}>
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent)', fontSize: 'var(--font-xs)' }}
                        >
                          View \u2197
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Generate & Share */}
          <div style={styles.actions}>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Print Report
            </button>
            <button
              className="btn btn-primary"
              onClick={handleGenerateShare}
              disabled={shareStatus === 'generating'}
            >
              {shareStatus === 'idle' && 'Generate & Share'}
              {shareStatus === 'generating' && 'Generating PDF...'}
              {shareStatus === 'done' && 'Link Copied!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
