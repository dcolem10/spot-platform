import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { useAuthStore } from '../../store/authStore';

const NEIGHBORHOODS = [
  'Shaw', 'Adams Morgan', 'Capitol Hill', 'Georgetown', 'Dupont Circle',
  'H Street', '14th Street', 'U Street', 'Navy Yard', 'Columbia Heights',
  'Petworth', 'Brookland'
];

const CUISINES = [
  'American', 'Italian', 'Mexican', 'Japanese', 'Chinese', 'Thai',
  'Indian', 'Ethiopian', 'Korean', 'Mediterranean', 'Vietnamese',
  'French', 'Caribbean', 'BBQ', 'Seafood'
];

const FOLLOWER_RANGES = [
  { label: 'Under 1K', value: 0 },
  { label: '1K-10K', value: 5000 },
  { label: '10K-50K', value: 25000 },
  { label: '50K-100K', value: 75000 },
  { label: '100K-500K', value: 300000 },
  { label: '500K+', value: 500000 },
];

interface FormData {
  displayName: string;
  bio: string;
  creatorType: 'food' | 'lifestyle' | 'travel' | 'other';
  city: string;
  neighborhoods: string[];
  cuisinePreferences: string[];
  socialLinks: {
    instagram: string;
    tiktok: string;
    youtube: string;
    website: string;
  };
  followerCount: number;
}

const CHECKLIST_ITEMS = [
  { id: 'campaign', label: 'Create your first campaign', description: 'Set up a campaign to track how your content drives restaurant visits.', link: '/app/campaigns/new' },
  { id: 'partner', label: 'Add a restaurant partner', description: 'Connect with a restaurant you love — our wizard makes it quick.', link: '/app/restaurants/add' },
  { id: 'offer', label: 'Share your first offer', description: 'Create an offer code your audience can redeem in real time.', link: '/app/offers/new' },
];

