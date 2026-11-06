import { test, expect } from '@playwright/test';

test('demo user can generate and refresh an email preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop smoke test');

  await page.goto('./');
  await page.getByRole('button', { name: /Try the full demo workspace/i })
    .click();

  // Email sharing is available to a signed-in demo user, not a read-only guest.
  const prompt = page.locator('.prompt-row')
    .filter({ hasText: 'Turn meeting notes into action items' });
  await expect(prompt).toBeVisible();
  await prompt.click();
  await page.getByRole('button', { name: 'Send via email' }).click();

  const dialog = page.getByRole('dialog')
    .filter({ has: page.locator('.share-email-dialog') });
  await dialog.getByRole('textbox', { name: 'Recipient name' }).fill('Alex');
  await dialog.getByRole('button', { name: 'Generate email preview' }).click();

  const body = dialog.getByRole('textbox', { name: 'Edit email message' });
  await expect(body).toHaveValue(/Dear Alex/);
  await expect(body).toHaveValue(/Turn meeting notes into action items/);

  await dialog.getByRole('button', { name: 'Casual' }).click();
  await dialog.getByRole('button', { name: 'Refresh preview' }).click();
  await expect(body).toHaveValue(/Hi Alex/);
});
