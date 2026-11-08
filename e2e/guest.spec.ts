import { test, expect } from '@playwright/test';

// Each test gets a fresh browser context with Promptfolio's built-in sample data.
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Continue as guest/i }).click();
  await expect(page.locator('.prompt-row')).toHaveCount(5);
});


test('guest can browse the sample prompt library', async ({ page }) => {
  await expect(page).toHaveURL(/#\/explore$/);

  await expect(
    page.locator('.prompt-row').filter({
      hasText: 'Turn meeting notes into action items',
    })
  ).toBeVisible();

  await expect(
    page.locator('.prompt-row').filter({
      hasText: 'Explore a market opportunity',
    })
  ).toBeVisible();
});


test('guest can search prompts by keyword', async ({ page }) => {
  await page.getByRole('button', { name: 'Keywords search' }).click();
  await page.getByRole('searchbox', { name: 'Search prompt keywords' })
    .fill('meeting notes');
  await page.getByRole('button', { name: /Show results/i }).click();

  await expect(page.locator('.prompt-row')).toHaveCount(1);
  await expect(page.locator('.prompt-row').first())
    .toContainText('Turn meeting notes into action items');
});

test('guest can filter by category', async ({ page }) => {
  await page.getByRole('group', { name: 'Select a category' })
    .getByRole('button', { name: 'Writing' }).click();

  await expect(page.locator('.prompt-row')).toHaveCount(2);
  await expect(page.locator('.prompt-row').filter({
    hasText: 'Write clearer customer emails',
  })).toBeVisible();
});

test('dark mode toggles without changing prompt data', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.prompt-row')).toHaveCount(5);

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a guest can open and close a prompt on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only navigation');

  await page.locator('.prompt-row')
    .filter({ hasText: 'Turn meeting notes into action items' }).click();
  await expect(page.locator('.detail-panel.mobile-visible')).toBeVisible();
  await expect(page.locator('.detail-panel .detail-title'))
    .toHaveText('Turn meeting notes into action items');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.detail-panel.mobile-visible')).toHaveCount(0);
});
