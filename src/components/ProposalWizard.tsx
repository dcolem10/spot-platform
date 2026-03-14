import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/ApiService';
import { isDemoMode, DEMO_RESTAURANTS_BY_CITY } from '../data/demoData';
import { useAuthStore } from '../store/authStore';
import type { Restaurant, ProposalType } from '../types';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const CITY_STORAGE_KEY = 'spot-selected-city';
function getSavedCity(): string | null {
  try { return localStorage.getItem(CITY_STORAGE_KEY); } catch { return null; }
}

const PROPOSAL_TYPES: {
  value: ProposalType;
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    value: 'deal',
    label: 'Deal Proposal',
    desc: 'Propose a sponsored deal — discount, BOGO, or flat fee — in exchange for content',
    icon: '🤝',
  },
  {
    value: 'campaign',
    label: 'Campaign Partnership',
    desc: 'Pitch a multi-deliverable campaign with timeline, budget, and content plan',
    icon: '📈',
  },
  {
    value: 'qr_code',
    label: 'QR Code Deal',
    desc: 'Set up a tracked QR code discount for your audience to redeem at the restaurant',
    icon: '📱',
  },
  {
    value: 'content_review',
    label: 'Content Review',
    desc: 'Request the restaurant review and approve your content before posting',
    icon: '📝',
  },
];

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface SelectedRestaurant {
  restaurantId: string;
  name: string;
  photo?: string;
  cuisine: string[];
  neighborhood: string;
  priceLevel?: number;
}

interface WizardForm {
  proposalType: ProposalType | '';
  description: string;
  budget: string;
  deliverables: string;
  duration: string;
  discountPercent: string;
  redemptionLimit: string;
  blackoutNotes: string;
  contentType: string;
  timeline: string;
  compensation: string;
}

interface ProposalWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    proposalType: ProposalType;
    targetId: string;
    targetName: string;
    terms: Record<string, unknown>;
  }) => void;
  isSubmitting: boolean;
  submitError?: string | null;
}

const emptyForm: WizardForm = {
  proposalType: '',
  description: '',
  budget: '',
  deliverables: '',
  duration: '',
  discountPercent: '',
  redemptionLimit: '',
  blackoutNotes: '',
  contentType: '',
  timeline: '',
  compensation: '',
};

