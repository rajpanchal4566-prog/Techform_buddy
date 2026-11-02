'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode (already installed PWA)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isDocStandalone = document.referrer.includes('android-app://');
      return isStandaloneMedia || isIosStandalone || isDocStandalone;
    };

    const standaloneNow = checkStandalone();
    setIsStandalone(standaloneNow);
    if (standaloneNow) return;

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // Check dismissal cookie/storage
    const dismissedUntil = localStorage.getItem('tfb_pwa_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }

    // Handle BeforeInstallPrompt for Chromium / Android / Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Auto-show banner if not dismissed
      const dismissed = localStorage.getItem('tfb_pwa_dismissed_until');
      if (!dismissed || Date.now() >= parseInt(dismissed, 10)) {
        setIsDismissed(false);
      }
    };

    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
      setIsDismissed(true);
      localStorage.setItem('tfb_pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIos) {
        setShowIosGuide(true);
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalledSuccessfully(true);
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowIosGuide(false);
    // Dismiss for 24 hours
    localStorage.setItem('tfb_pwa_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  // If already standalone or user dismissed, don't show the floating prompt
  if (isStandalone || installedSuccessfully || isDismissed) {
    return null;
  }

  // Only show if we have an install trigger (Chromium beforeinstallprompt or iOS device)
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <>
      <aside
        id="tfb-pwa-install-banner"
        className="tfb-pwa-banner"
        role="dialog"
        aria-label="Install TechForm Buddy App"
      >
        <div className="tfb-pwa-banner-inner">
          <div className="tfb-pwa-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6" />
              <path
                d="M8 12h16M8 16h12M8 20h14M22 10l4 4-4 4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="tfb-pwa-text">
            <div className="tfb-pwa-title">
              Install TechForm Buddy
              <span className="tfb-pwa-badge">Fast &amp; Offline</span>
            </div>
            <div className="tfb-pwa-desc">
              {isIos
                ? 'Add to your Home Screen for full-screen voice assistance & instant form filling.'
                : 'Install on your Phone or Desktop for native speed, offline access & voice commands.'}
            </div>
          </div>

          <div className="tfb-pwa-actions">
            {isIos ? (
              <button
                type="button"
                className="tfb-pwa-btn-primary"
                onClick={() => setShowIosGuide(true)}
              >
                How to Install
              </button>
            ) : (
              <button
                type="button"
                className="tfb-pwa-btn-primary"
                onClick={handleInstallClick}
                id="tfb-install-app-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Install App
              </button>
            )}

            <button
              type="button"
              className="tfb-pwa-btn-dismiss"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
            >
              Later
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Safari Install Guide Modal */}
      {showIosGuide && (
        <div className="tfb-ios-modal-backdrop" onClick={() => setShowIosGuide(false)}>
          <div className="tfb-ios-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tfb-ios-modal-header">
              <h3>Install on iPhone / iPad</h3>
              <button
                type="button"
                className="tfb-ios-close-btn"
                onClick={() => setShowIosGuide(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="tfb-ios-modal-body">
              <p className="tfb-ios-note">
                Install TechForm Buddy directly on your iOS home screen in 2 quick steps:
              </p>
              <div className="tfb-ios-step">
                <div className="tfb-ios-step-num">1</div>
                <div className="tfb-ios-step-text">
                  Tap the <strong>Share</strong> button in Safari&apos;s bottom toolbar:
                  <div className="tfb-ios-icon-example">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span>(Square with arrow pointing up)</span>
                  </div>
                </div>
              </div>
              <div className="tfb-ios-step">
                <div className="tfb-ios-step-num">2</div>
                <div className="tfb-ios-step-text">
                  Scroll down and tap <strong>Add to Home Screen</strong>:
                  <div className="tfb-ios-icon-example">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    <span>&quot;Add to Home Screen&quot;</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tfb-ios-modal-footer">
              <button
                type="button"
                className="tfb-pwa-btn-primary full-width"
                onClick={() => {
                  setShowIosGuide(false);
                  handleDismiss();
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
