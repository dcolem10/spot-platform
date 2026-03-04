import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_CAMPAIGN_REPORTS } from '../../data/demoData';
import type { CampaignReport as CampaignReportType, PostMetrics } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface MetricDef {
  label: string;
  value: string;
  color: string;
}

export default function CampaignReport() {
  const { campaignId } = useParams<{ campaignId: string }>();

  const { data: fetchedReport, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaign-report', campaignId],
    queryFn: async () => {
      if (isDemoMode()) {
        const demo = DEMO_CAMPAIGN_REPORTS.find((r) => r.campaignId === campaignId);
        if (demo) return demo;
      }
      const res = await api.get<CampaignReportType>(`/api/campaigns/${campaignId}/report`);
      if (res.error) throw new Error(res.error);
      if (!res.data) throw new Error('Report not found');
      return res.data;
    },
    enabled: Boolean(campaignId),
  });

  const report = fetchedReport ?? (isDemoMode() ? DEMO_CAMPAIGN_REPORTS.find((r) => r.campaignId === campaignId) ?? null : null);

  const metricCards: MetricDef[] = useMemo(() => {
    if (!report) return [];
    const m = report.metrics;
    return [
      { label: 'Total Reach', value: formatNumber(m.totalReach), color: 'var(--color-info)' },
      { label: 'Impressions', value: formatNumber(m.totalImpressions), color: 'var(--color-accent)' },
      { label: 'Saves', value: formatNumber(m.totalSaves), color: 'var(--color-success)' },
      { label: 'Shares', value: formatNumber(m.totalShares), color: 'var(--color-warning)' },
      { label: 'QR Scans', value: formatNumber(m.qrScans), color: 'var(--color-info)' },
      { label: 'Offer Redemptions', value: formatNumber(m.offerRedemptions), color: 'var(--color-success)' },
      { label: 'Est. Visits', value: formatNumber(m.estimatedVisits), color: 'var(--color-accent)' },
      { label: 'Engagement Rate', value: formatPct(m.engagementRate), color: 'var(--color-warning)' },
    ];
  }, [report]);

  const chartData = useMemo(() => {
    if (!report?.posts?.length) return null;

    // Sort posts by date
    const sorted = [...report.posts].sort(
      (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
    );

    const labels = sorted.map((p) => postLabel(p));

    // Read computed CSS variable values for chart colors at render time
    const rootStyle = getComputedStyle(document.documentElement);
    const accentColor = rootStyle.getPropertyValue('--color-accent').trim() || '#f97316';
    const infoColor = rootStyle.getPropertyValue('--color-info').trim() || '#3b82f6';
    const successColor = rootStyle.getPropertyValue('--color-success').trim() || '#22c55e';
    const warningColor = rootStyle.getPropertyValue('--color-warning').trim() || '#eab308';

    return {
      labels,
      datasets: [
        {
          label: 'Impressions',
          data: sorted.map((p) => p.impressions),
          backgroundColor: `${accentColor}cc`,
          borderRadius: 4,
        },
        {
          label: 'Reach',
          data: sorted.map((p) => p.reach),
          backgroundColor: `${infoColor}cc`,
          borderRadius: 4,
        },
        {
          label: 'Saves',
          data: sorted.map((p) => p.saves),
          backgroundColor: `${successColor}cc`,
          borderRadius: 4,
        },
        {
          label: 'Shares',
          data: sorted.map((p) => p.shares),
          backgroundColor: `${warningColor}cc`,
          borderRadius: 4,
        },
      ],
    };
  }, [report]);

  const chartOptions = useMemo(() => {
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-textSecondary').trim() || '#94a3b8';
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#2a2f42';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: textColor,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 12 },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (value: number | string) => {
              const num = typeof value === 'string' ? parseFloat(value) : value;
              return formatNumber(num);
            },
          },
        },
      },
    };
  }, []);

  const handleShareReport = () => {
    if (!report) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Campaign Report - ${report.restaurantName}`,
        text: `Check out the campaign results for ${report.restaurantName}`,
        url,
      }).catch(() => {
        // Share cancelled or failed — fall through to clipboard
        copyToClipboard(url);
      });
    } else {
      copyToClipboard(url);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    const originalTitle = document.title;
    document.title = `Campaign-Report-${report.restaurantName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
    window.print();
    // Restore title after print dialog
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '300px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '220px', height: '20px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="card">
              <LoadingSkeleton width="50%" height="12px" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <LoadingSkeleton width="70%" height="28px" />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <LoadingSkeleton height="300px" />
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load campaign report</h3>
          <p>{error instanceof Error ? error.message : 'Report not found or an error occurred.'}</p>
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Campaign Report</h1>
          <p className="page-subtitle">
            {report.restaurantName}
          </p>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginTop: 'var(--space-1)' }}>
            {formatDate(report.period.start)} &mdash; {formatDate(report.period.end)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={handleShareReport}>
            Share Report
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPDF}>
            Download PDF
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {metricCards.map((metric) => (
            <div key={metric.label} className="card" style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                color: 'var(--color-textMuted)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                marginBottom: 'var(--space-2)',
              }}>
                {metric.label}
              </p>
              <p style={{
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: metric.color,
                lineHeight: 1,
              }}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Post Performance Chart */}
      {chartData && (
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textPrimary)' }}>
            Post Performance
          </h2>
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ height: '360px' }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </section>
      )}

      {/* Post Details Table */}
      {report.posts.length > 0 && (
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textPrimary)' }}>
            Individual Posts ({report.posts.length})
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Platform', 'Date', 'Impressions', 'Reach', 'Likes', 'Saves', 'Shares', 'Comments'].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          fontSize: 'var(--font-xs)',
                          fontWeight: 600,
                          color: 'var(--color-textMuted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          textAlign: col === 'Platform' || col === 'Date' ? 'left' : 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...report.posts]
                    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
                    .map((post) => (
                      <tr
                        key={post.postId}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bgHover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...cellStyle, textAlign: 'left' }}>
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}
                          >
                            <span className={`badge ${post.platform === 'instagram' ? 'badge--accent' : 'badge--info'}`}>
                              {post.platform === 'instagram' ? 'IG' : 'TikTok'}
                            </span>
                          </a>
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--color-textSecondary)' }}>
                          {formatDate(post.postedAt)}
                        </td>
                        <td style={cellStyle}>{formatNumber(post.impressions)}</td>
                        <td style={cellStyle}>{formatNumber(post.reach)}</td>
                        <td style={cellStyle}>{formatNumber(post.likes)}</td>
                        <td style={cellStyle}>{formatNumber(post.saves)}</td>
                        <td style={cellStyle}>{formatNumber(post.shares)}</td>
                        <td style={cellStyle}>{formatNumber(post.comments)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* No posts */}
      {report.posts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-textMuted)' }}>
          <p>No individual post data available for this campaign yet.</p>
        </div>
      )}

      {/* Footer: generated timestamp */}
      <p style={{ textAlign: 'center', fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 'var(--space-4)' }}>
        Report generated {formatDate(report.generatedAt)}
      </p>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const cellStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  fontSize: 'var(--font-sm)',
  color: 'var(--color-textPrimary)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

function postLabel(post: PostMetrics): string {
  const date = new Date(post.postedAt);
  const platform = post.platform === 'instagram' ? 'IG' : 'TT';
  return `${platform} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback: no-op if clipboard API fails
  });
}
