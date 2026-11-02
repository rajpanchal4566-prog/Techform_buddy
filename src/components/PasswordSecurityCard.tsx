'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { validatePassword, getPasswordStrength } from '@/lib/auth';
import '../app/login/auth.css';

interface PasswordSecurityCardProps {
  userEmail?: string;
}

export default function PasswordSecurityCard({ userEmail }: PasswordSecurityCardProps) {
  const { data: session } = useSession();
  const email = userEmail || session?.user?.email || '';

  // Mode: 'direct' (via current password) or 'email_otp' (forgot current password)
  const [resetViaEmail, setResetViaEmail] = useState(false);

  // Direct Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [directNewPassword, setDirectNewPassword] = useState('');
  const [directConfirmPassword, setDirectConfirmPassword] = useState('');
  const [directLoading, setDirectLoading] = useState(false);
  const [directMessage, setDirectMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpNewPassword, setOtpNewPassword] = useState('');
  const [otpConfirmPassword, setOtpConfirmPassword] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpMessage, setOtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Live strength meters
  const directStrength = useMemo(() => getPasswordStrength(directNewPassword), [directNewPassword]);
  const directValidation = useMemo(
    () => validatePassword(directNewPassword, email),
    [directNewPassword, email]
  );

  const otpStrength = useMemo(() => getPasswordStrength(otpNewPassword), [otpNewPassword]);
  const otpValidation = useMemo(
    () => validatePassword(otpNewPassword, email),
    [otpNewPassword, email]
  );

  // Handle direct password change
  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectMessage(null);

    if (!directValidation.valid) {
      setDirectMessage({ type: 'error', text: directValidation.message });
      return;
    }

    if (directNewPassword !== directConfirmPassword) {
      setDirectMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setDirectLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword: directNewPassword,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setDirectMessage({ type: 'success', text: data.message || 'Password updated successfully!' });
        setCurrentPassword('');
        setDirectNewPassword('');
        setDirectConfirmPassword('');
      } else {
        setDirectMessage({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch {
      setDirectMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setDirectLoading(false);
    }
  };

  // Handle Send OTP to email
  const handleSendOtp = async () => {
    if (!email) {
      setOtpMessage({ type: 'error', text: 'No registered email found.' });
      return;
    }

    setOtpLoading(true);
    setOtpMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setOtpSent(true);
        setResendCooldown(60);
        setOtpMessage({
          type: 'success',
          text: `A 6-digit verification code has been sent in English to ${email}.`,
        });
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 150);
      } else {
        setOtpMessage({ type: 'error', text: data.error || 'Failed to send verification code.' });
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      }
    } catch {
      setOtpMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setOtpLoading(false);
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
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      otpRefs.current[index - 1]?.focus();
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

  // Submit Reset via Email
  const handleOtpResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpMessage(null);

    const otp = digits.join('');
    if (otp.length !== 6) {
      setOtpMessage({ type: 'error', text: 'Please enter all 6 digits of the code sent to your email.' });
      return;
    }

    if (!otpValidation.valid) {
      setOtpMessage({ type: 'error', text: otpValidation.message });
      return;
    }

    if (otpNewPassword !== otpConfirmPassword) {
      setOtpMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          newPassword: otpNewPassword,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setOtpMessage({ type: 'success', text: 'Password reset successfully!' });
        setOtpNewPassword('');
        setOtpConfirmPassword('');
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          setResetViaEmail(false);
          setOtpSent(false);
          setDirectMessage({ type: 'success', text: 'Password reset successfully via email!' });
        }, 1500);
      } else {
        setOtpMessage({ type: 'error', text: data.error || 'Failed to reset password.' });
      }
    } catch {
      setOtpMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="settings-card card animate-fadeIn" style={{ marginTop: 'var(--space-lg)' }}>
      <div className="settings-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔑</span>
          <h2>Password & Security</h2>
        </div>
        <p className="text-sm text-muted">
          Manage your account password using your existing password or via email verification
        </p>
      </div>

      {!resetViaEmail ? (
        /* OPTION 1: CHANGE PASSWORD USING EXISTING PASSWORD */
        <form onSubmit={handleDirectSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {directMessage && (
            <div
              style={{
                fontSize: '13px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: directMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: directMessage.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${directMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
              }}
            >
              {directMessage.text}
            </div>
          )}

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" htmlFor="current-pass-input" style={{ margin: 0 }}>
                Existing (Current) Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetViaEmail(true);
                  setDirectMessage(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Forgot existing password? Change through email
              </button>
            </div>
            <input
              id="current-pass-input"
              type="password"
              className="input"
              style={{ marginTop: '6px' }}
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="new-pass-input">
              New Password
            </label>
            <input
              id="new-pass-input"
              type="password"
              className="input"
              placeholder="Min 8 characters with upper, lower, number, symbol"
              value={directNewPassword}
              onChange={(e) => setDirectNewPassword(e.target.value)}
              required
            />

            {directNewPassword && (
              <div style={{ marginTop: '6px' }}>
                <div className="strength-bar-track">
                  <div className={`strength-bar-fill score-${directStrength.score}`} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Strength: <strong>{directStrength.label}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="confirm-pass-input">
              Confirm New Password
            </label>
            <input
              id="confirm-pass-input"
              type="password"
              className="input"
              placeholder="Re-enter your new password"
              value={directConfirmPassword}
              onChange={(e) => setDirectConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={directLoading || !directNewPassword || !currentPassword}
            >
              {directLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      ) : (
        /* OPTION 2: RESET PASSWORD VIA EMAIL OTP */
        <div style={{ marginTop: '16px', background: 'rgba(59, 130, 246, 0.04)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px', color: '#1e40af' }}>
              📧 Change Password via Email Verification
            </strong>
            <button
              type="button"
              onClick={() => {
                setResetViaEmail(false);
                setOtpMessage(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              ← Back to existing password
            </button>
          </div>

          {otpMessage && (
            <div
              style={{
                fontSize: '13px',
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '14px',
                background: otpMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: otpMessage.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${otpMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
              }}
            >
              {otpMessage.text}
            </div>
          )}

          {!otpSent ? (
            <div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
                We will send a 6-digit password reset code to your registered email: <strong>{email}</strong>
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendOtp}
                disabled={otpLoading || resendCooldown > 0}
              >
                {otpLoading
                  ? 'Sending code...'
                  : resendCooldown > 0
                  ? `Wait ${resendCooldown}s`
                  : 'Send Reset Code to Email'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleOtpResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label">6-Digit Code (from your Gmail)</label>
                <div className="otp-inputs-grid" dir="ltr" style={{ margin: '6px 0 10px' }}>
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`profile-otp-${idx}`}
                      ref={(el) => {
                        otpRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`otp-digit-box ${digit ? 'filled' : ''}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      disabled={otpLoading}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="otp-new-pass">
                  New Password
                </label>
                <input
                  id="otp-new-pass"
                  type="password"
                  className="input"
                  placeholder="Min 8 characters with upper, lower, number, symbol"
                  value={otpNewPassword}
                  onChange={(e) => setOtpNewPassword(e.target.value)}
                  required
                />
                {otpNewPassword && (
                  <div style={{ marginTop: '6px' }}>
                    <div className="strength-bar-track">
                      <div className={`strength-bar-fill score-${otpStrength.score}`} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Strength: <strong>{otpStrength.label}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="otp-confirm-pass">
                  Confirm New Password
                </label>
                <input
                  id="otp-confirm-pass"
                  type="password"
                  className="input"
                  placeholder="Re-enter your new password"
                  value={otpConfirmPassword}
                  onChange={(e) => setOtpConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || resendCooldown > 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? 'var(--color-text-tertiary)' : '#3b82f6',
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={otpLoading || digits.join('').length !== 6 || !otpNewPassword}
                >
                  {otpLoading ? 'Resetting...' : 'Reset Password via Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

