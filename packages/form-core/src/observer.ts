/**
 * MutationObserver and URL-change detection for dynamic and multi-step forms.
 */

export type FormChangeCallback = (reason: 'mutation' | 'url_change') => void;

let isHistoryPatched = false;
let globalOriginalPushState: typeof history.pushState | null = null;
let globalOriginalReplaceState: typeof history.replaceState | null = null;
const activeUrlCallbacks = new Set<() => void>();
const activeObservers = new Set<FormChangeObserver>();

export function patchHistoryOnce(): void {
  if (typeof window === 'undefined' || isHistoryPatched) return;
  globalOriginalPushState = history.pushState;
  globalOriginalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = globalOriginalPushState!.apply(this, args);
    activeUrlCallbacks.forEach(cb => cb());
    return result;
  };

  history.replaceState = function (...args) {
    const result = globalOriginalReplaceState!.apply(this, args);
    activeUrlCallbacks.forEach(cb => cb());
    return result;
  };

  isHistoryPatched = true;
}

export function unpatchHistory(): void {
  if (typeof window === 'undefined' || !isHistoryPatched) return;
  if (globalOriginalPushState) history.pushState = globalOriginalPushState;
  if (globalOriginalReplaceState) history.replaceState = globalOriginalReplaceState;
  globalOriginalPushState = null;
  globalOriginalReplaceState = null;
  isHistoryPatched = false;
  activeUrlCallbacks.clear();
}

export class FormChangeObserver {
  private observer: MutationObserver | null = null;
  private currentUrl = '';
  private debounceTimer: any = null;
  private callback: FormChangeCallback | null = null;

  constructor(private debounceMs = 400) {}

  public observe(callback: FormChangeCallback, targetNode: Node = document.body): void {
    this.callback = callback;
    if (typeof window === 'undefined') return;

    activeObservers.add(this);
    this.currentUrl = window.location.href;

    // 1. Setup MutationObserver
    if (typeof MutationObserver !== 'undefined' && targetNode) {
      this.observer = new MutationObserver(mutations => {
        let hasRelevantChange = false;
        for (const m of mutations) {
          if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
            for (const node of Array.from(m.addedNodes)) {
              if (node instanceof HTMLElement) {
                if (
                  node.matches('input, select, textarea, form') ||
                  node.querySelector('input, select, textarea, form')
                ) {
                  hasRelevantChange = true;
                  break;
                }
              }
            }
          }
          if (hasRelevantChange) break;
        }

        if (hasRelevantChange) {
          this.triggerDebounced('mutation');
        }
      });

      this.observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    }

    // 2. Setup URL change listeners (hashchange + popstate)
    window.addEventListener('popstate', this.handleUrlChange);
    window.addEventListener('hashchange', this.handleUrlChange);

    // 3. Register with idempotent history patcher
    patchHistoryOnce();
    activeUrlCallbacks.add(this.handleUrlChange);
  }

  private handleUrlChange = () => {
    if (typeof window === 'undefined') return;
    const newUrl = window.location.href;
    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;
      this.triggerDebounced('url_change');
    }
  };

  private triggerDebounced(reason: 'mutation' | 'url_change'): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.callback?.(reason);
    }, this.debounceMs);
  }

  public disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handleUrlChange);
      window.removeEventListener('hashchange', this.handleUrlChange);
      activeUrlCallbacks.delete(this.handleUrlChange);
    }
    activeObservers.delete(this);
    this.callback = null;
  }

  public static disconnectAll(): void {
    for (const obs of Array.from(activeObservers)) {
      obs.disconnect();
    }
    unpatchHistory();
  }
}
