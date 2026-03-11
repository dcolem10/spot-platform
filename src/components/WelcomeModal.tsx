import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type Step = 1 | 2 | 3;

export function WelcomeModal() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isDismissed, setIsDismissed] = useState(true);

  // Check localStorage on mount to see if user has already seen the modal
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('spot-welcome-dismissed');
    if (!hasSeenWelcome) {
      setIsDismissed(false);
    }
  }, []);

  const dismissModal = () => {
    setIsDismissed(true);
    localStorage.setItem('spot-welcome-dismissed', 'true');
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleNavigate = (path: string) => {
    dismissModal();
    navigate(path);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        animation: 'fadeIn 0.3s ease',
        backdropFilter: 'blur(4px)',
      }}
      onClick={dismissModal}
    >
      {/* Modal Card */}
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: 'var(--color-bgSecondary)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-xl)',
          animation: 'fadeSlideUp 0.4s ease',
          margin: '0 var(--space-4)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              animation: 'fadeSlideIn 0.3s ease',
            }}
          >
            <div
              style={{
                fontSize: '3.5rem',
                lineHeight: 1,
                marginBottom: 'var(--space-6)',
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              👋
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: 'var(--color-textPrimary)',
                marginBottom: 'var(--space-3)',
                letterSpacing: '-0.02em',
              }}
            >
              Welcome to Spot!
            </h2>
            <p
              style={{
                fontSize: 'var(--font-sm)',
                color: 'var(--color-textSecondary)',
                lineHeight: 1.6,
                marginBottom: 'var(--space-8)',
              }}
            >
              Spot connects food creators with restaurants through attribution — proving your content drives real traffic.
            </p>
          </div>
        )}

        {/* Step 2: How It Works */}
        {currentStep === 2 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeSlideIn 0.3s ease',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: 'var(--color-textPrimary)',
                marginBottom: 'var(--space-6)',
                textAlign: 'center',
                letterSpacing: '-0.02em',
              }}
            >
              How It Works
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Card 1 */}
              <div
                style={{
                  backgroundColor: 'var(--color-bgElevated)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-border)',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgHover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgElevated)';
                }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    marginBottom: 'var(--space-2)',
                    lineHeight: 1,
                  }}
                >
                  🔍
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--color-textPrimary)',
                    marginBottom: 'var(--space-1)',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  Discover
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-textMuted)',
                    lineHeight: 1.5,
                  }}
                >
                  Find restaurants that match your style
                </div>
              </div>

              {/* Card 2 */}
              <div
                style={{
                  backgroundColor: 'var(--color-bgElevated)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-border)',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgHover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgElevated)';
                }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    marginBottom: 'var(--space-2)',
                    lineHeight: 1,
                  }}
                >
                  🎥
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--color-textPrimary)',
                    marginBottom: 'var(--space-1)',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  Create
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-textMuted)',
                    lineHeight: 1.5,
                  }}
                >
                  Visit, create content, and set up tracking
                </div>
              </div>

              {/* Card 3 */}
              <div
                style={{
                  backgroundColor: 'var(--color-bgElevated)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                  border: '1px solid var(--color-border)',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgHover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bgElevated)';
                }}
              >
                <div
                  style={{
                    fontSize: '1.75rem',
                    marginBottom: 'var(--space-2)',
                    lineHeight: 1,
                  }}
                >
                  📊
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--color-textPrimary)',
                    marginBottom: 'var(--space-1)',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  Measure
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-textMuted)',
                    lineHeight: 1.5,
                  }}
                >
                  See exactly how many people you send
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Get Started */}
        {currentStep === 3 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              animation: 'fadeSlideIn 0.3s ease',
            }}
          >
            <div
              style={{
                fontSize: '3.5rem',
                lineHeight: 1,
                marginBottom: 'var(--space-6)',
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              🚀
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-2xl)',
                fontWeight: 700,
                color: 'var(--color-textPrimary)',
                marginBottom: 'var(--space-3)',
                letterSpacing: '-0.02em',
              }}
            >
              You're all set!
            </h2>
            <p
              style={{
                fontSize: 'var(--font-sm)',
                color: 'var(--color-textSecondary)',
                lineHeight: 1.6,
                marginBottom: 'var(--space-8)',
              }}
            >
              Start by exploring restaurants in your city, or jump straight to creating a campaign.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                width: '100%',
              }}
            >
              <button
                className="btn btn-primary btn-lg"
                onClick={() => handleNavigate('/app/restaurants')}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                }}
              >
                Explore Restaurants
              </button>
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => handleNavigate('/app/campaigns')}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                Create a Campaign
              </button>
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        {currentStep !== 3 && (
          <div
            style={{
              marginTop: 'var(--space-8)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Progress Dots */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      step === currentStep ? 'var(--color-accent)' : 'var(--color-border)',
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setCurrentStep(step as Step)}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={dismissModal}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-textMuted)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-textSecondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-textMuted)';
                }}
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.25)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accentHover)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(249, 115, 22, 0.35)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accent)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(249, 115, 22, 0.25)';
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
