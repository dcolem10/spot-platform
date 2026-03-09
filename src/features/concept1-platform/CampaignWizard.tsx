import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_RESTAURANTS_BY_CITY } from '../../data/demoData';
import type { Restaurant, Campaign } from '../../types';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const PACKAGE_OPTIONS = [
  { value: 'Spotlight', label: 'Spotlight', desc: 'Single post or story feature' },
  { value: 'Feature', label: 'Feature', desc: 'In-depth review or video' },
  { value: 'Series', label: 'Series', desc: 'Multi-part content series' },
  { value: 'Takeover', label: 'Takeover', desc: 'Full social media takeover' },
  { value: 'Custom', label: 'Custom', desc: 'Build your own package' },
];

const DELIVERABLE_OPTIONS = [
  '1 Reel', '2 Reels', '1 TikTok', '2 TikToks',
  '1 Story Set', '2 Story Sets', '1 Blog Post', 'Photo Set', '1 YouTube Short',
];

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface RestaurantContext {
  restaurantId: string;
  restaurantName: string;
  restaurantPhoto?: string;
  restaurantCuisine?: string;
  restaurantNeighborhood?: string;
  restaurantPrice?: number;
}

interface WizardForm {
  package: string;
  budget: string;
  goal: string;
  startDate: string;
  endDate: string;
  contentDeliverables: string[];
  notes: string;
}

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Campaign>) => void;
  isSubmitting: boolean;
  restaurantContext?: RestaurantContext | null;
}

