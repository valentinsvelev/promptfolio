import { test, expect } from '@playwright/test';
import { navigateToPage } from './helpers/navigation';

// Playwright's dev server runs with Supabase credentials cleared: demo only.
test.beforeEach(async ({ page, isMobile }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await navigateToPage(page, 'Admin', isMobile);
  await expect(page.locator('.admin-category-management')).toBeVisible();
});

test('in-use categories cannot be deleted', async ({ page }) => {
  const card = page.locator('.admin-category-management');
  await card.getByRole('combobox', { name: 'Select a category to rename' }).selectOption('Writing');
  await expect(card.getByRole('button', { name: 'Delete category' })).toBeDisabled();
  await expect(card.getByRole('status')).toContainText('cannot be deleted');
});

test('an unused category can be deleted after confirmation', async ({ page }) => {
  const card = page.locator('.admin-category-management');
  const select = card.getByRole('combobox', { name: 'Select a category to rename' });
  await select.selectOption('Engineering');
  await card.getByRole('button', { name: 'Delete category' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Engineering');
  await dialog.getByRole('button', { name: 'Delete category' }).click();
  await expect(select.locator('option[value="Engineering"]')).toHaveCount(0);
});

test('unused categories can be removed in bulk without affecting used ones', async ({ page, isMobile }) => {
  const card = page.locator('.admin-category-management');
  await card.getByRole('button', { name: /Delete unused \(3\)/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Prompt content and history will not be changed');
  await dialog.getByRole('button', { name: 'Delete unused categories' }).click();
  const options = card.getByRole('combobox', { name: 'Select a category to rename' }).locator('option');
  await expect(options).toHaveCount(5); // Placeholder + four used categories.
  await expect(card.getByRole('button', { name: /Delete unused/ })).toBeDisabled();
  await expect(card.getByRole('combobox', { name: 'Select a category to rename' }).locator('option[value="Writing"]')).toHaveCount(1);
  await navigateToPage(page, 'Explore', isMobile);
  await expect(page.locator('.prompt-row')).toHaveCount(5);
});
