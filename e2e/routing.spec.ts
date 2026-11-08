import { test, expect, type Page } from '@playwright/test';

const demo = async (page: Page) => {
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
};

const expectPageTitle = async (page: Page, title: string) => {
  await expect(page.locator('main .page-heading h1')).toContainText(title);
};

test('a direct My prompts URL survives navigation, history and reload', async ({ page }) => {
  await page.goto('./#/my-prompts');
  await demo(page);
  await expect(page).toHaveURL(/\/promptfolio\/#\/my-prompts$/);
  await expectPageTitle(page, 'My prompts');

  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expectPageTitle(page, 'Explore.');

  await page.goBack();
  await expect(page).toHaveURL(/#\/my-prompts$/);
  await expectPageTitle(page, 'My prompts');

  await page.goForward();
  await expect(page).toHaveURL(/#\/explore$/);

  await page.goto('./#/my-prompts');
  await page.reload();
  await demo(page); // Demo mode does not persist login across reloads.
  await expectPageTitle(page, 'My prompts');
});

test('the public changelog opens from a direct URL', async ({ page }) => {
  await page.goto('./#/changelog');
  // The changelog has been public since Issue #11; no demo sign-in is needed.
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();
  await expectPageTitle(page, 'Changelog');
  await expect(page).toHaveURL(/#\/changelog$/);
  await page.getByRole('button', { name: /Back to library/i }).click();
  // Visitors who are not signed in return to the sign-in page.
  await expect(page).toHaveURL(/#\/sign-in$/);
});

test('guest-only mode redirects restricted pages to Explore', async ({ page }) => {
  await page.goto('./#/admin');
  await page.getByRole('button', { name: /Continue as guest/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expectPageTitle(page, 'Explore.');
});

test('existing prompt-sharing query parameters survive hash navigation', async ({ page }) => {
  const promptId = '30000000-0000-4000-8000-000000000001';
  await page.goto(`./?prompt=${promptId}&from=colleague%40example.com#/my-prompts`);
  await demo(page);
  await expect(page).toHaveURL(new RegExp(`\\?prompt=${promptId}.*#\\/explore$`));
  await expect(page.locator('.detail-title')).toContainText('Turn meeting notes into action items');
});
