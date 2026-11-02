export * from './types';
export * from './readForm';
export * from './applyFill';
export * from './observer';
export * from './bridge';
export * from './analyzer';
export * from './overlay';

import {
  readForm,
  generateSelector,
  isSensitiveField,
  isLanguageControl,
  isSearchControl,
  isNavigationOrHeaderFooterControl,
  isRealForm,
} from './readForm';
import { applyFill, clearHighlights, normalizeDateValue } from './applyFill';
import { FormChangeObserver, unpatchHistory } from './observer';
import { createBridge, ChromeExtensionBridge, AndroidInAppBrowserBridge, MockBridge } from './bridge';
import { analyzeField, analyzeForm, generateSafeMapping, detectSensitiveField } from './analyzer';
import { GuideOverlay, OverlayOptions } from './overlay';

let activeOverlayInstance: GuideOverlay | null = null;

/**
 * Convenience method to launch the Guide Overlay on any web page.
 */
export function mountOverlay(options: OverlayOptions = {}): GuideOverlay {
  if (activeOverlayInstance) {
    activeOverlayInstance.destroy();
  }
  activeOverlayInstance = new GuideOverlay(options);
  activeOverlayInstance.mount();
  return activeOverlayInstance;
}

/**
 * Idempotent teardown method for the entire form-core runtime.
 * Disconnects observers, unpatches history, destroys overlay, clears highlights,
 * and resets window.__tfbLoaded.
 */
export function destroy(): void {
  if (typeof window === 'undefined') return;

  // 1. Destroy overlay
  if (activeOverlayInstance) {
    activeOverlayInstance.destroy();
    activeOverlayInstance = null;
  }
  const existingOverlayHost = document.getElementById('tfb-guide-overlay-host');
  if (existingOverlayHost) {
    existingOverlayHost.remove();
  }

  // 2. Disconnect observers and restore history
  FormChangeObserver.disconnectAll();

  // 3. Clear highlights
  clearHighlights();

  // 4. Reset injection flags
  (window as any).__tfbLoaded = false;
}

export const TechFormBuddyCore = {
  version: '1.0.0',
  readForm,
  generateSelector,
  isSensitiveField,
  applyFill,
  clearHighlights,
  normalizeDateValue,
  FormChangeObserver,
  createBridge,
  ChromeExtensionBridge,
  AndroidInAppBrowserBridge,
  MockBridge,
  analyzeField,
  analyzeForm,
  generateSafeMapping,
  detectSensitiveField,
  isLanguageControl,
  isSearchControl,
  isNavigationOrHeaderFooterControl,
  isRealForm,
  GuideOverlay,
  mountOverlay,
  destroy,
};

// Guard injection idempotency with window.__tfbLoaded (Requirement 3)
if (typeof window !== 'undefined') {
  if (!(window as any).__tfbLoaded) {
    (window as any).__tfbLoaded = true;
    (window as any).TechFormBuddyCore = TechFormBuddyCore;
  }
}

export default TechFormBuddyCore;
