declare const chrome: any;

import { BridgeMessage, BridgeMessageType, IBridge } from './types';

function createMessage<T>(type: BridgeMessageType, payload?: T): BridgeMessage<T> {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
  };
}

/**
 * Implementation 1: Chrome Extension Runtime Bridge (Manifest V3)
 */
export class ChromeExtensionBridge implements IBridge {
  private listeners: Set<(message: BridgeMessage) => void> = new Set();
  private chromeListener: ((msg: any, sender: any, sendResponse: any) => void) | null = null;

  constructor() {
    this.initListener();
  }

  private initListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      this.chromeListener = (msg: any) => {
        if (msg && typeof msg === 'object' && msg.type) {
          this.listeners.forEach(handler => handler(msg as BridgeMessage));
        }
      };
      chrome.runtime.onMessage.addListener(this.chromeListener);
    }
  }

  public async send<T = unknown, R = unknown>(type: BridgeMessageType, payload?: T): Promise<R> {
    const message = createMessage(type, payload);
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        reject(new Error('chrome.runtime.sendMessage is not available in current environment.'));
        return;
      }

      chrome.runtime.sendMessage(message, (response: any) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || 'Chrome runtime message error'));
          return;
        }
        resolve(response as R);
      });
    });
  }

  public onMessage(handler: (message: BridgeMessage) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public disconnect(): void {
    if (this.chromeListener && typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(this.chromeListener);
      this.chromeListener = null;
    }
    this.listeners.clear();
  }
}

/**
 * Implementation 2: Android In-App Browser Bridge (@capgo/inappbrowser)
 *
 * [UNVERIFIED - TO BE VERIFIED AGAINST @capgo/inappbrowser DOCUMENTATION IN PHASE 6]
 * Note: Android WebViews do not use iOS's window.webkit.messageHandlers by default.
 * In Phase 6, verify exact message channel API (e.g. messageFromWebview,
 * _capgoInAppBrowser, or postMessage channel) against the @capgo/inappbrowser README.
 */
export class AndroidInAppBrowserBridge implements IBridge {
  private listeners: Set<(message: BridgeMessage) => void> = new Set();
  private windowMessageListener: ((event: MessageEvent) => void) | null = null;

  constructor() {
    this.initListener();
  }

  /**
   * Runtime feature detection to verify whether any Android host communication channel is available.
   */
  public hasHostChannel(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    return Boolean(
      win.messageFromWebview?.postMessage ||
      win._capgoInAppBrowser?.postMessage ||
      win.webkit?.messageHandlers?.messageFromWebview?.postMessage
    );
  }

  private initListener() {
    if (typeof window === 'undefined') return;

    this.windowMessageListener = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // not json
        }
      }
      if (data && typeof data === 'object' && data.type) {
        this.listeners.forEach(handler => handler(data as BridgeMessage));
      }
    };

    window.addEventListener('message', this.windowMessageListener);

    // Global callback hook for Android InAppBrowser executeScript response injection
    (window as any).__techformHostBridgeCallback = (msg: BridgeMessage) => {
      this.listeners.forEach(handler => handler(msg));
    };
  }

  public async send<T = unknown, R = unknown>(type: BridgeMessageType, payload?: T): Promise<R> {
    const message = createMessage(type, payload);

    return new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined') {
          return reject(
            new Error(
              'AndroidInAppBrowserBridge [UNVERIFIED]: Host message channel is not available (window is undefined)'
            )
          );
        }

        const win = window as any;

        // 1. Android JS Interface provided by Capacitor InAppBrowser
        if (win.messageFromWebview?.postMessage) {
          win.messageFromWebview.postMessage(JSON.stringify(message));
          return resolve({ sent: true } as unknown as R);
        }

        // 2. Alternate _capgoInAppBrowser channel
        if (win._capgoInAppBrowser?.postMessage) {
          win._capgoInAppBrowser.postMessage(JSON.stringify(message));
          return resolve({ sent: true } as unknown as R);
        }

        // 3. iOS WKWebView handler (if container is cross-platform)
        if (win.webkit?.messageHandlers?.messageFromWebview?.postMessage) {
          win.webkit.messageHandlers.messageFromWebview.postMessage(message);
          return resolve({ sent: true } as unknown as R);
        }

        // Runtime feature detection: reject with clear error when no host channel exists
        return reject(
          new Error(
            'AndroidInAppBrowserBridge [UNVERIFIED]: Host message channel is not available in the current environment. No messageFromWebview or _capgoInAppBrowser interface detected.'
          )
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  public onMessage(handler: (message: BridgeMessage) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public disconnect(): void {
    if (this.windowMessageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.windowMessageListener);
      this.windowMessageListener = null;
      delete (window as any).__techformHostBridgeCallback;
    }
    this.listeners.clear();
  }
}

/**
 * Implementation 3: Mock Bridge for automated testing and headless environments
 */
export class MockBridge implements IBridge {
  private listeners: Set<(message: BridgeMessage) => void> = new Set();
  public sentMessages: BridgeMessage[] = [];
  private responseHandlers: Map<BridgeMessageType, (payload: any) => any> = new Map();

  public registerResponseHandler(type: BridgeMessageType, handler: (payload: any) => any) {
    this.responseHandlers.set(type, handler);
  }

  public async send<T = unknown, R = unknown>(type: BridgeMessageType, payload?: T): Promise<R> {
    const message = createMessage(type, payload);
    this.sentMessages.push(message);

    if (this.responseHandlers.has(type)) {
      const handler = this.responseHandlers.get(type)!;
      return handler(payload) as R;
    }

    return { ack: true, id: message.id } as unknown as R;
  }

  public simulateIncomingMessage(type: BridgeMessageType, payload?: any) {
    const msg = createMessage(type, payload);
    this.listeners.forEach(handler => handler(msg));
  }

  public onMessage(handler: (message: BridgeMessage) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public disconnect(): void {
    this.listeners.clear();
    this.sentMessages = [];
  }
}

/**
 * Environment-detecting bridge factory.
 */
export function createBridge(type?: 'auto' | 'chrome' | 'android' | 'mock'): IBridge {
  if (type === 'chrome') return new ChromeExtensionBridge();
  if (type === 'android') return new AndroidInAppBrowserBridge();
  if (type === 'mock') return new MockBridge();

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    return new ChromeExtensionBridge();
  }

  if (
    typeof window !== 'undefined' &&
    ((window as any).messageFromWebview || (window as any).webkit?.messageHandlers?.messageFromWebview)
  ) {
    return new AndroidInAppBrowserBridge();
  }

  return new MockBridge();
}
