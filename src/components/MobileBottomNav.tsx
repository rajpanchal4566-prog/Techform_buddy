'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function MobileBottomNav() {
  const pathname = usePathname() || '';
  const { status } = useSession();

  // Hide on authentication and public splash pages if not logged in
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isLandingPage = pathname === '/';

  if (isAuthPage || (isLandingPage && status !== 'authenticated')) {
    return null;
  }

  const isActive = (route: string) => {
    if (route === '/dashboard') return pathname === '/dashboard';
    if (route === '/forms/new') return pathname === '/forms/new';
    if (route === '/forms') return pathname === '/forms' || (pathname.startsWith('/forms/') && pathname !== '/forms/new');
    return pathname.startsWith(route);
  };

  return (
    <nav className="tfb-mobile-bottom-nav" aria-label="Mobile Navigation">
      <Link
        href="/dashboard"
        className={`tfb-mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Home</span>
      </Link>

      <Link
        href="/forms"
        className={`tfb-mobile-nav-item ${isActive('/forms') ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span>Forms</span>
      </Link>

      <Link
        href="/forms/new"
        className="tfb-mobile-nav-item tfb-mobile-nav-highlight"
        aria-label="Create New Form"
      >
        <div className="tfb-mobile-nav-add-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span>New</span>
      </Link>

      <Link
        href="/assistant"
        className={`tfb-mobile-nav-item ${isActive('/assistant') ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z" />
          <path d="M10 10h4" />
        </svg>
        <span>AI Guide</span>
      </Link>

      <Link
        href="/profile"
        className={`tfb-mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Profile</span>
      </Link>
    </nav>
  );
}
