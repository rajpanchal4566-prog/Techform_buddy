'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useAppHeader } from '@/components/AppShellContext';

export interface ApplicationItem {
  id: string;
  user_id: string;
  title: string;
  type: string;
  portal_name: string;
  portal_url: string | null;
  reference_number: string;
  date_applied: string;
  status: 'draft' | 'submitted' | 'under_review' | 'action_needed' | 'approved' | 'rejected';
  next_action: string | null;
  deadline: string | null;
  notes: string | null;
  reminder_set: number;
  attached_documents: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  draft: { label: 'Draft', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  submitted: { label: 'Submitted', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  under_review: { label: 'Under Review', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  action_needed: { label: 'Action Needed', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  approved: { label: 'Approved', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  rejected: { label: 'Rejected', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
};

function ApplicationsContent() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useAppHeader({
    title: 'My Applications Tracker',
    subtitle: 'Track official government, education, and job applications across portals with deadline alerts',
    actions: (
      <button
        id="add-application-btn"
        onClick={() => setShowAddModal(true)}
        className="btn btn-primary btn-sm"
      >
        <span>+</span> Track New Application
      </button>
    ),
  });

  // New application form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Scholarship');
  const [newPortalName, setNewPortalName] = useState('');
  const [newPortalUrl, setNewPortalUrl] = useState('');
  const [newRefNumber, setNewRefNumber] = useState('');
  const [newStatus, setNewStatus] = useState<ApplicationItem['status']>('submitted');
  const [newNextAction, setNewNextAction] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newReminder, setNewReminder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Editing state for next action / deadline
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editNextAction, setEditNextAction] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApplications(data);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPortalName.trim() || !newRefNumber.trim()) {
      setErrorMsg('Please fill in title, portal name, and reference number.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          portal_name: newPortalName,
          portal_url: newPortalUrl,
          reference_number: newRefNumber,
          status: newStatus,
          next_action: newNextAction,
          deadline: newDeadline,
          notes: newNotes,
          reminder_set: newReminder ? 1 : 0,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        // Reset form
        setNewTitle('');
        setNewPortalName('');
        setNewPortalUrl('');
        setNewRefNumber('');
        setNewNextAction('');
        setNewDeadline('');
        setNewNotes('');
        setNewReminder(false);
        await fetchApplications();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed to save application');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: ApplicationItem['status']) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (res.ok) {
        setApplications(prev => prev.map(a => a.id === id ? { ...a, status: nextStatus } : a));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSaveNextAction = async (id: string) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          next_action: editNextAction,
          deadline: editDeadline,
        }),
      });
      if (res.ok) {
        setApplications(prev => prev.map(a => a.id === id ? { ...a, next_action: editNextAction, deadline: editDeadline } : a));
        setEditingAppId(null);
      }
    } catch (err) {
      console.error('Failed to update next action:', err);
    }
  };

  const handleToggleReminder = async (app: ApplicationItem) => {
    const nextVal = app.reminder_set ? 0 : 1;
    try {
      const res = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, reminder_set: nextVal }),
      });
      if (res.ok) {
        setApplications(prev => prev.map(a => a.id === app.id ? { ...a, reminder_set: nextVal } : a));
      }
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this tracked application?')) return;
    try {
      const res = await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setApplications(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete application:', err);
    }
  };

  const filtered = applications.filter(app => {
    const matchStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchSearch = !search ||
      app.title.toLowerCase().includes(search.toLowerCase()) ||
      app.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      app.portal_name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getDaysLeft = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const target = new Date(deadlineStr).getTime();
    const now = Date.now();
    const diff = Math.ceil((target - now) / (1000 * 3600 * 24));
    if (diff < 0) return { label: 'Deadline Passed', color: '#ef4444' };
    if (diff === 0) return { label: 'Due Today', color: '#f59e0b' };
    if (diff === 1) return { label: '1 Day Left', color: '#f59e0b' };
    return { label: `${diff} Days Left`, color: '#3b82f6' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '260px' }}>
              <input
                id="search-applications-input"
                type="text"
                placeholder="Search by title, portal, or reference number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  outline: 'none',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {['all', 'submitted', 'under_review', 'action_needed', 'approved', 'rejected'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: statusFilter === st ? 'var(--color-accent)' : 'var(--color-border)',
                    background: statusFilter === st ? 'var(--color-accent-light)' : 'transparent',
                    color: statusFilter === st ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Applications Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>
              Loading applications...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              background: 'var(--color-bg-secondary)',
              border: '1px dashed var(--color-border)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{ fontSize: '32px' }}>📂</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                No Tracked Applications Found
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '420px' }}>
                Keep all your portal applications, deadlines, reference numbers, and next actions synchronized in one safe place.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary"
                style={{ marginTop: '8px', padding: '8px 16px', fontSize: '13px' }}
              >
                Track Your First Application
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filtered.map(app => {
                const conf = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
                const daysInfo = getDaysLeft(app.deadline);
                const isEditing = editingAppId === app.id;

                return (
                  <div
                    key={app.id}
                    className="application-card"
                    style={{
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '4px',
                        }}>
                          {app.type}
                        </span>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                          {app.title}
                        </h3>
                      </div>

                      <select
                        aria-label={`Change status for ${app.title}`}
                        value={app.status}
                        onChange={e => handleUpdateStatus(app.id, e.target.value as any)}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${conf.border}`,
                          background: conf.bg,
                          color: conf.color,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="action_needed">Action Needed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    {/* Meta info */}
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🏛️ <strong>Portal:</strong> {app.portal_name}</span>
                        {app.portal_url && (
                          <a
                            href={app.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
                          >
                            Visit Portal ↗
                          </a>
                        )}
                      </div>
                      <div>
                        🔢 <strong>Ref ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)' }}>{app.reference_number}</span>
                      </div>
                      <div>
                        📅 <strong>Applied:</strong> {app.date_applied}
                      </div>
                    </div>

                    {/* Next Action & Deadline Box */}
                    <div style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Next action..."
                            value={editNextAction}
                            onChange={e => setEditNextAction(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                          />
                          <input
                            type="date"
                            value={editDeadline}
                            onChange={e => setEditDeadline(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleSaveNextAction(app.id)}
                              style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAppId(null)}
                              style={{ background: 'transparent', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>🎯 Next Action:</span>
                            <button
                              onClick={() => {
                                setEditingAppId(app.id);
                                setEditNextAction(app.next_action || '');
                                setEditDeadline(app.deadline || '');
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Edit
                            </button>
                          </div>
                          <div style={{ color: app.next_action ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}>
                            {app.next_action || 'No next action recorded'}
                          </div>
                          {app.deadline && daysInfo && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                              <span>Due: {app.deadline}</span>
                              <span style={{ fontWeight: 700, color: daysInfo.color, fontSize: '11px' }}>
                                ⏳ {daysInfo.label}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--color-border)' }}>
                      <button
                        onClick={() => handleToggleReminder(app)}
                        style={{
                          background: app.reminder_set ? '#eff6ff' : 'transparent',
                          border: `1px solid ${app.reminder_set ? '#bfdbfe' : 'var(--color-border)'}`,
                          color: app.reminder_set ? '#1d4ed8' : 'var(--color-text-secondary)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{app.reminder_set ? '🔔 Reminder ON' : '🔕 Remind Me'}</span>
                      </button>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {app.portal_url && (
                          <a
                            href={app.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: 'var(--color-accent-light)',
                              color: 'var(--color-accent)',
                              border: '1px solid var(--color-accent-muted)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Check Status ↗
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(app.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Delete application"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      {/* Add Application Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Track New Application
              </h2>
            </div>

            <form onSubmit={handleCreateApplication}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {errorMsg && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '12px' }}>
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                    Application Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NSP Post-Matric Scholarship 2026"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Category / Type
                    </label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    >
                      <option value="Scholarship">Scholarship</option>
                      <option value="Government Exam">Government Exam</option>
                      <option value="License / Certificate">License / Certificate</option>
                      <option value="Internship">Internship</option>
                      <option value="University Admission">University Admission</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Initial Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as any)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="action_needed">Action Needed</option>
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Portal Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Scholarship Portal"
                      value={newPortalName}
                      onChange={e => setNewPortalName(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Reference / Ack ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NSP-2026-894102"
                      value={newRefNumber}
                      onChange={e => setNewRefNumber(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                    Portal Status URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://scholarships.gov.in"
                    value={newPortalUrl}
                    onChange={e => setNewPortalUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Next Action Required
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Submit bonafide cert to college office"
                      value={newNextAction}
                      onChange={e => setNewNextAction(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={e => setNewDeadline(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="reminder-checkbox"
                    checked={newReminder}
                    onChange={e => setNewReminder(e.target.checked)}
                  />
                  <label htmlFor="reminder-checkbox" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Set in-app reminder alerts before deadline
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: '1px solid var(--color-border)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                >
                  {submitting ? 'Saving...' : 'Save Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /><p>Loading Applications...</p></div>}>
      <ApplicationsContent />
    </Suspense>
  );
}

