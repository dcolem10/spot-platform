import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

type AuthMode = 'signIn' | 'signUp' | 'confirm' | 'forgotPassword' | 'resetPassword';

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  code?: string;
  general?: string;
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signIn');
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
      const { signIn, getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
      await signIn({ username: email, password });
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const claims = session.tokens?.idToken?.payload;

      if (claims) {
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
      const { confirmSignUp, signIn, getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
      await confirmSignUp({ username: email, confirmationCode: code });

      // Auto sign in after confirmation
      if (password) {
        await signIn({ username: email, password });
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        const claims = session.tokens?.idToken?.payload;

        if (claims) {
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
    signUp: 'Join the creator-first restaurant platform',
    confirm: `We sent a code to ${email}`,
    forgotPassword: 'Enter your email to receive a reset code',
    resetPassword: `Enter the code sent to ${email}`,
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/" style={s.logoLink}>
          <div style={s.logoCircle}>S</div>
          <span style={s.logoText}>Spot</span>
        </Link>

        <h1 style={s.title}>{titles[mode]}</h1>
        <p style={s.subtitle}>{subtitles[mode]}</p>

        {message && <div style={s.successBanner}>{message}</div>}
        {errors.general && <div style={s.errorBanner}>{errors.general}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          {mode === 'signUp' && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                style={errors.name ? { ...s.input, ...s.inputError } : s.input}
                autoComplete="name"
              />
              {errors.name && <span style={s.fieldError}>{errors.name}</span>}
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'forgotPassword') && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={errors.email ? { ...s.input, ...s.inputError } : s.input}
                autoComplete="email"
              />
              {errors.email && <span style={s.fieldError}>{errors.email}</span>}
            </div>
          )}

          {(mode === 'signIn' || mode === 'signUp' || mode === 'resetPassword') && (
            <div style={s.fieldGroup}>
              <label style={s.label}>
                {mode === 'resetPassword' ? 'New Password *' : 'Password *'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signUp' ? 'Min 8 chars, upper, lower, number, symbol' : 'Your password'}
                style={errors.password ? { ...s.input, ...s.inputError } : s.input}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              />
              {errors.password && <span style={s.fieldError}>{errors.password}</span>}
            </div>
          )}

          {mode === 'signUp' && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                style={errors.confirmPassword ? { ...s.input, ...s.inputError } : s.input}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span style={s.fieldError}>{errors.confirmPassword}</span>}
            </div>
          )}

          {(mode === 'confirm' || mode === 'resetPassword') && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Verification Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                style={errors.code ? { ...s.input, ...s.inputError } : s.input}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              {errors.code && <span style={s.fieldError}>{errors.code}</span>}
            </div>
          )}

          <button type="submit" disabled={loading} style={loading ? { ...s.submitBtn, opacity: 0.7 } : s.submitBtn}>
            {loading ? 'Please wait...' : {
              signIn: 'Sign In',
              signUp: 'Create Account',
              confirm: 'Verify Email',
              forgotPassword: 'Send Reset Code',
              resetPassword: 'Reset Password',
            }[mode]}
          </button>
        </form>

        <div style={s.footer}>
          {mode === 'signIn' && (
            <>
              <button style={s.linkBtn} onClick={() => switchMode('forgotPassword')}>Forgot password?</button>
              <span style={s.footerDivider}>|</span>
              <button style={s.linkBtn} onClick={() => switchMode('signUp')}>Create an account</button>
            </>
          )}
          {mode === 'signUp' && (
            <>
              <span style={s.footerText}>Already have an account?</span>{' '}
              <button style={s.linkBtn} onClick={() => switchMode('signIn')}>Sign in</button>
            </>
          )}
          {mode === 'confirm' && (
            <button style={s.linkBtn} onClick={handleResendCode}>Resend verification code</button>
          )}
          {(mode === 'forgotPassword' || mode === 'resetPassword') && (
            <button style={s.linkBtn} onClick={() => switchMode('signIn')}>Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1B2838 0%, #2d3e50 100%)',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 16,
    padding: 40,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
    marginBottom: 32,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#E8673C',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1B2838',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1B2838',
    textAlign: 'center' as const,
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
  successBanner: {
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  errorBanner: {
    background: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1B2838',
  },
  input: {
    padding: '10px 14px',
    fontSize: 15,
    border: '1px solid #ddd',
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  inputError: {
    borderColor: '#dc3545',
  },
  fieldError: {
    fontSize: 12,
    color: '#dc3545',
  },
  submitBtn: {
    padding: '12px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: '#E8673C',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: 8,
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: 20,
    fontSize: 14,
  },
  footerText: {
    color: '#666',
  },
  footerDivider: {
    color: '#ccc',
    margin: '0 8px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#E8673C',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    padding: 0,
    textDecoration: 'underline',
  },
};
