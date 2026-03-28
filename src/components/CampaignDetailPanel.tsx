import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/ApiService';
import { isDemoMode } from '../data/demoData';
import { StyledSelect } from './FormControls';
import { CalendarDatePicker } from './CalendarDatePicker';
import type { Campaign, CampaignActivity, CampaignStatus, Offer, Restaurant } from '../types';

/* ─── Constants (shared) ──────────────────────────────────────────────────── */

export const STAGES: { key: CampaignStatus; label: string; badgeClass: string }[] = [
  { key: 'inquiry', label: 'Inquiry', badgeClass: 'badge--info' },
  { key: 'negotiation', label: 'Negotiation', badgeClass: 'badge--warning' },
  { key: 'active', label: 'Active', badgeClass: 'badge--success' },
  { key: 'completed', label: 'Completed', badgeClass: 'badge--accent' },
];

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  visit_post: 'Visit & Create',
  menu_highlight: 'Menu Feature',
  event_coverage: 'Event Coverage',
  behind_scenes: 'Behind the Scenes',
  ongoing: 'Ongoing Relationship',
};

export const DEAL_TYPE_LABELS: Record<string, string> = {
  percent_off: '% Off Check',
  free_item: 'Free Item',
  bogo: 'BOGO',
  fixed_off: '$ Off Check',
};

export const TRACKING_LABELS: Record<string, string> = {
  qr_code: 'QR Code',
  deal_code: 'Deal Code',
  spot_link: 'Spot Link',
  reservation: 'Reservation Referral',
};

export function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Guided Next Steps ──────────────────────────────────────────────────── */

const NEXT_STEPS: Record<CampaignStatus, { emoji: string; title: string; body: string }> = {
  inquiry: {
    emoji: '📞',
    title: 'Reach out!',
    body: 'Call, DM on Instagram, or visit in person. Log your outreach in the Activity tab so you can track your follow-ups.',
  },
  negotiation: {
    emoji: '🤝',
    title: 'Finalize the deal',
    body: 'Link an offer, set your campaign dates, and agree on content deliverables. Check "Restaurant\'s Active Offers" below to link a deal.',
  },
  active: {
    emoji: '🎬',
    title: 'Time to create!',
    body: 'Visit the restaurant, create your content, and check off deliverables as you go. Your audience is waiting!',
  },
  completed: {
    emoji: '🏆',
    title: 'Great work!',
    body: 'Head to Attribution Reporter to generate a report and share your impact with the restaurant.',
  },
  cancelled: {
    emoji: '⏸',
    title: 'Campaign paused',
    body: 'This campaign was cancelled. You can reopen it by moving it back to Inquiry.',
  },
};

/* ─── Props ───────────────────────────────────────────────────────────────── */

