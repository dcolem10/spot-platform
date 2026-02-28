import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Campaign, CampaignStatus, Deliverable } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_CAMPAIGNS } from '../../data/demoData';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type SortField = 'date' | 'budget';
type SortDir = 'asc' | 'desc';

interface CRMStats {
  pipelineValue: number;
  conversionRate: number;
  avgCloseTimeDays: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const STATUS_BADGE: Record<CampaignStatus, string> = {
  inquiry: 'badge--info',
  negotiation: 'badge--warning',
  active: 'badge--success',
  completed: 'badge--accent',
  cancelled: 'badge--error',
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso?: string): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deliverableProgress(deliverables: Deliverable[]): number {
  if (deliverables.length === 0) return 0;
  const completed = deliverables.filter((d) => d.completed).length;
  return Math.round((completed / deliverables.length) * 100);
}

function computeStats(campaigns: Campaign[]): CRMStats {
  const pipelineValue = campaigns.reduce((sum, c) => sum + c.budget, 0);

  const total = campaigns.filter((c) => c.status !== 'cancelled').length;
  const converted = campaigns.filter((c) => c.status === 'active' || c.status === 'completed').length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const closedCampaigns = campaigns.filter((c) => c.status === 'completed' || c.status === 'active');
  let avgCloseTimeDays = 0;
  if (closedCampaigns.length > 0) {
    const totalDays = closedCampaigns.reduce((sum, c) => {
      const created = new Date(c.createdAt).getTime();
      const started = c.startDate ? new Date(c.startDate).getTime() : created;
      return sum + Math.max(1, Math.round((started - created) / 86400000));
    }, 0);
    avgCloseTimeDays = Math.round(totalDays / closedCampaigns.length);
  }

  return { pipelineValue, conversionRate, avgCloseTimeDays };
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--space-5)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  statValue: {
    fontSize: 'var(--font-2xl)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
  } as React.CSSProperties,
  statLabel: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
    marginTop: 'var(--space-1)',
  } as React.CSSProperties,
  toolbar: {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    marginBottom: 'var(--space-5)',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  filterBtn: (active: boolean) =>
    ({
      padding: 'var(--space-2) var(--space-4)',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-xs)',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.03em',
      cursor: 'pointer',
      transition: 'all var(--transition-fast)',
      background: active ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
      color: active ? 'var(--color-accent)' : 'var(--color-textSecondary)',
      border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    }) as React.CSSProperties,
  sortBtn: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    transition: 'color var(--transition-fast)',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
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
    padding: 'var(--space-4)',
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textPrimary)',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  row: {
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
  } as React.CSSProperties,
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  } as React.CSSProperties,
  progressFill: (pct: number) =>
    ({
      width: `${pct}%`,
      height: '100%',
      background: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)',
      borderRadius: 'var(--radius-full)',
      transition: 'width var(--transition-slow)',
    }) as React.CSSProperties,
  progressText: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    marginTop: 'var(--space-1)',
  } as React.CSSProperties,
  actionBtns: {
    display: 'flex',
    gap: 'var(--space-2)',
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
  detailOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  detailPanel: {
    background: 'var(--color-bgSecondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-8)',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: 'var(--shadow-xl)',
  } as React.CSSProperties,
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 'var(--space-3) 0',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 'var(--font-sm)',
  } as React.CSSProperties,
  detailLabel: {
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
  detailValue: {
    color: 'var(--color-textPrimary)',
    fontWeight: 600,
  } as React.CSSProperties,
  deliverableItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) 0',
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
} as const;

