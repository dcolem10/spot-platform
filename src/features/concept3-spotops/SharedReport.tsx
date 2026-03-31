import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface SharedReportData {
  campaignId: string;
  restaurantName: string;
  package: string;
  period: { start: string; end: string };
  metrics: {
    totalScans: number;
    totalRedemptions: number;
    estimatedVisits: number;
    estimatedRevenue: number;
    roi: number;
    costPerVisit: number;
    costPerRedemption: number;
    scanToRedemptionRate: number;
    budget: number;
  };
  generatedAt: string;
  expiresAt: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid report link');
      setLoading(false);
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${apiBase}/api/shared-report/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Report not found or expired');
        } else {
          setReport(data);
        }
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3b8' }}>
            Loading report...
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.errorBox}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
            <h2 style={{ color: '#f4f4f8', marginBottom: '8px' }}>Report Not Found</h2>
            <p style={{ color: '#9ca3b8' }}>{error || 'This report link may have expired or is invalid.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const scanToRedemption =
    report.metrics.totalScans > 0
      ? ((report.metrics.totalRedemptions / report.metrics.totalScans) * 100).toFixed(1)
      : '0';

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>Spot</div>
          <div style={styles.badge}>Attribution Report</div>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>{report.restaurantName}</h1>
          <p style={styles.heroMeta}>
            {report.package && <span style={styles.chip}>{report.package}</span>}
            {formatDate(report.period.start)} — {formatDate(report.period.end)}
          </p>
          <p style={styles.heroSub}>
            Generated {formatDate(report.generatedAt)} · Valid until {formatDate(report.expiresAt)}
          </p>
        </div>

        {/* Key Metrics */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{formatNumber(report.metrics.totalScans)}</div>
            <div style={styles.metricLabel}>QR Code Scans</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{formatNumber(report.metrics.totalRedemptions)}</div>
            <div style={styles.metricLabel}>Offer Redemptions</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{formatNumber(report.metrics.estimatedVisits)}</div>
            <div style={styles.metricLabel}>Estimated Visits</div>
          </div>
          <div style={{ ...styles.metricCard, borderColor: '#f97316' }}>
            <div style={{ ...styles.metricValue, color: '#f97316' }}>{scanToRedemption}%</div>
            <div style={styles.metricLabel}>Scan-to-Redemption</div>
          </div>
        </div>

        {/* ROI Section (only show if budget was set) */}
        {report.metrics.budget > 0 && (
          <div style={styles.roiCard}>
            <h2 style={styles.sectionTitle}>Return on Investment</h2>
            <div style={styles.roiGrid}>
              <div style={styles.roiItem}>
                <div style={styles.roiValue}>{formatCurrency(report.metrics.budget)}</div>
                <div style={styles.roiLabel}>Campaign Budget</div>
              </div>
              <div style={styles.roiItem}>
                <div style={styles.roiValue}>{formatCurrency(report.metrics.estimatedRevenue)}</div>
                <div style={styles.roiLabel}>Estimated Revenue Driven</div>
              </div>
              <div style={styles.roiItem}>
                <div style={{ ...styles.roiValue, color: report.metrics.roi >= 0 ? '#22c55e' : '#ef4444' }}>
                  {report.metrics.roi >= 0 ? '+' : ''}{report.metrics.roi.toFixed(0)}%
                </div>
                <div style={styles.roiLabel}>Return on Investment</div>
              </div>
              {report.metrics.costPerVisit > 0 && (
                <div style={styles.roiItem}>
                  <div style={styles.roiValue}>{formatCurrency(report.metrics.costPerVisit)}</div>
                  <div style={styles.roiLabel}>Cost per Visit</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attribution Breakdown */}
        <div style={styles.attributionCard}>
          <h2 style={styles.sectionTitle}>Attribution Breakdown</h2>
          <div style={styles.attrRow}>
            <span style={styles.attrLabel}>Scan-to-Redemption Rate</span>
            <span style={styles.attrValue}>{scanToRedemption}%</span>
          </div>
          {report.metrics.costPerRedemption > 0 && (
            <div style={styles.attrRow}>
              <span style={styles.attrLabel}>Cost per Redemption</span>
              <span style={styles.attrValue}>{formatCurrency(report.metrics.costPerRedemption)}</span>
            </div>
          )}
          <div style={styles.attrRow}>
            <span style={styles.attrLabel}>Visits Estimated from Redemptions</span>
            <span style={styles.attrValue}>{formatNumber(report.metrics.estimatedVisits)}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p>This report was shared by a creator on <strong>Spot Platform</strong>.</p>
          <p style={{ marginTop: '4px', fontSize: '12px' }}>
            Estimated visits use a 1.8× visit multiplier (not all customers use offers).
            Revenue estimates are based on industry-average check sizes unless POS data is connected.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────────── */

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0c0c14',
    color: '#f4f4f8',
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '40px 16px',
  } as React.CSSProperties,
  container: {
    maxWidth: '720px',
    margin: '0 auto',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '40px',
  } as React.CSSProperties,
  logo: {
    fontSize: '24px',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
    background: 'linear-gradient(135deg, #f97316, #fb923c)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as React.CSSProperties,
  badge: {
    padding: '4px 12px',
    borderRadius: '999px',
    background: 'rgba(249, 115, 22, 0.15)',
    border: '1px solid rgba(249, 115, 22, 0.3)',
    color: '#f97316',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  hero: {
    marginBottom: '32px',
  } as React.CSSProperties,
  heroTitle: {
    fontSize: '36px',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    marginBottom: '8px',
    lineHeight: 1.2,
  } as React.CSSProperties,
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#9ca3b8',
    fontSize: '15px',
    marginBottom: '4px',
  } as React.CSSProperties,
  heroSub: {
    fontSize: '13px',
    color: '#5e6480',
  } as React.CSSProperties,
  chip: {
    padding: '2px 8px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    fontSize: '12px',
    color: '#f4f4f8',
  } as React.CSSProperties,
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  } as React.CSSProperties,
  metricCard: {
    padding: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  metricValue: {
    fontSize: '32px',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    color: '#f4f4f8',
    lineHeight: 1.1,
  } as React.CSSProperties,
  metricLabel: {
    fontSize: '12px',
    color: '#9ca3b8',
    marginTop: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 600,
  } as React.CSSProperties,
  roiCard: {
    padding: '24px',
    background: 'rgba(249, 115, 22, 0.06)',
    border: '1px solid rgba(249, 115, 22, 0.2)',
    borderRadius: '12px',
    marginBottom: '16px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f4f4f8',
    marginBottom: '16px',
  } as React.CSSProperties,
  roiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  } as React.CSSProperties,
  roiItem: {
    textAlign: 'center' as const,
  } as React.CSSProperties,
  roiValue: {
    fontSize: '24px',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    color: '#f4f4f8',
  } as React.CSSProperties,
  roiLabel: {
    fontSize: '12px',
    color: '#9ca3b8',
    marginTop: '2px',
  } as React.CSSProperties,
  attributionCard: {
    padding: '24px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    marginBottom: '24px',
  } as React.CSSProperties,
  attrRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontSize: '14px',
  } as React.CSSProperties,
  attrLabel: {
    color: '#9ca3b8',
  } as React.CSSProperties,
  attrValue: {
    fontWeight: 700,
    color: '#f4f4f8',
  } as React.CSSProperties,
  errorBox: {
    textAlign: 'center' as const,
    padding: '80px 0',
  } as React.CSSProperties,
  footer: {
    color: '#5e6480',
    fontSize: '13px',
    lineHeight: 1.6,
    textAlign: 'center' as const,
    paddingTop: '24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  } as React.CSSProperties,
};