interface CampaignDetailPanelProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: (updates: Partial<Campaign>) => void;
  isSaving: boolean;
  variant: 'slideover' | 'modal';
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function CampaignDetailPanel({
  campaign,
  onClose,
  onUpdate,
  isSaving,
  variant,
}: CampaignDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [pendingActivity, setPendingActivity] = useState<CampaignActivity[]>([]);
  const [editForm, setEditForm] = useState({
    dealType: campaign.dealType || '',
    dealDescription: campaign.dealDescription || '',
    goal: campaign.goal || '',
    notes: campaign.notes || '',
    startDate: campaign.startDate || '',
    endDate: campaign.endDate || '',
  });

  // Fetch restaurant contact info + offers
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
    setPendingActivity([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reset form only when switching
  // to a different campaign (by ID), not when individual fields update mid-edit.
  }, [campaign.campaignId]);

  const hasPendingChanges = isEditing || pendingActivity.length > 0;

  const handleSave = () => {
    const updates: Partial<Campaign> = {};

    // Include edit form fields if editing
    if (isEditing) {
      updates.dealType = editForm.dealType || undefined;
      updates.dealDescription = editForm.dealDescription || undefined;
      updates.goal = editForm.goal || undefined;
      updates.notes = editForm.notes || undefined;
      updates.startDate = editForm.startDate || undefined;
      updates.endDate = editForm.endDate || undefined;
    }

    // Flush any pending activity items
    if (pendingActivity.length > 0) {
      updates.activity = [...(campaign.activity || []), ...pendingActivity];
    }

    onUpdate(updates);
    setIsEditing(false);
    setPendingActivity([]);
  };

  const handleDiscardPending = () => {
    setIsEditing(false);
    setPendingActivity([]);
    setNewNote('');
    // Reset edit form back to campaign values
    setEditForm({
      dealType: campaign.dealType || '',
      dealDescription: campaign.dealDescription || '',
      goal: campaign.goal || '',
      notes: campaign.notes || '',
      startDate: campaign.startDate || '',
      endDate: campaign.endDate || '',
    });
  };

  const handleLinkOffer = (offer: Offer) => {
    // Offer linking is an intentional action — persist immediately
    onUpdate({
      linkedOfferId: offer.offerId,
      linkedOfferCode: offer.code,
      dealDescription: offer.description,
      dealType: offer.type === 'qr' ? 'percent_off' : campaign.dealType || 'percent_off',
      activity: [
        ...(campaign.activity || []),
        ...pendingActivity,
        {
          id: `act-${Date.now()}`,
          type: 'offer_linked' as const,
          message: `Linked offer "${offer.description}" (code: ${offer.code})`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
    setPendingActivity([]);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setPendingActivity((prev) => [
      ...prev,
      {
        id: `act-${Date.now()}`,
        type: 'note' as const,
        message: newNote.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);
    setNewNote('');
  };

  const handleLogOutreach = (method: string) => {
    setPendingActivity((prev) => [
      ...prev,
      {
        id: `act-${Date.now()}`,
        type: 'outreach' as const,
        message: `Reached out via ${method}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const nextStep = NEXT_STEPS[campaign.status];

  /* ─── Layout wrappers ─────────────────────────────────────────────────── */

  const isModal = variant === 'modal';

  const panelContent = (
    <div
      aria-label="Campaign details"
      style={
        isModal
          ? {
              background: 'var(--color-bgSecondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }
          : {
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '520px',
              maxWidth: '92vw',
              backgroundColor: 'var(--color-bgSecondary)',
              borderLeft: '1px solid var(--color-border)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              animation: 'cdp-slideIn 0.2s ease',
            }
      }
    >
      <style>{`
        @keyframes cdp-slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: 'var(--font-lg)',
                fontWeight: 600,
                color: 'var(--color-textPrimary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {campaign.restaurantName}
            </h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`badge ${STAGES.find((s) => s.key === campaign.status)?.badgeClass ?? ''}`}>
                {STAGES.find((s) => s.key === campaign.status)?.label ?? campaign.status}
              </span>
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
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close campaign details"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-textMuted)',
              fontSize: 'var(--font-xl)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Restaurant Contact Bar */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 'var(--space-3)',
            background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-3)',
          }}
        >
          {restaurant?.phone ? (
            <a
              href={`tel:${restaurant.phone}`}
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-accent)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {restaurant.phone}
            </a>
          ) : (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>No phone</span>
          )}
          <span style={{ color: 'var(--color-border)' }}>|</span>
          {restaurant?.website ? (
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-accent)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
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
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--color-border)',
            margin: '0 calc(-1 * var(--space-6))',
            padding: '0 var(--space-6)',
          }}
        >
          {(['details', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
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
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '10px',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '1px 6px',
                  }}
                >
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
            {/* ── What to Do Next (guided) ────────────────────────── */}
            {nextStep && (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(249, 115, 22, 0.06)',
                  borderLeft: '3px solid var(--color-accent)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 'var(--font-lg)', flexShrink: 0 }}>{nextStep.emoji}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      What to Do Next: {nextStep.title}
                    </div>
                    <p
                      style={{
                        fontSize: 'var(--font-sm)',
                        color: 'var(--color-textSecondary)',
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {nextStep.body}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Restaurant's Active Offers */}
            <DetailSection title="Restaurant's Active Offers">
              {(restaurantOffers?.length ?? 0) > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {restaurantOffers?.map((offer) => {
                    const isLinked = offer.offerId === campaign.linkedOfferId;
                    return (
                      <div
                        key={offer.offerId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3)',
                          border: isLinked
                            ? '2px solid var(--color-accent)'
                            : '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          background: isLinked ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--font-sm)',
                              fontWeight: 600,
                              color: 'var(--color-textPrimary)',
                            }}
                          >
                            {offer.description}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-textMuted)',
                              marginTop: '2px',
                            }}
                          >
                            {offer.type.toUpperCase()} &middot; Code: {offer.code} &middot;{' '}
                            {offer.redemptions} redemptions
                          </div>
                        </div>
                        {isLinked ? (
                          <span
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-accent)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Linked
                          </span>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            style={{
                              fontSize: 'var(--font-xs)',
                              padding: 'var(--space-1) var(--space-3)',
                              whiteSpace: 'nowrap',
                            }}
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
                <div
                  style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    background: 'var(--color-bgElevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                  }}
                >
                  <p
                    style={{
                      fontSize: 'var(--font-sm)',
                      color: 'var(--color-textMuted)',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    No active offers from this restaurant yet. Reach out to coordinate a deal for your
                    audience.
                  </p>
                </div>
              )}
            </DetailSection>

            {/* Your Proposed Deal */}
            <DetailSection title="Your Proposed Deal">
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <StyledSelect
                    value={editForm.dealType}
                    onChange={(v) => setEditForm((p) => ({ ...p, dealType: v }))}
                    placeholder="Select deal type…"
                    options={[
                      { value: '', label: 'Select deal type…' },
                      ...Object.entries(DEAL_TYPE_LABELS).map(([val, label]) => ({
                        value: val,
                        label,
                        icon: val === 'percent_off' ? '🏷' : val === 'free_item' ? '🎁' : val === 'bogo' ? '🍽' : '💰',
                      })),
                    ]}
                  />
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
                  <DetailRow
                    label="Type"
                    value={DEAL_TYPE_LABELS[campaign.dealType ?? ''] || campaign.dealType || '—'}
                  />
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
                    <span
                      key={m}
                      className="badge"
                      style={{
                        background: 'rgba(249, 115, 22, 0.1)',
                        color: 'var(--color-accent)',
                        fontSize: '11px',
                      }}
                    >
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
                    <label
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-xs)',
                        color: 'var(--color-textMuted)',
                        marginBottom: '4px',
                      }}
                    >
                      Start
                    </label>
                    <CalendarDatePicker
                      value={editForm.startDate}
                      onChange={(v) => setEditForm((p) => ({ ...p, startDate: v }))}
                      placeholder="Start date"
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-xs)',
                        color: 'var(--color-textMuted)',
                        marginBottom: '4px',
                      }}
                    >
                      End
                    </label>
                    <CalendarDatePicker
                      value={editForm.endDate}
                      onChange={(v) => setEditForm((p) => ({ ...p, endDate: v }))}
                      placeholder="End date"
                      min={editForm.startDate}
                    />
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
                    <span
                      key={d}
                      className="badge"
                      style={{
                        background: 'var(--color-bgElevated)',
                        color: 'var(--color-textSecondary)',
                        fontSize: '11px',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Goal / Highlight */}
            <DetailSection title="What to Highlight">
              {isEditing ? (
                <textarea
                  className="form-input"
                  value={editForm.goal}
                  onChange={(e) => setEditForm((p) => ({ ...p, goal: e.target.value }))}
                  rows={3}
                  placeholder="What's interesting about this restaurant?"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: 'var(--font-sm)',
                    color: campaign.goal ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {campaign.goal || 'No highlight set.'}
                </p>
              )}
            </DetailSection>

            {/* Notes */}
            <DetailSection title="Notes">
              {isEditing ? (
                <textarea
                  className="form-input"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Additional notes..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: 'var(--font-sm)',
                    color: campaign.notes ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {campaign.notes || 'No notes.'}
                </p>
              )}
            </DetailSection>

            {/* Meta */}
            <DetailSection title="Details">
              <DetailRow label="Created" value={formatDate(campaign.createdAt)} />
              <DetailRow label="Updated" value={formatDate(campaign.updatedAt)} />
            </DetailSection>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Outreach Actions */}
            <DetailSection title="Log Outreach">
              <p
                style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-textMuted)',
                  marginBottom: 'var(--space-3)',
                  lineHeight: 1.4,
                }}
              >
                Record how you contacted this restaurant. This helps you track your pipeline.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {restaurant?.phone && (
                  <button
                    className="btn btn-secondary"
                    style={{
                      fontSize: 'var(--font-xs)',
                      padding: 'var(--space-2) var(--space-3)',
                    }}
                    onClick={() => handleLogOutreach('phone')}
                    disabled={isSaving}
                  >
                    Called
                  </button>
                )}
                {restaurant?.website && (
                  <button
                    className="btn btn-secondary"
                    style={{
                      fontSize: 'var(--font-xs)',
                      padding: 'var(--space-2) var(--space-3)',
                    }}
                    onClick={() => handleLogOutreach('website contact form')}
                    disabled={isSaving}
                  >
                    Website Form
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }}
                  onClick={() => handleLogOutreach('Instagram DM')}
                  disabled={isSaving}
                >
                  Instagram DM
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }}
                  onClick={() => handleLogOutreach('in person')}
                  disabled={isSaving}
                >
                  In Person
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-2) var(--space-3)' }}
                  onClick={() => handleLogOutreach('email')}
                  disabled={isSaving}
                >
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNote();
                  }}
                  style={{ flex: 1, boxSizing: 'border-box' }}
                />
                <button
                  className="btn btn-primary"
                  style={{
                    fontSize: 'var(--font-xs)',
                    padding: 'var(--space-2) var(--space-3)',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isSaving}
                >
                  Add
                </button>
              </div>
            </DetailSection>

            {/* Activity Timeline */}
            <DetailSection title="Timeline">
              {/* Pending items (not yet saved) */}
              {pendingActivity.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-warning)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    Unsaved ({pendingActivity.length})
                  </div>
                  {[...pendingActivity].reverse().map((act) => {
                    const iconMap: Record<string, string> = {
                      outreach: '📞',
                      note: '📝',
                    };
                    return (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3)',
                          marginBottom: 'var(--space-2)',
                          background: 'rgba(234, 179, 8, 0.08)',
                          border: '1px dashed var(--color-warning)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <span style={{ fontSize: 'var(--font-base)', flexShrink: 0 }}>
                          {iconMap[act.type] || '•'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', lineHeight: 1.4 }}>
                            {act.message}
                          </div>
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-warning)', marginTop: '2px', fontWeight: 500 }}>
                            Pending — click Save to keep
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingActivity((prev) => prev.filter((a) => a.id !== act.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-textMuted)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            lineHeight: 1,
                            padding: '2px',
                            flexShrink: 0,
                          }}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Saved activity */}
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
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3) 0',
                          borderBottom:
                            i < (campaign.activity?.length ?? 0) - 1
                              ? '1px solid var(--color-border)'
                              : 'none',
                        }}
                      >
                        <span style={{ fontSize: 'var(--font-base)', flexShrink: 0 }}>
                          {iconMap[act.type] || '•'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--font-sm)',
                              color: 'var(--color-textPrimary)',
                              lineHeight: 1.4,
                            }}
                          >
                            {act.message}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--font-xs)',
                              color: 'var(--color-textMuted)',
                              marginTop: '2px',
                            }}
                          >
                            {new Date(act.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            at{' '}
                            {new Date(act.timestamp).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : pendingActivity.length === 0 ? (
                <p
                  style={{
                    fontSize: 'var(--font-sm)',
                    color: 'var(--color-textMuted)',
                    textAlign: 'center',
                    padding: 'var(--space-6) 0',
                  }}
                >
                  No activity yet. Use the buttons above to log your outreach.
                </p>
              ) : null}
            </DetailSection>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'flex-end',
          flexShrink: 0,
          background: 'var(--color-bgSecondary)',
        }}
      >
        {hasPendingChanges ? (
          <>
            <button
              className="btn btn-secondary"
              onClick={handleDiscardPending}
            >
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : `Save${pendingActivity.length > 0 && !isEditing ? ` (${pendingActivity.length})` : ''}`}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setActiveTab('details');
                setIsEditing(true);
              }}
            >
              Edit Campaign
            </button>
          </>
        )}
      </div>
    </div>
  );

  /* ─── Render with backdrop ──────────────────────────────────────────── */

  // Escape key handler for both modal and slideover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (isModal) {
    return (
      <>
        <div
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Campaign details"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>{panelContent}</div>
        </div>
      </>
    );
  }

  // Slideover variant
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div role="dialog" aria-modal="true" aria-label="Campaign details">
        {panelContent}
      </div>
    </>
  );
}

/* ─── Helper Sub-components ──────────────────────────────────────────────── */

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          color: 'var(--color-textSecondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-3)',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
      }}
    >
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--color-textPrimary)',
          textAlign: 'right',
          maxWidth: '65%',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
}
