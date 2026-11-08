import { test, expect } from '@playwright/test';

test('sign-in has its own direct, refreshable URL', async ({ page }) => {
  await page.goto('./#/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
});

test('sign-up has a direct URL and browser history switches form modes', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await expect(page).toHaveURL(/#\/sign-up$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByText('Full name')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('going back to sign-in updates the address', async ({ page }) => {
  await page.goto('./#/sign-up');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
});

test('entering demo and returning from guest mode maintain meaningful URLs', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Continue as guest/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.locator('main .page-heading h1')).toContainText('Explore.');
});

test('plain site URL defaults to sign-in and keeps URL query strings', async ({ page }) => {
  await page.goto('./?from=colleague%40example.com');
  await expect(page).toHaveURL(/\?from=colleague%40example\.com#\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
});
