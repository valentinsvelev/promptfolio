import { test, expect } from '@playwright/test';

const demo = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
};

test('a direct My prompts URL survives navigation, history and reload', async ({ page }) => {
  await page.goto('./#/my-prompts');
  await demo(page);
  await expect(page).toHaveURL(/\/promptfolio\/#\/my-prompts$/);
  await expect(page.getByRole('heading', { name: /Manage your prompts/i })).toBeVisible();

  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.getByRole('heading', { name: /Collaborative prompt portfolio/i })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#\/my-prompts$/);
  await expect(page.getByRole('heading', { name: /Manage your prompts/i })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/#\/explore$/);

  await page.goto('./#/my-prompts');
  await page.reload();
  await demo(page); // Demo mode does not persist login across reloads.
  await expect(page.getByRole('heading', { name: /Manage your prompts/i })).toBeVisible();
});

test('the changelog opens from a direct URL', async ({ page }) => {
  await page.goto('./#/changelog');
  await demo(page);
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();
  await expect(page).toHaveURL(/#\/changelog$/);
  await page.getByRole('button', { name: /Back to library/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
});

test('guest-only mode redirects restricted pages to Explore', async ({ page }) => {
  await page.goto('./#/admin');
  await page.getByRole('button', { name: /Continue as guest/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.getByRole('heading', { name: /Collaborative prompt portfolio/i })).toBeVisible();
});

test('existing prompt-sharing query parameters survive hash navigation', async ({ page }) => {
  const promptId = '30000000-0000-4000-8000-000000000001';
  await page.goto(`./?prompt=${promptId}&from=colleague%40example.com#/my-prompts`);
  await demo(page);
  await expect(page).toHaveURL(new RegExp(`\\?prompt=${promptId}.*#\\/explore$`));
  await expect(page.locator('.detail-title')).toContainText('Turn meeting notes into action items');
});
