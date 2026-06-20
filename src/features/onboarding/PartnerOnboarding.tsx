import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { useAuthStore } from '../../store/authStore';

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

interface PlaceDetails {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name: string }>;
}

const DC_NEIGHBORHOODS = [
  'Adams Morgan',
  'Capitol Hill',
  'Chinatown/Penn Quarter',
  'Columbia Heights',
  'Dupont Circle',
  'Foggy Bottom',
  'Georgetown',
  'H Street NE',
  'Logan Circle',
  'Navy Yard',
  'NoMa',
  'Petworth',
  'Shaw',
  'U Street',
  'Brookland',
];

const CUISINES = [
  'American', 'Italian', 'Ethiopian', 'Mexican', 'Japanese', 'Chinese',
  'Korean', 'Thai', 'Indian', 'Mediterranean', 'French', 'Vietnamese',
  'Peruvian', 'Caribbean', 'Soul Food', 'Seafood', 'BBQ', 'Pizza', 'Brunch', 'Other'
];

const OFFER_TYPES = [
  { label: 'Percentage Off', value: 'percentage', icon: '％' },
  { label: 'Free Item', value: 'free_item', icon: '🎁' },
  { label: 'Buy One Get One', value: 'bogo', icon: '🍔' }
];

const STEPS = [
  { n: 1, label: 'Restaurant' },
  { n: 2, label: 'Offer' },
  { n: 3, label: 'Launch' },
];

const STEP_META: Record<number, { icon: string; title: string }> = {
  1: { icon: '🍽️', title: 'Restaurant Information' },
  2: { icon: '🎟️', title: 'Create Your First Offer' },
  3: { icon: '🚀', title: 'Review & Launch' },
};

interface FormData {
  restaurantName: string;
  cuisines: string[];
  neighborhood: string;
  phone: string;
  website: string;
  address: string;
  googlePlaceId: string;
  coords: { lat: number; lng: number } | null;
  rating: number | null;
  priceLevel: number;
  hours: string[] | null;
  discountPercentage: number;
  offerDescription: string;
  offerType: string;
  expiryDate: string;
}

function generateQRCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'SPOT-';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

function getDefaultExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
}

