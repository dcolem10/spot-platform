import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_CAMPAIGNS } from '../../data/demoData';
import CampaignWizard, { type RestaurantContext } from './CampaignWizard';
import type { Campaign, CampaignStatus, Deliverable } from '../../types';
import './CampaignManager.css';

const STAGES: { key: CampaignStatus; label: string; badgeClass: string }[] = [
  { key: 'inquiry', label: 'Inquiry', badgeClass: 'badge--info' },
  { key: 'negotiation', label: 'Negotiation', badgeClass: 'badge--warning' },
  { key: 'active', label: 'Active', badgeClass: 'badge--success' },
  { key: 'completed', label: 'Completed', badgeClass: 'badge--accent' },
];

function formatBudget(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deliverableProgress(deliverables: Deliverable[]): { done: number; total: number; pct: number } {
  const total = deliverables.length;
  const done = deliverables.filter((d) => d.completed).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export default function CampaignManager() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showWizard, setShowWizard] = useState(false);
  const [restaurantContext, setRestaurantContext] = useState<RestaurantContext | null>(null);

  // Auto-open wizard if restaurant context is in URL (came from RestaurantDetail)
  useEffect(() => {
    const restaurantId = searchParams.get('restaurantId');
    const restaurantName = searchParams.get('restaurantName');
    if (restaurantId && restaurantName) {
      setRestaurantContext({
        restaurantId,
        restaurantName,
        restaurantPhoto: searchParams.get('restaurantPhoto') || undefined,
        restaurantCuisine: searchParams.get('restaurantCuisine') || undefined,
        restaurantNeighborhood: searchParams.get('restaurantNeighborhood') || undefined,
        restaurantPrice: searchParams.get('restaurantPrice') ? Number(searchParams.get('restaurantPrice')) : undefined,
      });
      setShowWizard(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CAMPAIGNS;
      const res = await api.get<Campaign[]>('/api/campaigns');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Campaign>) => {
      const res = await api.post<Campaign>('/api/campaigns', payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      handleCloseWizard();
    },
  });

  const handleOpenWizard = useCallback(() => {
    setRestaurantContext(null);
    setShowWizard(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setShowWizard(false);
    setRestaurantContext(null);
    // Clear URL params if present
    setSearchParams({});
  }, [setSearchParams]);

  const moveMutation = useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: string; status: CampaignStatus }) => {
      const res = await api.put<Campaign>(`/api/campaigns/${campaignId}`, { status });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const campaigns = data?.length ? data : (isDemoMode() ? DEMO_CAMPAIGNS : []);

  const grouped = useMemo(() => {
    const map: Record<CampaignStatus, Campaign[]> = {
      inquiry: [],
      negotiation: [],
      active: [],
      completed: [],
      cancelled: [],
    };
    campaigns.forEach((c) => {
      if (map[c.status]) map[c.status].push(c);
    });
    return map;
  }, [campaigns]);

  const getNextStatus = (current: CampaignStatus): CampaignStatus | null => {
    const order: CampaignStatus[] = ['inquiry', 'negotiation', 'active', 'completed'];
    const idx = order.indexOf(current);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getPrevStatus = (current: CampaignStatus): CampaignStatus | null => {
    const order: CampaignStatus[] = ['inquiry', 'negotiation', 'active', 'completed'];
    const idx = order.indexOf(current);
    return idx > 0 ? order[idx - 1] : null;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '260px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '200px', height: '20px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-5)' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <LoadingSkeleton width="100%" height="24px" />
              <div style={{ marginTop: 'var(--space-4)' }}>
                <LoadingSkeleton count={3} height="100px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load campaigns</h3>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1400px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Campaign Pipeline</h1>
          <p className="page-subtitle">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} in your pipeline
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenWizard}>
          + New Campaign
        </button>
      </div>

      {/* Campaign Creation Wizard */}
      <CampaignWizard
        isOpen={showWizard}
        onClose={handleCloseWizard}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
        restaurantContext={restaurantContext}
      />

      {/* Kanban board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
      }}>
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            campaigns={grouped[stage.key]}
            onMoveForward={(id) => {
              const next = getNextStatus(stage.key);
              if (next) moveMutation.mutate({ campaignId: id, status: next });
            }}
            onMoveBack={(id) => {
              const prev = getPrevStatus(stage.key);
              if (prev) moveMutation.mutate({ campaignId: id, status: prev });
            }}
            isFirst={stage.key === 'inquiry'}
            isLast={stage.key === 'completed'}
            isMoving={moveMutation.isPending}
          />
        ))}
      </div>

      {campaigns.length === 0 && !showWizard && (
        <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
          <h3>No campaigns yet</h3>
          <p>Pick a restaurant, set up a deal, and start tracking the customers your content drives.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={handleOpenWizard}>
            + New Campaign
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function KanbanColumn({
  stage,
  campaigns,
  onMoveForward,
  onMoveBack,
  isFirst,
  isLast,
  isMoving,
}: {
  stage: { key: CampaignStatus; label: string; badgeClass: string };
  campaigns: Campaign[];
  onMoveForward: (id: string) => void;
  onMoveBack: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  isMoving: boolean;
}) {
  return (
    <div>
      {/* Column header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
        padding: '0 var(--space-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className={`badge ${stage.badgeClass}`}>{stage.label}</span>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', fontWeight: 600 }}>
            {campaigns.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div style={{
        minHeight: '200px',
        background: 'var(--color-bgSecondary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}>
        {campaigns.length === 0 ? (
          <div style={{
            padding: 'var(--space-8) var(--space-4)',
            textAlign: 'center',
            color: 'var(--color-textMuted)',
            fontSize: 'var(--font-sm)',
          }}>
            No campaigns
          </div>
        ) : (
          campaigns.map((campaign) => {
            const progress = deliverableProgress(campaign.deliverables);
            return (
              <div
                key={campaign.campaignId}
                style={{
                  background: 'var(--color-bgPrimary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-borderHover)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Restaurant name */}
                <h4 style={{
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  color: 'var(--color-textPrimary)',
                  marginBottom: 'var(--space-2)',
                  lineHeight: 1.3,
                }}>
                  {campaign.restaurantName}
                </h4>

                {/* Package + Budget */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--color-bgElevated)',
                      color: 'var(--color-textSecondary)',
                      fontSize: '10px',
                    }}
                  >
                    {campaign.package}
                  </span>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-accent)' }}>
                    {formatBudget(campaign.budget)}
                  </span>
                </div>

                {/* Date range */}
                {(campaign.startDate || campaign.endDate) && (
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-2)' }}>
                    {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                  </p>
                )}

                {/* Deliverable progress */}
                {progress.total > 0 && (
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-textMuted)' }}>Deliverables</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-textSecondary)', fontWeight: 600 }}>
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'var(--color-bgElevated)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${progress.pct}%`,
                        height: '100%',
                        background: progress.pct === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width var(--transition-slow)',
                      }} />
                    </div>
                  </div>
                )}

                {/* Quick-action move buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                  {!isFirst && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-2)' }}
                      onClick={() => onMoveBack(campaign.campaignId)}
                      disabled={isMoving}
                      title={`Move back`}
                    >
                      &#8592;
                    </button>
                  )}
                  {!isLast && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-2)' }}
                      onClick={() => onMoveForward(campaign.campaignId)}
                      disabled={isMoving}
                      title={`Move forward`}
                    >
                      &#8594;
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
