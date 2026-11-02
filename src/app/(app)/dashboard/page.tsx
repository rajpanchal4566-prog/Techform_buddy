'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import './dashboard.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

interface Form {
  id: string;
  title: string;
  status: string;
  category: string;
  updated_at: string;
}

function getIcon(name: string) {
  switch (name) {
    case 'forms':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'documents':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case 'assistant':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z" />
          <path d="M10 10h4" />
        </svg>
      );
    case 'browser':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentForms, setRecentForms] = useState<Form[]>([]);
  const [stats, setStats] = useState({ forms: 0, documents: 0, watches: 0 });
  const [recommendations, setRecommendations] = useState<{ eligible: any[]; almostEligible: any[] }>({ eligible: [], almostEligible: [] });

  useAppHeader({
    title: 'Dashboard',
    subtitle: `Welcome back, ${session?.user?.name?.split(' ')[0] || 'Citizen'}`,
  });

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const [notifRes, formsRes, statsRes, recRes] = await Promise.all([
        fetch('/api/notifications?limit=5'),
        fetch('/api/forms?limit=5'),
        fetch('/api/stats'),
        fetch('/api/recommendations'),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (formsRes.ok) setRecentForms(await formsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations({ eligible: recData.eligible || [], almostEligible: recData.almostEligible || [] });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  return (
    <div className="dashboard-content animate-fadeIn">
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">
                {getIcon('forms')}
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.forms}</span>
                <span className="stat-label">Forms</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">
                {getIcon('documents')}
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.documents}</span>
                <span className="stat-label">Documents</span>
              </div>
            </div>
            <Link href="/form-watch" className="stat-card card-hover" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="stat-icon stat-icon-amber">
                {getIcon('notifications')}
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.watches}</span>
                <span className="stat-label">Form Watch</span>
              </div>
            </Link>
          </div>

          {/* Quick Actions */}
          <section className="dashboard-section">
            <h2>Quick Actions</h2>
            <div className="quick-actions">
              <Link href="/assistant" className="action-card card card-hover">
                <div className="action-icon">
                  {getIcon('assistant')}
                </div>
                <span className="action-label">AI Assistant</span>
                <span className="action-desc">Guidance & Services</span>
              </Link>
              <Link href="/forms/new" className="action-card card card-hover">
                <div className="action-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span className="action-label">New Form</span>
                <span className="action-desc">Voice & auto-fill</span>
              </Link>
              <Link href="/documents" className="action-card card card-hover">
                <div className="action-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/></svg>
                </div>
                <span className="action-label">Upload Document</span>
                <span className="action-desc">Add to your profile</span>
              </Link>
              <Link href="/browser" className="action-card card card-hover">
                <div className="action-icon">
                  {getIcon('browser')}
                </div>
                <span className="action-label">Portal Launcher</span>
                <span className="action-desc">Launch official portals</span>
              </Link>
            </div>
          </section>

          <Link
            href="/arena"
            className="card card-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 20px',
              color: '#f8fafc',
              background: '#0f172a',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              textDecoration: 'none',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 26 }}>🛡️</span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: 'block', color: '#ffffff' }}>Play Buddy Defender</strong>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>Protect your forms in a quick safety arcade game.</span>
            </span>
            <span aria-hidden="true" style={{ color: '#bfdbfe', fontWeight: 700 }}>Play →</span>
          </Link>

          {/* Personalized Scheme Recommendations (Requirement B4) */}
          <section id="scheme-recommendations-section" className="dashboard-section">
            <div className="section-header" style={{ marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>🎯 Personalized Scheme Recommendations</h2>
                  <span className="badge badge-primary" style={{ fontSize: '11px' }}>Rule Engine</span>
                </div>
                <p className="text-xs text-muted" style={{ margin: '4px 0 0 0' }}>
                  Deterministic statutory eligibility evaluator matching your profile attributes (no hallucinated AI predictions)
                </p>
              </div>
              <Link href="/profile" className="btn btn-ghost btn-sm">Edit Profile</Link>
            </div>

            {/* Official Portal Verification Disclaimer */}
            <div
              id="recommendations-disclaimer-banner"
              style={{
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '11px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>ℹ️</span>
              <span>
                <strong>Official Portal Verification:</strong> Scheme eligibility criteria are compiled from statutory rules. Please verify notifications on the official website before applying.
              </span>
            </div>

            {recommendations.eligible.length === 0 && recommendations.almostEligible.length === 0 ? (
              <div className="card" style={{ padding: '16px 20px', background: 'var(--color-surface)', textAlign: 'center' }}>
                <p className="text-sm text-muted" style={{ margin: 0 }}>
                  Add your Date of Birth, Income, and Social Category in your Profile to unlock personalized scheme recommendations.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Fully Eligible Schemes */}
                {recommendations.eligible.map(rec => (
                  <div
                    key={rec.scheme.id}
                    className="card recommendation-card-eligible"
                    style={{
                      borderLeft: '4px solid #10b981',
                      padding: '16px 20px',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {rec.scheme.name}
                          </span>
                          <span className="badge badge-success" style={{ fontSize: '11px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                            ✓ 100% Eligible
                          </span>
                          <span className="badge badge-default" style={{ fontSize: '10px' }}>
                            {rec.scheme.domain.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 4px 0', lineHeight: 1.5 }}>
                          {rec.scheme.benefitDescription}
                        </p>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          🏛️ Official Portal: <a href={rec.scheme.portalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{rec.scheme.portalUrl}</a> • Verified: {rec.scheme.lastChecked || '2026-03-01'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {rec.scheme.templateId && (
                          <Link
                            href={`/forms/new?template=${rec.scheme.templateId}`}
                            className="btn btn-sm btn-primary"
                          >
                            Apply with Buddy
                          </Link>
                        )}
                        <a
                          href={rec.scheme.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-secondary"
                        >
                          Official Portal ↗
                        </a>
                      </div>
                    </div>

                    {/* Why You Qualify */}
                    <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '4px' }}>
                        💡 Why You Qualify:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#15803d', lineHeight: 1.6 }}>
                        {rec.whyYouQualify.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}

                {/* 2. Almost Eligible Schemes */}
                {recommendations.almostEligible.map(rec => (
                  <div
                    key={rec.scheme.id}
                    className="card recommendation-card-almost"
                    style={{
                      borderLeft: '4px solid #f59e0b',
                      padding: '16px 20px',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {rec.scheme.name}
                          </span>
                          <span className="badge badge-accent" style={{ fontSize: '11px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                            ⚡ Almost Eligible
                          </span>
                          <span className="badge badge-default" style={{ fontSize: '10px' }}>
                            {rec.scheme.domain.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 4px 0', lineHeight: 1.5 }}>
                          {rec.scheme.benefitDescription}
                        </p>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          🏛️ Official Portal: <a href={rec.scheme.portalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{rec.scheme.portalUrl}</a> • Verified: {rec.scheme.lastChecked || '2026-03-01'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href="/profile" className="btn btn-sm btn-secondary">
                          Update Profile
                        </Link>
                        <a
                          href={rec.scheme.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-ghost"
                        >
                          Guidelines ↗
                        </a>
                      </div>
                    </div>

                    {/* What is Missing */}
                    <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fde68a', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', display: 'block', marginBottom: '4px' }}>
                        ⚠️ What is Missing / Next Step:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#b45309', lineHeight: 1.6 }}>
                        {rec.whatIsMissing.map((missing: string, idx: number) => (
                          <li key={idx}>{missing}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Forms */}
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Recent Forms</h2>
              <Link href="/forms" className="btn btn-ghost btn-sm">View all</Link>
            </div>
            {recentForms.length > 0 ? (
              <div className="recent-list">
                {recentForms.map((form) => (
                  <Link key={form.id} href={`/forms/${form.id}`} className="recent-item card card-hover">
                    <div className="recent-item-info">
                      <span className="recent-item-title">{form.title}</span>
                      <span className="text-xs text-muted">{form.category || 'General'}</span>
                    </div>
                    <span className={`badge badge-${form.status === 'completed' ? 'success' : form.status === 'submitted' ? 'accent' : 'default'}`}>
                      {form.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p className="text-sm text-muted">No forms yet. Create your first form!</p>
                <Link href="/forms/new" className="btn btn-primary btn-sm">Create Form</Link>
              </div>
            )}
          </section>

          {/* Notifications */}
          <section className="dashboard-section">
            <div className="section-header">
              <h2>Notifications</h2>
              <Link href="/notifications" className="btn btn-ghost btn-sm">View all</Link>
            </div>
            {notifications.length > 0 ? (
              <div className="recent-list">
                {notifications.map((notif) => (
                  <div key={notif.id} className={`notif-item ${!notif.is_read ? 'notif-unread' : ''}`}>
                    <div className={`notif-dot notif-dot-${notif.type}`} />
                    <div className="notif-content">
                      <span className="notif-title">{notif.title}</span>
                      <span className="text-xs text-muted">{notif.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                No notifications yet
              </p>
            )}
          </section>
        </div>
  );
}
