import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import QRCodeLib from 'qrcode';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StyledSelect } from '../../components/FormControls';
import { CalendarDatePicker } from '../../components/CalendarDatePicker';
import { isDemoMode, DEMO_OFFERS, DEMO_CAMPAIGNS } from '../../data/demoData';
import type { Offer, Campaign, OfferApprovalStatus } from '../../types';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string) || '').replace(/\/$/, '');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

type OfferType = 'qr' | 'promo' | 'link';

interface CreateOfferForm {
  type: OfferType;
  description: string;
  restaurantId: string;
  restaurantName: string;
  linkedCampaignId: string;
  expiresAt: string;
}

const emptyForm: CreateOfferForm = {
  type: 'qr',
  description: '',
  restaurantId: '',
  restaurantName: '',
  linkedCampaignId: '',
  expiresAt: '',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/* ─── Source badge colors ─────────────────────────────────────────────────── */

const SOURCE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  instagram: { bg: 'rgba(225, 48, 108, 0.1)', color: '#E1306C', label: 'Instagram' },
  tiktok: { bg: 'rgba(0, 0, 0, 0.06)', color: '#000', label: 'TikTok' },
  youtube: { bg: 'rgba(255, 0, 0, 0.08)', color: '#FF0000', label: 'YouTube' },
  twitter: { bg: 'rgba(29, 161, 242, 0.1)', color: '#1DA1F2', label: 'Twitter/X' },
  web: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', label: 'Web' },
  direct: { bg: 'var(--color-bgElevated)', color: 'var(--color-textMuted)', label: 'Direct' },
  in_person: { bg: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)', label: 'In Person' },
  email: { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366F1', label: 'Email' },
};

const APPROVAL_BADGE: Record<OfferApprovalStatus, { bg: string; color: string; label: string }> = {
  creator_only: { bg: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-textMuted)', label: 'Creator Only' },
  pending_restaurant: { bg: 'var(--color-accentMuted)', color: 'var(--color-accent)', label: 'Pending Approval' },
  approved: { bg: 'var(--color-successMuted)', color: 'var(--color-success)', label: 'Mutually Approved' },
  paused_by_creator: { bg: 'var(--color-errorMuted)', color: 'var(--color-error)', label: 'Paused by Creator' },
  paused_by_restaurant: { bg: 'var(--color-errorMuted)', color: 'var(--color-error)', label: 'Paused by Restaurant' },
  rejected: { bg: 'var(--color-errorMuted)', color: 'var(--color-error)', label: 'Rejected' },
  published: { bg: 'var(--color-accentMuted)', color: 'var(--color-accent)', label: 'Open for Creators' },
};

/* Provenance badge — shows where an offer came from (marketplace). */
const ORIGIN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  restaurant_adopted: { bg: 'var(--color-successMuted)', color: 'var(--color-success)', label: 'Adopted from Restaurant' },
  restaurant: { bg: 'var(--color-accentMuted)', color: 'var(--color-accent)', label: 'Restaurant Deal' },
};

/**
 * Real QR code image generated via the `qrcode` library.
 * `value` should be the full URL to encode (e.g. the offer scan URL).
 * `id` is forwarded to the <img> element so download/print handlers can find it.
 */
