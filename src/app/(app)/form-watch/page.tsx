'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useRegisterActions } from '@/lib/actionRegistry';
import { useAppHeader } from '@/components/AppShellContext';
import './form-watch.css';

// ────────────── Types ──────────────

interface FilterDef {
  key: string;
  label: string;
  options: string[];
}

interface WatchAlert {
  id: string;
  notice_title: string;
  notice_link: string | null;
  classification: string;
  deadline_date: string | null;
  source_name: string;
  created_at: string;
  is_read: number;
  why_matched?: string | null;
}

interface SourceDetail {
  id: string;
  name: string;
  url: string;
  status: string;
  error_reason: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
}

interface Watch {
  id: string;
  search_query: string;
  source_id?: string | null;
  source_ids?: string[];
  source_name?: string | null;
  source_url?: string | null;
  is_verified?: boolean;
  monitored_categories?: string[];
  selected_notices?: string[];
  category: string | null;
  filters: Record<string, string> | null;
  is_active: number;
  last_checked: string | null;
  last_status: 'ok' | 'source_error' | 'all_failed' | 'error' | 'idle' | 'checking';
  sources_being_checked: string[];
  sources_detail?: SourceDetail[];
  unread_alerts_count: number;
  created_at: string;
  alerts: WatchAlert[];
}

interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  state: string | null;
  category: string | null;
  domain?: string | null;
  last_checked_at: string | null;
  last_status: string | null;
  last_error_reason?: string | null;
  last_success_at?: string | null;
}

interface RunResult {
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: Array<{ id: string; name: string; status: string; reason: string }>;
  itemsFound: number;
  newNotices: number;
  alertsCreated: number;
  allFailed: boolean;
  errors: string[];
}

interface GuideModalState {
  open: boolean;
  portalName: string;
  portalUrl: string;
}

// ────────────── Helpers ──────────────

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function classLabel(cls: string) {
  switch (cls) {
    case 'application_open': return 'Open';
    case 'deadline': return 'Deadline';
    case 'result': return 'Result';
    case 'admit_card': return 'Admit Card';
    default: return 'Notice';
  }
}

// ────────────── Component ──────────────

