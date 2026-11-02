'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import './notifications.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  link: string | null;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) setNotifications(await res.json());
  };

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useAppHeader({
    title: 'Notifications',
    subtitle: `${unreadCount} unread`,
    actions: unreadCount > 0 ? (
      <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
        Mark all as read
      </button>
    ) : null,
  });

  return (
    <div className="notif-content animate-fadeIn">
          {notifications.length > 0 ? (
            <div className="notif-list">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notif-card card ${!notif.is_read ? 'notif-card-unread' : ''}`}
                  onClick={() => !notif.is_read && markRead(notif.id)}
                >
                  <div className={`notif-type-dot notif-type-${notif.type}`} />
                  <div className="notif-card-content">
                    <div className="notif-card-header">
                      <span className="notif-card-title">{notif.title}</span>
                      <span className="text-xs text-muted">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted">{notif.message}</p>
                    {notif.link && (
                      <Link href={notif.link} className="text-sm" style={{ marginTop: '4px', display: 'inline-block' }}>
                        View details →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="64" height="64"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              <p className="text-muted">No notifications yet</p>
              <p className="text-xs text-muted">Notifications about form watches and updates will appear here</p>
            </div>
          )}
        </div>
  );
}
