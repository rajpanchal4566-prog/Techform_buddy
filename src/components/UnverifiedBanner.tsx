'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function UnverifiedBanner() {
  const { data: session } = useSession();

  // If user is logged in and email is not verified
  if (session?.user && (session.user as any).emailVerified === false) {
    const userEmail = session.user.email || '';
    return (
      <aside
        role="alert"
        aria-label="Email verification notice"
        style={{
          backgroundColor: '#991b1b',
          color: '#fee2e2',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '13px',
          fontWeight: 500,
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}
      >
        <span>
          ⚠️ <strong>Account unverified:</strong> You have limited access until you verify your email address.
        </span>
        <Link
          href={`/verify-email?email=${encodeURIComponent(userEmail)}`}
          style={{
            backgroundColor: '#fee2e2',
            color: '#7f1d1d',
            padding: '4px 10px',
            borderRadius: '4px',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '12px',
          }}
        >
          Verify Now
        </Link>
      </aside>
    );
  }

  return null;
}

