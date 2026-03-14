import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { CalendarDatePicker } from '../../components/CalendarDatePicker';
import { isDemoMode, DEMO_RESTAURANTS_BY_CITY } from '../../data/demoData';
import { useAuthStore } from '../../store/authStore';
import type { Restaurant, Campaign } from '../../types';

/* ─── City helpers ─────────────────────────────────────────────────────────── */
const CITY_STORAGE_KEY = 'spot-selected-city';
function getSavedCity(): string | null {
  try { return localStorage.getItem(CITY_STORAGE_KEY); } catch { return null; }
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

// Campaign types from the creator's perspective — what are you actually doing?
const CAMPAIGN_TYPES = [
  {
    value: 'visit_post',
    label: 'Visit & Create',
    desc: 'Visit the restaurant, create content, share a deal with your audience',
    icon: '📍',
    suggestedDeliverables: ['Instagram Reel', 'Instagram Carousel', 'Story Set'],
  },
  {
    value: 'menu_highlight',
    label: 'Menu Feature',
    desc: 'Highlight specific dishes, a new menu, or seasonal items with a deal for followers',
    icon: '🍽',
    suggestedDeliverables: ['Instagram Reel', 'TikTok', 'Instagram Carousel'],
  },
  {
    value: 'event_coverage',
    label: 'Event Coverage',
    desc: 'Cover an opening, tasting event, or special dinner — share exclusive access',
    icon: '🎉',
    suggestedDeliverables: ['Story Set', 'Instagram Reel', 'TikTok'],
  },
  {
    value: 'behind_scenes',
    label: 'Behind the Scenes',
    desc: 'Kitchen access, chef interview, sourcing story — deep content your audience loves',
    icon: '🎬',
    suggestedDeliverables: ['Instagram Reel', 'YouTube Short', 'TikTok'],
  },
  {
    value: 'ongoing',
    label: 'Ongoing Relationship',
    desc: 'Become a regular voice for this spot with consistent content and tracking',
    icon: '🤝',
    suggestedDeliverables: ['Instagram Reel', 'Story Set', 'TikTok', 'Instagram Carousel'],
  },
];

// Real content formats creators actually produce
const DELIVERABLE_OPTIONS = [
  'Instagram Reel', 'Instagram Carousel', 'Instagram Photo',
  'TikTok', 'YouTube Short',
  'Story Set', 'Blog Post',
];

// Deal types the creator can offer their audience through Spot
const DEAL_TYPES = [
  { value: 'percent_off', label: '% Off Check', desc: 'Percentage discount on the total bill', placeholder: 'e.g. 15' },
  { value: 'free_item', label: 'Free Item', desc: 'Complimentary dish or drink with purchase', placeholder: 'e.g. Free appetizer with entree' },
  { value: 'bogo', label: 'BOGO', desc: 'Buy one, get one free on a menu item', placeholder: 'e.g. BOGO cocktails' },
  { value: 'fixed_off', label: '$ Off Check', desc: 'Fixed dollar amount off the total', placeholder: 'e.g. $10 off orders over $50' },
];

// How attribution is tracked
const TRACKING_OPTIONS = [
  { value: 'qr_code', label: 'QR Code', desc: 'Unique QR code for your audience to scan at the restaurant', icon: '📱' },
  { value: 'deal_code', label: 'Deal Code', desc: 'Shareable promo code followers mention when they visit', icon: '🏷' },
  { value: 'spot_link', label: 'Spot Link', desc: 'Trackable link in your bio or stories', icon: '🔗' },
  { value: 'reservation', label: 'Reservation Referral', desc: 'Track bookings from your referral link', icon: '📅' },
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
  restaurantPhone?: string;
  restaurantWebsite?: string;
}

interface WizardForm {
  package: string;
  dealType: string;
  dealDescription: string;
  trackingMethods: string[];
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
  submitError?: string | null;
  restaurantContext?: RestaurantContext | null;
}

const emptyForm: WizardForm = {
  package: '',
  dealType: '',
  dealDescription: '',
  trackingMethods: ['qr_code'],
  goal: '',
  startDate: '',
  endDate: '',
  contentDeliverables: [],
  notes: '',
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CampaignWizard({ isOpen, onClose, onSubmit, isSubmitting, submitError, restaurantContext }: CampaignWizardProps) {
  const hasRestaurant = Boolean(restaurantContext?.restaurantId);
  const totalSteps = hasRestaurant ? 3 : 4;
  const [step, setStep] = useState(hasRestaurant ? 1 : 1);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantContext | null>(restaurantContext ?? null);
  const [searchQuery, setSearchQuery] = useState('');

  // Resolve the user's active city: saved selection > profile city > default
  const demoProfile = useAuthStore((s) => s.demoProfile);
  const activeCity = useMemo(() => getSavedCity() || demoProfile?.city || 'Washington, DC', [demoProfile?.city]);

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

  // Restaurant search query — filtered by user's selected city
  const { data: searchResults } = useQuery({
    queryKey: ['restaurantSearch', searchQuery, activeCity],
    queryFn: async () => {
      if (isDemoMode()) {
        const cityRestaurants = DEMO_RESTAURANTS_BY_CITY[activeCity] ?? [];
        if (!searchQuery.trim()) return cityRestaurants.slice(0, 8);
        const q = searchQuery.toLowerCase();
        return cityRestaurants.filter((r) => r.name.toLowerCase().includes(q) || r.cuisine.some((c) => c.toLowerCase().includes(q))).slice(0, 8);
      }
      const params = new URLSearchParams({ limit: '8' });
      if (activeCity) params.set('city', activeCity);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await api.get<{ items: Restaurant[]; nextPage?: string }>(`/api/restaurants?${params.toString()}`, { public: true });
      // Backend returns paginated { items, nextPage } format
      return res.data?.items ?? [];
    },
    enabled: isOpen && !hasRestaurant && step === 1,
    staleTime: 10_000,
  });

  /* ─── Step mapping ─────────────────────────────────────────────────────── */
  // If restaurant provided: steps are Package(1) → Timeline(2) → Review(3)
  // If no restaurant: steps are Restaurant(1) → Package(2) → Timeline(3) → Review(4)
  const getStepLabel = (s: number): string => {
    if (hasRestaurant) {
      if (s === 1) return 'What Are You Creating?';
      if (s === 2) return 'Content & Timeline';
      return 'Review & Launch';
    }
    if (s === 1) return 'Select Restaurant';
    if (s === 2) return 'What Are You Creating?';
    if (s === 3) return 'Content & Timeline';
    return 'Review & Launch';
  };

  const getStepSubtitle = (s: number): string => {
    if (hasRestaurant) {
      if (s === 1) return 'Pick your campaign type and set up a deal for your audience.';
      if (s === 2) return 'Choose your content deliverables and set the timeline.';
      return 'Review everything before launching your campaign.';
    }
    if (s === 1) return `Showing restaurants in ${activeCity}. Change your city from the directory.`;
    if (s === 2) return 'Pick your campaign type and set up a deal for your audience.';
    if (s === 3) return 'Choose your content deliverables and set the timeline.';
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

  const toggleTracking = useCallback((method: string) => {
    setForm((prev) => ({
      ...prev,
      trackingMethods: prev.trackingMethods.includes(method)
        ? prev.trackingMethods.filter((m) => m !== method)
        : [...prev.trackingMethods, method],
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
      restaurantPhone: r.phone ?? undefined,
      restaurantWebsite: r.website ?? undefined,
    });
    setError(null);
    setStep(2);
  }, []);

  const validate = (): boolean => {
    if (isRestaurantStep) {
      if (!selectedRestaurant) { setError('Please select a restaurant'); return false; }
    }
    if (isPackageStep) {
      if (!form.package) { setError('Please select a campaign type'); return false; }
      if (!form.dealType) { setError('Please select a deal type for your audience'); return false; }
      if (!form.dealDescription.trim()) { setError('Please describe the deal'); return false; }
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
    if (!selectedRestaurant || !form.package || !form.startDate) return;
    onSubmit({
      restaurantId: selectedRestaurant.restaurantId,
      restaurantName: selectedRestaurant.restaurantName,
      package: form.package,
      dealType: form.dealType || undefined,
      dealDescription: form.dealDescription || undefined,
      trackingMethods: form.trackingMethods.length > 0 ? form.trackingMethods : undefined,
      budget: 0,
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
              {/* Contact details */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: '6px' }}>
                {selectedRestaurant.restaurantPhone && (
                  <a href={`tel:${selectedRestaurant.restaurantPhone}`} style={{ fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                    {selectedRestaurant.restaurantPhone}
                  </a>
                )}
                {selectedRestaurant.restaurantWebsite && (
                  <a href={selectedRestaurant.restaurantWebsite} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                    Website
                  </a>
                )}
                {!selectedRestaurant.restaurantPhone && !selectedRestaurant.restaurantWebsite && (
                  <span style={{ fontSize: '11px', color: 'var(--color-warning, #f59e0b)', fontWeight: 500 }}>
                    No contact info — you may need to reach out via social media or in person
                  </span>
                )}
              </div>
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
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '3px' }}>
                      {r.phone && (
                        <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 500 }}>
                          Phone
                        </span>
                      )}
                      {r.website && (
                        <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 500 }}>
                          Website
                        </span>
                      )}
                      {!r.phone && !r.website && (
                        <span style={{ fontSize: '10px', color: 'var(--color-warning, #f59e0b)', fontWeight: 500 }}>
                          No contact info yet
                        </span>
                      )}
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

        {/* Step: Campaign Type + Deal Setup */}
        {isPackageStep && (
          <div>
            {/* Campaign type selection */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-3)' }}>
                Campaign Type <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {CAMPAIGN_TYPES.map((ct) => {
                  const selected = form.package === ct.value;
                  return (
                    <button
                      key={ct.value}
                      onClick={() => {
                        handleFieldChange('package', ct.value);
                        if (!form.contentDeliverables.length) {
                          setForm((prev) => ({ ...prev, contentDeliverables: ct.suggestedDeliverables.slice(0, 2) }));
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-4)',
                        padding: 'var(--space-4)',
                        border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        backgroundColor: selected ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                        transition: 'all 0.2s',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontSize: 'var(--font-xl)', flexShrink: 0 }}>{ct.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-textPrimary)', marginBottom: '2px' }}>
                          {ct.label}
                        </div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', lineHeight: 1.4 }}>
                          {ct.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deal for your audience */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                Deal for Your Audience <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-3)', lineHeight: 1.4 }}>
                What deal will you share with your followers? Better deals = more redemptions = more attribution credit for you.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {DEAL_TYPES.map((dt) => {
                  const selected = form.dealType === dt.value;
                  return (
                    <button
                      key={dt.value}
                      onClick={() => handleFieldChange('dealType', dt.value)}
                      style={{
                        padding: 'var(--space-3)',
                        border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: selected ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-xs)', color: 'var(--color-textPrimary)', marginBottom: '2px' }}>
                        {dt.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-textMuted)' }}>
                        {dt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
              {form.dealType && (
                <input
                  type="text"
                  className="form-input"
                  placeholder={DEAL_TYPES.find((dt) => dt.value === form.dealType)?.placeholder ?? 'Describe the deal...'}
                  value={form.dealDescription}
                  onChange={(e) => handleFieldChange('dealDescription', e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Attribution tracking methods */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                How to Track Attribution
              </label>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-3)', lineHeight: 1.4 }}>
                Select how you want to track the traffic you drive. QR code is selected by default.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
                {TRACKING_OPTIONS.map((to) => {
                  const selected = form.trackingMethods.includes(to.value);
                  return (
                    <button
                      key={to.value}
                      onClick={() => toggleTracking(to.value)}
                      style={{
                        padding: 'var(--space-3)',
                        border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        backgroundColor: selected ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--font-base)' }}>{to.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-xs)', color: 'var(--color-textPrimary)', marginBottom: '1px' }}>
                          {to.label}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-textMuted)', lineHeight: 1.3 }}>
                          {to.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campaign goal — what's interesting about this spot */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                What do you want to highlight?
              </label>
              <textarea
                className="form-input"
                placeholder="What's interesting about this spot? e.g. Their new tasting menu, the chef's story, a signature cocktail, brunch vibes..."
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
                <CalendarDatePicker
                  value={form.startDate}
                  onChange={(v) => handleFieldChange('startDate', v)}
                  placeholder="Start date"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--color-textSecondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 'var(--space-2)' }}>
                  End Date
                </label>
                <CalendarDatePicker
                  value={form.endDate}
                  onChange={(v) => handleFieldChange('endDate', v)}
                  placeholder="End date"
                  min={form.startDate}
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
              <ReviewRow label="Type" value={CAMPAIGN_TYPES.find((ct) => ct.value === form.package)?.label ?? form.package} />
              <ReviewRow label="Deal" value={`${DEAL_TYPES.find((dt) => dt.value === form.dealType)?.label ?? form.dealType}${form.dealDescription ? ` — ${form.dealDescription}` : ''}`} />
              {form.trackingMethods.length > 0 && (
                <ReviewRow label="Tracking" value={form.trackingMethods.map((m) => TRACKING_OPTIONS.find((t) => t.value === m)?.label ?? m).join(', ')} />
              )}
              {form.goal && <ReviewRow label="Highlight" value={form.goal} isLast={!form.startDate} />}
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

            {/* Restaurant contact info */}
            {selectedRestaurant && (
              <div style={{
                backgroundColor: 'var(--color-bgElevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
                marginBottom: 'var(--space-4)',
              }}>
                <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-4)' }}>
                  Restaurant Contact
                </h3>
                {selectedRestaurant.restaurantPhone && (
                  <ReviewRow label="Phone" value={selectedRestaurant.restaurantPhone} />
                )}
                {selectedRestaurant.restaurantWebsite && (
                  <ReviewRow label="Website" value={selectedRestaurant.restaurantWebsite} isLast={!selectedRestaurant.restaurantPhone} />
                )}
                {!selectedRestaurant.restaurantPhone && !selectedRestaurant.restaurantWebsite && (
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-warning, #f59e0b)', lineHeight: 1.5, margin: 0 }}>
                    No contact info on file for this restaurant. You may need to reach out via their social media or visit in person to coordinate the deal.
                  </p>
                )}
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <div style={{
                backgroundColor: 'var(--color-errorMuted)',
                border: '1px solid var(--color-error)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
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
                marginBottom: 'var(--space-2)',
              }}>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-success)', lineHeight: 1.5, margin: 0 }}>
                  Your campaign is ready to launch! It will appear in your pipeline as an inquiry.
                </p>
              </div>
            )}
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
              className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ flex: 1 }}
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