export default function CreatorOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // Start at welcome (step 0)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedChecklist, setCompletedChecklist] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    bio: '',
    creatorType: 'food',
    city: 'Washington, DC',
    neighborhoods: [],
    cuisinePreferences: [],
    socialLinks: {
      instagram: '',
      tiktok: '',
      youtube: '',
      website: '',
    },
    followerCount: 0,
  });

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, displayName: e.target.value }));
  };

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value.slice(0, 500);
    setFormData(prev => ({ ...prev, bio: text }));
  };

  const handleCreatorTypeChange = (type: 'food' | 'lifestyle' | 'travel' | 'other') => {
    setFormData(prev => ({ ...prev, creatorType: type }));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, city: e.target.value }));
  };

  const toggleNeighborhood = (neighborhood: string) => {
    setFormData(prev => ({
      ...prev,
      neighborhoods: prev.neighborhoods.includes(neighborhood)
        ? prev.neighborhoods.filter(n => n !== neighborhood)
        : [...prev.neighborhoods, neighborhood]
    }));
  };

  const toggleCuisine = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisinePreferences: prev.cuisinePreferences.includes(cuisine)
        ? prev.cuisinePreferences.filter(c => c !== cuisine)
        : [...prev.cuisinePreferences, cuisine]
    }));
  };

  const handleSocialLinkChange = (field: keyof typeof formData.socialLinks, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [field]: value
      }
    }));
  };

  const handleFollowerCountChange = (value: number) => {
    setFormData(prev => ({ ...prev, followerCount: value }));
  };

  const totalFormSteps = 5; // 0=welcome, 1-4=form, 5=complete

  const handleNext = () => {
    if (step === 1) {
      if (!formData.displayName.trim()) {
        setError('Display name is required');
        return;
      }
    }
    setError(null);
    if (step === 4) {
      handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    const isDemoMode = useAuthStore.getState().isDemoMode;

    if (!isDemoMode) {
      setIsSubmitting(true);
      try {
        const response = await api.post('/api/profile', formData);
        if (response.status !== 'success') {
          setError(response.error || 'Failed to save profile');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        setError('An unexpected error occurred');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    setStep(5); // Go to completion step
  };

  const handleChecklistItem = (id: string, link: string) => {
    setCompletedChecklist(prev =>
      prev.includes(id) ? prev : [...prev, id]
    );
    navigate(link);
  };

  const progressPercent = step === 0 ? 0 : step >= 5 ? 100 : (step / totalFormSteps) * 100;

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
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    minHeight: '100px',
    resize: 'vertical',
  };

  const charCounterStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-textMuted)',
    marginTop: '4px',
    textAlign: 'right',
  };

  const radioGroupStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
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
    border: '2px solid #d1d5db',
    backgroundColor: 'white',
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

  const completeButtonStyle: React.CSSProperties = {
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
      `}</style>

      <div style={wrapperStyle}>
        <div style={progressBarStyle}>
          <div style={progressFillStyle} />
        </div>

        {/* Step indicators */}
        {step > 0 && step < 5 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: s === step ? 'var(--color-accent)' : s < step ? '#f9a882' : 'var(--color-bgElevated)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        )}

        <h1 style={titleStyle}>
          {step === 0 && 'Welcome to Spot Platform'}
          {step === 1 && 'Tell us about yourself'}
          {step === 2 && 'Where do you create?'}
          {step === 3 && 'Your food style'}
          {step === 4 && 'Connect your channels'}
          {step === 5 && "You're all set!"}
        </h1>

        <p style={subtitleStyle}>
          {step === 0 && "We help food creators prove ROI to restaurant partners through closed-loop attribution. Let's set up your profile in under 2 minutes."}
          {step === 1 && "Let's start with the basics to build your creator profile."}
          {step === 2 && "Tell us about your favorite neighborhoods to feature."}
          {step === 3 && "What cuisines do you love to create content about?"}
          {step === 4 && "Add your social media handles and follower count."}
          {step === 5 && "Your profile is ready. Here are three things to do next to start tracking your impact."}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={stepContentStyle}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <>
              <div style={{ backgroundColor: 'var(--color-bgSurface)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '14px', color: 'var(--color-textPrimary)', lineHeight: '1.7' }}>
                  <div style={{ marginBottom: '16px', fontWeight: '600', fontSize: '16px' }}>What you'll unlock:</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>1.</span>
                    <span><strong>Campaign tracking</strong> — See exactly how your content drives restaurant visits through QR scans and offer redemptions.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>2.</span>
                    <span><strong>AI content ideas</strong> — Get personalized post angles and campaign suggestions based on your performance data.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>3.</span>
                    <span><strong>ROI reports</strong> — Show restaurants the dollar value of your partnerships with one-click attribution reports.</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-textMuted)' }}>
                Takes about 2 minutes to complete
              </div>
            </>
          )}

          {/* Step 1: Tell us about yourself */}
          {step === 1 && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Display Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Your name or brand"
                  value={formData.displayName}
                  onChange={handleDisplayNameChange}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Bio</label>
                <textarea
                  style={textareaStyle}
                  placeholder="Tell us about yourself and your content"
                  value={formData.bio}
                  onChange={handleBioChange}
                />
                <div style={charCounterStyle}>{formData.bio.length} / 500</div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Creator Type</label>
                <div style={radioGroupStyle}>
                  {(['food', 'lifestyle', 'travel', 'other'] as const).map((type) => (
                    <div
                      key={type}
                      style={radioOptionStyle(formData.creatorType === type)}
                      onClick={() => handleCreatorTypeChange(type)}
                    >
                      <label style={radioLabelStyle}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Where do you create? */}
          {step === 2 && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Washington, DC"
                  value={formData.city}
                  onChange={handleCityChange}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Neighborhoods</label>
                <div style={chipContainerStyle}>
                  {NEIGHBORHOODS.map((neighborhood) => (
                    <button
                      key={neighborhood}
                      style={chipStyle(formData.neighborhoods.includes(neighborhood))}
                      onClick={() => toggleNeighborhood(neighborhood)}
                      type="button"
                    >
                      {neighborhood}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Your food style */}
          {step === 3 && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Cuisine Preferences</label>
                <div style={chipContainerStyle}>
                  {CUISINES.map((cuisine) => (
                    <button
                      key={cuisine}
                      style={chipStyle(formData.cuisinePreferences.includes(cuisine))}
                      onClick={() => toggleCuisine(cuisine)}
                      type="button"
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 4: Connect your channels */}
          {step === 4 && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Instagram</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '8px', color: 'var(--color-textSecondary)' }}>@</span>
                  <input
                    type="text"
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="username"
                    value={formData.socialLinks.instagram}
                    onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                  />
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>TikTok</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '8px', color: 'var(--color-textSecondary)' }}>@</span>
                  <input
                    type="text"
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="username"
                    value={formData.socialLinks.tiktok}
                    onChange={(e) => handleSocialLinkChange('tiktok', e.target.value)}
                  />
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>YouTube (optional)</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Channel URL or name"
                  value={formData.socialLinks.youtube}
                  onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Website (optional)</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="https://example.com"
                  value={formData.socialLinks.website}
                  onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Follower Count</label>
                <select
                  style={selectStyle}
                  value={formData.followerCount}
                  onChange={(e) => handleFollowerCountChange(Number(e.target.value))}
                >
                  {FOLLOWER_RANGES.map((range) => (
                    <option key={range.label} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Step 5: Completion checklist */}
          {step === 5 && (
            <>
              <div style={{ marginBottom: '8px' }}>
                {CHECKLIST_ITEMS.map((item) => {
                  const isDone = completedChecklist.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '16px',
                        padding: '16px', marginBottom: '12px',
                        backgroundColor: isDone ? 'var(--color-successMuted)' : 'var(--color-bgSurface)',
                        border: isDone ? '1px solid #86efac' : '1px solid #e5e7eb',
                        borderRadius: '8px', cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleChecklistItem(item.id, item.link)}
                    >
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        border: isDone ? '2px solid #22c55e' : '2px solid #d1d5db',
                        backgroundColor: isDone ? 'var(--color-success)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '12px', fontWeight: '700', marginTop: '2px',
                      }}>
                        {isDone ? '\u2713' : ''}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--color-textPrimary)', marginBottom: '4px' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-textSecondary)', lineHeight: '1.4' }}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div style={buttonGroupStyle}>
          {step === 0 && (
            <button
              style={{ ...completeButtonStyle }}
              onClick={() => setStep(1)}
              type="button"
            >
              Get Started
            </button>
          )}
          {step > 0 && step < 5 && step > 1 && (
            <button
              style={backButtonStyle}
              onClick={handleBack}
              type="button"
            >
              Back
            </button>
          )}
          {step >= 1 && step < 5 && (
            <button
              style={{ ...nextButtonStyle, ...(step === 1 ? { marginLeft: 'auto' } : {}) }}
              onClick={handleNext}
              disabled={isSubmitting}
              type="button"
            >
              {step === 4 ? (isSubmitting ? 'Setting up...' : 'Complete Setup') : 'Next'}
            </button>
          )}
          {step === 5 && (
            <button
              style={{ ...completeButtonStyle, backgroundColor: 'var(--color-textPrimary)' }}
              onClick={() => navigate('/app/dashboard')}
              type="button"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