const emptyForm: WizardForm = {
  package: '',
  budget: '',
  goal: '',
  startDate: '',
  endDate: '',
  contentDeliverables: [],
  notes: '',
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CampaignWizard({ isOpen, onClose, onSubmit, isSubmitting, restaurantContext }: CampaignWizardProps) {
  const hasRestaurant = Boolean(restaurantContext?.restaurantId);
  const totalSteps = hasRestaurant ? 3 : 4;
  const [step, setStep] = useState(hasRestaurant ? 1 : 1);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantContext | null>(restaurantContext ?? null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset when opened/closed
  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setError(null);
      setSelectedRestaurant(restaurantContext ?? null);
      setStep(1);
      setSearchQuery('');
    }
  }, [isOpen, restaurantContext]);

  // Restaurant search query
  const { data: searchResults } = useQuery({
    queryKey: ['restaurantSearch', searchQuery],
    queryFn: async () => {
      if (isDemoMode()) {
        const all = Object.values(DEMO_RESTAURANTS_BY_CITY).flat();
        if (!searchQuery.trim()) return all.slice(0, 8);
        const q = searchQuery.toLowerCase();
        return all.filter((r) => r.name.toLowerCase().includes(q) || r.cuisine.some((c) => c.toLowerCase().includes(q))).slice(0, 8);
      }
      const res = await api.get<Restaurant[]>(`/api/restaurants?search=${encodeURIComponent(searchQuery)}&limit=8`, { public: true });
      return res.data ?? [];
    },
    enabled: isOpen && !hasRestaurant && step === 1,
    staleTime: 10_000,
  });

  /* ─── Step mapping ─────────────────────────────────────────────────────── */
  // If restaurant provided: steps are Package(1) → Timeline(2) → Review(3)
  // If no restaurant: steps are Restaurant(1) → Package(2) → Timeline(3) → Review(4)
  const getStepLabel = (s: number): string => {
    if (hasRestaurant) {
      if (s === 1) return 'Campaign Package';
      if (s === 2) return 'Timeline & Deliverables';
      return 'Review & Launch';
    }
    if (s === 1) return 'Select Restaurant';
    if (s === 2) return 'Campaign Package';
    if (s === 3) return 'Timeline & Deliverables';
    return 'Review & Launch';
  };

  const getStepSubtitle = (s: number): string => {
    if (hasRestaurant) {
      if (s === 1) return 'Choose how you want to feature this restaurant.';
      if (s === 2) return 'Set your campaign timeline and content deliverables.';
      return 'Review everything before launching your campaign.';
    }
    if (s === 1) return 'Search and select a restaurant to partner with.';
    if (s === 2) return 'Choose how you want to feature this restaurant.';
    if (s === 3) return 'Set your campaign timeline and content deliverables.';
    return 'Review everything before launching your campaign.';
  };

  const isPackageStep = hasRestaurant ? step === 1 : step === 2;
  const isTimelineStep = hasRestaurant ? step === 2 : step === 3;
  const isReviewStep = step === totalSteps;
  const isRestaurantStep = !hasRestaurant && step === 1;

  /* ─── Handlers ─────────────────────────────────────────────────────────── */

  const handleFieldChange = useCallback((field: keyof WizardForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleDeliverable = useCallback((item: string) => {
    setForm((prev) => ({
      ...prev,
      contentDeliverables: prev.contentDeliverables.includes(item)
        ? prev.contentDeliverables.filter((d) => d !== item)
        : [...prev.contentDeliverables, item],
    }));
  }, []);

  const selectRestaurant = useCallback((r: Restaurant) => {
    setSelectedRestaurant({
      restaurantId: r.restaurantId,
      restaurantName: r.name,
      restaurantPhoto: r.photos?.[0],
      restaurantCuisine: r.cuisine.join(','),
      restaurantNeighborhood: r.neighborhood,
      restaurantPrice: r.priceLevel,
    });
    setError(null);
    setStep(2);
  }, []);

  const validate = (): boolean => {
    if (isRestaurantStep) {
      if (!selectedRestaurant) { setError('Please select a restaurant'); return false; }
    }
    if (isPackageStep) {
      if (!form.package) { setError('Please select a campaign package'); return false; }
      if (!form.budget.trim()) { setError('Budget is required'); return false; }
    }
    if (isTimelineStep) {
      if (!form.startDate) { setError('Start date is required'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    setError(null);
    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = () => {
    if (!selectedRestaurant) return;
    onSubmit({
      restaurantId: selectedRestaurant.restaurantId,
      restaurantName: selectedRestaurant.restaurantName,
      package: form.package,
      budget: Number(form.budget),
      goal: form.goal || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      contentDeliverables: form.contentDeliverables.length > 0 ? form.contentDeliverables : undefined,
      notes: form.notes || undefined,
      status: 'inquiry',
      deliverables: [],
    });
  };

  if (!isOpen) return null;

  const progressPercent = (step / totalSteps) * 100;
  const cuisines = selectedRestaurant?.restaurantCuisine?.split(',').filter(Boolean) ?? [];

  /* ─── Render ────────────────────────────────────────────────────────────── */

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
        @keyframes wizardFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wizard-card::-webkit-scrollbar { width: 6px; }
        .wizard-card::-webkit-scrollbar-track { background: transparent; }
        .wizard-card::-webkit-scrollbar-thumb { background: var(--color-borderHover); border-radius: 3px; }
      `}</style>

      <div
        className="wizard-card"
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
          animation: 'wizardFadeIn 0.3s ease',
        }}
      >
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step {step} of {totalSteps}
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

        {/* Restaurant Context Card (shown on all steps after selection) */}
        {selectedRestaurant && !isRestaurantStep && (
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
            {selectedRestaurant.restaurantPhoto ? (
              <img
                src={selectedRestaurant.restaurantPhoto}
                alt={selectedRestaurant.restaurantName}
                style={{
                  width: '56px', height: '56px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '56px', height: '56px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: '2px' }}>
                {selectedRestaurant.restaurantName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', alignItems: 'center' }}>
                {selectedRestaurant.restaurantNeighborhood && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                    {selectedRestaurant.restaurantNeighborhood}
                  </span>
                )}
                {selectedRestaurant.restaurantPrice && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-accent)', fontWeight: 600, marginLeft: 'var(--space-2)' }}>
                    {PRICE_LABELS[selectedRestaurant.restaurantPrice]}
                  </span>
                )}
              </div>
              {cuisines.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {cuisines.slice(0, 3).map((c) => (
                    <span key={c} className="badge" style={{
                      background: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)',
                      fontSize: '10px', fontWeight: 500, padding: '2px 8px',
                    }}>
                      {c}
                    </span>
                  ))}
                  {cuisines.length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-textMuted)' }}>+{cuisines.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step title */}
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-2)' }}>
          {getStepLabel(step)}
        </h2>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
          {getStepSubtitle(step)}
        </p>

        {/* Error */}
        {error && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-errorMuted)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-sm)',
            marginBottom: 'var(--space-5)',
          }}>
            {error}
          </div>
        )}

        {/* ─── Step Content ──────────────────────────────────────────────── */}

        {/* Step: Select Restaurant */}
        {isRestaurantStep && (
          <div>
            <input
              type="text"
              className="form-input"
              placeholder="Search restaurants by name or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', marginBottom: 'var(--space-4)', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '360px', overflowY: 'auto' }}>
              {(searchResults ?? []).map((r) => (
                <button
                  key={r.restaurantId}
                  onClick={() => selectRestaurant(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: selectedRestaurant?.restaurantId === r.restaurantId
                      ? 'var(--color-accentMuted)'
                      : 'var(--color-bgElevated)',
                    border: selectedRestaurant?.restaurantId === r.restaurantId
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r.photos?.[0] ? (
                    <img src={r.photos[0]} alt={r.name} style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)' }}>{r.name}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                      {r.neighborhood} &middot; {r.cuisine.slice(0, 2).join(', ')} &middot; {PRICE_LABELS[r.priceLevel]}
                    </div>
                  </div>
                </button>
              ))}
              {searchResults && searchResults.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)', padding: 'var(--space-6) 0' }}>
                  No restaurants found. Try a different search.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Campaign Package */}
        {isPackageStep && (
          <div>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-3)' }}>
                Package Type <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                {PACKAGE_OPTIONS.map((pkg) => (
                  <button
                    key={pkg.value}
                    onClick={() => handleFieldChange('package', pkg.value)}
                    style={{
                      padding: 'var(--space-4)',
                      border: form.package === pkg.value ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: form.package === pkg.value ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: '2px' }}>
                      {pkg.label}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                      {pkg.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                Budget ($) <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 2500"
                value={form.budget}
                onChange={(e) => handleFieldChange('budget', e.target.value)}
                min="0"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                Campaign Goal
              </label>
              <textarea
                className="form-input"
                placeholder="What do you want to achieve with this campaign? e.g. Drive weekend brunch traffic, promote new menu launch..."
                value={form.goal}
                onChange={(e) => handleFieldChange('goal', e.target.value.slice(0, 300))}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', textAlign: 'right', marginTop: '4px' }}>
                {form.goal.length} / 300
              </div>
            </div>
          </div>
        )}

        {/* Step: Timeline & Deliverables */}
        {isTimelineStep && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                  Start Date <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.startDate}
                  onChange={(e) => handleFieldChange('startDate', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.endDate}
                  onChange={(e) => handleFieldChange('endDate', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-3)' }}>
                Content Deliverables
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {DELIVERABLE_OPTIONS.map((item) => {
                  const selected = form.contentDeliverables.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleDeliverable(item)}
                      style={{
                        padding: 'var(--space-2) var(--space-4)',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-xs)',
                        fontWeight: 500,
                        border: 'none',
                        backgroundColor: selected ? 'var(--color-accent)' : 'var(--color-bgElevated)',
                        color: selected ? '#fff' : 'var(--color-textPrimary)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                Additional Notes
              </label>
              <textarea
                className="form-input"
                placeholder="Any special requirements, preferences, or context..."
                value={form.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        )}

        {/* Step: Review & Launch */}
        {isReviewStep && (
          <div>
            {/* Campaign details review */}
            <div style={{
              backgroundColor: 'var(--color-bgElevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>Campaign Details</h3>
                <button
                  onClick={() => setStep(hasRestaurant ? 1 : 2)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 'var(--font-xs)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Edit
                </button>
              </div>
              <ReviewRow label="Package" value={form.package} />
              <ReviewRow label="Budget" value={`$${Number(form.budget).toLocaleString()}`} />
              {form.goal && <ReviewRow label="Goal" value={form.goal} isLast={!form.startDate} />}
            </div>

            <div style={{
              backgroundColor: 'var(--color-bgElevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>Timeline & Deliverables</h3>
                <button
                  onClick={() => setStep(hasRestaurant ? 2 : 3)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 'var(--font-xs)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Edit
                </button>
              </div>
              <ReviewRow label="Start Date" value={form.startDate ? new Date(form.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'} />
              <ReviewRow label="End Date" value={form.endDate ? new Date(form.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'} />
              {form.contentDeliverables.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textSecondary)', fontWeight: 500 }}>Deliverables</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end', maxWidth: '60%' }}>
                    {form.contentDeliverables.map((d) => (
                      <span key={d} className="badge" style={{
                        background: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-accent)',
                        fontSize: '10px', fontWeight: 500, padding: '2px 8px',
                      }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {form.notes && <ReviewRow label="Notes" value={form.notes} isLast />}
            </div>

            {/* Ready message */}
            <div style={{
              backgroundColor: 'var(--color-successMuted)',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-2)',
            }}>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-success)', lineHeight: 1.5, margin: 0 }}>
                Your campaign is ready to launch! It will appear in your pipeline as an inquiry.
              </p>
            </div>
          </div>
        )}

        {/* ─── Navigation Buttons ────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-6)',
          justifyContent: 'space-between',
        }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
              Back
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
          )}

          {!isReviewStep ? (
            <button
              className="btn btn-primary"
              onClick={handleNext}
              style={{ flex: 1 }}
              disabled={isRestaurantStep && !selectedRestaurant}
            >
              Next
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ flex: 1, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Launching...' : 'Launch Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ReviewRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingBottom: isLast ? 0 : 'var(--space-3)',
      borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
      marginBottom: isLast ? 0 : 'var(--space-3)',
    }}>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textSecondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
