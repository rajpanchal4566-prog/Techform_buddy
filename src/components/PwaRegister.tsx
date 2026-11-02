'use client';

import { useEffect } from 'react';

/**
 * PwaRegister component
 * Registers the Service Worker (/sw.js) for PWA functionality,
 * offline caching, background notifications, and installability.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Check for updates periodically (every 1 hour)
        const intervalId = setInterval(() => {
          registration.update().catch((err) => {
            console.debug('Periodic SW update check failed:', err);
          });
        }, 60 * 60 * 1000);

        // When a new SW becomes installed, optionally prompt or activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('TechForm Buddy update available. Refreshing on next navigation.');
            }
          });
        });

        return () => clearInterval(intervalId);
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  return null;
}
