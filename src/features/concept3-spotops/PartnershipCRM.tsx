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

interface EditFormData {
  status: CampaignStatus;
  package: string;
  budget: number;
  startDate: string;
  endDate: string;
  notes: string;
  deliverables: Deliverable[];
}

/* ─── Constants ────────────────────────────────────────────────────────────── */

const STATUS_PIPELINE: CampaignStatus[] = ['inquiry', 'negotiation', 'active', 'completed'];

const STATUS_OPTIONS: CampaignStatus[] = ['inquiry', 'negotiation', 'active', 'completed', 'cancelled'];

const PACKAGE_OPTIONS = ['Spotlight', 'Feature', 'Series', 'Takeover', 'Custom'];

const DELIVERABLE_TYPES: Deliverable['type'][] = ['reel', 'story', 'post', 'tiktok', 'mention'];

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

function nextStatus(current: CampaignStatus): CampaignStatus | null {
  const idx = STATUS_PIPELINE.indexOf(current);
  if (idx === -1 || idx === STATUS_PIPELINE.length - 1) return null;
  return STATUS_PIPELINE[idx + 1];
}

function makeDeliverableId(): string {
  return `del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  /* ─── Pipeline Step Indicator ─────────────────────────────────────────── */
  pipelineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  pipelineStep: (active: boolean, past: boolean) =>
    ({
      flex: 1,
      textAlign: 'center' as const,
      padding: 'var(--space-2) var(--space-1)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-xs)',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.03em',
      background: active
        ? 'var(--color-accentMuted)'
        : past
          ? 'var(--color-successMuted)'
          : 'var(--color-bgElevated)',
      color: active
        ? 'var(--color-accent)'
        : past
          ? 'var(--color-success)'
          : 'var(--color-textMuted)',
      border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
    }) as React.CSSProperties,
  pipelineArrow: {
    color: 'var(--color-textMuted)',
    fontSize: 'var(--font-xs)',
    flexShrink: 0,
  } as React.CSSProperties,
  /* ─── Form Styles ────────────────────────────────────────────────────── */
  formGroup: {
    marginBottom: 'var(--space-4)',
  } as React.CSSProperties,
  formLabel: {
    display: 'block',
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-textSecondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-2)',
  } as React.CSSProperties,
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
  } as React.CSSProperties,
  deliverableEditRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr auto auto',
    gap: 'var(--space-2)',
    alignItems: 'center',
    marginBottom: 'var(--space-2)',
  } as React.CSSProperties,
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: 'var(--color-accent)',
  } as React.CSSProperties,
  clickableDeliverable: (completed: boolean) =>
    ({
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 'var(--font-sm)',
      color: 'var(--color-textSecondary)',
      cursor: 'pointer',
      borderRadius: 'var(--radius-sm)',
      transition: 'background var(--transition-fast)',
      background: completed ? 'var(--color-successMuted)' : 'transparent',
    }) as React.CSSProperties,
  inlineNotesPrompt: {
    padding: 'var(--space-3)',
    fontSize: 'var(--font-sm)',
    color: 'var(--color-textMuted)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    border: '1px dashed var(--color-border)',
    textAlign: 'center' as const,
    transition: 'border-color var(--transition-fast)',
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
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode()) {
      setCampaigns(DEMO_CAMPAIGNS);
      setLoading(false);
      return;
    }

    const res = await api.get<Campaign[]>('/api/spotops/campaigns');
    if (res.error) {
      setError(res.error);
    }
    if (res.data && res.data.length > 0) {
      setCampaigns(res.data);
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

  /* ─── Mutation helpers ───────────────────────────────────────────────── */

  const updateCampaign = useCallback(
    async (id: string, updates: Partial<Campaign>) => {
      // Update local state
      setCampaigns((prev) => prev.map((c) => (c.campaignId === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)));

      // Update selected campaign if viewing it
      setSelectedCampaign((prev) => (prev && prev.campaignId === id ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : prev));

      // In real mode, fire API
      if (!isDemoMode()) {
        await api.put(`/api/campaigns/${id}`, updates);
      }
    },
    [],
  );

  const handleToggleDeliverable = useCallback(
    (campaignId: string, deliverableId: string, deliverables: Deliverable[]) => {
      const updated = deliverables.map((d) =>
        d.id === deliverableId
          ? {
              ...d,
              completed: !d.completed,
              completedAt: !d.completed ? new Date().toISOString() : undefined,
            }
          : d,
      );
      updateCampaign(campaignId, { deliverables: updated });
    },
    [updateCampaign],
  );

  const handleStatusAdvance = useCallback(
    (campaignId: string, newStatus: CampaignStatus) => {
      updateCampaign(campaignId, { status: newStatus });
    },
    [updateCampaign],
  );

  const handleNotesSave = useCallback(
    (campaignId: string, notes: string) => {
      updateCampaign(campaignId, { notes: notes || undefined });
      setEditingNotes(false);
    },
    [updateCampaign],
  );

  /* ─── Edit Modal helpers ─────────────────────────────────────────────── */

  const openEditModal = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditForm({
      status: campaign.status,
      package: campaign.package,
      budget: campaign.budget,
      startDate: campaign.startDate ?? '',
      endDate: campaign.endDate ?? '',
      notes: campaign.notes ?? '',
      deliverables: campaign.deliverables.map((d) => ({ ...d })),
    });
    // Close view panel if open
    setSelectedCampaign(null);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingCampaign(null);
    setEditForm(null);
    setEditSaving(false);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingCampaign || !editForm) return;
    if (editForm.budget <= 0) return;

    setEditSaving(true);

    const updates: Partial<Campaign> = {
      status: editForm.status,
      package: editForm.package,
      budget: editForm.budget,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
      notes: editForm.notes || undefined,
      deliverables: editForm.deliverables,
    };

    await updateCampaign(editingCampaign.campaignId, updates);
    setEditSaving(false);
    closeEditModal();
  }, [editingCampaign, editForm, updateCampaign, closeEditModal]);

  const addDeliverable = useCallback(() => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      deliverables: [
        ...editForm.deliverables,
        { id: makeDeliverableId(), type: 'reel', description: '', completed: false },
      ],
    });
  }, [editForm]);

  const removeDeliverable = useCallback(
    (id: string) => {
      if (!editForm) return;
      setEditForm({
        ...editForm,
        deliverables: editForm.deliverables.filter((d) => d.id !== id),
      });
    },
    [editForm],
  );

  const updateDeliverable = useCallback(
    (id: string, field: keyof Deliverable, value: string | boolean) => {
      if (!editForm) return;
      setEditForm({
        ...editForm,
        deliverables: editForm.deliverables.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
      });
    },
    [editForm],
  );

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
                            openEditModal(campaign);
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

      {/* ─── Interactive Detail Panel ─────────────────────────────────────── */}
      {selectedCampaign && (
        <div
          style={styles.detailOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedCampaign(null);
              setEditingNotes(false);
            }
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
                onClick={() => {
                  setSelectedCampaign(null);
                  setEditingNotes(false);
                }}
                aria-label="Close detail panel"
              >
                {'\u2715'}
              </button>
            </div>

            {/* Pipeline Status Indicator */}
            {selectedCampaign.status !== 'cancelled' && (
              <div style={styles.pipelineRow}>
                {STATUS_PIPELINE.map((stage, i) => {
                  const currentIdx = STATUS_PIPELINE.indexOf(selectedCampaign.status);
                  const isActive = stage === selectedCampaign.status;
                  const isPast = i < currentIdx;
                  return (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 'var(--space-2)' }}>
                      <div style={{ ...styles.pipelineStep(isActive, isPast), flex: 1 }}>
                        {isPast ? '\u2713 ' : ''}{stage}
                      </div>
                      {i < STATUS_PIPELINE.length - 1 && <span style={styles.pipelineArrow}>{'\u203A'}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Status Advance Button */}
            {nextStatus(selectedCampaign.status) && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleStatusAdvance(selectedCampaign.campaignId, nextStatus(selectedCampaign.status)!)}
                >
                  Move to {nextStatus(selectedCampaign.status)}
                </button>
              </div>
            )}

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

            {/* Inline Notes Editing */}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ ...styles.detailLabel, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Notes</div>
              {editingNotes ? (
                <div>
                  <textarea
                    className="form-input"
                    style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditingNotes(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleNotesSave(selectedCampaign.campaignId, notesValue)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : selectedCampaign.notes ? (
                <p
                  style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.6, cursor: 'pointer', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}
                  onClick={() => {
                    setNotesValue(selectedCampaign.notes ?? '');
                    setEditingNotes(true);
                  }}
                  title="Click to edit"
                >
                  {selectedCampaign.notes}
                </p>
              ) : (
                <div
                  style={styles.inlineNotesPrompt}
                  onClick={() => {
                    setNotesValue('');
                    setEditingNotes(true);
                  }}
                >
                  + Add notes
                </div>
              )}
            </div>

            {/* Clickable Deliverables */}
            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-3)' }}>
                Deliverables ({selectedCampaign.deliverables.filter((d) => d.completed).length}/{selectedCampaign.deliverables.length})
              </div>
              <div style={styles.progressTrack}>
                <div style={styles.progressFill(deliverableProgress(selectedCampaign.deliverables))} />
              </div>
              <div style={{ marginTop: 'var(--space-3)' }}>
                {selectedCampaign.deliverables.map((d) => (
                  <div
                    key={d.id}
                    style={styles.clickableDeliverable(d.completed)}
                    onClick={() => handleToggleDeliverable(selectedCampaign.campaignId, d.id, selectedCampaign.deliverables)}
                    role="checkbox"
                    aria-checked={d.completed}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleDeliverable(selectedCampaign.campaignId, d.id, selectedCampaign.deliverables);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={d.completed}
                      readOnly
                      style={styles.checkbox}
                      tabIndex={-1}
                    />
                    <span style={{ color: d.completed ? 'var(--color-textPrimary)' : 'var(--color-textSecondary)', flex: 1 }}>
                      {d.description}
                    </span>
                    <span className={`badge ${d.completed ? 'badge--success' : 'badge--info'}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      {d.type}
                    </span>
                    {d.completed && d.completedAt && (
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', flexShrink: 0 }}>
                        {formatDate(d.completedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setSelectedCampaign(null); setEditingNotes(false); }}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => openEditModal(selectedCampaign)}>
                Edit Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Campaign Modal ──────────────────────────────────────────── */}
      {editingCampaign && editForm && (
        <div
          style={styles.detailOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div style={{ ...styles.detailPanel, maxWidth: '640px' }}>
            <div style={styles.detailHeader}>
              <div>
                <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Edit Campaign
                </h2>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
                  {editingCampaign.restaurantName}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={closeEditModal}
                aria-label="Close edit modal"
              >
                {'\u2715'}
              </button>
            </div>

            {/* Status + Package row */}
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Status</label>
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as CampaignStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Package</label>
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editForm.package}
                  onChange={(e) => setEditForm({ ...editForm, package: e.target.value })}
                >
                  {PACKAGE_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget */}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Budget</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)' }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '100%', paddingLeft: 'var(--space-6)' }}
                  value={editForm.budget}
                  min={1}
                  onChange={(e) => setEditForm({ ...editForm, budget: Number(e.target.value) })}
                />
              </div>
              {editForm.budget <= 0 && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-error)', marginTop: 'var(--space-1)', display: 'block' }}>
                  Budget must be greater than 0
                </span>
              )}
            </div>

            {/* Dates row */}
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>End Date</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Notes</label>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add campaign notes..."
              />
            </div>

            {/* Deliverables */}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Deliverables</label>
              {editForm.deliverables.map((d) => (
                <div key={d.id} style={styles.deliverableEditRow}>
                  <select
                    className="form-input"
                    value={d.type}
                    onChange={(e) => updateDeliverable(d.id, 'type', e.target.value)}
                  >
                    {DELIVERABLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    value={d.description}
                    onChange={(e) => updateDeliverable(d.id, 'description', e.target.value)}
                    placeholder="Description..."
                  />
                  <input
                    type="checkbox"
                    checked={d.completed}
                    onChange={(e) => updateDeliverable(d.id, 'completed', e.target.checked)}
                    style={styles.checkbox}
                    title="Completed"
                  />
                  <button
                    className="btn btn-ghost"
                    onClick={() => removeDeliverable(d.id)}
                    title="Remove deliverable"
                    style={{ color: 'var(--color-error)', padding: 'var(--space-1) var(--space-2)' }}
                  >
                    {'\u2715'}
                  </button>
                </div>
              ))}
              <button
                className="btn btn-ghost"
                onClick={addDeliverable}
                style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-sm)' }}
              >
                + Add Deliverable
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-5)' }}>
              <button className="btn btn-secondary" onClick={closeEditModal} disabled={editSaving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEditSave}
                disabled={editSaving || editForm.budget <= 0}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
