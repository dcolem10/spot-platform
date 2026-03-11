import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { isDemoMode, DEMO_CAMPAIGNS } from '../../data/demoData';
import CampaignWizard, { type RestaurantContext } from './CampaignWizard';
import type { Campaign, CampaignStatus, Deliverable, Offer, Restaurant } from '../../types';
import './CampaignManager.css';

const STAGES: { key: CampaignStatus; label: string; badgeClass: string }[] = [
  { key: 'inquiry', label: 'Inquiry', badgeClass: 'badge--info' },
  { key: 'negotiation', label: 'Negotiation', badgeClass: 'badge--warning' },
  { key: 'active', label: 'Active', badgeClass: 'badge--success' },
  { key: 'completed', label: 'Completed', badgeClass: 'badge--accent' },
];

function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deliverableProgress(deliverables: Deliverable[]): { done: number; total: number; pct: number } {
  const total = deliverables.length;
  const done = deliverables.filter((d) => d.completed).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// Campaign type labels (keep in sync with wizard)
const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  visit_post: 'Visit & Create',
  menu_highlight: 'Menu Feature',
  event_coverage: 'Event Coverage',
  behind_scenes: 'Behind the Scenes',
  ongoing: 'Ongoing Relationship',
};

const DEAL_TYPE_LABELS: Record<string, string> = {
  percent_off: '% Off Check',
  free_item: 'Free Item',
  bogo: 'BOGO',
  fixed_off: '$ Off Check',
};

