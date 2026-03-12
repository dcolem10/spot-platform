import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import CampaignDetailPanel, {
  STAGES,
  CAMPAIGN_TYPE_LABELS,
  DEAL_TYPE_LABELS,
  formatDate,
} from '../../components/CampaignDetailPanel';
import { isDemoMode, DEMO_CAMPAIGNS } from '../../data/demoData';
import CampaignWizard, { type RestaurantContext } from './CampaignWizard';
import type { Campaign, CampaignStatus, Deliverable } from '../../types';
import './CampaignManager.css';

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
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

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
        restaurantPhone: searchParams.get('restaurantPhone') || undefined,
        restaurantWebsite: searchParams.get('restaurantWebsite') || undefined,
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

  const [mutationError, setMutationError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Campaign>) => {
      const res = await api.post<Campaign>('/api/campaigns', payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      handleCloseWizard();
      setMutationError(null);
    },
    onError: (err: Error) => {
      setMutationError(`Failed to create campaign: ${err.message}`);
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

  const updateMutation = useMutation({
    mutationFn: async ({ campaignId, updates }: { campaignId: string; updates: Partial<Campaign> }) => {
      if (isDemoMode()) return { ...selectedCampaign, ...updates } as Campaign;
      const res = await api.put<Campaign>(`/api/campaigns/${campaignId}`, updates);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      if (data) setSelectedCampaign(data as Campaign);
      setMutationError(null);
    },
    onError: (err: Error) => {
      setMutationError(`Failed to update campaign: ${err.message}`);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: string; status: CampaignStatus }) => {
      const res = await api.put<Campaign>(`/api/campaigns/${campaignId}`, { status });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setMutationError(null);
    },
    onError: (err: Error) => {
      setMutationError(`Failed to move campaign: ${err.message}`);
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

      {/* Mutation error banner */}
      {mutationError && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-errorMuted)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-sm)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{mutationError}</span>
          <button
            onClick={() => setMutationError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: 'var(--font-lg)',
              lineHeight: 1,
              padding: 'var(--space-1)',
            }}
          >
            &times;
          </button>
        </div>
      )}

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
            onSelect={(campaign) => setSelectedCampaign(campaign)}
            selectedId={selectedCampaign?.campaignId ?? null}
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

      {/* Campaign Detail Panel (shared component) */}
      {selectedCampaign && (
        <CampaignDetailPanel
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onUpdate={(updates) => updateMutation.mutate({ campaignId: selectedCampaign.campaignId, updates })}
          isSaving={updateMutation.isPending}
          variant="slideover"
        />
      )}

      {campaigns.length === 0 && !showWizard && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <EmptyState
            icon={'\uD83D\uDE80'}
            title="Launch your first campaign"
            description="Create content campaigns for restaurants, track deliverables, and measure your attribution impact."
            ctaLabel="New Campaign"
            onCtaClick={handleOpenWizard}
            secondaryLabel="Discover Restaurants"
            secondaryTo="/app/restaurants"
          />
        </div>
      )}
    </div>
  );
}

/* ─── Kanban Column ────────────────────────────────────────────────────────── */

function KanbanColumn({
  stage,
  campaigns,
  onSelect,
  selectedId,
  onMoveForward,
  onMoveBack,
  isFirst,
  isLast,
  isMoving,
}: {
  stage: { key: CampaignStatus; label: string; badgeClass: string };
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
  selectedId: string | null;
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
            const isSelected = campaign.campaignId === selectedId;
            return (
              <div
                key={campaign.campaignId}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(campaign)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(campaign); } }}
                style={{
                  background: 'var(--color-bgPrimary)',
                  border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--color-borderHover)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
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

                {/* Package + Deal */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--color-bgElevated)',
                      color: 'var(--color-textSecondary)',
                      fontSize: '10px',
                    }}
                  >
                    {CAMPAIGN_TYPE_LABELS[campaign.package] || campaign.package}
                  </span>
                  {campaign.dealType && (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(249, 115, 22, 0.1)',
                        color: 'var(--color-accent)',
                        fontSize: '10px',
                      }}
                    >
                      {DEAL_TYPE_LABELS[campaign.dealType] || campaign.dealType}
                    </span>
                  )}
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
                      onClick={(e) => { e.stopPropagation(); onMoveBack(campaign.campaignId); }}
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
                      onClick={(e) => { e.stopPropagation(); onMoveForward(campaign.campaignId); }}
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
