import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { isDemoMode, DEMO_OFFERS, DEMO_CAMPAIGNS } from '../../data/demoData';
import type { Offer, Campaign } from '../../types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

/**
 * Placeholder QR code SVG.
 */
function QRCodePlaceholder({ code }: { code: string }) {
  const cells: boolean[][] = [];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const size = 21;
  for (let row = 0; row < size; row++) {
    cells[row] = [];
    for (let col = 0; col < size; col++) {
      const isFinderTL = row < 7 && col < 7;
      const isFinderTR = row < 7 && col >= size - 7;
      const isFinderBL = row >= size - 7 && col < 7;
      if (isFinderTL || isFinderTR || isFinderBL) {
        const lr = isFinderTL ? row : isFinderBL ? row - (size - 7) : row;
        const lc = isFinderTL ? col : isFinderTR ? col - (size - 7) : col;
        cells[row][col] =
          lr === 0 || lr === 6 || lc === 0 || lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        const seed = (hash + row * 31 + col * 17) & 0xffff;
        cells[row][col] = seed % 3 !== 0;
      }
    }
  }

  const cellSize = 6;
  const padding = 2;
  const totalSize = (size + padding * 2) * cellSize;

  return (
    <svg
      width={totalSize}
      height={totalSize}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      style={{ display: 'block', maxWidth: '180px' }}
    >
      <rect width={totalSize} height={totalSize} fill="#fff" rx="4" />
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={(c + padding) * cellSize}
              y={(r + padding) * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export default function OfferManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateOfferForm>(emptyForm);
  const [expandedQR, setExpandedQR] = useState<string | null>(null);

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
      const res = await api.get<Campaign[]>('/api/campaigns');
      return res.data ?? [];
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
      setShowForm(false);
      setForm(emptyForm);
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
    const svgEl = document.getElementById(`qr-svg-${offer.offerId}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${offer.code}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handlePrint = useCallback((offer: Offer) => {
    const svgEl = document.getElementById(`qr-svg-${offer.offerId}`);
    if (!svgEl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    printWindow.document.write(`
      <html>
        <head><title>QR Code - ${escapeHtml(offer.code)}</title></head>
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
          <div style="text-align:center;">
            ${svgData}
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

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
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
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={form.restaurantId}
                  onChange={(e) => handleSelectRestaurant(e.target.value)}
                >
                  <option value="">Select a restaurant...</option>
                  {restaurantOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
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
              <select
                className="form-input"
                style={{ width: '100%' }}
                value={form.linkedCampaignId}
                onChange={(e) => handleFormChange('linkedCampaignId', e.target.value)}
              >
                <option value="">None (standalone deal)</option>
                {(campaigns ?? [])
                  .filter((c) => !form.restaurantId || c.restaurantId === form.restaurantId)
                  .map((c) => (
                    <option key={c.campaignId} value={c.campaignId}>
                      {c.restaurantName} — {c.package}
                    </option>
                  ))}
              </select>
            </label>

            {/* Expiration */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>Expiration Date</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => handleFormChange('expiresAt', e.target.value)}
                style={inputStyle}
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
                <QRCodePlaceholder code={`SPOT-${form.restaurantId.slice(0, 8).toUpperCase()}`} />
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
              {!createMutation.isPending && 'Create Deal'}
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
                onDownload={handleDownloadQR}
                onPrint={handlePrint}
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
                onDownload={handleDownloadQR}
                onPrint={handlePrint}
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

function OfferRow({
  offer,
  linkedCampaign,
  expandedQR,
  onToggleQR,
  onToggleActive,
  onDownload,
  onPrint,
}: {
  offer: Offer;
  linkedCampaign?: Campaign;
  expandedQR: string | null;
  onToggleQR: (id: string | null) => void;
  onToggleActive: ReturnType<typeof useMutation<unknown, Error, { offerId: string; isActive: boolean }>>;
  onDownload: (offer: Offer) => void;
  onPrint: (offer: Offer) => void;
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
            <span style={{
              fontFamily: 'monospace',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              color: 'var(--color-textSecondary)',
              background: 'var(--color-bgElevated)',
              padding: '2px var(--space-2)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {offer.code}
            </span>
            {expired && <span className="badge badge--error">Expired</span>}
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
            onClick={() => onToggleActive.mutate({ offerId: offer.offerId, isActive: !offer.isActive })}
            disabled={onToggleActive.isPending}
          >
            {offer.isActive ? 'Deactivate' : 'Activate'}
          </button>
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
            id={`qr-svg-${offer.offerId}`}
            style={{
              padding: 'var(--space-4)',
              background: '#fff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'inline-block',
            }}
          >
            <QRCodePlaceholder code={offer.code} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={() => onDownload(offer)}>
              Download SVG
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
}