const TRACKING_LABELS: Record<string, string> = {
  qr_code: 'QR Code',
  deal_code: 'Deal Code',
  spot_link: 'Spot Link',
  reservation: 'Reservation Referral',
};

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

      {/* Campaign Detail Panel */}
      {selectedCampaign && (
        <CampaignDetailPanel
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onUpdate={(updates) => updateMutation.mutate({ campaignId: selectedCampaign.campaignId, updates })}
          isSaving={updateMutation.isPending}
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

/* ─── Sub-components ───────────────────────────────────────────────────────── */

/* ─── Campaign Detail Panel ─────────────────────────────────────────────── */

function CampaignDetailPanel({
  campaign,
  onClose,
  onUpdate,
  isSaving,
}: {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: (updates: Partial<Campaign>) => void;
  isSaving: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editForm, setEditForm] = useState({
    dealType: campaign.dealType || '',
    dealDescription: campaign.dealDescription || '',
    goal: campaign.goal || '',
    notes: campaign.notes || '',
    startDate: campaign.startDate || '',
    endDate: campaign.endDate || '',
  });

  // Fetch the restaurant's real data (contact info, existing offers)
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', campaign.restaurantId],
    queryFn: async () => {
      if (isDemoMode()) return null;
      const res = await api.get<Restaurant>(`/api/restaurants/${campaign.restaurantId}`);
      return res.data ?? null;
    },
    enabled: Boolean(campaign.restaurantId),
    staleTime: 30_000,
  });

  // Fetch existing offers for this restaurant
  const { data: restaurantOffers } = useQuery({
    queryKey: ['restaurantOffers', campaign.restaurantId],
    queryFn: async () => {
      if (isDemoMode()) return [];
      const res = await api.get<Offer[]>(`/api/restaurants/${campaign.restaurantId}/offers`);
      return (res.data ?? []).filter((o) => o.isActive);
    },
    enabled: Boolean(campaign.restaurantId),
    staleTime: 30_000,
  });

  // Sync edit form when campaign changes
  useEffect(() => {
    setEditForm({
      dealType: campaign.dealType || '',
      dealDescription: campaign.dealDescription || '',
      goal: campaign.goal || '',
      notes: campaign.notes || '',
      startDate: campaign.startDate || '',
      endDate: campaign.endDate || '',
    });
    setIsEditing(false);
    setActiveTab('details');
  }, [campaign.campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    onUpdate({
      dealType: editForm.dealType || undefined,
      dealDescription: editForm.dealDescription || undefined,
      goal: editForm.goal || undefined,
      notes: editForm.notes || undefined,
      startDate: editForm.startDate || undefined,
      endDate: editForm.endDate || undefined,
    });
    setIsEditing(false);
  };

  const handleLinkOffer = (offer: Offer) => {
    onUpdate({
      linkedOfferId: offer.offerId,
      linkedOfferCode: offer.code,
      dealDescription: offer.description,
      dealType: offer.type === 'qr' ? 'percent_off' : campaign.dealType || 'percent_off',
      activity: [
        ...(campaign.activity || []),
        {
          id: `act-${Date.now()}`,
          type: 'offer_linked' as const,
          message: `Linked offer "${offer.description}" (code: ${offer.code})`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onUpdate({
      activity: [
        ...(campaign.activity || []),
        {
          id: `act-${Date.now()}`,
          type: 'note' as const,
          message: newNote.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    });
    setNewNote('');
  };

  const handleLogOutreach = (method: string) => {
    onUpdate({
      activity: [
        ...(campaign.activity || []),
        {
          id: `act-${Date.now()}`,
          type: 'outreach' as const,
          message: `Reached out via ${method}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: 'var(--color-bgSecondary)',
          borderLeft: '1px solid var(--color-border)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideIn 0.2s ease',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: 'var(--space-6)', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-1)' }}>
                {campaign.restaurantName}
              </h2>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`badge ${STAGES.find((s) => s.key === campaign.status)?.badgeClass ?? ''}`}>
                  {STAGES.find((s) => s.key === campaign.status)?.label ?? campaign.status}
                </span>
                <span className="badge" style={{ background: 'var(--color-bgElevated)', color: 'var(--color-textSecondary)', fontSize: '10px' }}>
                  {CAMPAIGN_TYPE_LABELS[campaign.package] || campaign.package}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--color-textMuted)',
                fontSize: 'var(--font-xl)', cursor: 'pointer', padding: 'var(--space-1)', lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {/* Restaurant Contact Bar */}
          <div style={{
            display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center',
            padding: 'var(--space-3)', background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)',
          }}>
            {restaurant?.phone ? (
              <a href={`tel:${restaurant.phone}`} style={{ fontSize: 'var(--font-xs)', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                {restaurant.phone}
              </a>
            ) : (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>No phone</span>
            )}
            <span style={{ color: 'var(--color-border)' }}>|</span>
            {restaurant?.website ? (
              <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                Website
              </a>
            ) : (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>No website</span>
            )}
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
              {restaurant?.neighborhood || '—'}
            </span>
          </div>

          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--color-border)', margin: '0 calc(-1 * var(--space-6))', padding: '0 var(--space-6)' }}>
            {(['details', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-textMuted)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  marginBottom: '-1px',
                }}
              >
                {tab}
                {tab === 'activity' && (campaign.activity?.length ?? 0) > 0 && (
                  <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--color-accent)', color: '#fff', borderRadius: '10px', padding: '1px 6px' }}>
                    {campaign.activity?.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Restaurant's Active Offers — the real deals */}
              <DetailSection title="Restaurant's Active Offers">
                {(restaurantOffers?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {restaurantOffers?.map((offer) => {
                      const isLinked = offer.offerId === campaign.linkedOfferId;
                      return (
                        <div key={offer.offerId} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                          padding: 'var(--space-3)',
                          border: isLinked ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          background: isLinked ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
                              {offer.description}
                            </div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: '2px' }}>
                              {offer.type.toUpperCase()} &middot; Code: {offer.code} &middot; {offer.redemptions} redemptions
                            </div>
                          </div>
                          {isLinked ? (
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              Linked
                            </span>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-3)', whiteSpace: 'nowrap' }}
                              onClick={() => handleLinkOffer(offer)}
                              disabled={isSaving}
                            >
                              Link to Campaign
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    padding: 'var(--space-4)', textAlign: 'center',
                    background: 'var(--color-bgElevated)', borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                  }}>
                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', margin: 0, lineHeight: 1.5 }}>
                      No active offers from this restaurant yet. Reach out to coordinate a deal for your audience.
                    </p>
                  </div>
                )}
              </DetailSection>

              {/* Your Proposed Deal */}
              <DetailSection title="Your Proposed Deal">
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <select
                      className="form-input"
                      value={editForm.dealType}
                      onChange={(e) => setEditForm((p) => ({ ...p, dealType: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="">Select deal type...</option>
                      {Object.entries(DEAL_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 15% off for your followers, free appetizer with entree..."
                      value={editForm.dealDescription}
                      onChange={(e) => setEditForm((p) => ({ ...p, dealDescription: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                ) : (
                  <>
                    <DetailRow label="Type" value={DEAL_TYPE_LABELS[campaign.dealType ?? ''] || campaign.dealType || '—'} />
                    <DetailRow label="Description" value={campaign.dealDescription || '—'} />
                    {campaign.linkedOfferCode && (
                      <DetailRow label="Linked Code" value={campaign.linkedOfferCode} />
                    )}
                  </>
                )}
              </DetailSection>

              {/* Tracking Methods */}
              {(campaign.trackingMethods?.length ?? 0) > 0 && (
                <DetailSection title="Attribution Tracking">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {campaign.trackingMethods?.map((m) => (
                      <span key={m} className="badge" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)', fontSize: '11px' }}>
                        {TRACKING_LABELS[m] || m}
                      </span>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Timeline */}
              <DetailSection title="Timeline">
                {isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: '4px' }}>Start</label>
                      <input type="date" className="form-input" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: '4px' }}>End</label>
                      <input type="date" className="form-input" value={editForm.endDate} onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <DetailRow label="Start" value={formatDate(campaign.startDate)} />
                    <DetailRow label="End" value={formatDate(campaign.endDate)} />
                  </>
                )}
              </DetailSection>

              {/* Content Deliverables */}
              {(campaign.contentDeliverables?.length ?? 0) > 0 && (
                <DetailSection title="Content Deliverables">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {campaign.contentDeliverables?.map((d) => (
                      <span key={d} className="badge" style={{ background: 'var(--color-bgElevated)', color: 'var(--color-textSecondary)', fontSize: '11px' }}>{d}</span>
                    ))}
                  </div>
                </DetailSection>
              )}

              {/* Goal / Highlight */}
              <DetailSection title="What to Highlight">
                {isEditing ? (
                  <textarea className="form-input" value={editForm.goal} onChange={(e) => setEditForm((p) => ({ ...p, goal: e.target.value }))} rows={3} placeholder="What's interesting about this restaurant?" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <p style={{ fontSize: 'var(--font-sm)', color: campaign.goal ? 'var(--color-textPrimary)' : 'var(--color-textMuted)', lineHeight: 1.5, margin: 0 }}>
                    {campaign.goal || 'No highlight set.'}
                  </p>
                )}
              </DetailSection>

              {/* Notes */}
              <DetailSection title="Notes">
                {isEditing ? (
                  <textarea className="form-input" value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Additional notes..." style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <p style={{ fontSize: 'var(--font-sm)', color: campaign.notes ? 'var(--color-textPrimary)' : 'var(--color-textMuted)', lineHeight: 1.5, margin: 0 }}>
                    {campaign.notes || 'No notes.'}
                  </p>
                )}
              </DetailSection>

              {/* Meta */}
              <DetailSection title="Details">
                <DetailRow label="Created" value={formatDate(campaign.createdAt)} />
                <DetailRow label="Updated" value={formatDate(campaign.updatedAt)} />
                <DetailRow label="Campaign ID" value={campaign.campaignId} />
              </DetailSection>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Outreach Actions */}
              <DetailSection title="Log Outreach">
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-3)', lineHeight: 1.4 }}>
                  Record how you contacted this restaurant. This helps you track your pipeline.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {restaurant?.phone && (
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }} onClick={() => handleLogOutreach('phone')} disabled={isSaving}>
                      Called
                    </button>
                  )}
                  {restaurant?.website && (
                    <button className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }} onClick={() => handleLogOutreach('website contact form')} disabled={isSaving}>
                      Website Form
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }} onClick={() => handleLogOutreach('Instagram DM')} disabled={isSaving}>
                    Instagram DM
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }} onClick={() => handleLogOutreach('in person')} disabled={isSaving}>
                    In Person
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }} onClick={() => handleLogOutreach('email')} disabled={isSaving}>
                    Email
                  </button>
                </div>
              </DetailSection>

              {/* Add Note */}
              <DetailSection title="Add Note">
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Spoke with manager, they're interested..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                    style={{ flex: 1, boxSizing: 'border-box' }}
                  />
                  <button className="btn btn-primary" style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)', whiteSpace: 'nowrap' }} onClick={handleAddNote} disabled={!newNote.trim() || isSaving}>
                    Add
                  </button>
                </div>
              </DetailSection>

              {/* Activity Timeline */}
              <DetailSection title="Timeline">
                {(campaign.activity?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[...(campaign.activity || [])].reverse().map((act, i) => {
                      const iconMap: Record<string, string> = {
                        outreach: '📞',
                        note: '📝',
                        offer_linked: '🔗',
                        deal_updated: '🏷',
                        status_change: '➡️',
                      };
                      return (
                        <div key={act.id} style={{
                          display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) 0',
                          borderBottom: i < (campaign.activity?.length ?? 0) - 1 ? '1px solid var(--color-border)' : 'none',
                        }}>
                          <span style={{ fontSize: 'var(--font-base)', flexShrink: 0 }}>{iconMap[act.type] || '•'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', lineHeight: 1.4 }}>
                              {act.message}
                            </div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: '2px' }}>
                              {new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(act.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                    No activity yet. Use the buttons above to log your outreach.
                  </p>
                )}
              </DetailSection>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: 'var(--space-4) var(--space-6)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end',
          flexShrink: 0,
          background: 'var(--color-bgSecondary)',
        }}>
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => { setActiveTab('details'); setIsEditing(true); }}>
              Edit Campaign
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{
        fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)',
    }}>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' }}>{value}</span>
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
