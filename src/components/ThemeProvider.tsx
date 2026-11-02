'use client';

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
});

const STORAGE_KEY = 'tfb_theme';
let currentPreference: ThemePreference = 'system';
const listeners = new Set<() => void>();

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentPreference;
}

function getServerSnapshot(): ThemePreference {
  return 'system';
}

function updatePreference(preference: ThemePreference) {
  if (currentPreference === preference) return;
  currentPreference = preference;
  listeners.forEach((listener) => listener());
}

function applyTheme(preference: ThemePreference) {
  const isDark = preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedTheme = isDark ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolvedTheme;
  const color = window.getComputedStyle(document.documentElement).getPropertyValue('--tfb-bg').trim();
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = color;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    updatePreference(nextPreference);
    applyTheme(nextPreference);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextPreference);
    } catch (error) {
      console.error('Unable to persist the theme preference.', error);
    }
  }, []);

  useEffect(() => {
    let initialPreference: ThemePreference = 'system';
    try {
      const savedPreference = window.localStorage.getItem(STORAGE_KEY);
      if (isThemePreference(savedPreference)) initialPreference = savedPreference;
    } catch (error) {
      console.error('Unable to read the saved theme preference.', error);
    }
    updatePreference(initialPreference);
    applyTheme(initialPreference);

    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (currentPreference === 'system') applyTheme('system');
    };
    const updateFromStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const nextPreference = isThemePreference(event.newValue) ? event.newValue : 'system';
      updatePreference(nextPreference);
      applyTheme(nextPreference);
    };

    colorScheme.addEventListener('change', updateSystemTheme);
    window.addEventListener('storage', updateFromStorage);
    return () => {
      colorScheme.removeEventListener('change', updateSystemTheme);
      window.removeEventListener('storage', updateFromStorage);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