export default function FormWatchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Watch creation & search flow
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; existingWatchId?: string } | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<'all' | 'exam' | 'scholarship' | 'admission' | 'hackathon'>('all');
  const [matchedSources, setMatchedSources] = useState<any[]>([]);
  const [bestMatch, setBestMatch] = useState<any | null>(null);
  const [otherMatches, setOtherMatches] = useState<any[]>([]);
  const [showAddMoreSources, setShowAddMoreSources] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<string, boolean>>({});
  const [isBroadQuery, setIsBroadQuery] = useState(false);
  const [broadCategories, setBroadCategories] = useState<Array<{ key: string; label: string; options: string[] }>>([]);
  const [selectedBroadOptions, setSelectedBroadOptions] = useState<Record<string, string>>({});
  const [hasNoMatch, setHasNoMatch] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Hackathons & Events specific filters (Requirement 3)
  const [hackathonMode, setHackathonMode] = useState('all');
  const [hackathonCity, setHackathonCity] = useState('');
  const [hackathonStudentOnly, setHackathonStudentOnly] = useState(false);
  const [hackathonDeadlineDays, setHackathonDeadlineDays] = useState('all');

  // Selection & Discovery
  const [selectedSource, setSelectedSource] = useState<any | null>(null);
  const [categoryCheckboxes, setCategoryCheckboxes] = useState<Record<string, boolean>>({
    recruitment: true,
    notification: true,
    admit_card: true,
    result: true,
    syllabus: true,
  });
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoveredNotices, setDiscoveredNotices] = useState<any[]>([]);
  const [selectedNotices, setSelectedNotices] = useState<Record<string, boolean>>({});

  // Custom URL entry
  const [showCustomUrlBox, setShowCustomUrlBox] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [confirmCustomWarning, setConfirmCustomWarning] = useState(false);

  // Narrowing fallback filters
  const [filterDefs, setFilterDefs] = useState<FilterDef[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [storedInfo, setStoredInfo] = useState<string | null>(null);

  // Watches list
  const [watches, setWatches] = useState<Watch[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // Watcher job execution
  const [checking, setChecking] = useState(false);
  const [checkingWatchId, setCheckingWatchId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  // Push permission
  const [pushState, setPushState] = useState<'unknown' | 'denied' | 'granted' | 'prompt'>('unknown');

  // "Open with Buddy" 3-step guide modal
  const [guideModal, setGuideModal] = useState<GuideModalState | null>(null);

  // Client query flag to prevent SSR hydration mismatch (Requirement 1)
  const [isDevQuery, setIsDevQuery] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('dev=true')) {
      setIsDevQuery(true);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const fetchData = useCallback(async () => {
    try {
      const [watchRes, sourceRes] = await Promise.all([
        fetch('/api/form-watches'),
        fetch('/api/watcher/run'),
      ]);
      if (watchRes.ok) setWatches(await watchRes.json());
      if (sourceRes.ok) {
        const data = await sourceRes.json();
        setSources(data.sources || []);
      }
    } catch (err) {
      console.error('Failed to fetch form watch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Register Form Watch actions with Action Registry (Requirement 1)
  useRegisterActions([
    {
      name: 'create_watch',
      description: 'Create a new portal watch to monitor official government exam, recruitment, and scholarship notices.',
      parameters: {
        query: {
          type: 'string',
          description: 'Search query or organization name (e.g. MPPSC, UPSC, Scholarship).',
          required: true,
        },
        sources: {
          type: 'array',
          description: 'Optional list of source IDs to watch.',
          required: false,
        },
      },
      isReadOnly: false,
      confirmationPrompt: ({ query }) => `Create watch to monitor updates for "${query}"?`,
      handler: async ({ query, sources }) => {
        try {
          const res = await fetch('/api/form-watches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchQuery: query,
              selectedSources: sources || [],
            }),
          });
          if (res.ok) {
            fetchData();
            return {
              success: true,
              message: `Created watch for "${query}"`,
            };
          } else {
            return {
              success: false,
              message: `Failed to create watch for "${query}"`,
            };
          }
        } catch (err: any) {
          return {
            success: false,
            message: `Error creating watch: ${err?.message || 'Network error'}`,
          };
        }
      },
    },
  ], [fetchData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tfb-page-ready', { detail: { page: '/form-watch' } }));
      const handlePlannerWatch = (e: any) => {
        if (e?.detail?.query) {
          setQuery(e.detail.query);
        }
      };
      window.addEventListener('tfb-create-watch', handlePlannerWatch);
      return () => {
        window.removeEventListener('tfb-create-watch', handlePlannerWatch);
      };
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      checkPushPermission();

      // Check if URL contains query params from push notification click (?open=...&title=...)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const openUrl = params.get('open');
        const openTitle = params.get('title') || 'Portal Notice';
        if (openUrl) {
          handleOpenWithBuddy(openUrl, openTitle);
        }
      }
    }
  }, [status, fetchData]);

  // ── Push Permission & Registration ──
  const checkPushPermission = () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushState('denied');
      return;
    }
    setPushState(Notification.permission as any);
  };

  const requestPush = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPushState(permission as any);

      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const keyRes = await fetch('/api/push/vapid-key');
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      }
    } catch (err) {
      console.error('Push subscription error:', err);
    }
  };

  // ── Profile City Auto-Fetch (Opt-in only, Requirement 3) ──
  const handleUseProfileCity = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        const city = data?.profile?.city || data?.city || '';
        if (city) {
          setHackathonCity(city);
        } else {
          alert('No city found in your profile. Please enter your city manually.');
        }
      }
    } catch {
      console.warn('Failed to fetch profile city');
    }
  };

  // ── Sources Registry Search Flow (Requirement 1, 2, 3, 4) ──
  const handleSearchSources = async (searchText?: string) => {
    const q = (searchText !== undefined ? searchText : query).trim();
    if (!q) return;

    setSearchLoading(true);
    setLookupError(null);
    setDuplicateWarning(null);
    setStoredInfo(null);
    setSelectedSource(null);
    setDiscoveredNotices([]);
    setShowCustomUrlBox(false);

    try {
      const res = await fetch(`/api/form-watches/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Search lookup failed with status ${res.status}`);
      }

      const data = await res.json();
      const matches = data.matches || [];
      const best = data.bestMatch || matches[0] || null;
      const others = data.otherMatches || matches.slice(1);

      setMatchedSources(matches);
      setBestMatch(best);
      setOtherMatches(others);
      setIsBroadQuery(Boolean(data.isBroad));
      setBroadCategories(data.categories || []);
      setHasNoMatch(Boolean(data.hasNoMatch));
      setSuggestions(data.suggestions || []);

      // Requirement 1: Pre-select ONLY the best name match (e.g. "upsc" -> UPSC)
      if (best) {
        setSelectedSourceIds({ [best.id]: true });
        setSelectedSource(best);
      } else {
        setSelectedSourceIds({});
      }

      if (data.categories && data.categories.length > 0) {
        const defs: Record<string, string> = {};
        for (const cat of data.categories) {
          defs[cat.key] = cat.options[0] || 'All';
        }
        setSelectedBroadOptions(defs);
      }
    } catch (err: any) {
      console.error('Sources search error:', err);
      // Requirement 1: Show an error message in the UI when lookup fails instead of silently showing nothing
      setLookupError(err.message || 'Lookup failed: Unable to connect to official sources registry. Please check your network and try again.');
      setMatchedSources([]);
      setBestMatch(null);
      setOtherMatches([]);
      setSelectedSourceIds({});
      setHasNoMatch(false);
      setSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // ── Pick Source & Discovery Flow (Requirement 3 & 5) ──
  const handlePickSource = async (source: any) => {
    setSelectedSource(source);
    // Ensure this source is marked checked
    setSelectedSourceIds(prev => ({ ...prev, [source.id]: true }));

    // Initialize category checkboxes
    const initialCats: Record<string, boolean> = {};
    const avail = source.availableCategories || ['recruitment', 'notification', 'admit_card', 'result', 'syllabus'];
    for (const c of avail) {
      initialCats[c] = true;
    }
    setCategoryCheckboxes(initialCats);
    await handleDiscoverNotices(source);
  };

  const handleDiscoverNotices = async (source: any) => {
    setDiscoverLoading(true);
    try {
      const res = await fetch('/api/form-watches/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: source.id,
          url: source.url,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const notices = data.notices || [];
        setDiscoveredNotices(notices);
        // Default: select all discovered notices
        const initialSelected: Record<string, boolean> = {};
        for (const n of notices) {
          initialSelected[n.title] = true;
        }
        setSelectedNotices(initialSelected);
      }
    } catch (err) {
      console.error('Discovery error:', err);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleConfirmSuggested = async (sugg: any) => {
    const customSrc = {
      id: null,
      name: sugg.name,
      url: sugg.url,
      description: sugg.description,
      isVerified: false, // Explicitly marked unverified
      monitoredWhat: 'Public notices, application openings, and exam alerts',
      availableCategories: ['recruitment', 'notification', 'admit_card', 'result'],
      lastChecked: null,
    };
    setSelectedSource(customSrc);
    setCategoryCheckboxes({ recruitment: true, notification: true, admit_card: true, result: true });
    await handleDiscoverNotices(customSrc);
  };

  const handleConfirmCustomUrl = async () => {
    if (!customUrl.trim() || !confirmCustomWarning) return;
    try {
      new URL(customUrl.trim());
    } catch {
      alert('Please enter a valid URL (starting with https:// or http://)');
      return;
    }

    const customSrc = {
      id: null,
      name: customName.trim() || customUrl.trim(),
      url: customUrl.trim(),
      description: 'Custom portal entered by user.',
      isVerified: false,
      monitoredWhat: 'Public notice updates',
      availableCategories: ['recruitment', 'notification', 'admit_card', 'result'],
      lastChecked: null,
    };
    setSelectedSource(customSrc);
    setCategoryCheckboxes({ recruitment: true, notification: true, admit_card: true, result: true });
    setShowCustomUrlBox(false);
    await handleDiscoverNotices(customSrc);
  };

  // ── Save Watch with Chosen Source & Categories (Requirement 1, 2, 6) ──
  const handleSaveWatch = async (updateExisting = false) => {
    if (!selectedSource && !query.trim()) return;
    setCreating(true);
    setDuplicateWarning(null);

    try {
      const activeCategories = Object.keys(categoryCheckboxes).filter(k => categoryCheckboxes[k]);
      const activeNotices = Object.keys(selectedNotices).filter(title => selectedNotices[title]);
      const checkedSourceIds = Object.keys(selectedSourceIds).filter(id => selectedSourceIds[id]);

      // Combine filters including hackathon specific filters (Requirement 3)
      const combinedFilters: Record<string, any> = { ...selectedBroadOptions };
      if (hackathonMode && hackathonMode !== 'all') combinedFilters.mode = hackathonMode;
      if (hackathonCity && hackathonCity.trim()) combinedFilters.city = hackathonCity.trim();
      if (hackathonStudentOnly) combinedFilters.studentEligible = true;
      if (hackathonDeadlineDays && hackathonDeadlineDays !== 'all') combinedFilters.deadlineDays = hackathonDeadlineDays;

      const finalSourceIds = checkedSourceIds.length > 0
        ? checkedSourceIds
        : (selectedSource?.id ? [selectedSource.id] : []);

      const res = await fetch('/api/form-watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: query.trim() || selectedSource?.name,
          sourceId: finalSourceIds[0] || null,
          sourceIds: finalSourceIds,
          customUrl: selectedSource?.url || null,
          customName: selectedSource?.name || null,
          monitoredCategories: activeCategories,
          selectedNotices: activeNotices,
          isVerified: selectedSource ? Boolean(selectedSource.isVerified) : true,
          filters: combinedFilters,
          category: selectedTopic !== 'all' ? selectedTopic : (selectedSource?.category || null),
          updateExisting,
        }),
      });

      if (res.status === 409) {
        // Requirement 2: DEDUPE: offer to update existing watch
        const data = await res.json().catch(() => ({}));
        setDuplicateWarning({
          message: data.message || `A watch for this query or source already exists.`,
          existingWatchId: data.existingWatch?.id,
        });
        setCreating(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setStoredInfo(data.stored?.explanation || (updateExisting ? 'Watch updated successfully.' : 'Watch saved successfully.'));
        setQuery('');
        setSelectedSource(null);
        setBestMatch(null);
        setOtherMatches([]);
        setSelectedSourceIds({});
        setMatchedSources([]);
        setDiscoveredNotices([]);
        setDuplicateWarning(null);
        fetchData();
      }
    } catch (err: any) {
      console.error('Save watch error:', err);
      setLookupError('Failed to save watch. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleNarrow = () => handleSearchSources();
  const handleCreateWatch = handleSaveWatch;

  const handleDeleteWatch = async (id: string) => {
    try {
      await fetch('/api/form-watches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setWatches(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Delete watch error:', err);
    }
  };

  // ── Watcher Job Execution (Dev / Manual Trigger) ──
  const handleCheckNow = async (sourceId?: string, watchId?: string) => {
    if (watchId) setCheckingWatchId(watchId);
    else setChecking(true);

    setRunResult(null);
    try {
      const res = await fetch('/api/watcher/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      if (res.ok) {
        const result = await res.json();
        setRunResult(result);
        fetchData(); // Refresh watches + sources
      }
    } catch (err) {
      console.error('Check now error:', err);
    } finally {
      setChecking(false);
      setCheckingWatchId(null);
    }
  };

  // ── Open with Buddy Action ──
  const handleOpenWithBuddy = (url: string, name: string, alertId?: string) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tfb_active_task', name);
      } catch {}
      window.postMessage({ type: 'TFB_OPEN_WITH_BUDDY', language: 'en', url, taskName: name }, '*');
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    if (alertId) {
      fetch('/api/form-watches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      }).then(() => {
        setWatches(prev =>
          prev.map(w => ({
            ...w,
            alerts: w.alerts.map(a => (a.id === alertId ? { ...a, is_read: 1 } : a)),
            unread_alerts_count: Math.max(0, w.unread_alerts_count - 1),
          }))
        );
      }).catch(() => {});
    }

    setGuideModal({
      open: true,
      portalName: name,
      portalUrl: url,
    });
  };

  // ── Quick Test Simulator ──
  const handleSimulateTestNotice = async () => {
    try {
      const testNotice = {
        notices: [
          {
            title: `Simulated Notice: Post-Matric Scholarship Scheme 2026-27 (Generated ${new Date().toLocaleTimeString()})`,
            link: 'https://scholarships.gov.in',
            date: new Date().toISOString().split('T')[0],
          },
        ],
      };
      await fetch('/api/test-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testNotice),
      });
      // Run watcher for test source immediately
      const testSource = sources.find(s => s.url.includes('test-source'));
      await handleCheckNow(testSource?.id);
    } catch (err) {
      console.error('Simulate notice error:', err);
    }
  };

  useAppHeader({
    title: 'Form Watch',
    subtitle: 'Real-time government portal monitor with narrowing filters & Web Push alerts',
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSimulateTestNotice}
          title="Add a test notice to the local test source and scan it"
        >
          🧪 Simulate Notice
        </button>
        <button
          id="fw-check-all-btn"
          className="btn btn-primary btn-sm fw-check-btn"
          onClick={() => handleCheckNow()}
          disabled={checking}
        >
          {checking ? (
            <>
              <div className="loading-spinner" />
              Checking Sources…
            </>
          ) : (
            '🔄 Check All Now'
          )}
        </button>
      </div>
    ),
  });

  return (
    <>
      <div className="fw-content animate-fadeIn">
          {/* Push Permission Banner */}
          {pushState === 'prompt' && (
            <div className="fw-push-banner">
              <div className="fw-push-text">
                <strong>🔔 Enable Web Push Notifications</strong>
                <span>
                  Receive immediate alerts when new forms, deadlines, or exam results are published —
                  even when TechForm Buddy is closed. We send strictly matched alerts.
                </span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={requestPush}>
                Enable Push
              </button>
            </div>
          )}

          {/* Run Result Banner (Requirement 5) */}
          {runResult && (
            <div
              id="fw-run-result-banner"
              className={`fw-run-result ${
                runResult.allFailed || (runResult.sourcesChecked > 0 && runResult.sourcesSucceeded === 0)
                  ? 'fw-run-result-error'
                  : runResult.sourcesFailed && runResult.sourcesFailed.length > 0
                  ? 'fw-run-result-warning'
                  : 'fw-run-result-success'
              }`}
            >
              {runResult.allFailed || (runResult.sourcesChecked > 0 && runResult.sourcesSucceeded === 0) ? (
                <>⚠️ All monitored sources failed to respond. No portals could be reached.</>
              ) : (
                <>
                  ✓ Scanned {runResult.sourcesChecked} source{runResult.sourcesChecked !== 1 ? 's' : ''} •{' '}
                  {runResult.itemsFound ?? runResult.newNotices} items found • {runResult.newNotices} new •{' '}
                  {runResult.alertsCreated} matched
                  {runResult.sourcesFailed && runResult.sourcesFailed.length > 0 && (
                    <>
                      {' '}• ⚠ Unreachable ({runResult.sourcesFailed.length}):{' '}
                      {runResult.sourcesFailed.map((f: any) => (typeof f === 'string' ? f : `${f.name} (${f.reason || f.status})`)).join(', ')}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Create Watch & Narrowing Flow ── */}
          <section className="fw-create-section card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Create a New Form Watch</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Search our verified sources registry across government exams, scholarships, admissions, and hackathons or enter a custom portal.
            </p>

            {/* Requirement 3: Topics Beyond Govt tabs */}
            <div className="fw-topics-tabs">
              {[
                { id: 'all', label: 'All Topics' },
                { id: 'exam', label: '🏛️ Govt Jobs & Exams' },
                { id: 'scholarship', label: '🎓 Scholarships' },
                { id: 'admission', label: '🏫 Admissions' },
                { id: 'hackathon', label: '💻 Hackathons & Events' },
              ].map(tab => (
                <button
                  key={tab.id}
                  id={`fw-tab-${tab.id}`}
                  type="button"
                  className={`fw-topic-tab ${selectedTopic === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    const nextTopic = tab.id as any;
                    setSelectedTopic(nextTopic);
                    if (nextTopic === 'hackathon') {
                      if (!query || query === 'scholarship' || query === 'admission') {
                        setQuery('hackathon');
                        handleSearchSources('hackathon');
                      }
                    } else if (nextTopic === 'scholarship') {
                      if (!query || query === 'hackathon' || query === 'admission') {
                        setQuery('scholarship');
                        handleSearchSources('scholarship');
                      }
                    } else if (nextTopic === 'admission') {
                      if (!query || query === 'hackathon' || query === 'scholarship') {
                        setQuery('admission');
                        handleSearchSources('admission');
                      }
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="fw-search-row">
              <input
                id="fw-search-input"
                className="input"
                type="text"
                placeholder={
                  selectedTopic === 'hackathon'
                    ? 'e.g. hackathon, Smart India Hackathon, web3, AI'
                    : selectedTopic === 'scholarship'
                    ? 'e.g. NSP, post-matric, pre-matric, merit scholarship'
                    : selectedTopic === 'admission'
                    ? 'e.g. CUET, NTA, JEE, GATE, college admission'
                    : 'e.g. mppsc, upsc, scholarship, hackathon, ssc cgl'
                }
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setStoredInfo(null);
                  setLookupError(null);
                  setDuplicateWarning(null);
                }}
                onKeyDown={e => e.key === 'Enter' && handleSearchSources()}
              />
              <button
                id="fw-search-btn"
                className="btn btn-primary"
                onClick={() => handleSearchSources()}
                disabled={searchLoading || !query.trim()}
              >
                {searchLoading ? 'Searching…' : '🔍 Search Registry'}
              </button>
              <button
                id="fw-refine-btn"
                className="btn btn-secondary"
                onClick={() => handleSearchSources()}
                disabled={searchLoading || !query.trim()}
                title="Search and refine matching sources"
              >
                {searchLoading ? 'Analyzing…' : 'Refine'}
              </button>
            </div>

            {/* Requirement 3: Hackathons & Events filter panel */}
            {(selectedTopic === 'hackathon' || query.toLowerCase().includes('hackathon')) && (
              <div id="fw-hackathon-filters-panel" className="fw-narrow-panel" style={{ marginTop: '10px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  💻 Hackathons &amp; Events Filters:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Mode / Location:
                    </label>
                    <select
                      id="fw-hackathon-mode-select"
                      className="input"
                      value={hackathonMode}
                      onChange={e => setHackathonMode(e.target.value)}
                    >
                      <option value="all">Any Mode (Online &amp; Offline)</option>
                      <option value="online">Online / Virtual only</option>
                      <option value="offline">In-Person / Offline only</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      City / State:
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        id="fw-hackathon-city-input"
                        className="input"
                        placeholder="e.g. Bhopal, Delhi, Bengaluru"
                        value={hackathonCity}
                        onChange={e => setHackathonCity(e.target.value)}
                      />
                      <button
                        id="fw-use-profile-city-btn"
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleUseProfileCity}
                        title="Opt-in: Autofill city from your profile"
                      >
                        📍 Use Profile
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Deadline Window:
                    </label>
                    <select
                      id="fw-hackathon-deadline-select"
                      className="input"
                      value={hackathonDeadlineDays}
                      onChange={e => setHackathonDeadlineDays(e.target.value)}
                    >
                      <option value="all">Any Deadline</option>
                      <option value="7">Within 7 Days</option>
                      <option value="15">Within 15 Days</option>
                      <option value="30">Within 30 Days</option>
                      <option value="60">Within 60 Days</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px' }}>
                    <label className="fw-checkbox-label" style={{ fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        id="fw-student-eligible-cb"
                        type="checkbox"
                        checked={hackathonStudentOnly}
                        onChange={e => setHackathonStudentOnly(e.target.checked)}
                      />
                      🎓 Student-eligible only
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Requirement 2: DEDUPE: Offer to update existing watch */}
            {duplicateWarning && (
              <div
                id="fw-duplicate-banner"
                className="fw-error-banner"
                style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span>
                  <div>
                    <strong>Existing Watch Found: </strong>
                    <span>{duplicateWarning.message}</span>
                  </div>
                </div>
                <button
                  id="fw-update-existing-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSaveWatch(true)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  🔄 Update Existing Watch
                </button>
              </div>
            )}

            {/* Requirement 1: Show an error message in the UI when the lookup fails instead of silently showing nothing */}
            {lookupError && (
              <div id="fw-lookup-error" className="fw-error-banner" role="alert">
                <span>⚠️</span>
                <div>
                  <strong>Lookup Failed: </strong>
                  <span>{lookupError}</span>
                </div>
              </div>
            )}

            {/* Requirement 3: For a broad word like "scholarship" show categories first (state, education level, govt/private) and then matching sources */}
            {isBroadQuery && broadCategories.length > 0 && (
              <div id="fw-broad-categories" className="fw-narrow-panel">
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Select clarifying categories to narrow your topic ({query}):
                </h4>
                {broadCategories.map(cat => (
                  <div key={cat.key} className="fw-filter-group">
                    <div className="fw-filter-label">{cat.label}</div>
                    <div className="fw-chips">
                      {cat.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`fw-chip ${selectedBroadOptions[cat.key] === opt ? 'fw-chip-selected' : ''}`}
                          onClick={() =>
                            setSelectedBroadOptions(prev => ({ ...prev, [cat.key]: opt }))
                          }
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Requirement 1: Show matches as selectable cards with checkboxes. Pre-select ONLY best match; show rest under Add more sources */}
            {matchedSources.length > 0 && (
              <div id="fw-matched-sources-list" className="fw-selection-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Registry Portals ({matchedSources.length} match{matchedSources.length > 1 ? 'es' : ''})
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    Pre-selected best match • Pick portal to scan or save watch
                  </span>
                </div>

                {/* Best Match Card (Pre-selected) */}
                {bestMatch && (
                  <div
                    className={`fw-source-selection-card ${selectedSourceIds[bestMatch.id] ? 'selected' : ''}`}
                    id={`source-card-${bestMatch.id}`}
                  >
                    <div className="fw-card-header">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <input
                          id={`source-cb-${bestMatch.id}`}
                          type="checkbox"
                          style={{ marginTop: '4px', cursor: 'pointer', width: '18px', height: '18px' }}
                          checked={Boolean(selectedSourceIds[bestMatch.id])}
                          onChange={e => {
                            const val = e.target.checked;
                            setSelectedSourceIds(prev => ({ ...prev, [bestMatch.id]: val }));
                            if (val) setSelectedSource(bestMatch);
                          }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 className="fw-card-title">{bestMatch.name}</h4>
                            <span className="fw-badge" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: 700 }}>
                              ⭐ Best Match
                            </span>
                          </div>
                          <a
                            href={bestMatch.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fw-card-url"
                            title="Open official portal in new tab"
                          >
                            🏛️ {bestMatch.url} ↗
                          </a>
                        </div>
                      </div>
                      <div>
                        {bestMatch.isVerified ? (
                          <span className="fw-badge fw-badge-verified">✓ Verified Govt Portal</span>
                        ) : (
                          <span className="fw-badge fw-badge-unverified">⚠️ Unverified Portal</span>
                        )}
                      </div>
                    </div>

                    <p className="fw-card-desc">{bestMatch.description}</p>

                    <div className="fw-card-monitors">
                      <strong>Monitored updates:</strong> {bestMatch.monitoredWhat || 'Recruitment notices, exam dates, admit cards & results'}
                    </div>

                    {/* Checkboxes for what to watch */}
                    <div className="fw-card-checkboxes">
                      <div style={{ width: '100%', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        What to watch on this portal:
                      </div>
                      {[
                        { id: 'recruitment', label: 'Recruitment / Vacancy' },
                        { id: 'notification', label: 'Notification / Advt' },
                        { id: 'admit_card', label: 'Admit Card' },
                        { id: 'result', label: 'Result' },
                        { id: 'syllabus', label: 'Syllabus / Exam Calendar' },
                      ].map(cat => (
                        <label key={cat.id} className="fw-checkbox-label">
                          <input
                            type="checkbox"
                            checked={Boolean(categoryCheckboxes[cat.id])}
                            onChange={e =>
                              setCategoryCheckboxes(prev => ({
                                ...prev,
                                [cat.id]: e.target.checked,
                              }))
                            }
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>

                    <div className="fw-card-footer">
                      <span>🕒 Last checked: {timeAgo(bestMatch.lastChecked)}</span>
                      <button
                        id={`btn-scan-${bestMatch.id}`}
                        className={`btn ${selectedSource?.id === bestMatch.id ? 'btn-primary' : 'btn-secondary'} btn-sm fw-select-source-btn`}
                        onClick={() => handlePickSource(bestMatch)}
                      >
                        {selectedSource?.id === bestMatch.id ? '✓ Scanning Notices' : 'Select Portal & Scan Notices'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Requirement 1: Show rest under "Add more sources" */}
                {otherMatches.length > 0 && (
                  <div id="fw-add-more-sources-section" className="fw-add-more-container" style={{ marginTop: '12px' }}>
                    <button
                      id="fw-toggle-add-more-btn"
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--color-bg-secondary)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                      }}
                      onClick={() => setShowAddMoreSources(prev => !prev)}
                    >
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        ➕ Add more sources ({otherMatches.length} additional portal{otherMatches.length > 1 ? 's' : ''})
                      </span>
                      <span>{showAddMoreSources ? '▲ Hide' : '▼ Expand'}</span>
                    </button>

                    {showAddMoreSources && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                        {otherMatches.map(src => {
                          const isChecked = Boolean(selectedSourceIds[src.id]);
                          return (
                            <div
                              key={src.id}
                              className={`fw-source-selection-card ${isChecked ? 'selected' : ''}`}
                              id={`source-card-${src.id}`}
                              style={{ margin: 0 }}
                            >
                              <div className="fw-card-header">
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  <input
                                    id={`source-cb-${src.id}`}
                                    type="checkbox"
                                    style={{ marginTop: '4px', cursor: 'pointer', width: '18px', height: '18px' }}
                                    checked={isChecked}
                                    onChange={e => {
                                      const val = e.target.checked;
                                      setSelectedSourceIds(prev => ({ ...prev, [src.id]: val }));
                                      if (val && !selectedSource) setSelectedSource(src);
                                    }}
                                  />
                                  <div>
                                    <h4 className="fw-card-title">{src.name}</h4>
                                    <a
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="fw-card-url"
                                    >
                                      🏛️ {src.url} ↗
                                    </a>
                                  </div>
                                </div>
                                <div>
                                  {src.isVerified ? (
                                    <span className="fw-badge fw-badge-verified">✓ Verified</span>
                                  ) : (
                                    <span className="fw-badge fw-badge-unverified">⚠️ Unverified</span>
                                  )}
                                </div>
                              </div>
                              <p className="fw-card-desc">{src.description}</p>
                              <div className="fw-card-footer">
                                <span>🕒 Last checked: {timeAgo(src.lastChecked)}</span>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handlePickSource(src)}
                                >
                                  Scan Portal Notices
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Requirement 4: NO MATCH flow */}
            {hasNoMatch && (
              <div id="fw-no-match-section" className="fw-selection-container">
                <div id="fw-no-match-banner" className="fw-error-banner" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b', color: '#b45309' }}>
                  <span>ℹ️</span>
                  <div>
                    <strong>No Verified Registry Match:</strong> No pre-indexed portal found for &ldquo;{query}&rdquo;.
                  </div>
                </div>

                {suggestions.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '8px 0', color: 'var(--color-text-primary)' }}>
                      Suggested Official Sites (Unverified):
                    </h4>
                    {suggestions.map((sugg, idx) => (
                      <div key={idx} className="fw-source-selection-card" style={{ borderStyle: 'dashed' }}>
                        <div className="fw-card-header">
                          <div>
                            <h4 className="fw-card-title">{sugg.name}</h4>
                            <a href={sugg.url} target="_blank" rel="noopener noreferrer" className="fw-card-url">
                              🌐 {sugg.url} ↗
                            </a>
                          </div>
                          <span className="fw-badge fw-badge-unverified">⚠️ Unverified</span>
                        </div>
                        <p className="fw-card-desc">{sugg.description}</p>
                        <div className="fw-card-footer">
                          <span style={{ fontSize: '11px', color: '#b45309' }}>
                            Government/Educational domain confirmed (.gov.in / .nic.in / .edu.in)
                          </span>
                          <button
                            id="fw-confirm-suggested-btn"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleConfirmSuggested(sugg)}
                          >
                            Confirm URL &amp; Scan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '8px' }}>
                  <button
                    id="fw-toggle-custom-btn"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowCustomUrlBox(prev => !prev)}
                  >
                    {showCustomUrlBox ? 'Hide Custom URL' : '+ Add a Custom Portal URL'}
                  </button>

                  {showCustomUrlBox && (
                    <div id="fw-custom-url-box" className="fw-custom-url-box">
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400e' }}>
                        ⚠️ Security Warning: Custom / Unverified URL
                      </div>
                      <p style={{ fontSize: '12px', color: '#78350f', margin: 0 }}>
                        TechForm Buddy will only monitor public notice tables. Never enter URLs of login pages, banking sites, or credential portals. Custom sites are unverified.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        <input
                          id="fw-custom-name-input"
                          className="input"
                          type="text"
                          placeholder="Portal Name (e.g. State Examination Board)"
                          value={customName}
                          onChange={e => setCustomName(e.target.value)}
                        />
                        <input
                          id="fw-custom-url-input"
                          className="input"
                          type="url"
                          placeholder="https://example.gov.in/notices"
                          value={customUrl}
                          onChange={e => setCustomUrl(e.target.value)}
                        />
                        <label className="fw-checkbox-label" style={{ fontWeight: 600, color: '#92400e' }}>
                          <input
                            id="fw-confirm-custom-cb"
                            type="checkbox"
                            checked={confirmCustomWarning}
                            onChange={e => setConfirmCustomWarning(e.target.checked)}
                          />
                          I acknowledge this is an unverified public portal and accept the risks.
                        </label>
                        <div>
                          <button
                            id="fw-use-custom-btn"
                            className="btn btn-primary btn-sm"
                            disabled={!customUrl.trim() || !confirmCustomWarning}
                            onClick={handleConfirmCustomUrl}
                          >
                            Confirm &amp; Use Custom URL
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Requirement 5: DISCOVERY flow after picking a source */}
            {selectedSource && (
              <div id="fw-discovery-section" className="fw-discovery-panel">
                <div className="fw-discovery-header">
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      📋 Live Notices on {selectedSource.name}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Select specific exams or notices to receive targeted alerts:
                    </p>
                  </div>
                  {discoveredNotices.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          discoveredNotices.forEach(n => { all[n.title] = true; });
                          setSelectedNotices(all);
                        }}
                      >
                        Select All
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => setSelectedNotices({})}
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {discoverLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 10px' }} />
                    Scanning official portal for active advertisements and examinations…
                  </div>
                ) : discoveredNotices.length > 0 ? (
                  <div className="fw-notice-list" id="fw-discovered-notices-list">
                    {discoveredNotices.map((notice, idx) => (
                      <label key={idx} className="fw-notice-item">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedNotices[notice.title])}
                          onChange={e =>
                            setSelectedNotices(prev => ({
                              ...prev,
                              [notice.title]: e.target.checked,
                            }))
                          }
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {notice.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {notice.date && <span>📅 {notice.date}</span>}
                            {notice.classification && (
                              <span style={{ textTransform: 'capitalize' }}>🏷️ {notice.classification}</span>
                            )}
                            {notice.link && (
                              <a href={notice.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>
                                PDF / Link ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', padding: '12px 0' }}>
                    No specific sub-notices found. All updates matching your monitored categories will be tracked.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedSource(null);
                      setDiscoveredNotices([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    id="fw-save-watch-btn"
                    className="btn btn-primary"
                    onClick={() => handleSaveWatch(false)}
                    disabled={creating}
                  >
                    {creating ? 'Saving Watch…' : `✓ Save Form Watch for ${selectedSource.name}`}
                  </button>
                </div>
              </div>
            )}

            {storedInfo && (
              <div className="fw-stored-info">
                🔒 <strong>Stored Data:</strong> {storedInfo}
              </div>
            )}
          </section>

          {/* ── Active Watches ── */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 style={{ margin: 0 }}>Your Form Watches ({watches.length})</h3>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="skeleton" style={{ height: '110px', borderRadius: '14px' }} />
                <div className="skeleton" style={{ height: '110px', borderRadius: '14px' }} />
              </div>
            ) : watches.length > 0 ? (
              <div className="fw-watches-list">
                {watches.map(watch => (
                  <div key={watch.id} className="fw-watch-card">
                    {/* Header */}
                    <div className="fw-watch-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span className="fw-watch-title">🔍 {watch.search_query}</span>
                        {watch.is_verified !== false ? (
                          <span className="fw-badge fw-badge-verified">✓ Verified Govt Portal</span>
                        ) : (
                          <span className="fw-badge fw-badge-unverified">⚠️ Custom Portal</span>
                        )}
                        {/* Status Badge: idle / checking / error / all_failed / source_error (Requirement 5) */}
                        <span
                          className={`fw-status-badge ${
                            checkingWatchId === watch.id
                              ? 'checking'
                              : watch.last_status === 'all_failed'
                              ? 'error'
                              : watch.last_status === 'source_error' || watch.last_status === 'error'
                              ? 'error'
                              : 'idle'
                          }`}
                        >
                          {checkingWatchId === watch.id
                            ? '🟡 Checking…'
                            : watch.last_status === 'all_failed'
                            ? '🔴 All Sources Failed'
                            : watch.last_status === 'source_error' || watch.last_status === 'error'
                            ? '🟠 Source Issue'
                            : '🟢 Idle / Active'}
                        </span>
                        {/* In-app alert badge */}
                        {watch.alerts.length > 0 && (
                          <span className="fw-alert-badge">
                            🔔 {watch.alerts.length} alert{watch.alerts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="fw-watch-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCheckNow(undefined, watch.id)}
                          disabled={checkingWatchId === watch.id}
                          title="Check sources for this watch now"
                        >
                          {checkingWatchId === watch.id ? 'Scanning…' : 'Check Now'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteWatch(watch.id)}
                          title="Delete this watch"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Official Portal Link */}
                    {watch.source_url && (
                      <div style={{ padding: '6px var(--space-lg) 2px', fontSize: '12px' }}>
                        <a href={watch.source_url} target="_blank" rel="noopener noreferrer" className="fw-card-url">
                          🏛️ {watch.source_name || watch.source_url} ↗
                        </a>
                      </div>
                    )}

                    {/* Monitored categories chips */}
                    {watch.monitored_categories && watch.monitored_categories.length > 0 && (
                      <div style={{ padding: '4px var(--space-lg)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Tracking:</span>
                        {watch.monitored_categories.map(c => (
                          <span key={c} style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                            {c.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Targeted notice selections */}
                    {watch.selected_notices && watch.selected_notices.length > 0 && (
                      <div style={{ padding: '4px var(--space-lg)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <strong>Targeted notices ({watch.selected_notices.length}):</strong>{' '}
                        {watch.selected_notices.slice(0, 3).join(', ')}
                        {watch.selected_notices.length > 3 && ` +${watch.selected_notices.length - 3} more`}
                      </div>
                    )}

                    {/* Filters Applied */}
                    {watch.filters && Object.keys(watch.filters).length > 0 && (
                      <div className="fw-watch-filters">
                        {Object.entries(watch.filters).map(([key, value]) => (
                          <span key={key} className="fw-watch-filter-chip">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Sources being checked with Per-Source Status (Requirement 5) */}
                    <div className="fw-watch-sources-container">
                      <strong>Sources monitored ({watch.sources_detail ? watch.sources_detail.length : watch.sources_being_checked.length}):</strong>
                      {watch.sources_detail && watch.sources_detail.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '6px' }}>
                          {watch.sources_detail.map(sd => {
                            const isOk = sd.status === 'ok';
                            const isBlocked = sd.status === 'blocked';
                            const isTimeout = sd.status === 'timeout';
                            const isParseError = sd.status === 'parse_error';
                            const isUnsupported = sd.status === 'unsupported';

                            let statusClass = 'fw-status-pill-ok';
                            let statusLabel = '✓ OK';
                            if (isBlocked) { statusClass = 'fw-status-pill-blocked'; statusLabel = '🚫 Blocked (401/403)'; }
                            else if (isTimeout) { statusClass = 'fw-status-pill-timeout'; statusLabel = '⏱️ Timeout'; }
                            else if (isParseError) { statusClass = 'fw-status-pill-parse'; statusLabel = '⚠️ Parse Error'; }
                            else if (isUnsupported) { statusClass = 'fw-status-pill-unsupported'; statusLabel = '⚪ Unsupported'; }
                            else if (!isOk && sd.status) { statusClass = 'fw-status-pill-error'; statusLabel = `⚠️ ${sd.status}`; }

                            return (
                              <div
                                key={sd.id}
                                className="fw-source-status-row"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg-tertiary)', borderRadius: '6px' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: '13px' }}>🏛️ {sd.name}</span>
                                  <span className={`fw-source-status-pill ${statusClass}`}>{statusLabel}</span>
                                  {sd.error_reason && (
                                    <span className="fw-source-error-reason" style={{ fontSize: '11px', color: '#dc2626' }}>
                                      ({sd.error_reason})
                                    </span>
                                  )}
                                  {sd.last_success_at && (
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                      • Last OK: {timeAgo(sd.last_success_at)}
                                    </span>
                                  )}
                                </div>
                                <button
                                  className="btn btn-ghost btn-sm fw-retry-source-btn"
                                  style={{ fontSize: '11px', padding: '2px 8px' }}
                                  onClick={() => handleCheckNow(sd.id, watch.id)}
                                  disabled={checkingWatchId === watch.id}
                                  title={`Retry checking ${sd.name}`}
                                >
                                  🔄 Retry
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        watch.sources_being_checked.map(srcName => (
                          <span key={srcName} className="fw-watch-source-pill">
                            🏛️ {srcName}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Meta info: Last checked timestamp */}
                    <div className="fw-watch-meta">
                      <span>🕒 Last checked: {timeAgo(watch.last_checked)}</span>
                      <span>📅 Created {timeAgo(watch.created_at)}</span>
                    </div>

                    {/* Matched Notices & Alerts */}
                    {watch.alerts.length > 0 ? (
                      <div className="fw-watch-alerts">
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Matched Notices ({watch.alerts.length}):
                        </div>
                        {watch.alerts.map((alert: WatchAlert) => (
                          <div key={alert.id} className="fw-alert-item">
                            <span className={`fw-alert-class fw-class-${alert.classification}`}>
                              {classLabel(alert.classification)}
                            </span>
                            <div className="fw-alert-content">
                              <div className="fw-alert-title">{alert.notice_title}</div>
                              {/* Requirement 4: Every alert stores "why this matched" */}
                              {alert.why_matched && (
                                <div className="fw-alert-why-matched" style={{ fontSize: '11px', color: '#475569', marginTop: '3px', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: '4px' }}>
                                  💡 <strong>Why matched:</strong> {alert.why_matched}
                                </div>
                              )}
                              <div className="fw-alert-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                                <span className="fw-source-badge">🏛️ {alert.source_name}</span>
                                {alert.deadline_date && (
                                  <span className="fw-deadline-chip">
                                    📅 Deadline: {alert.deadline_date}
                                  </span>
                                )}
                                <span>• Discovered {timeAgo(alert.created_at)}</span>
                              </div>
                              <div className="fw-alert-actions">
                                <button
                                  className="fw-btn-buddy"
                                  onClick={() =>
                                    handleOpenWithBuddy(
                                      alert.notice_link || 'https://scholarships.gov.in',
                                      alert.notice_title,
                                      alert.id
                                    )
                                  }
                                >
                                  🚀 Open with Buddy
                                </button>
                                {alert.notice_link && (
                                  <a
                                    href={alert.notice_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: '11px', padding: '3px 8px' }}
                                  >
                                    Visit Site ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 'var(--space-sm) var(--space-lg) var(--space-md)',
                          fontSize: 'var(--font-size-xs)',
                          color: watch.last_status === 'all_failed' ? '#dc2626' : 'var(--color-text-tertiary)',
                          fontWeight: watch.last_status === 'all_failed' ? 600 : 400,
                        }}
                      >
                        {watch.last_status === 'all_failed'
                          ? '⚠️ All monitored sources failed to respond. No portals could be reached.'
                          : 'No matching notices found yet. Click “Check Now” to scan official portals.'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="56" height="56">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <p className="text-muted" style={{ fontWeight: 600 }}>No Form Watches Created</p>
                <p className="text-xs text-muted">
                  Type a topic above (e.g. scholarship or exam name) to monitor government portals automatically.
                </p>
              </div>
            )}
          </section>

          {/* ── Source Registry ── */}
          <section>
            <div className="fw-sources-header">
              <div>
                <h3 style={{ margin: 0 }}>Registered Source Portals ({sources.length})</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Official state and national government notification portals periodically polled by TechForm Buddy.
                </p>
              </div>
            </div>

            <div className="fw-sources-grid" style={{ marginTop: 'var(--space-md)' }}>
              {sources
                .filter(source => {
                  const isLocalTest =
                    source.url.includes('test-source') ||
                    source.url.includes('localhost') ||
                    source.category === 'test';
                  if (!isLocalTest) return true;
                  // Dev flag: only show when dev flag or query ?dev=true is active (hydrated safely via useEffect)
                  if (isDevQuery) return true;
                  if (process.env.NODE_ENV === 'development') return true;
                  return false;
                })
                .map(source => {
                const statusOk = source.last_status === 'ok';
                const statusUnknown = !source.last_status;
                const isLocalTest = source.url.includes('test-source');

                return (
                  <div key={source.id} className="fw-source-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="fw-source-name">{source.name}</span>
                      {isLocalTest && (
                        <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          TEST SOURCE
                        </span>
                      )}
                    </div>

                    <div className="fw-source-meta">
                      <span
                        className={`fw-status-dot ${
                          statusOk ? 'fw-status-ok' : statusUnknown ? 'fw-status-unknown' : 'fw-status-error'
                        }`}
                      />
                      <span>
                        {statusOk
                          ? `Polled OK • ${timeAgo(source.last_checked_at)}`
                          : statusUnknown
                          ? 'Not checked yet'
                          : `Status: ${source.last_status}`}
                      </span>
                    </div>

                    <div className="fw-source-meta">
                      <span>Category: {source.category || 'general'}</span>
                      {source.state && <span>• State: {source.state}</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                        onClick={() => handleCheckNow(source.id)}
                      >
                        Scan This Source
                      </button>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        Visit ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Open with Buddy Guide Modal ── */}
        {guideModal && (
          <div className="fw-modal-backdrop" onClick={() => setGuideModal(null)}>
            <div className="fw-modal-card" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '32px' }}>🚀</div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Opening with TechForm Buddy
                  </h3>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    {guideModal.portalName}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#2563eb', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                      Portal opened in your browser
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      The official notice/portal has opened in a new tab. TechForm Buddy extension is ready to assist.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#2563eb', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                      Click &ldquo;Start on this page&rdquo;
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Buddy will analyze the fields and automatically map your verified profile details into the form.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#2563eb', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                      Review &amp; Submit Safely
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      🔒 Zero Credential Retention: You review all values and submit the official form yourself.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <a
                  href={guideModal.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Re-open Tab ↗
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setGuideModal(null)}>
                  Got It!
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

// ── Utility: Base64 to Uint8Array for VAPID ──

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
