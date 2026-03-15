import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './AuthPage.css';

type AuthMode = 'signIn' | 'signUp' | 'confirm' | 'forgotPassword' | 'resetPassword';

const VALID_MODES: AuthMode[] = ['signIn', 'signUp', 'confirm', 'forgotPassword', 'resetPassword'];

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  code?: string;
  general?: string;
}

export default function AuthPage() {
  // Support ?mode=signUp from "Get Started" links
  const [searchParams] = useSearchParams();
  const initialMode = VALID_MODES.includes(searchParams.get('mode') as AuthMode)
    ? (searchParams.get('mode') as AuthMode)
    : 'signIn';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Valid email required';
    }

    if (mode === 'signUp') {
      if (!name.trim() || name.trim().length < 2) {
        errs.name = 'Name required (at least 2 characters)';
      }
      if (password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      } else if (!/[A-Z]/.test(password)) {
        errs.password = 'Must include an uppercase letter';
      } else if (!/[a-z]/.test(password)) {
        errs.password = 'Must include a lowercase letter';
      } else if (!/[0-9]/.test(password)) {
        errs.password = 'Must include a number';
      } else if (!/[^A-Za-z0-9]/.test(password)) {
        errs.password = 'Must include a special character';
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match';
      }
    }

    if (mode === 'signIn' && !password) {
      errs.password = 'Password required';
    }

    if (mode === 'confirm' && (!code.trim() || code.length < 4)) {
      errs.code = 'Enter the verification code from your email';
    }

    if (mode === 'resetPassword' && (!code.trim() || code.length < 4)) {
      errs.code = 'Enter the verification code from your email';
    }

    if (mode === 'resetPassword') {
      if (password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async () => {
    try {
      const { signIn, signOut, getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');

      // Clear any stale Cognito session before attempting sign-in
      try { await signOut(); } catch { /* no session to clear */ }

      await signIn({ username: email, password });
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const claims = session.tokens?.idToken?.payload;

      if (claims) {
        setDemoMode(false);
        setAuth({
          userId: user.userId,
          email: (claims['email'] as string) ?? email,
          name: (claims['name'] as string) ?? email,
          role: (claims['custom:role'] as 'creator' | 'partner' | 'audience') ?? 'creator',
          groups: (claims['cognito:groups'] as string[]) ?? [],
          orgId: (claims['custom:orgId'] as string) ?? undefined,
        });
      }

      navigate('/app/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'UserNotConfirmedException') {
        setMessage('Please confirm your account first.');
        setMode('confirm');
      } else if (error.name === 'NotAuthorizedException') {
        setErrors({ general: 'Incorrect email or password' });
      } else {
        setErrors({ general: error.message || 'Sign-in failed' });
      }
    }
  };

  const handleSignUp = async () => {
    try {
      const { signUp } = await import('aws-amplify/auth');
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name: name.trim(),
          },
        },
      });

      setMessage('Check your email for a verification code.');
      setMode('confirm');
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'UsernameExistsException') {
        setErrors({ general: 'An account with this email already exists. Try signing in.' });
      } else {
        setErrors({ general: error.message || 'Sign-up failed' });
      }
    }
  };

  const handleConfirm = async () => {
    try {
      const { confirmSignUp, signIn, signOut, getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
      await confirmSignUp({ username: email, confirmationCode: code });

      // Auto sign in after confirmation
      if (password) {
        try { await signOut(); } catch { /* no session to clear */ }
        await signIn({ username: email, password });
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        const claims = session.tokens?.idToken?.payload;

        if (claims) {
          setDemoMode(false);
          setAuth({
            userId: user.userId,
            email: (claims['email'] as string) ?? email,
            name: (claims['name'] as string) ?? name,
            role: 'creator',
            groups: [],
          });
        }

        navigate('/app/dashboard', { replace: true });
      } else {
        setMessage('Account confirmed! You can now sign in.');
        setMode('signIn');
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'CodeMismatchException') {
        setErrors({ code: 'Invalid verification code' });
      } else if (error.name === 'ExpiredCodeException') {
        setErrors({ code: 'Code expired. Request a new one.' });
      } else {
        setErrors({ general: error.message || 'Confirmation failed' });
      }
    }
  };

  const handleForgotPassword = async () => {
    try {
      const { resetPassword } = await import('aws-amplify/auth');
      await resetPassword({ username: email });
      setMessage('Check your email for a password reset code.');
      setMode('resetPassword');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrors({ general: error.message || 'Failed to send reset code' });
    }
  };

  const handleResetPassword = async () => {
    try {
      const { confirmResetPassword } = await import('aws-amplify/auth');
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword: password });
      setMessage('Password reset! You can now sign in.');
      setPassword('');
      setCode('');
      setMode('signIn');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrors({ general: error.message || 'Password reset failed' });
    }
  };

  const handleResendCode = async () => {
    try {
      const { resendSignUpCode } = await import('aws-amplify/auth');
      await resendSignUpCode({ username: email });
      setMessage('A new code has been sent to your email.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrors({ general: error.message || 'Failed to resend code' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage('');

    if (!validate()) return;

    setLoading(true);
    try {
      switch (mode) {
        case 'signIn': await handleSignIn(); break;
        case 'signUp': await handleSignUp(); break;
        case 'confirm': await handleConfirm(); break;
        case 'forgotPassword': await handleForgotPassword(); break;
        case 'resetPassword': await handleResetPassword(); break;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    setDemoMode(true);
    setAuth({
      userId: 'demo-user',
      email: 'demo@spot.app',
      name: 'Demo Creator',
      role: 'creator',
      groups: ['creator'],
    });
    navigate('/app/dashboard', { replace: true });
  };

  const switchMode = (newMode: AuthMode) => {
    setErrors({});
    setMessage('');
    setMode(newMode);
  };

  const titles: Record<AuthMode, string> = {
    signIn: 'Welcome back',
    signUp: 'Create your account',
    confirm: 'Verify your email',
    forgotPassword: 'Reset password',
    resetPassword: 'Set new password',
  };

  const subtitles: Record<AuthMode, string> = {
    signIn: 'Sign in to your Spot Platform account',
    signUp: 'Get paid for food content. Prove your ROI. Grow your income.',
    confirm: `We sent a code to ${email}`,
    forgotPassword: 'Enter your email to receive a reset code',
    resetPassword: `Enter the code sent to ${email}`,
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-circle">S</div>
          <span className="auth-logo-text">Spot</span>
        </Link>

        <h1 className="auth-title">{titles[mode]}</h1>
        <p className="auth-subtitle">{subtitles[mode]}</p>

        {message && <div className="auth-banner auth-banner--success">{message}</div>}
        {errors.general && <div className="auth-banner auth-banner--error">{errors.general}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signUp' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={`auth-input${errors.name ? ' auth-input--error' : ''}`}
                autoComplete="name"
              />
              {errors.name && <span className="auth-field-error">{errors.name}</span>}
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'forgotPassword') && (
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`auth-input${errors.email ? ' auth-input--error' : ''}`}
                autoComplete="email"
              />
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'resetPassword') && (
            <div className="auth-field">
              <label className="auth-label">
                {mode === 'resetPassword' ? 'New Password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signUp' ? 'Min 8 chars, upper, lower, number, symbol' : 'Your password'}
                className={`auth-input${errors.password ? ' auth-input--error' : ''}`}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              />
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </div>
          )}

          {mode === 'signUp' && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`auth-input${errors.confirmPassword ? ' auth-input--error' : ''}`}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span className="auth-field-error">{errors.confirmPassword}</span>}
            </div>
          )}

          {(mode === 'confirm' || mode === 'resetPassword') && (
            <div className="auth-field">
              <label className="auth-label">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className={`auth-input${errors.code ? ' auth-input--error' : ''}`}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              {errors.code && <span className="auth-field-error">{errors.code}</span>}
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? 'Please wait...' : {
              signIn: 'Sign In',
              signUp: 'Create Account',
              confirm: 'Verify Email',
              forgotPassword: 'Send Reset Code',
              resetPassword: 'Reset Password',
            }[mode]}
          </button>
        </form>

        {(mode === 'signIn' || mode === 'signUp') && (
          <>
            <div className="auth-divider">
              <span className="auth-divider-text">or</span>
            </div>
            <button className="auth-demo-btn" onClick={handleDemoMode}>
              Try Demo Mode — No Account Needed
            </button>
          </>
        )}

        <div className="auth-footer">
          {mode === 'signIn' && (
            <>
              <button className="auth-link-btn" onClick={() => switchMode('forgotPassword')}>Forgot password?</button>
              <span className="auth-footer-divider">|</span>
              <button className="auth-link-btn" onClick={() => switchMode('signUp')}>Create an account</button>
            </>
          )}
          {mode === 'signUp' && (
            <>
              <span className="auth-footer-text">Already have an account?</span>
              <button className="auth-link-btn" onClick={() => switchMode('signIn')}>Sign in</button>
            </>
          )}
          {mode === 'confirm' && (
            <button className="auth-link-btn" onClick={handleResendCode}>Resend verification code</button>
          )}
          {(mode === 'forgotPassword' || mode === 'resetPassword') && (
            <button className="auth-link-btn" onClick={() => switchMode('signIn')}>Back to sign in</button>
          )}
        </div>

        {/* Legal links */}
        <div className="auth-legal">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="auth-legal-link">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="auth-legal-link">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
