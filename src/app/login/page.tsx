'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { validatePassword, getPasswordStrength } from '@/lib/auth';
import BuddyMascot from '@/components/BuddyMascot';
import './auth.css';

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'login' | 'forgot_request' | 'forgot_reset'
  const [mode, setMode] = useState<'login' | 'forgot_request' | 'forgot_reset'>('login');

  // Login form state
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [aadhaarLoading, setAadhaarLoading] = useState(false);

  // Forgot Password state
  const [resetEmail, setResetEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Live password validation for reset
  const passwordValidation = useMemo(() => {
    if (mode !== 'forgot_reset') return { valid: false, message: '', errors: [] };
    return validatePassword(newPassword, resetEmail);
  }, [newPassword, resetEmail, mode]);

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(newPassword);
  }, [newPassword]);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Failed to initiate Google sign in. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleAadhaarClick = () => {
    setAadhaarLoading(true);
    setTimeout(() => {
      setError('Aadhaar OTP gateway is initializing for sandbox mode. Please sign in with email or Google.');
      setAadhaarLoading(false);
    }, 600);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: form.email.trim(),
        password: form.password,
      });

      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Invalid email or password.'
            : result.error
        );
        setLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
      setLoading(false);
    }
  };

  // Step 1: Request password reset code
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'Reset code sent to your email.');
        setResendCooldown(60);
        setMode('forgot_reset');
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 150);
      } else {
        setError(data.error || 'Failed to request reset code. Please try again.');
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // OTP inputs handling
  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...digits];
    if (!cleaned) {
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }
    newDigits[index] = cleaned.slice(-1);
    setDigits(newDigits);
    setError('');
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    const target = Math.min(pasted.length, 5);
    otpRefs.current[target]?.focus();
  };

  // Step 2: Confirm OTP & set new password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const otp = digits.join('');
    if (otp.length !== 6) {
      setError('Please enter the full 6-digit code sent to your email.');
      return;
    }

    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp,
          newPassword,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Your password has been reset successfully! You can now sign in.');
        setMode('login');
        setForm({ email: resetEmail.trim(), password: '' });
      } else {
        setError(data.error || 'Failed to reset password. Please check the code.');
        if (typeof data.attemptsLeft === 'number') {
          setAttemptsLeft(data.attemptsLeft);
        }
      }
    } catch {
      setError('Network error resetting password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Mascot & Brand Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <BuddyMascot size={54} state="idle" />
          </div>
          <h1>
            {mode === 'login'
              ? 'Welcome to TechForm Buddy'
              : mode === 'forgot_request'
              ? 'Reset Password'
              : 'Set New Password'}
          </h1>
          <p>
            {mode === 'login'
              ? 'Sign in to access your digital citizen services and AI planner'
              : mode === 'forgot_request'
              ? 'Enter your registered email to receive a 6-digit recovery code'
              : `Enter the 6-digit code sent to ${resetEmail} and your new password`}
          </p>
        </div>

        {/* Mode Tabs: [ Login ] [ Register ] */}
        {mode === 'login' && (
          <div className="auth-mode-tabs">
            <button type="button" className="auth-mode-tab active">
              Login
            </button>
            <Link href="/register" className="auth-mode-tab">
              Register
            </Link>
          </div>
        )}

        <div className="auth-form">
          {error && (
            <div className="auth-error" role="alert">
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <div>
                <div>{error}</div>
                {typeof attemptsLeft === 'number' && attemptsLeft > 0 && (
                  <div style={{ fontSize: '11.5px', marginTop: '3px', opacity: 0.9 }}>
                    Attempts remaining: {attemptsLeft}
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && !error && (
            <div className="auth-success">
              <span>✓</span> {successMsg}
            </div>
          )}

          {/* NORMAL LOGIN MODE */}
          {mode === 'login' && (
            <>
              <button
                type="button"
                className="btn-google"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.9273 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                    fill="#EA4335"
                  />
                </svg>
                {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
              </button>

              <button
                type="button"
                className="btn-google"
                style={{ marginTop: '2px' }}
                onClick={handleAadhaarClick}
                disabled={aadhaarLoading || loading}
              >
                <span style={{ fontSize: '18px' }}>🪪</span>
                {aadhaarLoading ? 'Verifying Gateway...' : 'Continue with Aadhaar'}
              </button>

              <div className="auth-divider">
                <span>or sign in with email</span>
              </div>

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="login-email">
                    Email address
                  </label>
                  <div className="input-with-icon">
                    <svg className="input-icon" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M3 5l6 4 6-4M3 13h12V5H3v8z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      id="login-email"
                      type="email"
                      className="input"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="login-password">
                    Password
                  </label>
                  <div className="input-with-icon">
                    <svg className="input-icon" viewBox="0 0 18 18" fill="none">
                      <rect x="4" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 8V6a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="input"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="pwd-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="auth-options-row">
                  <label className="auth-remember-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="auth-forgot-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => {
                      setResetEmail(form.email);
                      setError('');
                      setSuccessMsg('');
                      setMode('forgot_request');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In →'}
                </button>

                <div className="auth-trust-badge">
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.464 9.99 1.579 2.065 3.48 3.018 4.096 3.263a.5.5 0 0 0 .398 0c.616-.245 2.517-1.198 4.096-3.263 1.677-2.195 3.06-5.513 2.464-9.99a1.54 1.54 0 0 0-1.044-1.263 62.7 62.7 0 0 0-2.887-.87C9.843.266 8.69 0 8 0zm2.146 5.854a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 9.043l3.146-3.189z" />
                  </svg>
                  <span>Protected with 256-bit encryption • Citizen Security</span>
                </div>
              </form>
            </>
          )}

          {/* FORGOT PASSWORD STEP 1: REQUEST CODE */}
          {mode === 'forgot_request' && (
            <form onSubmit={handleRequestResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="forgot-email">
                  Registered Email Address
                </label>
                <div className="input-with-icon">
                  <svg className="input-icon" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M3 5l6 4 6-4M3 13h12V5H3v8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input
                    id="forgot-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading || resendCooldown > 0}
              >
                {loading
                  ? 'Sending code...'
                  : resendCooldown > 0
                  ? `Wait ${resendCooldown}s`
                  : 'Send Reset Code to Email'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setMode('login');
                }}
              >
                ← Back to Sign in
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD STEP 2: VERIFY OTP & SET NEW PASSWORD */}
          {mode === 'forgot_reset' && (
            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label">6-Digit Reset Code (from email)</label>
                <div className="otp-container" dir="ltr">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`reset-otp-${idx}`}
                      ref={(el) => {
                        otpRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className="otp-digit-input"
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      disabled={loading}
                      aria-label={`Reset Code Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="reset-new-password">
                  New Password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  className="input"
                  placeholder="Min 8 chars with upper, lower, number, symbol"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="password-strength-container">
                    <div className="strength-bar-track">
                      <div className={`strength-bar-segment ${passwordStrength.score >= 1 ? 'active-weak' : ''}`} />
                      <div className={`strength-bar-segment ${passwordStrength.score >= 2 ? 'active-fair' : ''}`} />
                      <div className={`strength-bar-segment ${passwordStrength.score >= 3 ? 'active-strong' : ''}`} />
                    </div>
                    <div className="strength-label-text">
                      Strength: <strong>{passwordStrength.label}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="reset-confirm-password">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  className="input"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading || digits.join('').length !== 6 || !newPassword}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleRequestResetCode}
                  disabled={loading || resendCooldown > 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? '#a5a79b' : '#590907',
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMsg('');
                    setMode('login');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#746a63',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ← Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="auth-footer">
          <p>
            Don&apos;t have an account? <Link href="/register">Create one for free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
