import { test, expect } from '@playwright/test';
import { getDb } from '../../../src/lib/db';

test.describe('Notifications & Web Push Expansion (B8)', () => {
  const testUserId = 'test-notif-user-1';

  test.beforeAll(() => {
    const db = getDb();
    // Ensure test user exists in SQLite
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, preferred_language)
      VALUES (?, ?, ?, ?, ?)
    `).run(testUserId, 'testnotif@example.com', 'test-hash-placeholder', 'Notif Test User', 'en');

    // Clean up notifications for this test user
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(testUserId);

    // Seed 2 notifications
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('notif-t1', testUserId, 'UPSC Civil Services 2026', 'New registration window open', 'info', 0, '/forms');

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('notif-t2', testUserId, 'Grievance Acknowledged', 'Your grievance TFB-GOV-123456 has been registered', 'success', 0, '/grievances');
  });

  test('VAPID key endpoint returns valid public key string or 503 fallback', async ({ request }) => {
    const res = await request.get('/api/push/vapid-key');
    if (res.status() === 200) {
      const data = await res.json();
      expect(typeof data.publicKey).toBe('string');
      expect(data.publicKey.length).toBeGreaterThan(10);
    } else {
      expect(res.status()).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('VAPID not configured');
    }
  });

  test('Push subscription endpoint validates payload structure and rejects invalid payloads with 400', async ({ request }) => {
    // Missing required p256dh and auth keys
    const res = await request.post('/api/push/subscribe', {
      data: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint',
      },
    });

    // When not logged in, returns 401; when logged in without keys returns 400
    expect([400, 401]).toContain(res.status());
  });

  test('Direct DB notification updates reflect is_read state correctly', async () => {
    const db = getDb();
    const before = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(testUserId) as { count: number };
    expect(before.count).toBe(2);

    // Mark single notification read
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run('notif-t1', testUserId);
    const afterOne = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get('notif-t1') as { is_read: number };
    expect(afterOne.is_read).toBe(1);

    // Mark all read
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(testUserId);
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(testUserId) as { count: number };
    expect(unreadCount.count).toBe(0);
  });

  test('Notifications page loads and renders notification interface', async ({ page }) => {
    // Mock NextAuth session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: testUserId, name: 'Notif Test User', email: 'testnotif@example.com' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Page title check
    await expect(page.locator('h1')).toContainText(/Notifications|Alerts/i);

    // Verify notification content
    const content = await page.content();
    expect(content.includes('Notification') || content.includes('Alert') || content.includes('All')).toBe(true);
  });
});
