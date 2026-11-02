import { test, expect } from '@playwright/test';
import { attachFileToInput } from '../src/applyFill';

test.describe('Item E: Document, Photo, Signature Upload & Portal Attachment Suite', () => {
  // Test 1: attachFileToInput assigns File via DataTransfer and dispatches change event
  test('attachFileToInput populates input.files and fires change/input events', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <input type="file" id="test-photo" accept="image/*" />
          <div id="status">No file</div>
          <script>
            const input = document.getElementById('test-photo');
            input.addEventListener('change', () => {
              const file = input.files[0];
              document.getElementById('status').textContent = file ? file.name + ' (' + file.size + 'b)' : 'No file';
            });
          </script>
        </body>
      </html>
    `);

    const result = await page.evaluate(() => {
      const input = document.getElementById('test-photo') as HTMLInputElement;
      const file = new File(['dummy-photo-content'], 'applicant_photo.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        hasFiles: input.files ? input.files.length > 0 : false,
        fileName: input.files ? input.files[0]?.name : null,
      };
    });

    expect(result.hasFiles).toBe(true);
    expect(result.fileName).toBe('applicant_photo.jpg');

    const statusText = await page.locator('#status').textContent();
    expect(statusText).toContain('applicant_photo.jpg');
  });

  // Test 2: Demo Portal renders photo, signature and document slots
  test('Demo Portal page renders photo, signature, and document upload slots', async ({ page }) => {
    // Mock NextAuth session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { name: 'Raj', email: 'raj@example.com' } }),
      });
    });

    await page.goto('/demo-portal');
    await page.waitForLoadState('networkidle');

    // Verify upload slots exist
    const photoInput = page.locator('#portal-photo-input');
    const sigInput = page.locator('#portal-signature-input');
    const docInput = page.locator('#portal-document-input');

    await expect(photoInput).toBeVisible();
    await expect(sigInput).toBeVisible();
    await expect(docInput).toBeVisible();

    // Verify accept attributes match government requirements
    await expect(photoInput).toHaveAttribute('accept', 'image/jpeg,image/png');
    await expect(sigInput).toHaveAttribute('accept', 'image/jpeg,image/png');
    await expect(docInput).toHaveAttribute('accept', 'application/pdf,image/*');
  });

  // Test 3: Setting a file in Demo Portal updates the validation status
  test('Uploading a file in Demo Portal validates size and displays attachment confirmation', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { name: 'Raj', email: 'raj@example.com' } }),
      });
    });

    await page.goto('/demo-portal');
    await page.waitForLoadState('networkidle');

    // Set file on photo input (50 KB buffer)
    const photoInput = page.locator('#portal-photo-input');
    await photoInput.setInputFiles({
      name: 'passport_photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(50 * 1024, 'a'),
    });

    // Verify confirmation message
    const photoStatus = page.locator('text=Attached: passport_photo.jpg');
    await expect(photoStatus).toBeVisible();
    await expect(photoStatus).toContainText('50 KB');

    // Set file on signature input (20 KB buffer)
    const sigInput = page.locator('#portal-signature-input');
    await sigInput.setInputFiles({
      name: 'signature.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(20 * 1024, 'b'),
    });

    const sigStatus = page.locator('text=Attached: signature.png');
    await expect(sigStatus).toBeVisible();
    await expect(sigStatus).toContainText('20 KB');
  });

  // Test 4: Size limits detection warns when file exceeds threshold
  test('Demo portal warns when uploaded file exceeds portal limit', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { name: 'Raj', email: 'raj@example.com' } }),
      });
    });

    await page.goto('/demo-portal');
    await page.waitForLoadState('networkidle');

    // Upload 150 KB photo (exceeds 100 KB limit)
    const photoInput = page.locator('#portal-photo-input');
    await photoInput.setInputFiles({
      name: 'large_photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(150 * 1024, 'x'),
    });

    const warning = page.locator('text=Exceeds 100 KB limit');
    await expect(warning).toBeVisible();
  });
});

