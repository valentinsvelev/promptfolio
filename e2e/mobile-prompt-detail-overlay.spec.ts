import { expect, test } from '@playwright/test';

test('mobile prompt detail covers the header and keeps its badges and close button accessible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only full-screen detail view');

  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await page.locator('.prompt-row').filter({ hasText: 'Turn meeting notes into action items' }).click();

  const detail = page.locator('.detail-panel.mobile-visible');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.status-row .flag')).toHaveText(['Team: Operations', 'Category: Writing']);
  await expect(detail.getByRole('img', { name: 'Approved' })).toBeVisible();

  const close = detail.getByRole('button', { name: 'Back' });
  await expect(close).toBeVisible();
  await expect(close).toBeInViewport();

  // The overlay must escape the underlying page layout and sit over the topbar.
  const placement = await detail.evaluate(panel => {
    const button = panel.querySelector<HTMLButtonElement>('.detail-mobile-close')!;
    const rect = panel.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(
      buttonRect.left + buttonRect.width / 2,
      buttonRect.top + buttonRect.height / 2,
    );
    return {
      portalledToBody: panel.parentElement === document.body,
      fillsViewport: Math.abs(rect.left) < 2 && Math.abs(rect.top) < 2 &&
        Math.abs(rect.width - window.innerWidth) < 2,
      closeReceivesTaps: hit === button || button.contains(hit),
    };
  });
  expect(placement).toEqual({
    portalledToBody: true,
    fillsViewport: true,
    closeReceivesTaps: true,
  });

  await close.click();
  await expect(detail).toHaveCount(0);
  await expect(page.locator('.prompt-row').first()).toBeVisible();
});
