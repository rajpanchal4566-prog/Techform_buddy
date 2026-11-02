'use client';

import React, { useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar, { MobileMenuButton } from '@/components/Sidebar';
import ThemeSelector from '@/components/ThemeSelector';
import {
  AppShellProvider,
  HeaderActionsSlot,
  useHeaderTitleState,
  useMobileState,
  useMobileDispatch,
} from '@/components/AppShellContext';
import './dashboard/dashboard.css';

const DEFAULT_PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your citizen services and applications' },
  '/forms': { title: 'Forms', subtitle: 'Manage and fill your forms' },
  '/forms/new': { title: 'Create Form or Document', subtitle: 'Speak or type to generate a structured form' },
  '/applications': { title: 'My Applications Tracker', subtitle: 'Track status, next steps, and deadlines for official government & institutional forms' },
  '/tracker': { title: 'My Applications Tracker', subtitle: 'Track status, next steps, and deadlines for official government & institutional forms' },
  '/notifications': { title: 'Notifications & Alerts', subtitle: 'Real-time updates, deadline reminders, and form announcements' },
  '/form-watch': { title: 'Form Watch', subtitle: 'Monitor government and exam portals for new forms and notifications' },
  '/documents': { title: 'Document Understanding & Vault', subtitle: 'Upload notices, marksheets, certificates, or bank letters for plain-language summaries' },
  '/profile': { title: 'Citizen Profile', subtitle: 'Manage your verified personal details and documents' },
  '/settings': { title: 'Settings', subtitle: 'Manage account security, language preferences, and extension tokens' },
  '/browser': { title: 'Web Browser Sandbox', subtitle: 'Simulated browser environment for form testing' },
  '/assistant': { title: 'AI Assistant', subtitle: 'Voice and text multilingual guidance' },
  '/extension': { title: 'Chrome Extension', subtitle: 'Connect and manage your browser extension' },
  '/extension/connect': { title: 'Connect Extension', subtitle: 'Authorize TechForm Buddy extension' },
};

function AppShellHeaderTitle({ defaultTitle, defaultSubtitle }: { defaultTitle: string; defaultSubtitle?: string }) {
  const titleConfig = useHeaderTitleState();
  const title = titleConfig.title || defaultTitle;
  const subtitle = titleConfig.subtitle !== undefined ? titleConfig.subtitle : defaultSubtitle;

  return (
    <div style={{ minWidth: 0 }}>
      <h1
        id="app-header-title"
        style={{
          margin: 0,
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted" style={{ margin: '4px 0 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  // Test render counter to verify zero runaway re-render loops
  if (typeof window !== 'undefined') {
    (window as any).__SHELL_RENDER_COUNT__ = ((window as any).__SHELL_RENDER_COUNT__ || 0) + 1;
  }

  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const mobileOpen = useMobileState();
  const setMobileOpen = useMobileDispatch();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const defaultMeta = useMemo(() => {
    if (!pathname) return { title: 'TechForm Buddy' };
    if (DEFAULT_PAGE_META[pathname]) return DEFAULT_PAGE_META[pathname];
    for (const [route, meta] of Object.entries(DEFAULT_PAGE_META)) {
      if (pathname.startsWith(route)) return meta;
    }
    return { title: 'TechForm Buddy' };
  }, [pathname]);

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading TechForm Buddy...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="app-layout">
      {/* Universal Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Main Content Area */}
      <main className="main-content">
        <header className="main-header" id="app-main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <MobileMenuButton onClick={() => setMobileOpen(true)} />
            <AppShellHeaderTitle defaultTitle={defaultMeta.title} defaultSubtitle={defaultMeta.subtitle} />
          </div>
          {/* Isolated slot for page action buttons / portals */}
          <ThemeSelector />
          <HeaderActionsSlot />
        </header>

        <div className="app-page-wrapper">{children}</div>
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppShellProvider>
  );
}
