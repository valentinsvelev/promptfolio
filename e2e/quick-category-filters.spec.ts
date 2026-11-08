import { test, expect } from '@playwright/test';

// Runs in built-in demo mode; no production Supabase access.
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
});

test('Other teams shows category quick filters scoped to other teams', async ({ page }) => {
  await page.getByRole('button', { name: 'Other teams', exact: true }).click();
  const categories = page.getByRole('group', { name: 'Select a category' });
  await expect(categories.getByRole('button', { name: 'Research', exact: true })).toBeVisible();
  await expect(categories.getByRole('button', { name: 'Analysis', exact: true })).toBeVisible();
  await expect(categories.getByRole('button', { name: 'Writing', exact: true })).toHaveCount(0);

  await categories.getByRole('button', { name: 'Research' }).click();
  await expect(page.locator('.prompt-row')).toHaveCount(1);
  await expect(page.locator('.prompt-row').first()).toContainText('Explore a market opportunity');
  await categories.getByRole('button', { name: 'Research' }).click();
  await expect(page.locator('.prompt-row')).toHaveCount(2);
});

test('My prompts shows categories scoped to owned or created prompts', async ({ page }) => {
  await page.getByRole('button', { name: 'My prompts', exact: true }).click();
  const categories = page.getByRole('group', { name: 'Select a category' });
  await expect(categories.getByRole('button', { name: 'Writing', exact: true })).toBeVisible();
  await expect(categories.getByRole('button', { name: 'Productivity', exact: true })).toBeVisible();
  await expect(categories.getByRole('button', { name: 'Research', exact: true })).toHaveCount(0);

  await categories.getByRole('button', { name: 'Writing' }).click();
  await expect(page.locator('.prompt-row')).toHaveCount(2);
  await categories.getByRole('button', { name: 'Writing' }).click();
  await expect(page.locator('.prompt-row')).toHaveCount(3);

  // Trash is a separate view and should not show category quick filters.
  await page.getByRole('button', { name: 'Trash', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Select a category' })).toHaveCount(0);
});
