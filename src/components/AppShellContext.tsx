'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

export interface HeaderTitleConfig {
  title?: string;
  subtitle?: string;
}

export interface HeaderConfig extends HeaderTitleConfig {
  actions?: React.ReactNode;
}

// 1. Primitive-only Title/Subtitle State & Dispatch Contexts
const HeaderTitleStateContext = createContext<HeaderTitleConfig>({});
const HeaderTitleDispatchContext = createContext<(config: HeaderTitleConfig) => void>(() => {});

// 2. Mobile Drawer State & Dispatch Contexts
const MobileStateContext = createContext<boolean>(false);
const MobileDispatchContext = createContext<(open: boolean) => void>(() => {});

// 3. Header Actions Isolated External Store
// Keeps JSX completely OUT of React state/context to prevent circular re-render loops.
class HeaderActionsStore {
  private actions: React.ReactNode = null;
  private listeners = new Set<() => void>();

  getSnapshot = (): React.ReactNode => this.actions;

  setActions = (actions: React.ReactNode) => {
    if (this.actions === actions) return;
    this.actions = actions;
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

const HeaderActionsStoreContext = createContext<HeaderActionsStore | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [titleConfig, setTitleConfigRaw] = useState<HeaderTitleConfig>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  // Singleton store instance for the lifetime of this shell provider
  const actionsStoreRef = useRef<HeaderActionsStore | null>(null);
  if (!actionsStoreRef.current) {
    actionsStoreRef.current = new HeaderActionsStore();
  }

  // Stable dispatch with shallow equality check on primitives
  const setTitleConfig = useCallback((next: HeaderTitleConfig) => {
    setTitleConfigRaw((prev) => {
      if (prev.title === next.title && prev.subtitle === next.subtitle) {
        return prev;
      }
      return next;
    });
  }, []);

  const setMobileOpenStable = useCallback((open: boolean) => {
    setMobileOpen((prev) => (prev === open ? prev : open));
  }, []);

  return (
    <HeaderTitleDispatchContext.Provider value={setTitleConfig}>
      <HeaderTitleStateContext.Provider value={titleConfig}>
        <HeaderActionsStoreContext.Provider value={actionsStoreRef.current}>
          <MobileDispatchContext.Provider value={setMobileOpenStable}>
            <MobileStateContext.Provider value={mobileOpen}>
              {children}
            </MobileStateContext.Provider>
          </MobileDispatchContext.Provider>
        </HeaderActionsStoreContext.Provider>
      </HeaderTitleStateContext.Provider>
    </HeaderTitleDispatchContext.Provider>
  );
}

/**
 * Isolated leaf component that renders actions into the header slot.
 * Subscribes directly to HeaderActionsStore, so action changes ONLY re-render this leaf element
 * and NEVER re-render AppShellProvider, layout, or child pages.
 */
export function HeaderActionsSlot() {
  const store = useContext(HeaderActionsStoreContext);
  const actions = useSyncExternalStore(
    store ? store.subscribe : () => () => {},
    store ? store.getSnapshot : () => null,
    () => null
  );

  return (
    <div
      id="app-header-actions"
      className="header-actions-slot"
      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
    >
      {actions}
    </div>
  );
}

/**
 * Portal component for pages or widgets that prefer directly rendering JSX into the header slot.
 */
export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  const target = document.getElementById('app-header-actions');
  if (!target) return null;

  return createPortal(children, target);
}

export function useMobileState() {
  return useContext(MobileStateContext);
}

export function useMobileDispatch() {
  return useContext(MobileDispatchContext);
}

export function useHeaderTitleState() {
  return useContext(HeaderTitleStateContext);
}

export function useHeaderActionsStore() {
  return useContext(HeaderActionsStoreContext);
}

/**
 * Backwards-compatible shell consumer hook for layout.tsx.
 */
export function useAppShell() {
  const titleConfig = useContext(HeaderTitleStateContext);
  const setTitleConfig = useContext(HeaderTitleDispatchContext);
  const mobileOpen = useContext(MobileStateContext);
  const setMobileOpen = useContext(MobileDispatchContext);
  const store = useContext(HeaderActionsStoreContext);

  const setHeaderConfig = useCallback(
    (config: HeaderConfig) => {
      setTitleConfig({ title: config.title, subtitle: config.subtitle });
      if (store && config.actions !== undefined) {
        store.setActions(config.actions);
      }
    },
    [setTitleConfig, store]
  );

  return {
    headerConfig: {
      title: titleConfig.title,
      subtitle: titleConfig.subtitle,
    },
    setHeaderConfig,
    mobileOpen,
    setMobileOpen,
  };
}

/**
 * Hook for pages to configure the app header.
 * 
 * Rules guaranteed by this implementation:
 * 1. ONLY consumes dispatchers/stores (NEVER subscribes to state).
 * 2. Dependency array for title/subtitle contains ONLY primitive strings.
 * 3. Actions JSX is synced to the isolated leaf store via ref without triggering component re-renders.
 * 4. Cleanup runs ONLY on unmount, preventing any re-render loops.
 */
export function useAppHeader(config: HeaderConfig) {
  const setTitleConfig = useContext(HeaderTitleDispatchContext);
  const store = useContext(HeaderActionsStoreContext);

  const actionsRef = useRef(config.actions);
  actionsRef.current = config.actions;

  // Title effect: depends strictly on primitive strings
  useEffect(() => {
    setTitleConfig({ title: config.title, subtitle: config.subtitle });
  }, [setTitleConfig, config.title, config.subtitle]);

  // Actions effect: syncs actions ref to isolated store without re-rendering caller
  useEffect(() => {
    if (store && actionsRef.current !== undefined) {
      store.setActions(actionsRef.current);
    }
  });

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      setTitleConfig({});
      if (store) {
        store.setActions(null);
      }
    };
  }, [setTitleConfig, store]);
}
