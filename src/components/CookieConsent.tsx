import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieConsent.css';

const STORAGE_KEY = 'spot_cookie_consent';

export type CookieConsentChoice = 'all' | 'necessary';

/** Returns the stored consent choice, or null if not yet set. */
export function getCookieConsent(): CookieConsentChoice | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'all' || stored === 'necessary') return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return null;
}

/** Returns true if the user has consented to analytics cookies. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'all';
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no preference has been recorded yet
    if (getCookieConsent() === null) {
      // Small delay so it doesn't flash in before the page paints
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  function saveChoice(choice: CookieConsentChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Silently fail — consent still recorded in-memory for the session
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <div className="cookie-banner__content">
        <div className="cookie-banner__text">
          <span className="cookie-banner__icon" aria-hidden="true">🍪</span>
          <p>
            We use cookies to keep you signed in and improve your experience.{' '}
            <strong>Strictly necessary cookies</strong> (authentication, security) are always
            active.{' '}
            <strong>Analytics cookies</strong> help us understand how Spot is used.{' '}
            <Link to="/privacy" className="cookie-banner__link">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button
            className="cookie-banner__btn cookie-banner__btn--secondary"
            onClick={() => saveChoice('necessary')}
          >
            Necessary only
          </button>
          <button
            className="cookie-banner__btn cookie-banner__btn--primary"
            onClick={() => saveChoice('all')}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
