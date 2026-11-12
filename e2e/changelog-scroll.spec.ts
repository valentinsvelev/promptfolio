import { test, expect } from '@playwright/test';

test('footer version link opens changelog at the top', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);

  const versionLink = page.getByRole('link', { name: /View changelog for v/i });
  // Focus and keyboard activation work on mobile, too, without asking
  // Playwright to scroll the entire footer into view using a smooth animation.
  await versionLink.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/#\/changelog$/);
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
});
