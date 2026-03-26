import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { useAuthStore } from '../../store/authStore';

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
  { label: 'Percentage Off', value: 'percentage' },
  { label: 'Free Item', value: 'free_item' },
  { label: 'Buy One Get One', value: 'bogo' }
];

interface FormData {
  restaurantName: string;
  cuisines: string[];
  neighborhood: string;
  phone: string;
  website: string;
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
    discountPercentage: 20,
    offerDescription: '',
    offerType: 'percentage',
    expiryDate: getDefaultExpiryDate(),
  });

  const handleRestaurantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, restaurantName: e.target.value }));
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
        // Create restaurant
        const restaurantRes = await api.post('/api/restaurants', {
          name: formData.restaurantName,
          cuisines: formData.cuisines,
          neighborhood: formData.neighborhood,
          phone: formData.phone,
          website: formData.website || undefined,
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

  const progressPercent = (step / 3) * 100;

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-bgSurface)',
    padding: '20px',
  };

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: 'var(--color-bgCard, #1a1a2e)',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    padding: '40px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '4px',
    backgroundColor: 'var(--color-bgElevated)',
    borderRadius: '2px',
    marginBottom: '40px',
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: 'var(--color-accent)',
    width: `${progressPercent}%`,
    transition: 'width 0.3s ease',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '600',
    color: 'var(--color-textPrimary)',
    marginBottom: '12px',
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
    padding: '12px',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
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
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
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
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: selected ? 'var(--color-accent)' : 'var(--color-bgElevated)',
    color: selected ? 'white' : 'var(--color-textPrimary)',
    transition: 'all 0.2s',
  });

  const radioGroupStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
  };

  const radioOptionStyle = (selected: boolean): React.CSSProperties => ({
    padding: '12px',
    border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'center',
    backgroundColor: selected ? 'var(--color-accentMuted)' : 'var(--color-bgSurface)',
    transition: 'all 0.2s',
  });

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
    padding: '12px 24px',
    border: '2px solid var(--color-border, #333)',
    backgroundColor: 'var(--color-bgElevated, #252540)',
    color: 'var(--color-textPrimary)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const nextButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const launchButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 24px',
    backgroundColor: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
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
        }
        button:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
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
        <div style={progressBarStyle}>
          <div style={progressFillStyle} />
        </div>

        <h1 style={titleStyle}>
          {step === 1 && 'Restaurant Information'}
          {step === 2 && 'Create Your First Offer'}
          {step === 3 && 'Review & Launch'}
        </h1>

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
              <div style={formGroupStyle}>
                <label style={labelStyle}>Restaurant Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="e.g., Rasika, The Dabney"
                  value={formData.restaurantName}
                  onChange={handleRestaurantNameChange}
                />
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

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#166534', lineHeight: '1.5' }}>
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
