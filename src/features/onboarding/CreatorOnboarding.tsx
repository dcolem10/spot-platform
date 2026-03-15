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
  creatorType: 'food' | 'reviews' | 'recipes' | 'culinary-travel';
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
  { id: 'restaurants', label: 'Browse restaurants', description: 'Discover restaurants in your area worth creating content about and start building partnerships.', link: '/app/restaurants', icon: 'restaurant' },
  { id: 'social', label: 'Connect your social accounts', description: 'Link Instagram, TikTok, or YouTube to track engagement metrics on your published content.', link: '/app/social', icon: 'social' },
  { id: 'campaign', label: 'Create your first campaign', description: 'Set up a campaign with a restaurant, attach a deal, and start tracking attribution.', link: '/app/campaigns', icon: 'campaign' },
];

const CREATOR_TYPES = [
  { value: 'food' as const, label: 'Food Creator', icon: '🍽️', desc: 'Restaurant features & dining content' },
  { value: 'reviews' as const, label: 'Food Reviewer', icon: '⭐', desc: 'Honest reviews & taste tests' },
  { value: 'recipes' as const, label: 'Recipe Creator', icon: '👨‍🍳', desc: 'Recipes & cooking content' },
  { value: 'culinary-travel' as const, label: 'Culinary Travel', icon: '🗺️', desc: 'Food-focused travel & guides' },
];

/* ─── SVG Icons ─────────────────────────────────────────────────────────────── */
const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const HandshakeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88" />
    <path d="m9.5 16.5-1-1a1 1 0 0 0-3 3l2 2a1 1 0 0 0 3-3" />
    <path d="M3 7V5a1 1 0 0 1 1-1h3" /><path d="M21 7V5a1 1 0 0 0-1-1h-3" />
    <path d="M6 12H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3" /><path d="M18 12h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3" />
  </svg>
);

const RocketIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const PartyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.8 11.3 2 22l10.7-3.79" />
    <path d="M4 3h.01" /><path d="M22 8h.01" /><path d="M15 2h.01" />
    <path d="M22 20h.01" /><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
    <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17" />
    <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7" />
  </svg>
);


