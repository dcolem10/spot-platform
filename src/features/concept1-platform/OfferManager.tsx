import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_OFFERS } from '../../data/demoData';
import type { Offer } from '../../types';

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
  code: string;
  expiresAt: string;
}

const emptyForm: CreateOfferForm = {
  type: 'qr',
  description: '',
  code: '',
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

/**
 * Placeholder QR code SVG.
 * Real QR rendering would use the `qrcode` library at runtime; this gives a
 * visual preview that communicates intent without a build-time dependency.
 */
function QRCodePlaceholder({ code }: { code: string }) {
  // Generate a deterministic pattern from the code string
  const cells: boolean[][] = [];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const size = 21; // Standard QR module count (Version 1)
  for (let row = 0; row < size; row++) {
    cells[row] = [];
    for (let col = 0; col < size; col++) {
      // Finder patterns in corners
      const isFinderTL = row < 7 && col < 7;
      const isFinderTR = row < 7 && col >= size - 7;
      const isFinderBL = row >= size - 7 && col < 7;
      if (isFinderTL || isFinderTR || isFinderBL) {
        const lr = isFinderTL ? row : isFinderBL ? row - (size - 7) : row;
        const lc = isFinderTL ? col : isFinderTR ? col - (size - 7) : col;
        // Border or center
        cells[row][col] =
          lr === 0 || lr === 6 || lc === 0 || lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        // Pseudo-random data cells
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

export default function OfferManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateOfferForm>(emptyForm);
  const [expandedQR, setExpandedQR] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['offers'],
    queryFn: async () => {
      if (isDemoMode) return DEMO_OFFERS;
      const res = await api.get<Offer[]>('/api/partner/offers');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Offer>) => {
      const res = await api.post<Offer>('/api/offers', payload);
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

  const offers = data?.length ? data : (isDemoMode ? DEMO_OFFERS : []);
  const activeOffers = offers.filter((o) => o.isActive);
  const inactiveOffers = offers.filter((o) => !o.isActive);

  const handleFormChange = useCallback((field: keyof CreateOfferForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.description.trim() || !form.code.trim()) return;
    createMutation.mutate({
      type: form.type,
      description: form.description.trim(),
      code: form.code.trim(),
      expiresAt: form.expiresAt || undefined,
      isActive: true,
    });
  }, [form, createMutation]);

  const handleDownloadQR = useCallback((offer: Offer) => {
    // In a real implementation this would generate a PNG from the qrcode library.
    // Here we trigger download of the SVG.
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
    // svgData is generated by our own XMLSerializer from a DOM element we control,
    // so it is safe to embed directly without escaping.
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
          <h1 className="page-title">Offer Manager</h1>
          <p className="page-subtitle">
            Create and manage QR codes, promo codes, and tracking links
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Offer'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            New Offer
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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

            {/* Code */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={labelStyle}>
                {form.type === 'qr' ? 'QR Value / Code' : form.type === 'promo' ? 'Promo Code' : 'Tracking Slug'}
                <span style={{ color: 'var(--color-error)' }}> *</span>
              </span>
              <input
                type="text"
                value={form.code}
                onChange={(e) => handleFormChange('code', e.target.value)}
                placeholder={form.type === 'promo' ? 'e.g. SPOT20OFF' : 'e.g. spot-pasta-palace'}
                style={inputStyle}
              />
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
          {form.type === 'qr' && form.code.trim() && (
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{
                padding: 'var(--space-3)',
                background: '#fff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'inline-block',
              }}>
                <QRCodePlaceholder code={form.code} />
              </div>
              <div>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-1)' }}>
                  QR Code Preview
                </p>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                  The final QR code will be generated when the offer is created.
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
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !form.description.trim() || !form.code.trim()}
              style={{ opacity: createMutation.isPending ? 0.7 : 1 }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Offer'}
            </button>
          </div>

          {createMutation.isError && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-3)' }}>
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create offer.'}
            </p>
          )}
        </div>
      )}

      {/* Active Offers */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textPrimary)' }}>
          Active Offers ({activeOffers.length})
        </h2>

        {activeOffers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-textMuted)' }}>
            <p>No active offers. Create one to start tracking engagement.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {activeOffers.map((offer) => (
              <OfferRow
                key={offer.offerId}
                offer={offer}
                expandedQR={expandedQR}
                onToggleQR={setExpandedQR}
                onToggleActive={toggleMutation}
                onDownload={handleDownloadQR}
                onPrint={handlePrint}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inactive Offers */}
      {inactiveOffers.length > 0 && (
        <section>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-textSecondary)' }}>
            Inactive Offers ({inactiveOffers.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', opacity: 0.7 }}>
            {inactiveOffers.map((offer) => (
              <OfferRow
                key={offer.offerId}
                offer={offer}
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

      {offers.length === 0 && !showForm && (
        <div className="empty-state">
          <h3>No offers yet</h3>
          <p>Create QR codes, promo codes, or tracking links to measure engagement.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => setShowForm(true)}>
            + Create Offer
          </button>
        </div>
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
  expandedQR,
  onToggleQR,
  onToggleActive,
  onDownload,
  onPrint,
}: {
  offer: Offer;
  expandedQR: string | null;
  onToggleQR: (id: string | null) => void;
  onToggleActive: ReturnType<typeof useMutation<unknown, Error, { offerId: string; isActive: boolean }>>;
  onDownload: (offer: Offer) => void;
  onPrint: (offer: Offer) => void;
}) {
  const expired = isExpired(offer.expiresAt);
  const convRate = offer.scans > 0 ? Math.round((offer.redemptions / offer.scans) * 100) : 0;
  const isQRExpanded = expandedQR === offer.offerId;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
        {/* Left: Info */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span
              className={`badge ${offer.type === 'qr' ? 'badge--info' : offer.type === 'promo' ? 'badge--accent' : 'badge--success'}`}
              style={{ textTransform: 'uppercase' }}
            >
              {offer.type === 'qr' ? 'QR Code' : offer.type === 'promo' ? 'Promo Code' : 'Link'}
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              color: 'var(--color-textPrimary)',
              background: 'var(--color-bgElevated)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {offer.code}
            </span>
            {expired && <span className="badge badge--error">Expired</span>}
          </div>

          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
            {offer.description}
          </p>

          {offer.expiresAt && (
            <p style={{ fontSize: 'var(--font-xs)', color: expired ? 'var(--color-error)' : 'var(--color-textMuted)' }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