const TOTAL_STEPS = 4;

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function ProposalWizard({ isOpen, onClose, onSubmit, isSubmitting, submitError }: ProposalWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<SelectedRestaurant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const demoProfile = useAuthStore((s) => s.demoProfile);
  const activeCity = useMemo(() => getSavedCity() || demoProfile?.city || 'Washington, DC', [demoProfile?.city]);

  // Reset when opened/closed
  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setError(null);
      setSelectedRestaurant(null);
      setStep(1);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Restaurant search query
  const { data: searchResults } = useQuery({
    queryKey: ['restaurantSearch', 'proposal', searchQuery, activeCity],
    queryFn: async () => {
      if (isDemoMode()) {
        const cityRestaurants = DEMO_RESTAURANTS_BY_CITY[activeCity] ?? [];
        if (!searchQuery.trim()) return cityRestaurants.slice(0, 8);
        const q = searchQuery.toLowerCase();
        return cityRestaurants.filter(
          (r) => r.name.toLowerCase().includes(q) || r.cuisine.some((c) => c.toLowerCase().includes(q))
        ).slice(0, 8);
      }
      const params = new URLSearchParams({ limit: '8' });
      if (activeCity) params.set('city', activeCity);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await api.get<{ items: Restaurant[]; nextPage?: string }>(`/api/restaurants?${params.toString()}`, { public: true });
      return res.data?.items ?? [];
    },
    enabled: isOpen && step === 1,
    staleTime: 10_000,
  });

  /* ─── Step labels ────────────────────────────────────────────────────── */

  const getStepLabel = (s: number): string => {
    if (s === 1) return 'Select Restaurant';
    if (s === 2) return 'Proposal Type';
    if (s === 3) return 'Set Terms';
    return 'Review & Send';
  };

  const getStepSubtitle = (s: number): string => {
    if (s === 1) return `Showing restaurants in ${activeCity}. Change your city from the directory.`;
    if (s === 2) return 'What kind of partnership are you proposing?';
    if (s === 3) return 'Define the terms of your proposal.';
    return 'Review everything before sending your proposal.';
  };

  /* ─── Handlers ───────────────────────────────────────────────────────── */

  const handleFieldChange = useCallback((field: keyof WizardForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const selectRestaurant = useCallback((r: Restaurant) => {
    setSelectedRestaurant({
      restaurantId: r.restaurantId,
      name: r.name,
      photo: r.photos?.[0],
      cuisine: r.cuisine,
      neighborhood: r.neighborhood,
      priceLevel: r.priceLevel,
    });
    setError(null);
    setStep(2);
  }, []);

  const validate = (): boolean => {
    if (step === 1) {
      if (!selectedRestaurant) { setError('Please select a restaurant'); return false; }
    }
    if (step === 2) {
      if (!form.proposalType) { setError('Please select a proposal type'); return false; }
    }
    if (step === 3) {
      if (!form.description.trim()) { setError('Please add a description for your proposal'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const buildTerms = (): Record<string, unknown> => {
    const terms: Record<string, unknown> = {
      description: form.description,
    };

    if (form.proposalType === 'deal' || form.proposalType === 'campaign') {
      if (form.budget) terms.budget = Number(form.budget);
      if (form.deliverables) terms.deliverables = form.deliverables;
      if (form.duration) terms.duration = form.duration;
    }

    if (form.proposalType === 'qr_code') {
      if (form.discountPercent) terms.discountPercent = Number(form.discountPercent);
      if (form.redemptionLimit) terms.redemptionLimit = Number(form.redemptionLimit);
      if (form.blackoutNotes) terms.blackoutNotes = form.blackoutNotes;
      terms.dealType = 'qr_tracked';
    }

    if (form.proposalType === 'content_review') {
      if (form.contentType) terms.contentType = form.contentType;
      if (form.timeline) terms.timeline = form.timeline;
      if (form.compensation) terms.compensation = form.compensation;
    }

    return terms;
  };

  const handleSubmit = () => {
    if (!selectedRestaurant || !form.proposalType) return;
    onSubmit({
      proposalType: form.proposalType as ProposalType,
      targetId: selectedRestaurant.restaurantId,
      targetName: selectedRestaurant.name,
      terms: buildTerms(),
    });
  };

  if (!isOpen) return null;

  const progressPercent = (step / TOTAL_STEPS) * 100;
  const isReviewStep = step === TOTAL_STEPS;

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes proposalWizardFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .proposal-wizard-card::-webkit-scrollbar { width: 6px; }
        .proposal-wizard-card::-webkit-scrollbar-track { background: transparent; }
        .proposal-wizard-card::-webkit-scrollbar-thumb { background: var(--color-borderHover); border-radius: 3px; }
      `}</style>

      <div
        className="proposal-wizard-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-bgSecondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-xl)',
          animation: 'proposalWizardFadeIn 0.3s ease',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step {step} of {TOTAL_STEPS}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--color-textMuted)',
              fontSize: 'var(--font-lg)', cursor: 'pointer', padding: 'var(--space-1)',
              lineHeight: 1,
            }}
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '4px',
          backgroundColor: 'var(--color-bgElevated)',
          borderRadius: '2px',
          marginBottom: 'var(--space-6)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            backgroundColor: 'var(--color-accent)',
            width: `${progressPercent}%`,
            transition: 'width 0.3s ease',
            borderRadius: '2px',
          }} />
        </div>

        {/* Restaurant context card (shown steps 2-4) */}
        {selectedRestaurant && step > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-6)',
          }}>
            {selectedRestaurant.photo ? (
              <img
                src={selectedRestaurant.photo}
                alt={selectedRestaurant.name}
                style={{
                  width: '48px', height: '48px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '48px', height: '48px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bgPrimary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                🍽
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)' }}>
                {selectedRestaurant.name}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                {selectedRestaurant.cuisine.join(', ')}
                {selectedRestaurant.neighborhood && ` · ${selectedRestaurant.neighborhood}`}
                {selectedRestaurant.priceLevel && ` · ${PRICE_LABELS[selectedRestaurant.priceLevel] || ''}`}
              </div>
            </div>
          </div>
        )}

        {/* Step heading */}
        <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
          {getStepLabel(step)}
        </h2>
        <p style={{ margin: '0 0 var(--space-6)', fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
          {getStepSubtitle(step)}
        </p>

        {/* ── Step 1: Select Restaurant ────────────────────────────────────── */}
        {step === 1 && (
          <>
            <input
              type="text"
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bgElevated)',
                color: 'var(--color-textPrimary)',
                fontSize: 'var(--font-sm)',
                marginBottom: 'var(--space-4)',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {(searchResults || []).map((r) => (
                <button
                  key={r.restaurantId}
                  type="button"
                  onClick={() => selectRestaurant(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-bgElevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  {r.photos?.[0] ? (
                    <img
                      src={r.photos[0]}
                      alt={r.name}
                      style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '44px', height: '44px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bgPrimary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', flexShrink: 0,
                    }}>
                      🍽
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                      {r.cuisine.join(', ')}
                      {r.neighborhood && ` · ${r.neighborhood}`}
                      {r.priceLevel && ` · ${PRICE_LABELS[r.priceLevel] || ''}`}
                    </div>
                  </div>
                  <span style={{ color: 'var(--color-accent)', fontSize: 'var(--font-sm)', fontWeight: 600, flexShrink: 0 }}>
                    Select &rarr;
                  </span>
                </button>
              ))}

              {searchResults && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)' }}>
                  No restaurants found. Try a different search.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: Proposal Type ────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {PROPOSAL_TYPES.map((pt) => {
              const selected = form.proposalType === pt.value;
              return (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => {
                    handleFieldChange('proposalType', pt.value);
                    setError(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: selected ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bgElevated))' : 'var(--color-bgElevated)',
                    border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--color-borderHover)'; }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  <span style={{ fontSize: '28px', flexShrink: 0 }}>{pt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: '2px' }}>
                      {pt.label}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', lineHeight: 1.4 }}>
                      {pt.desc}
                    </div>
                  </div>
                  {selected && (
                    <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontSize: '18px', flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step 3: Terms ────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Description — always shown */}
            <div>
              <label style={labelStyle}>Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe what you're proposing — what you'll deliver, what you'd like in return..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            {/* Deal / Campaign fields */}
            {(form.proposalType === 'deal' || form.proposalType === 'campaign') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={labelStyle}>Budget ($)</label>
                    <input
                      type="number"
                      value={form.budget}
                      onChange={(e) => handleFieldChange('budget', e.target.value)}
                      placeholder="e.g. 500"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Duration</label>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => handleFieldChange('duration', e.target.value)}
                      placeholder="e.g. 30 days"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Deliverables</label>
                  <input
                    type="text"
                    value={form.deliverables}
                    onChange={(e) => handleFieldChange('deliverables', e.target.value)}
                    placeholder="e.g. 2 Reels + 3 Stories"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {/* QR Code fields */}
            {form.proposalType === 'qr_code' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={labelStyle}>Discount %</label>
                    <input
                      type="number"
                      value={form.discountPercent}
                      onChange={(e) => handleFieldChange('discountPercent', e.target.value)}
                      placeholder="e.g. 15"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Redemption Limit</label>
                    <input
                      type="number"
                      value={form.redemptionLimit}
                      onChange={(e) => handleFieldChange('redemptionLimit', e.target.value)}
                      placeholder="e.g. 100"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Blackout Dates / Notes</label>
                  <input
                    type="text"
                    value={form.blackoutNotes}
                    onChange={(e) => handleFieldChange('blackoutNotes', e.target.value)}
                    placeholder="e.g. Not valid on weekends or holidays"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {/* Content Review fields */}
            {form.proposalType === 'content_review' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={labelStyle}>Content Type</label>
                    <input
                      type="text"
                      value={form.contentType}
                      onChange={(e) => handleFieldChange('contentType', e.target.value)}
                      placeholder="e.g. Instagram Reel"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Timeline</label>
                    <input
                      type="text"
                      value={form.timeline}
                      onChange={(e) => handleFieldChange('timeline', e.target.value)}
                      placeholder="e.g. 2 weeks"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Compensation</label>
                  <input
                    type="text"
                    value={form.compensation}
                    onChange={(e) => handleFieldChange('compensation', e.target.value)}
                    placeholder="e.g. $300 flat fee or complimentary dinner"
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Review & Send ────────────────────────────────────────── */}
        {isReviewStep && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <ReviewRow label="Restaurant" value={selectedRestaurant?.name || '—'} />
            <ReviewRow
              label="Proposal Type"
              value={PROPOSAL_TYPES.find((pt) => pt.value === form.proposalType)?.label || '—'}
            />
            <ReviewRow label="Description" value={form.description || '—'} />

            {(form.proposalType === 'deal' || form.proposalType === 'campaign') && (
              <>
                {form.budget && <ReviewRow label="Budget" value={`$${form.budget}`} />}
                {form.deliverables && <ReviewRow label="Deliverables" value={form.deliverables} />}
                {form.duration && <ReviewRow label="Duration" value={form.duration} />}
              </>
            )}

            {form.proposalType === 'qr_code' && (
              <>
                {form.discountPercent && <ReviewRow label="Discount" value={`${form.discountPercent}%`} />}
                {form.redemptionLimit && <ReviewRow label="Redemption Limit" value={form.redemptionLimit} />}
                {form.blackoutNotes && <ReviewRow label="Blackout Notes" value={form.blackoutNotes} />}
              </>
            )}

            {form.proposalType === 'content_review' && (
              <>
                {form.contentType && <ReviewRow label="Content Type" value={form.contentType} />}
                {form.timeline && <ReviewRow label="Timeline" value={form.timeline} />}
                {form.compensation && <ReviewRow label="Compensation" value={form.compensation} />}
              </>
            )}

            {/* Separator */}
            <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-2) 0' }} />

            {/* Submit error */}
            {submitError && (
              <div style={{
                backgroundColor: 'var(--color-errorMuted)',
                border: '1px solid var(--color-error)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
              }}>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-error)', lineHeight: 1.5, margin: 0 }}>
                  {submitError}
                </p>
              </div>
            )}

            {/* Ready message */}
            {!submitError && (
              <div style={{
                backgroundColor: 'var(--color-successMuted)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
              }}>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-success)', lineHeight: 1.5, margin: 0 }}>
                  Your proposal is ready to send!
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Inline error ──────────────────────────────────────────────── */}
        {error && (
          <div style={{
            backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            marginTop: 'var(--space-4)',
          }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-error)' }}>{error}</p>
          </div>
        )}

        {/* ── Navigation buttons ───────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textSecondary)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              &larr; Back
            </button>
          ) : (
            <div />
          )}

          {isReviewStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textOnAccent, #fff)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: isSubmitting ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Sending...' : 'Send Proposal'}
            </button>
          ) : step > 1 ? (
            <button
              type="button"
              onClick={handleNext}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-textOnAccent, #fff)',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Next &rarr;
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared styles ───────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-xs)',
  fontWeight: 600,
  color: 'var(--color-textSecondary)',
  marginBottom: 'var(--space-1)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bgElevated)',
  color: 'var(--color-textPrimary)',
  fontSize: 'var(--font-sm)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      padding: 'var(--space-2) 0',
    }}>
      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', flexShrink: 0, minWidth: '120px' }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--font-sm)',
        color: 'var(--color-textPrimary)',
        fontWeight: 500,
        textAlign: 'right',
        wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  );
}