export default function CreatorOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
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

  const handleCreatorTypeChange = (type: 'food' | 'reviews' | 'recipes' | 'culinary-travel') => {
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

  const totalFormSteps = 5;

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
    const store = useAuthStore.getState();

    if (!store.isDemoMode) {
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
    } else {
      store.setDemoProfile({
        displayName: formData.displayName,
        city: formData.city,
        neighborhoods: formData.neighborhoods,
        cuisinePreferences: formData.cuisinePreferences,
        creatorType: formData.creatorType,
        followerCount: formData.followerCount,
        socialLinks: formData.socialLinks,
      });
      store.setDemoOnboarded(true);
    }

    setIsSubmitting(false);
    setStep(5);
  };

  const handleChecklistItem = (id: string, link: string) => {
    setCompletedChecklist(prev =>
      prev.includes(id) ? prev : [...prev, id]
    );
    navigate(link);
  };

  const progressPercent = step === 0 ? 0 : step >= 5 ? 100 : (step / totalFormSteps) * 100;

  const STEP_TITLES = [
    'Welcome to Spot',
    'Tell us about yourself',
    'Where do you create?',
    'Your food style',
    'Connect your channels',
    "You're all set!",
  ];

  const STEP_SUBTITLES = [
    "The operating system for food creators. Manage restaurant partnerships, track attribution through QR codes and deals, and prove your content drives real customers.",
    "Let's start with the basics to build your creator profile.",
    "Tell us about your favorite neighborhoods to feature.",
    "What cuisines do you love to create content about?",
    "Add your social media handles and follower count.",
    "Your profile is ready. Here are three things to do next to start building your creator business.",
  ];

  return (
    <div className="onboarding-container">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .onboarding-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #09090f;
          padding: 20px;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Background ambient glow orbs */
        .onboarding-container::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -10%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%);
          animation: pulseGlow 6s ease-in-out infinite;
          pointer-events: none;
        }
        .onboarding-container::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
          animation: pulseGlow 8s ease-in-out infinite 2s;
          pointer-events: none;
        }

        .onboarding-card {
          width: 100%;
          max-width: 580px;
          background: rgba(17, 17, 25, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 44px;
          position: relative;
          z-index: 1;
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
          animation: scaleIn 0.4s ease-out;
        }

        /* Gradient accent line at top of card */
        .onboarding-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 40px;
          right: 40px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #f97316, #ec4899, #8b5cf6, transparent);
          border-radius: 0 0 2px 2px;
        }

        .onboarding-progress-track {
          height: 3px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          margin-bottom: 36px;
          overflow: hidden;
        }
        .onboarding-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f97316, #fb923c);
          border-radius: 4px;
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 12px rgba(249, 115, 22, 0.3);
        }

        .onboarding-step-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 28px;
        }
        .onboarding-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .onboarding-step-dot--active {
          background: #f97316;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
          width: 24px;
          border-radius: 4px;
        }
        .onboarding-step-dot--done {
          background: rgba(249, 115, 22, 0.5);
        }
        .onboarding-step-dot--upcoming {
          background: rgba(255, 255, 255, 0.08);
        }

        .onboarding-title {
          font-family: 'Outfit', -apple-system, sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #f4f4f8;
          margin: 0 0 10px 0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .onboarding-title--welcome {
          background: linear-gradient(135deg, #f4f4f8 0%, #f97316 60%, #fb923c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 32px;
        }

        .onboarding-subtitle {
          font-size: 15px;
          color: #9ca3b8;
          margin: 0 0 32px 0;
          line-height: 1.6;
        }

        .onboarding-step-content {
          animation: fadeIn 0.35s ease-out;
        }

        /* ── Form elements ────────────────────────────── */
        .onboarding-form-group {
          margin-bottom: 24px;
        }
        .onboarding-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #9ca3b8;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .onboarding-input,
        .onboarding-textarea,
        .onboarding-select {
          width: 100%;
          padding: 13px 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s ease;
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4f8;
        }
        .onboarding-input::placeholder,
        .onboarding-textarea::placeholder {
          color: #5e6480;
        }
        .onboarding-input:focus,
        .onboarding-textarea:focus,
        .onboarding-select:focus {
          outline: none;
          border-color: rgba(249, 115, 22, 0.5);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
        }
        .onboarding-textarea {
          min-height: 100px;
          resize: vertical;
        }
        .onboarding-select option {
          background: #1a1a25;
          color: #f4f4f8;
        }
        .onboarding-char-counter {
          font-size: 12px;
          color: #5e6480;
          margin-top: 6px;
          text-align: right;
        }

        /* ── Creator type cards ──────────────────────── */
        .onboarding-type-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .onboarding-type-card {
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          cursor: pointer;
          text-align: center;
          background: rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
        }
        .onboarding-type-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }
        .onboarding-type-card--selected {
          background: rgba(249, 115, 22, 0.1);
          border-color: rgba(249, 115, 22, 0.4);
          box-shadow: 0 0 16px rgba(249, 115, 22, 0.08);
        }
        .onboarding-type-card--selected:hover {
          background: rgba(249, 115, 22, 0.14);
          border-color: rgba(249, 115, 22, 0.5);
        }
        .onboarding-type-emoji {
          font-size: 24px;
          margin-bottom: 6px;
          display: block;
        }
        .onboarding-type-label {
          font-size: 14px;
          font-weight: 600;
          color: #f4f4f8;
          display: block;
        }
        .onboarding-type-desc {
          font-size: 11px;
          color: #5e6480;
          margin-top: 2px;
          display: block;
        }

        /* ── Chips ───────────────────────────────────── */
        .onboarding-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .onboarding-chip {
          padding: 8px 16px;
          border-radius: 100px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #9ca3b8;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .onboarding-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #f4f4f8;
        }
        .onboarding-chip--selected {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(251, 146, 60, 0.15));
          border-color: rgba(249, 115, 22, 0.4);
          color: #fb923c;
        }
        .onboarding-chip--selected:hover {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.25), rgba(251, 146, 60, 0.2));
          color: #fb923c;
        }

        /* ── Social input with prefix ────────────────── */
        .onboarding-social-row {
          display: flex;
          align-items: center;
          gap: 0;
        }
        .onboarding-social-prefix {
          padding: 13px 12px 13px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-right: none;
          border-radius: 12px 0 0 12px;
          color: #5e6480;
          font-size: 15px;
          font-weight: 500;
        }
        .onboarding-social-input {
          flex: 1;
          padding: 13px 16px 13px 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: none;
          border-radius: 0 12px 12px 0;
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s ease;
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4f8;
        }
        .onboarding-social-input::placeholder {
          color: #5e6480;
        }
        .onboarding-social-row:focus-within .onboarding-social-prefix,
        .onboarding-social-row:focus-within .onboarding-social-input {
          border-color: rgba(249, 115, 22, 0.5);
          background: rgba(255, 255, 255, 0.06);
        }
        .onboarding-social-input:focus {
          outline: none;
        }

        /* ── Buttons ─────────────────────────────────── */
        .onboarding-btn-group {
          display: flex;
          gap: 12px;
          margin-top: 36px;
        }
        .onboarding-btn {
          flex: 1;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .onboarding-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .onboarding-btn--primary {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          border: none;
          box-shadow: 0 4px 16px rgba(249, 115, 22, 0.25);
        }
        .onboarding-btn--primary:hover:not(:disabled) {
          box-shadow: 0 6px 24px rgba(249, 115, 22, 0.35);
          transform: translateY(-1px);
        }
        .onboarding-btn--secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #9ca3b8;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .onboarding-btn--secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: #f4f4f8;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .onboarding-btn--full {
          width: 100%;
        }
        .onboarding-btn--dark {
          background: #f4f4f8;
          color: #09090f;
          border: none;
        }
        .onboarding-btn--dark:hover:not(:disabled) {
          background: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(244, 244, 248, 0.15);
        }

        /* ── Welcome features ────────────────────────── */
        .onboarding-features {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }
        .onboarding-feature {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          transition: all 0.2s ease;
        }
        .onboarding-feature:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .onboarding-feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .onboarding-feature-icon--orange {
          background: rgba(249, 115, 22, 0.12);
          color: #f97316;
        }
        .onboarding-feature-icon--purple {
          background: rgba(139, 92, 246, 0.12);
          color: #8b5cf6;
        }
        .onboarding-feature-icon--green {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
        }
        .onboarding-feature-title {
          font-size: 14px;
          font-weight: 600;
          color: #f4f4f8;
          margin-bottom: 2px;
        }
        .onboarding-feature-desc {
          font-size: 13px;
          color: #5e6480;
          line-height: 1.5;
        }

        .onboarding-time-hint {
          text-align: center;
          font-size: 12px;
          color: #5e6480;
          letter-spacing: 0.02em;
        }

        /* ── Error ───────────────────────────────────── */
        .onboarding-error {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          border-radius: 12px;
          font-size: 14px;
          margin-bottom: 20px;
        }

        /* ── Checklist ───────────────────────────────── */
        .onboarding-checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 18px;
          margin-bottom: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .onboarding-checklist-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateX(2px);
        }
        .onboarding-checklist-item--done {
          background: rgba(34, 197, 94, 0.06);
          border-color: rgba(34, 197, 94, 0.2);
        }
        .onboarding-checklist-check {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          transition: all 0.2s ease;
        }
        .onboarding-checklist-check--pending {
          border: 2px solid rgba(255, 255, 255, 0.12);
          background: transparent;
        }
        .onboarding-checklist-check--done {
          border: 2px solid #22c55e;
          background: #22c55e;
          color: white;
        }
        .onboarding-checklist-label {
          font-weight: 600;
          color: #f4f4f8;
          margin-bottom: 3px;
          font-size: 14px;
        }
        .onboarding-checklist-desc {
          font-size: 13px;
          color: #5e6480;
          line-height: 1.4;
        }

        /* ── Completion header ────────────────────────── */
        .onboarding-complete-icon {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(249, 115, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: #f97316;
          animation: floatSlow 3s ease-in-out infinite;
        }

        /* ── Welcome header ──────────────────────────── */
        .onboarding-welcome-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(251, 146, 60, 0.08));
          border: 1px solid rgba(249, 115, 22, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: #f97316;
        }

        /* ── Responsive ──────────────────────────────── */
        @media (max-width: 480px) {
          .onboarding-card {
            padding: 28px 24px;
            border-radius: 16px;
          }
          .onboarding-title {
            font-size: 24px;
          }
          .onboarding-title--welcome {
            font-size: 26px;
          }
          .onboarding-type-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .onboarding-feature {
            padding: 12px;
          }
          .onboarding-card::before {
            left: 24px;
            right: 24px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="onboarding-card">
        {/* Progress bar */}
        <div className="onboarding-progress-track">
          <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Step dots */}
        {step > 0 && step < 5 && (
          <div className="onboarding-step-dots">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`onboarding-step-dot ${
                  s === step ? 'onboarding-step-dot--active' :
                  s < step ? 'onboarding-step-dot--done' :
                  'onboarding-step-dot--upcoming'
                }`}
              />
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className={`onboarding-title ${step === 0 ? 'onboarding-title--welcome' : ''}`}>
          {step === 5 && (
            <div className="onboarding-complete-icon">
              <PartyIcon />
            </div>
          )}
          {step === 0 && (
            <div className="onboarding-welcome-icon">
              <RocketIcon />
            </div>
          )}
          {STEP_TITLES[step]}
        </h1>

        <p className="onboarding-subtitle">{STEP_SUBTITLES[step]}</p>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="onboarding-step-content">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <>
              <div className="onboarding-features">
                <div className="onboarding-feature">
                  <div className="onboarding-feature-icon onboarding-feature-icon--orange">
                    <HandshakeIcon />
                  </div>
                  <div>
                    <div className="onboarding-feature-title">Restaurant partnerships</div>
                    <div className="onboarding-feature-desc">Discover restaurants, send proposals, manage content approvals, and build long-term partnerships — all in one place.</div>
                  </div>
                </div>
                <div className="onboarding-feature">
                  <div className="onboarding-feature-icon onboarding-feature-icon--purple">
                    <ChartIcon />
                  </div>
                  <div>
                    <div className="onboarding-feature-title">Attribution + engagement</div>
                    <div className="onboarding-feature-desc">QR codes, deal redemptions, and social media metrics prove exactly how many customers your content drives.</div>
                  </div>
                </div>
                <div className="onboarding-feature">
                  <div className="onboarding-feature-icon onboarding-feature-icon--green">
                    <FileTextIcon />
                  </div>
                  <div>
                    <div className="onboarding-feature-title">Grow your business</div>
                    <div className="onboarding-feature-desc">Campaign pipeline, editorial calendar, content archive, and ROI reports to run your creator business like a pro.</div>
                  </div>
                </div>
              </div>
              <div className="onboarding-time-hint">Takes about 2 minutes to complete</div>
            </>
          )}

          {/* Step 1: Tell us about yourself */}
          {step === 1 && (
            <>
              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="displayName">Display Name *</label>
                <input
                  id="displayName"
                  type="text"
                  className="onboarding-input"
                  placeholder="Your name or brand"
                  value={formData.displayName}
                  onChange={handleDisplayNameChange}
                />
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  className="onboarding-textarea"
                  placeholder="Tell us about yourself and your content"
                  value={formData.bio}
                  onChange={handleBioChange}
                />
                <div className="onboarding-char-counter">{formData.bio.length} / 500</div>
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label">Creator Type</label>
                <div className="onboarding-type-grid">
                  {CREATOR_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`onboarding-type-card ${formData.creatorType === type.value ? 'onboarding-type-card--selected' : ''}`}
                      onClick={() => handleCreatorTypeChange(type.value)}
                    >
                      <span className="onboarding-type-emoji">{type.icon}</span>
                      <span className="onboarding-type-label">{type.label}</span>
                      <span className="onboarding-type-desc">{type.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Where do you create? */}
          {step === 2 && (
            <>
              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  className="onboarding-input"
                  placeholder="Washington, DC"
                  value={formData.city}
                  onChange={handleCityChange}
                />
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label">Neighborhoods</label>
                <div className="onboarding-chips">
                  {NEIGHBORHOODS.map((neighborhood) => (
                    <button
                      key={neighborhood}
                      className={`onboarding-chip ${formData.neighborhoods.includes(neighborhood) ? 'onboarding-chip--selected' : ''}`}
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
              <div className="onboarding-form-group">
                <label className="onboarding-label">Cuisine Preferences</label>
                <div className="onboarding-chips">
                  {CUISINES.map((cuisine) => (
                    <button
                      key={cuisine}
                      className={`onboarding-chip ${formData.cuisinePreferences.includes(cuisine) ? 'onboarding-chip--selected' : ''}`}
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
              <div className="onboarding-form-group">
                <label className="onboarding-label">Instagram</label>
                <div className="onboarding-social-row">
                  <span className="onboarding-social-prefix">@</span>
                  <input
                    type="text"
                    className="onboarding-social-input"
                    placeholder="username"
                    value={formData.socialLinks.instagram}
                    onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                  />
                </div>
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label">TikTok</label>
                <div className="onboarding-social-row">
                  <span className="onboarding-social-prefix">@</span>
                  <input
                    type="text"
                    className="onboarding-social-input"
                    placeholder="username"
                    value={formData.socialLinks.tiktok}
                    onChange={(e) => handleSocialLinkChange('tiktok', e.target.value)}
                  />
                </div>
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="youtube">YouTube (optional)</label>
                <input
                  id="youtube"
                  type="text"
                  className="onboarding-input"
                  placeholder="Channel URL or name"
                  value={formData.socialLinks.youtube}
                  onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                />
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="website">Website (optional)</label>
                <input
                  id="website"
                  type="text"
                  className="onboarding-input"
                  placeholder="https://example.com"
                  value={formData.socialLinks.website}
                  onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                />
              </div>

              <div className="onboarding-form-group">
                <label className="onboarding-label" htmlFor="followers">Follower Count</label>
                <select
                  id="followers"
                  className="onboarding-select"
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
            <div style={{ marginBottom: '8px' }}>
              {CHECKLIST_ITEMS.map((item) => {
                const isDone = completedChecklist.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`onboarding-checklist-item ${isDone ? 'onboarding-checklist-item--done' : ''}`}
                    onClick={() => handleChecklistItem(item.id, item.link)}
                  >
                    <div className={`onboarding-checklist-check ${isDone ? 'onboarding-checklist-check--done' : 'onboarding-checklist-check--pending'}`}>
                      {isDone && <CheckIcon />}
                    </div>
                    <div>
                      <div className="onboarding-checklist-label">{item.label}</div>
                      <div className="onboarding-checklist-desc">{item.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="onboarding-btn-group">
          {step === 0 && (
            <button
              className="onboarding-btn onboarding-btn--primary onboarding-btn--full"
              onClick={() => setStep(1)}
              type="button"
            >
              Get Started <ArrowRightIcon />
            </button>
          )}
          {step > 1 && step < 5 && (
            <button
              className="onboarding-btn onboarding-btn--secondary"
              onClick={handleBack}
              type="button"
            >
              Back
            </button>
          )}
          {step >= 1 && step < 5 && (
            <button
              className="onboarding-btn onboarding-btn--primary"
              style={step === 1 ? { marginLeft: 'auto' } : undefined}
              onClick={handleNext}
              disabled={isSubmitting}
              type="button"
            >
              {step === 4 ? (isSubmitting ? 'Setting up...' : 'Complete Setup') : 'Next'}
              {!isSubmitting && step < 4 && <ArrowRightIcon />}
            </button>
          )}
          {step === 5 && (
            <button
              className="onboarding-btn onboarding-btn--dark onboarding-btn--full"
              onClick={() => navigate('/app/dashboard')}
              type="button"
            >
              Go to Dashboard <ArrowRightIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