export default function PartnerOnboarding() {
  const navigate = useNavigate();
  const setDemoOnboarded = useAuthStore((s) => s.setDemoOnboarded);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQRCode] = useState(generateQRCode());

  const [formData, setFormData] = useState<FormData>({
    restaurantName: '',
    cuisines: [],
    neighborhood: '',
    phone: '',
    website: '',
    address: '',
    googlePlaceId: '',
    coords: null,
    rating: null,
    priceLevel: 2,
    hours: null,
    discountPercentage: 20,
    offerDescription: '',
    offerType: 'percentage',
    expiryDate: getDefaultExpiryDate(),
  });

  // Google Places autocomplete state
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [placeSelected, setPlaceSelected] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Places autocomplete search
  const searchPlaces = useCallback((query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 2 || isDemoMode()) {
      setPlaceResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const res = await api.get(`/api/places/autocomplete?query=${encodeURIComponent(query)}`);
        const data = res.data as { results?: PlaceResult[] } | undefined;
        if (res.status === 'success' && data?.results) {
          setPlaceResults(data.results);
          setShowDropdown(data.results.length > 0);
        }
      } catch {
        // Fail silently — user can still type manually
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, []);

  // When a place is selected from dropdown, fetch full details and auto-fill
  const handlePlaceSelect = useCallback(async (place: PlaceResult) => {
    setFormData(prev => ({ ...prev, restaurantName: place.name, address: place.address, googlePlaceId: place.placeId }));
    setPlaceSelected(true);
    setShowDropdown(false);
    setPlaceResults([]);

    // Fetch full details to auto-fill phone, website, hours, coords, etc.
    setLoadingDetails(true);
    try {
      const res = await api.get(`/api/places/details?placeId=${encodeURIComponent(place.placeId)}`);
      if (res.status === 'success' && res.data) {
        const d = res.data as PlaceDetails;
        setFormData(prev => ({
          ...prev,
          phone: d.nationalPhoneNumber || prev.phone,
          website: d.websiteUri || prev.website,
          rating: d.rating || null,
          priceLevel: d.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 : d.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? 4 : d.priceLevel === 'PRICE_LEVEL_MODERATE' ? 2 : 1,
          coords: d.location ? { lat: d.location.latitude, lng: d.location.longitude } : null,
          hours: d.regularOpeningHours?.weekdayDescriptions || null,
        }));
      }
    } catch {
      // Details fetch failed — user can fill in manually
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const handleRestaurantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, restaurantName: val }));
    setPlaceSelected(false);
    searchPlaces(val);
  };

  const toggleCuisine = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter(c => c !== cuisine)
        : [...prev.cuisines, cuisine]
    }));
  };

  const handleNeighborhoodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, neighborhood: e.target.value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, phone: e.target.value }));
  };

  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, website: e.target.value }));
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, discountPercentage: Number(e.target.value) }));
  };

  const handleOfferTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, offerType: type }));
  };

  const handleOfferDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value.slice(0, 200);
    setFormData(prev => ({ ...prev, offerDescription: text }));
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, expiryDate: e.target.value }));
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!formData.restaurantName.trim()) {
        setError('Restaurant name is required');
        return false;
      }
      if (formData.cuisines.length === 0) {
        setError('Please select at least one cuisine type');
        return false;
      }
      if (!formData.neighborhood) {
        setError('Neighborhood is required');
        return false;
      }
    } else if (step === 2) {
      if (!formData.offerDescription.trim()) {
        setError('Offer description is required');
        return false;
      }
      if (!formData.expiryDate) {
        setError('Expiry date is required');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    const demo = isDemoMode();

    if (!demo) {
      setIsSubmitting(true);
      try {
        // Create restaurant with Google Places data
        const restaurantRes = await api.post('/api/restaurants', {
          name: formData.restaurantName,
          cuisine: formData.cuisines,
          neighborhood: formData.neighborhood,
          phone: formData.phone,
          website: formData.website || undefined,
          address: formData.address || undefined,
          googlePlaceId: formData.googlePlaceId || undefined,
          coords: formData.coords || undefined,
          priceLevel: formData.priceLevel,
          hours: formData.hours || undefined,
          isPartner: true,
        });

        if (restaurantRes.status !== 'success' || !restaurantRes.data) {
          setError(restaurantRes.error || 'Failed to create restaurant');
          setIsSubmitting(false);
          return;
        }

        const restaurantId = (restaurantRes.data as any).restaurantId;

        // Create offer
        const offerRes = await api.post(`/api/restaurants/${restaurantId}/offers`, {
          code: generatedQRCode,
          type: formData.offerType,
          description: formData.offerDescription,
          discountPercentage: formData.discountPercentage,
          expiresAt: formData.expiryDate,
        });

        if (offerRes.status !== 'success') {
          setError(offerRes.error || 'Failed to create offer');
          setIsSubmitting(false);
          return;
        }

        // Create a profile so OnboardingGuard doesn't redirect back
        await api.post('/api/profile', {
          displayName: formData.restaurantName,
          bio: '',
          city: 'Washington, DC',
          neighborhoods: [formData.neighborhood],
          cuisinePreferences: formData.cuisines,
          socialLinks: { instagram: '', tiktok: '', youtube: '', website: formData.website || '' },
          followerCount: 0,
          creatorType: 'food',
        });

        setIsSubmitting(false);
        navigate('/app/partner');
      } catch (err) {
        setError('An unexpected error occurred');
        setIsSubmitting(false);
      }
    } else {
      // Demo mode - mark onboarding complete and navigate
      setDemoOnboarded(true);
      navigate('/app/partner');
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-bgPrimary)',
    backgroundImage: 'radial-gradient(900px circle at 50% -10%, rgba(249,115,22,0.10), transparent 55%)',
    padding: '24px',
  };

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: 'var(--color-bgSecondary, #111119)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl, 24px)',
    boxShadow: 'var(--shadow-xl)',
    padding: '40px',
  };

  const stepperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '36px',
  };

  const stepCircleStyle = (active: boolean, done: boolean): React.CSSProperties => ({
    width: '34px',
    height: '34px',
    flexShrink: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    background: active || done ? 'var(--gradient-warm)' : 'var(--color-bgElevated)',
    color: active || done ? '#fff' : 'var(--color-textMuted)',
    boxShadow: active ? 'var(--shadow-glow)' : 'none',
    transition: 'all 0.3s ease',
  });

  const stepLabelStyle = (on: boolean): React.CSSProperties => ({
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-display)',
    color: on ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
    transition: 'color 0.3s ease',
  });

  const stepConnectorStyle = (done: boolean): React.CSSProperties => ({
    flex: 1,
    height: '2px',
    marginTop: '16px',
    borderRadius: '2px',
    background: done ? 'var(--gradient-warm)' : 'var(--color-border)',
    transition: 'all 0.3s ease',
  });

  const headerBadgeStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    flexShrink: 0,
    borderRadius: 'var(--radius-md, 12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    background: 'var(--color-accentMuted)',
    border: '1px solid var(--color-border)',
  };

  const eyebrowStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: 'var(--color-accent)',
    marginBottom: '4px',
    fontFamily: 'var(--font-display)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    fontFamily: 'var(--font-display)',
    color: 'var(--color-textPrimary)',
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--color-textSecondary)',
    marginBottom: '32px',
    lineHeight: '1.5',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--color-textPrimary)',
    marginBottom: '8px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    border: '1px solid var(--color-border, #333)',
    borderRadius: 'var(--radius-md, 12px)',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: 'var(--color-bgElevated, #252540)',
    color: 'var(--color-textPrimary, #fff)',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    minHeight: '80px',
    resize: 'vertical',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: 'var(--color-bgElevated, #252540)',
    color: 'var(--color-textPrimary, #fff)',
  };

  const charCounterStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-textMuted)',
    marginTop: '4px',
    textAlign: 'right',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: '1px solid var(--color-border, #333)',
    borderRadius: 'var(--radius-md, 12px)',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    backgroundColor: 'var(--color-bgElevated, #252540)',
    color: 'var(--color-textPrimary, #fff)',
  };

  const sliderContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  };

  const sliderStyle: React.CSSProperties = {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  };

  const chipContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  };

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 'var(--radius-full, 9999px)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    border: selected ? '1px solid transparent' : '1px solid var(--color-border)',
    background: selected ? 'var(--gradient-warm)' : 'var(--color-bgElevated)',
    color: selected ? '#fff' : 'var(--color-textSecondary)',
    boxShadow: selected ? 'var(--shadow-glow)' : 'none',
    transition: 'all 0.2s',
  });

  const radioGroupStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
  };

  const radioOptionStyle = (selected: boolean): React.CSSProperties => ({
    padding: '16px 12px',
    border: selected ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md, 12px)',
    cursor: 'pointer',
    textAlign: 'center',
    backgroundColor: selected ? 'var(--color-accentMuted)' : 'var(--color-bgElevated)',
    boxShadow: selected ? 'var(--shadow-glow)' : 'none',
    transition: 'all 0.2s',
  });

  const radioIconStyle: React.CSSProperties = {
    fontSize: '22px',
    marginBottom: '8px',
    lineHeight: 1,
  };

  const radioLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--color-textPrimary)',
    cursor: 'pointer',
  };

  const qrCodeBoxStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bgSurface)',
    border: '2px dashed var(--color-border, #333)',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    marginTop: '16px',
  };

  const qrCodeTextStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--color-textPrimary)',
    marginBottom: '8px',
    letterSpacing: '2px',
  };

  const qrCodeLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-textSecondary)',
  };

  const reviewBoxStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bgSurface)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
  };

  const reviewRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--color-border, #333)',
  };

  const reviewRowLastStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0px',
  };

  const reviewLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-textSecondary)',
    fontWeight: '500',
  };

  const reviewValueStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--color-textPrimary)',
    fontWeight: '600',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginTop: '32px',
    justifyContent: 'space-between',
  };

  const backButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '13px 24px',
    border: '1px solid var(--color-border, #333)',
    backgroundColor: 'var(--color-bgElevated, #252540)',
    color: 'var(--color-textSecondary)',
    borderRadius: 'var(--radius-md, 12px)',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const nextButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '13px 24px',
    background: 'var(--gradient-warm)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md, 12px)',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    transition: 'all 0.2s',
  };

  const launchButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 24px',
    background: 'var(--gradient-warm)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md, 12px)',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    transition: 'all 0.2s',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--color-errorMuted)',
    color: 'var(--color-error)',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  };

  const stepContentStyle: React.CSSProperties = {
    opacity: 1,
    animation: 'fadeIn 0.3s ease',
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 3px var(--color-accentMuted);
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--color-bgElevated, #252540);
          outline: none;
          -webkit-slider-thumb-appearance: none;
          appearance: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--color-accent);
          cursor: pointer;
          transition: background 0.2s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          background: #d75a2b;
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--color-accent);
          cursor: pointer;
          border: none;
          transition: background 0.2s;
        }
        input[type="range"]::-moz-range-thumb:hover {
          background: #d75a2b;
        }
      `}</style>

      <div style={wrapperStyle}>
        <div style={stepperStyle}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                flex: i < STEPS.length - 1 ? 1 : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={stepCircleStyle(step === s.n, step > s.n)}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={stepLabelStyle(step >= s.n)}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={stepConnectorStyle(step > s.n)} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <div style={headerBadgeStyle}>{STEP_META[step].icon}</div>
          <div>
            <div style={eyebrowStyle}>Step {step} of 3</div>
            <h1 style={titleStyle}>{STEP_META[step].title}</h1>
          </div>
        </div>

        <p style={subtitleStyle}>
          {step === 1 && "Let's get your restaurant on Spot — it's free. Creators will find you and drive measurable new customers to your door."}
          {step === 2 && 'Set up a deal that creators can share with their audience. Every redemption is a tracked new customer for you.'}
          {step === 3 && 'Review your restaurant and offer details before going live. You only pay for partnerships that deliver results.'}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={stepContentStyle}>
          {/* Step 1: Restaurant Info */}
          {step === 1 && (
            <>
              <div style={formGroupStyle} ref={dropdownRef}>
                <label style={labelStyle}>Restaurant Name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="Start typing to search Google Places..."
                    value={formData.restaurantName}
                    onChange={handleRestaurantNameChange}
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--color-textMuted)' }}>
                      Searching...
                    </div>
                  )}
                  {showDropdown && placeResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      backgroundColor: 'var(--color-bgCard, #1a1a2e)', border: '1px solid var(--color-border, #333)',
                      borderRadius: '8px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', overflow: 'hidden',
                    }}>
                      {placeResults.map((place) => (
                        <button
                          key={place.placeId}
                          type="button"
                          onClick={() => handlePlaceSelect(place)}
                          style={{
                            width: '100%', padding: '12px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                            backgroundColor: 'transparent', color: 'var(--color-textPrimary, #fff)', display: 'block',
                            borderBottom: '1px solid var(--color-border, #222)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bgElevated, #252540)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{place.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-textSecondary)', marginTop: '2px' }}>{place.address}</div>
                        </button>
                      ))}
                      <div style={{ padding: '6px 16px', fontSize: '11px', color: 'var(--color-textMuted)', textAlign: 'center', borderTop: '1px solid var(--color-border, #222)' }}>
                        Powered by Google Places
                      </div>
                    </div>
                  )}
                </div>
                {!isDemoMode() && !placeSelected && formData.restaurantName.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--color-textMuted)', marginTop: '6px' }}>
                    Search for your restaurant to auto-fill details from Google
                  </div>
                )}
                {placeSelected && (
                  <div style={{ fontSize: '12px', color: 'var(--color-success, #22c55e)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {loadingDetails ? 'Loading restaurant details...' : 'Restaurant details auto-filled from Google Places'}
                  </div>
                )}
                {formData.address && (
                  <div style={{ fontSize: '12px', color: 'var(--color-textSecondary)', marginTop: '4px' }}>
                    {formData.address}
                  </div>
                )}
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Cuisine Type *</label>
                <div style={chipContainerStyle}>
                  {CUISINES.map((cuisine) => (
                    <button
                      key={cuisine}
                      style={chipStyle(formData.cuisines.includes(cuisine))}
                      onClick={() => toggleCuisine(cuisine)}
                      type="button"
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Neighborhood *</label>
                <select
                  style={selectStyle}
                  value={formData.neighborhood}
                  onChange={handleNeighborhoodChange}
                >
                  <option value="">Select a neighborhood</option>
                  {DC_NEIGHBORHOODS.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </option>
                  ))}
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Phone Number *</label>
                <input
                  type="tel"
                  style={inputStyle}
                  placeholder="(202) 555-0123"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Website (optional)</label>
                <input
                  type="url"
                  style={inputStyle}
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={handleWebsiteChange}
                />
              </div>
            </>
          )}

          {/* Step 2: First Offer */}
          {step === 2 && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Offer Type</label>
                <div style={radioGroupStyle}>
                  {OFFER_TYPES.map((offerType) => (
                    <div
                      key={offerType.value}
                      style={radioOptionStyle(formData.offerType === offerType.value)}
                      onClick={() => handleOfferTypeChange(offerType.value)}
                    >
                      <div style={radioIconStyle}>{offerType.icon}</div>
                      <label style={radioLabelStyle}>
                        {offerType.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Discount Percentage: {formData.discountPercentage}%</label>
                <div style={sliderContainerStyle}>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={formData.discountPercentage}
                    onChange={handleDiscountChange}
                    style={sliderStyle}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-textSecondary)', marginTop: '8px' }}>
                  10% - 50% off
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Offer Description *</label>
                <textarea
                  style={textareaStyle}
                  placeholder="e.g., Show this code to your server for a discount on your next meal"
                  value={formData.offerDescription}
                  onChange={handleOfferDescriptionChange}
                />
                <div style={charCounterStyle}>{formData.offerDescription.length} / 200</div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Offer Expiry Date *</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={formData.expiryDate}
                  onChange={handleExpiryDateChange}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Offer Code Preview</label>
                <div style={qrCodeBoxStyle}>
                  <div style={qrCodeTextStyle}>{generatedQRCode}</div>
                  <div style={qrCodeLabelStyle}>Customers use this code when visiting from a creator&rsquo;s recommendation</div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <>
              <div style={reviewBoxStyle}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-textPrimary)', marginBottom: '16px' }}>
                  Restaurant Details
                </h3>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Name</span>
                  <span style={reviewValueStyle}>{formData.restaurantName}</span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Cuisines</span>
                  <span style={reviewValueStyle}>{formData.cuisines.join(', ')}</span>
                </div>
                {formData.address && (
                  <div style={reviewRowStyle}>
                    <span style={reviewLabelStyle}>Address</span>
                    <span style={reviewValueStyle}>{formData.address}</span>
                  </div>
                )}
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Neighborhood</span>
                  <span style={reviewValueStyle}>{formData.neighborhood}</span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Phone</span>
                  <span style={reviewValueStyle}>{formData.phone}</span>
                </div>
                <div style={reviewRowLastStyle}>
                  <span style={reviewLabelStyle}>Website</span>
                  <span style={reviewValueStyle}>{formData.website || '--'}</span>
                </div>
              </div>

              <div style={reviewBoxStyle}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-textPrimary)', marginBottom: '16px' }}>
                  Offer Details
                </h3>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Type</span>
                  <span style={reviewValueStyle}>{OFFER_TYPES.find(t => t.value === formData.offerType)?.label}</span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Discount</span>
                  <span style={reviewValueStyle}>{formData.discountPercentage}% Off</span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Description</span>
                  <span style={reviewValueStyle}>{formData.offerDescription}</span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={reviewLabelStyle}>Expires</span>
                  <span style={reviewValueStyle}>{new Date(formData.expiryDate).toLocaleDateString()}</span>
                </div>
                <div style={reviewRowLastStyle}>
                  <span style={reviewLabelStyle}>Code</span>
                  <span style={reviewValueStyle}>{generatedQRCode}</span>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: 'var(--color-success, #22c55e)', lineHeight: '1.5' }}>
                  ✓ You&rsquo;re all set! Creators can now discover your restaurant and drive new customers through tracked content partnerships &mdash; always free for restaurants, with measurable ROI on every deal.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div style={buttonGroupStyle}>
          {step > 1 && (
            <button
              style={backButtonStyle}
              onClick={handleBack}
              type="button"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              style={{ ...nextButtonStyle, ...(step === 1 ? { marginLeft: 'auto' } : {}) }}
              onClick={handleNext}
              type="button"
            >
              Next
            </button>
          ) : (
            <button
              style={launchButtonStyle}
              onClick={handleSubmit}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? 'Going Live...' : 'Go Live'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
