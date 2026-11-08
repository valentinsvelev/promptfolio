import { test, expect } from '@playwright/test';

test('prompt details show owner, category, and an icon-only approval indicator', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();

  await page.locator('.prompt-row').filter({
    hasText: 'Turn meeting notes into action items',
  }).click();

  const badges = page.locator('.detail-panel .status-row');
  await expect(badges.locator('.flag')).toHaveText(['Operations', 'Writing']);
  await expect(badges).not.toContainText(/published|approved/i);
  await expect(badges.getByRole('img', { name: 'Approved' })).toBeVisible();
});
