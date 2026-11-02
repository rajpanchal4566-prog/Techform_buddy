'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../../dashboard/dashboard.css';

// Fixed development extension ID generated from the manifest RSA key
const EXTENSION_ID = 'fjlpjcmiflkpcbkmeopkcffopdojieph';

export default function ExtensionConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    // Check if extension content script injected dataset attribute
    const checkExt = () => {
      const extVer = document.documentElement.dataset.tfbExtension;
      if (extVer) {
        setExtensionDetected(true);
        setExtensionVersion(extVer);
      }
    };

    checkExt();
    const interval = setInterval(checkExt, 500);

    const onExtReady = (e: any) => {
      const ver = e.detail?.version || '1.0.0';
      setExtensionDetected(true);
      setExtensionVersion(ver);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'TFB_EXTENSION_READY') {
        setExtensionDetected(true);
        setExtensionVersion(e.data.version || '1.0.0');
      }
    };
    window.addEventListener('tfb-extension-ready', onExtReady);
    window.addEventListener('message', onMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tfb-extension-ready', onExtReady);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMsg('');
    try {
      // 1. Issue a scoped extension token
      const res = await fetch('/api/extension/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Chrome Extension (Desktop)' }),
      });

      if (!res.ok) {
        throw new Error('Failed to issue extension token');
      }

      const data = await res.json();
      const rawToken = data.token;
      setManualToken(rawToken);

      // 2. Try sending token via chrome.runtime.sendMessage (if available)
      let sentToExtension = false;
      if (typeof window !== 'undefined' && (window as any).chrome?.runtime?.sendMessage) {
        try {
          (window as any).chrome.runtime.sendMessage(
            EXTENSION_ID,
            {
              type: 'TFB_CONNECT',
              token: rawToken,
              appUrl: window.location.origin,
            },
            (response: any) => {
              if (response?.success) {
                setConnected(true);
              }
            }
          );
          sentToExtension = true;
        } catch {
          // Extension might use a different ID or window message
        }
      }

      // Also dispatch a window event that our content script listens to
      window.postMessage(
        {
          type: 'TFB_CONNECT_TOKEN',
          token: rawToken,
          appUrl: window.location.origin,
        },
        '*'
      );

      setConnected(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting extension');
    } finally {
      setConnecting(false);
    }
  };

  const copyToken = () => {
    if (manualToken) {
      navigator.clipboard.writeText(manualToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 3000);
    }
  };

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <main style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{ padding: '32px', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '48px' }}>🧩</span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '12px 0 6px 0', color: '#0f172a' }}>
              Connect TechForm Buddy Extension
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Pair your browser extension to assist in filling official forms on external websites securely.
            </p>
          </div>

          {/* Extension Detection Status */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: extensionDetected ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${extensionDetected ? '#bbf7d0' : '#fde68a'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{extensionDetected ? '✅' : '⚠️'}</span>
              <div>
                <strong style={{ fontSize: '14px', color: extensionDetected ? '#166534' : '#92400e' }}>
                  {extensionDetected ? `Extension Detected (v${extensionVersion || '1.0.0'})` : 'Extension Not Detected'}
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: extensionDetected ? '#15803d' : '#b45309' }}>
                  {extensionDetected
                    ? 'Ready to establish authenticated connection.'
                    : 'Ensure the extension is installed and loaded in Chrome.'}
                </p>
              </div>
            </div>
          </div>

          {connected ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#16a34a', margin: '0 0 8px 0' }}>
                Extension Successfully Connected!
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
                Your extension is now authenticated with scoped access (<code>form:map</code>, <code>profile:read</code>).
                You can now navigate to any form website and click <strong>&ldquo;Start on this page&rdquo;</strong> in the extension popup.
              </p>

              {manualToken && (
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '6px', textAlign: 'left', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Authorization Token:</span>
                    <button
                      onClick={copyToken}
                      style={{ fontSize: '12px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {tokenCopied ? 'Copied!' : 'Copy Token'}
                    </button>
                  </div>
                  <code style={{ fontSize: '11px', wordBreak: 'break-all', color: '#0f172a' }}>{manualToken}</code>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link href="/dashboard" className="btn btn-primary">
                  Go to Dashboard
                </Link>
                <Link href="/settings" className="btn btn-secondary">
                  Manage Extensions
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {errorMsg && (
                <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
                  {errorMsg}
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600 }}
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? 'Authorizing & Connecting...' : 'Connect Extension Now'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link href="/dashboard" style={{ fontSize: '13px', color: '#64748b' }}>
                  Cancel and return to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