const STATUS_FILTERS: { key: CampaignStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function PartnershipCRM() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Campaign[]>('/api/spotops/campaigns');
    if (res.error && !isDemoMode) {
      setError(res.error);
    }
    if (res.data && res.data.length > 0) {
      setCampaigns(res.data);
    } else if (isDemoMode) {
      setCampaigns(DEMO_CAMPAIGNS);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const filtered = useMemo(() => {
    let result = [...campaigns];

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = a.budget - b.budget;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [campaigns, statusFilter, sortField, sortDir]);

  const stats = useMemo(() => computeStats(campaigns), [campaigns]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '160px', height: '18px' }} />
        </div>
        <div style={styles.statsRow}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: '120px', height: '28px', marginBottom: 'var(--space-2)' }} />
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="skeleton" style={{ height: '300px' }} />
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Partnership CRM</h1>
        <p className="page-subtitle">Manage all your restaurant partnerships in one place</p>
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

      {/* Summary Stats */}
      <div style={styles.statsRow} className="stagger-children">
        <div className="card">
          <div style={styles.statValue}>{formatCurrency(stats.pipelineValue)}</div>
          <div style={styles.statLabel}>Total Pipeline Value</div>
        </div>
        <div className="card">
          <div style={styles.statValue}>{stats.conversionRate}%</div>
          <div style={styles.statLabel}>Conversion Rate</div>
        </div>
        <div className="card">
          <div style={styles.statValue}>
            {stats.avgCloseTimeDays} <span style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--color-textSecondary)' }}>days</span>
          </div>
          <div style={styles.statLabel}>Average Close Time</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            style={styles.filterBtn(statusFilter === f.key)}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button
          style={styles.sortBtn}
          onClick={() => toggleSort('date')}
          title="Sort by date"
        >
          Date {sortField === 'date' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
        </button>
        <button
          style={styles.sortBtn}
          onClick={() => toggleSort('budget')}
          title="Sort by budget"
        >
          Budget {sortField === 'budget' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No partnerships found</h3>
            <p>
              {statusFilter !== 'all'
                ? `No campaigns with status "${statusFilter}"`
                : 'Create your first campaign to get started'}
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Restaurant</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Package</th>
                <th style={styles.th}>Budget</th>
                <th style={styles.th}>Start Date</th>
                <th style={styles.th}>Deliverables</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((campaign) => {
                const progress = deliverableProgress(campaign.deliverables);
                return (
                  <tr
                    key={campaign.campaignId}
                    style={styles.row}
                    onClick={() => setSelectedCampaign(campaign)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-bgHover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '';
                    }}
                  >
                    <td style={{ ...styles.td, fontWeight: 600 }}>{campaign.restaurantName}</td>
                    <td style={styles.td}>
                      <span className={`badge ${STATUS_BADGE[campaign.status]}`}>{campaign.status}</span>
                    </td>
                    <td style={styles.td}>{campaign.package}</td>
                    <td style={styles.td}>{formatCurrency(campaign.budget)}</td>
                    <td style={styles.td}>{formatDate(campaign.startDate)}</td>
                    <td style={styles.td}>
                      <div style={styles.progressTrack}>
                        <div style={styles.progressFill(progress)} />
                      </div>
                      <div style={styles.progressText}>
                        {campaign.deliverables.filter((d) => d.completed).length}/{campaign.deliverables.length} ({progress}%)
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionBtns}>
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaign(campaign);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            /* navigate to edit */
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedCampaign && (
        <div
          style={styles.detailOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCampaign(null);
          }}
        >
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              <div>
                <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  {selectedCampaign.restaurantName}
                </h2>
                <span className={`badge ${STATUS_BADGE[selectedCampaign.status]}`}>
                  {selectedCampaign.status}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedCampaign(null)}
                aria-label="Close detail panel"
              >
                \u2715
              </button>
            </div>

            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Package</span>
              <span style={styles.detailValue}>{selectedCampaign.package}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Budget</span>
              <span style={styles.detailValue}>{formatCurrency(selectedCampaign.budget)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Start Date</span>
              <span style={styles.detailValue}>{formatDate(selectedCampaign.startDate)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>End Date</span>
              <span style={styles.detailValue}>{formatDate(selectedCampaign.endDate)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Created</span>
              <span style={styles.detailValue}>{formatDate(selectedCampaign.createdAt)}</span>
            </div>

            {selectedCampaign.notes && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ ...styles.detailLabel, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Notes</div>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.6 }}>
                  {selectedCampaign.notes}
                </p>
              </div>
            )}

            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)' }}>
                Deliverables ({selectedCampaign.deliverables.filter((d) => d.completed).length}/{selectedCampaign.deliverables.length})
              </div>
              <div style={styles.progressTrack}>
                <div style={styles.progressFill(deliverableProgress(selectedCampaign.deliverables))} />
              </div>
              <div style={{ marginTop: 'var(--space-3)' }}>
                {selectedCampaign.deliverables.map((d) => (
                  <div key={d.id} style={styles.deliverableItem}>
                    <span style={{ color: d.completed ? 'var(--color-success)' : 'var(--color-textMuted)' }}>
                      {d.completed ? '\u2713' : '\u25CB'}
                    </span>
                    <span style={{ color: d.completed ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)' }}>
                      {d.description}
                    </span>
                    <span className={`badge ${d.completed ? 'badge--success' : 'badge--info'}`} style={{ marginLeft: 'auto' }}>
                      {d.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCampaign(null)}>
                Close
              </button>
              <button className="btn btn-primary">Edit Campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
