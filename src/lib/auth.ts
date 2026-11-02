import bcryptjs from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcryptjs.compare(password, hashedPassword);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * PASSWORD RULES (Requirement 3):
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one symbol (!@#$%^&*()_+-=[]{}|;':",.<>?/`~)
 * - NOT a very common password
 * - NOT containing the email local part
 *
 * Returns all violations (not just the first one).
 */

// Very common passwords — a compact subset; extend as needed
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'abc12345', 'abcd1234', 'iloveyou', 'letmein1',
  'welcome1', 'sunshine1', 'princess1', 'admin123', 'master123', 'login123',
  'monkey123', 'dragon123', 'baseball1', 'football1', 'shadow12', 'trustno1',
  'charlie1', 'michael1', 'superman1', 'batman123', 'mustang1', 'access14',
  'hello123', 'whatever1', 'pass1234', 'test1234', 'changeme', 'p@ssw0rd',
  'p@ssword1', 'passw0rd', 'pass@123', 'admin@123', 'welcome@1', 'india@123',
  'user1234', 'abcdefgh', 'qwerty12', 'asdfghjk', 'zxcvbnm1', '!@#$%^&*',
  'password!', 'Pa$$w0rd', 'Password1', 'Password1!', 'Qwerty@1', 'India@123',
]);

export function validatePassword(
  password: string,
  email?: string
): { valid: boolean; message: string; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.)');
  }

  // Check against common passwords (case-insensitive + common leet-speak substitutions)
  const leetNormalized = password
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/!/g, 'i');

  if (
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    COMMON_PASSWORDS.has(leetNormalized)
  ) {
    errors.push('This password is too common and easy to guess. Please choose a stronger password.');
  }

  // Check if password contains the email local part (before @)
  if (email) {
    const localPart = email.split('@')[0]?.toLowerCase();
    if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      errors.push('Password must not contain your email username');
    }
  }

  return {
    valid: errors.length === 0,
    message: errors[0] || '',
    errors,
  };
}

/**
 * Password strength meter: returns 0–4 score.
 * 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong
 */
export function getPasswordStrength(password: string): {
  score: number;
  label: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
} {
  let score = 0;
  if (!password) return { score: 0, label: 'very-weak' };

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  // Deduct for common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) score = Math.min(score, 1);

  const capped = Math.min(score, 4);
  const labels: Record<number, 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong'> = {
    0: 'very-weak',
    1: 'weak',
    2: 'fair',
    3: 'strong',
    4: 'very-strong',
  };
  return { score: capped, label: labels[capped] };
}
