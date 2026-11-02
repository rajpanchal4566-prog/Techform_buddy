/**
 * Client-safe email validation, typo suggestions, and disposable domain detection.
 * Does not import any Node.js built-ins so it bundles cleanly in client components.
 */

// Common domain typo corrections
export const DOMAIN_TYPO_MAP: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaol.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlool.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yaoo.com': 'yahoo.com',
  'yah00.com': 'yahoo.com',
  'yaho.co.in': 'yahoo.co.in',
  'rediffmal.com': 'rediffmail.com',
  'redifmail.com': 'rediffmail.com',
  'reddiffmail.com': 'rediffmail.com',
};

// Known disposable email domains
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'tempmail.com',
  'throwaway.email', 'temp-mail.org', 'yopmail.com', 'yopmail.fr',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'dispostable.com',
  'trashmail.com', 'trashmail.net', 'trashmail.me', 'tempail.com',
  'fakeinbox.com', 'mailnesia.com', 'maildrop.cc', 'discard.email',
  'getnada.com', 'tempr.email', 'dropmail.me', '10minutemail.com',
  'mohmal.com', 'mailcatch.com', 'tempinbox.com', 'tempmailaddress.com',
  'burnermail.io', 'inboxkitten.com', 'emailondeck.com', 'mailsac.com',
  'harakirimail.com', 'spamgourmet.com', 'mytemp.email', 'throwawaymail.com',
  'mintemail.com', 'tempmailo.com', 'emailfake.com',
]);

/**
 * Basic email format validation (RFC 5322 simplified).
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!re.test(trimmed)) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  return true;
}

/**
 * Suggest a correction for common email domain typos.
 * Returns null if no suggestion, or the corrected email.
 */
export function suggestEmailCorrection(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (DOMAIN_TYPO_MAP[domain]) {
    return `${local}@${DOMAIN_TYPO_MAP[domain]}`;
  }
  return null;
}

/**
 * Check if a domain is a known disposable email provider.
 */
export function isDisposableDomain(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  return DISPOSABLE_DOMAINS.has(parts[1]);
}
