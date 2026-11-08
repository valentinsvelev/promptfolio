import { test, expect, type Page } from '@playwright/test';

async function checkCompactHeading(page: Page, title: string) {
  const header = page.locator('main .page-heading');
  await expect(header).toBeVisible();
  await expect(header.locator('h1')).toContainText(title);
  await expect(header.locator('p')).not.toBeEmpty();
  return header;
}

test('all workspace pages use the compact Option B header', async ({ page, isMobile }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const pages = [
    ['Explore', 'Explore.'],
    ['My prompts', 'My prompts'],
    ['Teams', 'Teams'],
    ['Reviews', 'Reviews'],
    ['Admin', 'Admin'],
  ] as const;

  for (const [navLabel, title] of pages) {
    await test.step(`navigate to ${navLabel}`, async () => {
      await nav.getByRole('button', { name: new RegExp(`^${navLabel}(?:\\s+\\d+)?$`) }).click();
      const header = await checkCompactHeading(page, title);
      const box = await header.boundingBox();
      expect(box?.height).toBeLessThan(isMobile ? 115 : 95);
    });
  }

  await test.step('open Changelog from the footer', async () => {
    await page.getByRole('link', { name: /View changelog for v/i }).click();
    await checkCompactHeading(page, 'Changelog');
    await expect(page).toHaveURL(/#\/changelog$/);
  });
});

test('the public changelog has the same compact header', async ({ page }) => {
  await page.goto('./#/changelog');
  await checkCompactHeading(page, 'Changelog');
});