function QRCodeImage({ value, size = 180, id }: { value: string; size?: number; id?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#f0f0f0',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#999',
        }}
      >
        …
      </div>
    );
  }

  return (
    <img
      id={id}
      src={dataUrl}
      alt="QR code"
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export default function OfferManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateOfferForm>(emptyForm);
  const [expandedQR, setExpandedQR] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Auto-clear feedback after 4 seconds
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['offers'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_OFFERS;
      const res = await api.get<Offer[]>('/api/partner/offers');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  // Fetch campaigns so we can show linked campaign names and let user link from form
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CAMPAIGNS;
      const res = await api.get<{ items: Campaign[]; nextPage?: string }>('/api/campaigns');
      // Backend returns paginated { items, nextPage } format
      return res.data?.items ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Offer>) => {
      if (!payload.restaurantId) throw new Error('Please select a restaurant');
      const res = await api.post<Offer>(`/api/restaurants/${payload.restaurantId}/offers`, payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowForm(false);
      setForm(emptyForm);
      setActionFeedback({ type: 'success', message: 'Offer created successfully!' });
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to create offer' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ offerId, isActive }: { offerId: string; isActive: boolean }) => {
      const res = await api.put<Offer>(`/api/offers/${offerId}`, { isActive });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: `Failed to toggle offer: ${err.message}` });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async ({ offerId, creatorTerms }: { offerId: string; creatorTerms: Record<string, unknown> }) => {
      if (isDemoMode()) return;
      const res = await api.put(`/api/offers/${offerId}/submit-for-approval`, { creatorTerms });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['offers'] }); },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: `Approval submission failed: ${err.message}` });
    },
  });

  const pauseOfferMutation = useMutation({
    mutationFn: async ({ offerId, role, reason }: { offerId: string; role: string; reason?: string }) => {
      if (isDemoMode()) return;
      const res = await api.put(`/api/offers/${offerId}/pause`, { role, reason });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['offers'] }); },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: `Failed to pause offer: ${err.message}` });
    },
  });

  const resumeOfferMutation = useMutation({
    mutationFn: async ({ offerId }: { offerId: string }) => {
      if (isDemoMode()) return;
      const res = await api.put(`/api/offers/${offerId}/resume`, {});
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['offers'] }); },
    onError: (err: Error) => {
      setActionFeedback({ type: 'error', message: `Failed to resume offer: ${err.message}` });
    },
  });

  const offers = data?.length ? data : (isDemoMode() ? DEMO_OFFERS : []);
  const activeOffers = offers.filter((o) => o.isActive);
  const inactiveOffers = offers.filter((o) => !o.isActive);

  // Build lookup of campaign names by ID
  const campaignMap = useMemo(() => {
    const map: Record<string, Campaign> = {};
    (campaigns ?? []).forEach((c) => { map[c.campaignId] = c; });
    return map;
  }, [campaigns]);

  // Aggregate stats
  const totalScans = offers.reduce((s, o) => s + o.scans, 0);
  const totalRedemptions = offers.reduce((s, o) => s + o.redemptions, 0);
  const overallConversion = totalScans > 0 ? Math.round((totalRedemptions / totalScans) * 100) : 0;

  // Unique restaurants from campaigns for the create form
  const restaurantOptions = useMemo(() => {
    const seen = new Set<string>();
    return (campaigns ?? [])
      .filter((c) => {
        if (seen.has(c.restaurantId)) return false;
        seen.add(c.restaurantId);
        return true;
      })
      .map((c) => ({ id: c.restaurantId, name: c.restaurantName }));
  }, [campaigns]);

  const handleFormChange = useCallback((field: keyof CreateOfferForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectRestaurant = useCallback((restaurantId: string) => {
    const match = restaurantOptions.find((r) => r.id === restaurantId);
    setForm((prev) => ({
      ...prev,
      restaurantId,
      restaurantName: match?.name || '',
    }));
  }, [restaurantOptions]);

  const handleSubmit = useCallback(() => {
    if (!form.description.trim() || !form.restaurantId) return;
    createMutation.mutate({
      type: form.type,
      description: form.description.trim(),
      restaurantName: form.restaurantName,
      linkedCampaignId: form.linkedCampaignId || undefined,
      expiresAt: form.expiresAt || undefined,
      isActive: true,
    } as unknown as Partial<Offer>);
  }, [form, createMutation]);

  const handleDownloadQR = useCallback((offer: Offer) => {
    const imgEl = document.getElementById(`qr-img-${offer.offerId}`) as HTMLImageElement | null;
    if (!imgEl?.src) return;
    const link = document.createElement('a');
    link.href = imgEl.src;
    link.download = `qr-${offer.code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handlePrint = useCallback((offer: Offer) => {
    const imgEl = document.getElementById(`qr-img-${offer.offerId}`) as HTMLImageElement | null;
    if (!imgEl?.src) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>QR Code - ${escapeHtml(offer.code)}</title></head>
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
          <div style="text-align:center;">
            <img src="${imgEl.src}" width="240" height="240" alt="QR Code" />
            <p style="margin-top:16px;font-family:sans-serif;font-size:14px;color:#666;">${escapeHtml(offer.description)}</p>
            <p style="font-family:monospace;font-size:18px;font-weight:bold;">${escapeHtml(offer.code)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, []);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '240px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '200px', height: '20px' }} />
        </div>
        <LoadingSkeleton count={4} height="100px" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load offers</h3>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Action feedback toast */}
      {actionFeedback && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 9999,
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: actionFeedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: actionFeedback.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${actionFeedback.type === 'error' ? '#fca5a5' : '#86efac'}`,
            fontSize: 'var(--font-sm)', fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            maxWidth: '400px',
          }}
          onClick={() => setActionFeedback(null)}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Confirmation dialog for destructive actions */}
      {confirmAction && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="card"
            style={{ maxWidth: '400px', padding: 'var(--space-5)', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-md)', color: 'var(--color-textPrimary)' }}>
              {confirmAction.message}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#ef4444' }}
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Deals & QR</h1>
          <p className="page-subtitle">
            Create trackable deals for your restaurant campaigns — QR codes, promo codes, and links
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Deal'}
        </button>
      </div>

      {/* Summary Stats — responsive grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="stagger-children">
        <div className="card">
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)' }}>
            {activeOffers.length}
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginTop: 'var(--space-1)' }}>
            Active Deals
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)' }}>
            {formatNumber(totalScans)}
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginTop: 'var(--space-1)' }}>
            Total Scans
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatNumber(totalRedemptions)}
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginTop: 'var(--space-1)' }}>
            Redemptions
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
            {overallConversion}%
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginTop: 'var(--space-1)' }}>
            Conversion Rate
          </div>
        </div>
      </div>

      {/* How It Works guidance */}
      {offers.length === 0 && !showForm && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <EmptyState
            icon={'🎟️'}
            title="Create your first trackable deal"
            description="Deals connect your content to real restaurant visits. Create a QR code or promo code, share it in your content, and watch redemptions come in. Each scan is tracked by source — Instagram, TikTok, or direct."
            ctaLabel="Create Deal"
            onCtaClick={() => setShowForm(true)}
            secondaryLabel="Start a Campaign First"
            secondaryTo="/app/campaigns"
          />
        </div>
      )}

      {/* Guidance callout (when offers exist but few) */}
      {offers.length > 0 && offers.length < 3 && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'rgba(249, 115, 22, 0.06)',
          borderLeft: '3px solid var(--color-accent)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-lg)', flexShrink: 0 }}>💡</span>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 'var(--space-1)' }}>
                Pro Tip: Link deals to your campaigns
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.5, margin: 0 }}>
                When you create a deal and link it to a campaign, the attribution flows automatically. Share the link <code style={{ background: 'var(--color-bgElevated)', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>spot.link/CODE?src=instagram</code> on your socials — we track every scan by platform.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            New Deal
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Restaurant */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>
                Restaurant<span style={{ color: 'var(--color-error)' }}> *</span>
              </span>
              {restaurantOptions.length > 0 ? (
                <StyledSelect
                  value={form.restaurantId}
                  onChange={(v) => handleSelectRestaurant(v)}
                  placeholder="Select a restaurant…"
                  options={[
                    { value: '', label: 'Select a restaurant…' },
                    ...restaurantOptions.map((r) => ({
                      value: r.id,
                      label: r.name,
                      icon: '🍽',
                    })),
                  ]}
                />
              ) : (
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', padding: 'var(--space-2) 0' }}>
                  <Link to="/app/campaigns" style={{ color: 'var(--color-accent)' }}>Create a campaign</Link> first to link a restaurant.
                </div>
              )}
            </label>

            {/* Type */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>Type</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {(['qr', 'promo', 'link'] as OfferType[]).map((type) => (
                  <button
                    key={type}
                    className={`badge ${form.type === type ? 'badge--accent' : ''}`}
                    style={{
                      cursor: 'pointer',
                      background: form.type === type ? undefined : 'var(--color-bgElevated)',
                      color: form.type === type ? undefined : 'var(--color-textSecondary)',
                      border: 'none',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--font-sm)',
                      textTransform: 'uppercase',
                    }}
                    onClick={() => handleFormChange('type', type)}
                  >
                    {type === 'qr' ? 'QR Code' : type === 'promo' ? 'Promo Code' : 'Link'}
                  </button>
                ))}
              </div>
            </label>

            {/* Link to Campaign (optional) */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>Link to Campaign</span>
              <StyledSelect
                value={form.linkedCampaignId}
                onChange={(v) => handleFormChange('linkedCampaignId', v)}
                placeholder="None (standalone deal)"
                options={[
                  { value: '', label: 'None (standalone deal)' },
                  ...(campaigns ?? [])
                    .filter((c) => !form.restaurantId || c.restaurantId === form.restaurantId)
                    .map((c) => ({
                      value: c.campaignId,
                      label: `${c.restaurantName} — ${c.package}`,
                      icon: '🔗',
                    })),
                ]}
              />
            </label>

            {/* Expiration */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>Expiration Date</span>
              <CalendarDatePicker
                value={form.expiresAt}
                onChange={(v) => handleFormChange('expiresAt', v)}
                placeholder="No expiration"
                min={new Date().toISOString().split('T')[0]}
              />
            </label>
          </div>

          {/* Description (full width) */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-4)' }}>
            <span style={labelStyle}>
              Description<span style={{ color: 'var(--color-error)' }}> *</span>
            </span>
            <textarea
              value={form.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder="e.g. 20% off your first visit — show this QR code to your server"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '72px',
              }}
            />
          </label>

          {/* QR Preview */}
          {form.type === 'qr' && form.restaurantId && (
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{
                padding: 'var(--space-3)',
                background: '#fff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'inline-block',
              }}>
                <QRCodeImage
                  value={`${API_BASE}/api/offers/SPOT-${form.restaurantId.slice(0, 8).toUpperCase()}/scan`}
                />
              </div>
              <div>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-1)' }}>
                  QR Code Preview
                </p>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                  A unique code (SPOT-XXXXXXXX) will be auto-generated when you create this deal.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Cancel
            </button>
            <button
              className={`btn btn-primary ${createMutation.isPending ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
              disabled={createMutation.isPending || !form.description.trim() || !form.restaurantId}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Deal'}
            </button>
          </div>

          {createMutation.isError && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-3)' }}>
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create deal.'}
            </p>
          )}
        </div>
      )}

      {/* Active Offers */}
      {activeOffers.length > 0 && (
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textPrimary)' }}>
            Active Deals ({activeOffers.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activeOffers.map((offer) => (
              <OfferRow
                key={offer.offerId}
                offer={offer}
                linkedCampaign={offer.linkedCampaignId ? campaignMap[offer.linkedCampaignId] : undefined}
                expandedQR={expandedQR}
                onToggleQR={setExpandedQR}
                onToggleActive={toggleMutation}
                onSubmitForApproval={submitForApprovalMutation}
                onPause={pauseOfferMutation}
                onResume={resumeOfferMutation}
                onDownload={handleDownloadQR}
                onPrint={handlePrint}
                onConfirm={(msg, action) => setConfirmAction({ message: msg, onConfirm: action })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Inactive Offers */}
      {inactiveOffers.length > 0 && (
        <section>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textSecondary)' }}>
            Inactive Deals ({inactiveOffers.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', opacity: 0.7 }}>
            {inactiveOffers.map((offer) => (
              <OfferRow
                key={offer.offerId}
                offer={offer}
                linkedCampaign={offer.linkedCampaignId ? campaignMap[offer.linkedCampaignId] : undefined}
                expandedQR={expandedQR}
                onToggleQR={setExpandedQR}
                onToggleActive={toggleMutation}
                onSubmitForApproval={submitForApprovalMutation}
                onPause={pauseOfferMutation}
                onResume={resumeOfferMutation}
                onDownload={handleDownloadQR}
                onPrint={handlePrint}
                onConfirm={(msg, action) => setConfirmAction({ message: msg, onConfirm: action })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-xs)',
  fontWeight: 600,
  color: 'var(--color-textSecondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const inputStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--color-bgElevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-textPrimary)',
  fontSize: 'var(--font-sm)',
  outline: 'none',
  fontFamily: 'inherit',
};

/* ─── Sub-components ───────────────────────────────────────────────────────── */

const OfferRow = memo(function OfferRow({
  offer,
  linkedCampaign,
  expandedQR,
  onToggleQR,
  onToggleActive,
  onSubmitForApproval,
  onPause,
  onResume,
  onDownload,
  onPrint,
  onConfirm,
}: {
  offer: Offer;
  linkedCampaign?: Campaign;
  expandedQR: string | null;
  onToggleQR: (id: string | null) => void;
  onToggleActive: UseMutationResult<unknown, Error, { offerId: string; isActive: boolean }>;
  onSubmitForApproval: UseMutationResult<unknown, Error, { offerId: string; creatorTerms: Record<string, unknown> }>;
  onPause: UseMutationResult<unknown, Error, { offerId: string; role: string; reason?: string }>;
  onResume: UseMutationResult<unknown, Error, { offerId: string }>;
  onDownload: (offer: Offer) => void;
  onPrint: (offer: Offer) => void;
  onConfirm: (message: string, action: () => void) => void;
}) {
  const expired = isExpired(offer.expiresAt);
  const convRate = offer.scans > 0 ? Math.round((offer.redemptions / offer.scans) * 100) : 0;
  const isQRExpanded = expandedQR === offer.offerId;

  // Top sources by scan count
  const sources = Object.entries(offer.scansBySource || {})
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
        {/* Left: Info */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          {/* Restaurant name + type badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
            {offer.restaurantName && (
              <span style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 700,
                color: 'var(--color-textPrimary)',
              }}>
                {offer.restaurantName}
              </span>
            )}
            <span
              className={`badge ${offer.type === 'qr' ? 'badge--info' : offer.type === 'promo' ? 'badge--accent' : 'badge--success'}`}
              style={{ textTransform: 'uppercase' }}
            >
              {offer.type === 'qr' ? 'QR Code' : offer.type === 'promo' ? 'Promo Code' : 'Link'}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                color: 'var(--color-textSecondary)',
                background: 'var(--color-bgElevated)',
                padding: '2px var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
              title="Click to copy"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(offer.code).then(() => {
                  const el = e.currentTarget;
                  el.style.background = '#dcfce7';
                  el.textContent = 'Copied!';
                  setTimeout(() => { el.style.background = ''; el.textContent = offer.code; }, 1500);
                });
              }}
            >
              {offer.code}
            </span>
            {expired && <span className="badge badge--error">Expired</span>}
            {offer.approvalStatus && offer.approvalStatus !== 'creator_only' && (
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                background: APPROVAL_BADGE[offer.approvalStatus]?.bg || 'transparent',
                color: APPROVAL_BADGE[offer.approvalStatus]?.color || 'inherit',
              }}>
                {APPROVAL_BADGE[offer.approvalStatus]?.label || offer.approvalStatus}
              </span>
            )}
            {offer.origin && ORIGIN_BADGE[offer.origin] && (
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                background: ORIGIN_BADGE[offer.origin].bg,
                color: ORIGIN_BADGE[offer.origin].color,
              }}>
                {ORIGIN_BADGE[offer.origin].label}
              </span>
            )}
          </div>

          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
            {offer.description}
          </p>

          {/* Linked campaign badge */}
          {linkedCampaign && (
            <Link
              to="/app/campaigns"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-accent)',
                textDecoration: 'none',
                background: 'rgba(249, 115, 22, 0.08)',
                padding: '2px var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-2)',
              }}
            >
              🔗 {linkedCampaign.restaurantName} — {linkedCampaign.package}
            </Link>
          )}

          {/* Source breakdown */}
          {sources.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
              {sources.map(([src, count]) => {
                const style = SOURCE_COLORS[src] || SOURCE_COLORS.direct;
                return (
                  <span
                    key={src}
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      background: style.bg,
                      color: style.color,
                    }}
                  >
                    {style.label} {count}
                  </span>
                );
              })}
            </div>
          )}

          {offer.expiresAt && (
            <p style={{ fontSize: 'var(--font-xs)', color: expired ? 'var(--color-error)' : 'var(--color-textMuted)', marginTop: 'var(--space-2)' }}>
              {expired ? 'Expired' : 'Expires'} {formatDate(offer.expiresAt)}
            </p>
          )}
        </div>

        {/* Middle: Stats */}
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-textPrimary)', lineHeight: 1 }}>
              {formatNumber(offer.scans)}
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 'var(--space-1)' }}>
              Scans
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-success)', lineHeight: 1 }}>
              {formatNumber(offer.redemptions)}
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 'var(--space-1)' }}>
              Redeemed
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>
              {convRate}%
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginTop: 'var(--space-1)' }}>
              Conversion
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flexShrink: 0 }}>
          {offer.type === 'qr' && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 'var(--font-xs)' }}
              onClick={() => onToggleQR(isQRExpanded ? null : offer.offerId)}
            >
              {isQRExpanded ? 'Hide QR' : 'Show QR'}
            </button>
          )}
          <button
            className={`btn ${offer.isActive ? 'btn-ghost' : 'btn-primary'}`}
            style={{ fontSize: 'var(--font-xs)' }}
            onClick={() => {
              if (offer.isActive) {
                onConfirm('Deactivate this deal? It will stop appearing for new scans.', () =>
                  onToggleActive.mutate({ offerId: offer.offerId, isActive: false })
                );
              } else {
                onToggleActive.mutate({ offerId: offer.offerId, isActive: true });
              }
            }}
            disabled={onToggleActive.isPending}
          >
            {offer.isActive ? 'Deactivate' : 'Activate'}
          </button>
          {/* Mutual Approval Actions */}
          {(!offer.approvalStatus || offer.approvalStatus === 'creator_only') && offer.isActive && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 'var(--font-xs)' }}
              onClick={() => onSubmitForApproval.mutate({
                offerId: offer.offerId,
                creatorTerms: {
                  discountType: 'percent',
                  discountValue: 15,
                  notes: offer.description,
                },
              })}
              disabled={onSubmitForApproval.isPending}
              title="Submit this deal for restaurant approval"
            >
              Request Approval
            </button>
          )}
          {(offer.approvalStatus === 'approved' || offer.approvalStatus === 'creator_only') && offer.isActive && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 'var(--font-xs)', color: 'var(--color-error)' }}
              onClick={() => onPause.mutate({ offerId: offer.offerId, role: 'creator' })}
              disabled={onPause.isPending}
            >
              Pause Deal
            </button>
          )}
          {offer.approvalStatus?.startsWith('paused_by_') && (
            <button
              className="btn btn-primary"
              style={{ fontSize: 'var(--font-xs)' }}
              onClick={() => onResume.mutate({ offerId: offer.offerId })}
              disabled={onResume.isPending}
            >
              Resume Deal
            </button>
          )}
        </div>
      </div>

      {/* Expanded QR code */}
      {isQRExpanded && offer.type === 'qr' && (
        <div style={{
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
        }}>
          <div
            style={{
              padding: 'var(--space-4)',
              background: '#fff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'inline-block',
            }}
          >
            <QRCodeImage
              id={`qr-img-${offer.offerId}`}
              value={`${API_BASE}/api/offers/${offer.code}/scan`}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={() => onDownload(offer)}>
              Download PNG
            </button>
            <button className="btn btn-secondary" onClick={() => onPrint(offer)}>
              Print QR
            </button>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>
                Share with source tracking:
              </p>
              <code style={{
                fontSize: '11px',
                background: 'var(--color-bgElevated)',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-accent)',
                display: 'block',
                wordBreak: 'break-all',
              }}>
                spot.link/{offer.code}?src=instagram
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
