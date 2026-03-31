import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Campaign, CampaignStatus, Deliverable } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_CAMPAIGNS } from '../../data/demoData';
import { EmptyState } from '../../components/EmptyState';
import CampaignDetailPanel, { formatDate } from '../../components/CampaignDetailPanel';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type SortField = 'date' | 'value';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'kanban';

interface CRMStats {
  pipelineValue: number;
  conversionRate: number;
  avgCloseTimeDays: number;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const STATUS_BADGE: Record<CampaignStatus, string> = {
  inquiry: 'badge--info',
  negotiation: 'badge--warning',
  active: 'badge--success',
  completed: 'badge--accent',
  cancelled: 'badge--error',
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
  viewToggle: {
    display: 'flex',
    gap: 'var(--space-1)',
    marginLeft: 'var(--space-3)',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-md)',
    padding: '2px',
    border: '1px solid var(--color-border)',
  } as React.CSSProperties,
  viewBtn: (active: boolean) =>
    ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '28px',
      borderRadius: 'calc(var(--radius-md) - 2px)',
      cursor: 'pointer',
      border: 'none',
      background: active ? 'var(--color-accent)' : 'transparent',
      color: active ? '#fff' : 'var(--color-textMuted)',
      transition: 'all var(--transition-fast)',
      fontSize: '14px',
    }) as React.CSSProperties,
  kanbanBoard: {
    display: 'flex',
    gap: 'var(--space-4)',
    overflowX: 'auto' as const,
    paddingBottom: 'var(--space-4)',
    alignItems: 'flex-start',
  } as React.CSSProperties,
  kanbanColumn: {
    flexShrink: 0,
    width: '240px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-3)',
  } as React.CSSProperties,
  kanbanColumnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-3) var(--space-4)',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-md)',
    borderBottom: '2px solid var(--color-border)',
  } as React.CSSProperties,
  kanbanColumnTitle: {
    fontSize: 'var(--font-xs)',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
  kanbanCard: {
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-4)',
    cursor: 'pointer',
    border: '1px solid var(--color-border)',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-2)',
  } as React.CSSProperties,
  kanbanCardTitle: {
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.3,
  } as React.CSSProperties,
  kanbanCardMeta: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
  } as React.CSSProperties,
  kanbanEmpty: {
    padding: 'var(--space-5) var(--space-4)',
    textAlign: 'center' as const,
    color: 'var(--color-textMuted)',
    fontSize: 'var(--font-xs)',
    background: 'var(--color-bgElevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--color-border)',
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

const KANBAN_STAGES: CampaignStatus[] = ['inquiry', 'negotiation', 'active', 'completed', 'cancelled'];

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function PartnershipCRM() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  /* ─── Data fetching (React Query) ──────────────────────────────────── */

  const { data: campaigns = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['crmCampaigns'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CAMPAIGNS;
      const res = await api.get<{ items: Campaign[]; nextPage?: string }>('/api/spotops/campaigns');
      if (res.error) throw new Error(res.error);
      // Backend returns paginated { items, nextPage } format
      return res.data?.items ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ campaignId, updates }: { campaignId: string; updates: Partial<Campaign> }) => {
      if (isDemoMode()) return { ...selectedCampaign, ...updates } as Campaign;
      const res = await api.put<Campaign>(`/api/campaigns/${campaignId}`, updates);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crmCampaigns'] });
      if (data) setSelectedCampaign(data as Campaign);
    },
  });

  /* ─── Derived data ──────────────────────────────────────────────────── */

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

  // Kanban: group all campaigns by status, sorted within each column
  const kanbanGrouped = useMemo(() => {
    const sorted = [...campaigns].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = a.budget - b.budget;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return KANBAN_STAGES.reduce<Record<CampaignStatus, Campaign[]>>((acc, stage) => {
      acc[stage] = sorted.filter((c) => c.status === stage);
      return acc;
    }, {} as Record<CampaignStatus, Campaign[]>);
  }, [campaigns, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  /* ─── Loading ────────────────────────────────────────────────────────── */

  if (isLoading) {
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

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Restaurant CRM</h1>
          <p className="page-subtitle">Track your restaurant partnerships and see what to do next</p>
        </div>
        <Link to="/app/campaigns" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + New Campaign
        </Link>
      </div>

      {/* Error */}
      {isError && (
        <div style={styles.errorBanner}>
          <span>{error instanceof Error ? error.message : 'Failed to load campaigns'}</span>
          <button className="btn btn-ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div style={styles.statsRow} className="stagger-children">
        <div className="card">
          <div style={styles.statValue}>{formatCurrency(stats.pipelineValue)}</div>
          <div style={styles.statLabel}>Est. Attribution Value</div>
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
        {viewMode === 'table' && STATUS_FILTERS.map((f) => (
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
          onClick={() => toggleSort('value')}
          title="Sort by estimated value"
        >
          Value {sortField === 'value' ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
        </button>
        {/* View toggle */}
        <div style={styles.viewToggle}>
          <button
            style={styles.viewBtn(viewMode === 'table')}
            onClick={() => setViewMode('table')}
            title="Table view"
            aria-label="Switch to table view"
          >
            ☰
          </button>
          <button
            style={styles.viewBtn(viewMode === 'kanban')}
            onClick={() => setViewMode('kanban')}
            title="Kanban view"
            aria-label="Switch to Kanban view"
          >
            ⊞
          </button>
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon={statusFilter !== 'all' ? '\uD83D\uDD0D' : '\uD83E\uDD1D'}
              title={statusFilter !== 'all' ? 'No matching campaigns' : 'Your CRM is empty'}
              description={statusFilter !== 'all'
                ? `No campaigns with status "${statusFilter}". Try a different filter or create a new campaign.`
                : 'Start by discovering restaurants and creating your first campaign. Your partnerships will appear here.'}
              ctaLabel={statusFilter === 'all' ? 'Discover Restaurants' : undefined}
              ctaTo={statusFilter === 'all' ? '/app/restaurants' : undefined}
              secondaryLabel={statusFilter === 'all' ? 'New Campaign' : undefined}
              secondaryTo={statusFilter === 'all' ? '/app/campaigns' : undefined}
            />
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Restaurant</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Package</th>
                  <th style={styles.th}>Est. Value</th>
                  <th style={styles.th}>Start Date</th>
                  <th style={styles.th}>Deliverables</th>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Kanban view */}
      {viewMode === 'kanban' && (
        campaigns.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="\uD83E\uDD1D"
              title="Your CRM is empty"
              description="Start by discovering restaurants and creating your first campaign. Your partnerships will appear here."
              ctaLabel="Discover Restaurants"
              ctaTo="/app/restaurants"
              secondaryLabel="New Campaign"
              secondaryTo="/app/campaigns"
            />
          </div>
        ) : (
          <div style={styles.kanbanBoard}>
            {KANBAN_STAGES.map((stage) => {
              const cards = kanbanGrouped[stage] ?? [];
              return (
                <div key={stage} style={styles.kanbanColumn}>
                  <div style={styles.kanbanColumnHeader}>
                    <span style={styles.kanbanColumnTitle}>{stage}</span>
                    <span className={`badge ${STATUS_BADGE[stage]}`}>{cards.length}</span>
                  </div>
                  {cards.length === 0 ? (
                    <div style={styles.kanbanEmpty}>No deals</div>
                  ) : (
                    cards.map((campaign) => {
                      const progress = deliverableProgress(campaign.deliverables);
                      return (
                        <div
                          key={campaign.campaignId}
                          style={styles.kanbanCard}
                          onClick={() => setSelectedCampaign(campaign)}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)';
                            (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                          }}
                        >
                          <div style={styles.kanbanCardTitle}>{campaign.restaurantName}</div>
                          <div style={styles.kanbanCardMeta}>{campaign.package}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                              {formatCurrency(campaign.budget)}
                            </span>
                            <span style={styles.kanbanCardMeta}>{formatDate(campaign.startDate)}</span>
                          </div>
                          {campaign.deliverables.length > 0 && (
                            <>
                              <div style={styles.progressTrack}>
                                <div style={styles.progressFill(progress)} />
                              </div>
                              <div style={styles.progressText}>
                                {campaign.deliverables.filter((d) => d.completed).length}/{campaign.deliverables.length} deliverables
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ─── Rich Detail Panel (shared component) ──────────────────────── */}
      {selectedCampaign && (
        <CampaignDetailPanel
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onUpdate={(updates) => updateMutation.mutate({ campaignId: selectedCampaign.campaignId, updates })}
          isSaving={updateMutation.isPending}
          variant="modal"
        />
      )}
    </div>
  );
}
