import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/ApiService';

type CallbackStatus = 'loading' | 'success' | 'error';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

/**
 * SocialOAuthCallback — handles the browser redirect after a social platform
 * (Instagram / TikTok / YouTube) completes OAuth authorization.
 *
 * Flow:
 *  1. User clicks "Connect" on SocialConnectionsPanel
 *  2. Frontend redirects browser to the platform's auth page
 *  3. Platform redirects back to /app/social/callback/:platform?code=...&state=...
 *  4. This component reads the params and POSTs them to the backend to exchange
 *     the authorization code for tokens (authenticated via Cognito session)
 *  5. On success, navigate back to /app/social
 */
export default function SocialOAuthCallback() {
  const { platform = '' } = useParams<{ platform: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke
    if (calledRef.current) return;
    calledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      setErrorMessage(errorDescription || error);
      setStatus('error');
      return;
    }

    if (!code || !state) {
      setErrorMessage('Missing authorization code or state. Please try connecting again.');
      setStatus('error');
      return;
    }

    const labeledPlatform = PLATFORM_LABELS[platform] ?? platform;

    api.get(`/api/social/callback/${platform}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then((res) => {
        if (res.status === 'success') {
          setStatus('success');
          setTimeout(() => navigate('/app/social', { replace: true }), 1500);
        } else {
          setErrorMessage(res.error || `Failed to complete ${labeledPlatform} connection.`);
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorMessage(`Failed to complete ${labeledPlatform} connection. Please try again.`);
        setStatus('error');
      });
  }, [platform, navigate]);

  const label = PLATFORM_LABELS[platform] ?? platform;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bgPrimary)',
      padding: 'var(--space-6)',
    }}>
      <div style={{
        background: 'var(--color-bgCard)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        border: '1px solid var(--color-border)',
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-bgSecondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              fontSize: 28,
            }}>
              {platform === 'instagram' ? '📸' : platform === 'tiktok' ? '🎵' : '▶️'}
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-textPrimary)',
              marginBottom: 'var(--space-2)',
            }}>
              Connecting {label}…
            </h2>
            <p style={{ color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)' }}>
              Completing authorization. Please wait.
            </p>
            <div style={{
              marginTop: 'var(--space-6)',
              height: 4,
              borderRadius: 999,
              background: 'var(--color-bgSecondary)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: '40%',
                background: 'var(--color-accent)',
                borderRadius: 999,
                animation: 'slide 1.2s ease-in-out infinite',
              }} />
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              fontSize: 28,
            }}>
              ✓
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-textPrimary)',
              marginBottom: 'var(--space-2)',
            }}>
              {label} Connected
            </h2>
            <p style={{ color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)' }}>
              Redirecting you back…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              fontSize: 28,
            }}>
              ✕
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-textPrimary)',
              marginBottom: 'var(--space-2)',
            }}>
              Connection Failed
            </h2>
            <p style={{
              color: 'var(--color-textMuted)',
              fontSize: 'var(--font-sm)',
              marginBottom: 'var(--space-6)',
            }}>
              {errorMessage}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/app/social', { replace: true })}
            >
              Back to Social Accounts
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
