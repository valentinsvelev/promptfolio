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

  // Test the observable requirement rather than comparing the panel's CSS width
  // to window.innerWidth (which can differ from the content viewport on mobile).
  // The panel must escape the list's layout, cover the header, and receive taps.
  const placement = await detail.evaluate(panel => {
    const button = panel.querySelector<HTMLButtonElement>('.detail-mobile-close')!;
    const header = document.querySelector<HTMLElement>('.topbar')!;
    const headerRect = header.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const headerHit = document.elementFromPoint(
      Math.max(1, Math.min(viewportWidth - 1, headerRect.left + headerRect.width / 2)),
      Math.max(1, Math.min(window.innerHeight - 1, headerRect.top + headerRect.height / 2)),
    );
    const closeHit = document.elementFromPoint(
      buttonRect.left + buttonRect.width / 2,
      buttonRect.top + buttonRect.height / 2,
    );
    return {
      portalledToBody: panel.parentElement === document.body,
      fixedPosition: getComputedStyle(panel).position === 'fixed',
      coversHeader: headerHit === panel || (headerHit !== null && panel.contains(headerHit)),
      closeReceivesTaps: closeHit === button || button.contains(closeHit),
    };
  });
  expect(placement).toEqual({
    portalledToBody: true,
    fixedPosition: true,
    coversHeader: true,
    closeReceivesTaps: true,
  });

  await close.click();
  await expect(detail).toHaveCount(0);
  await expect(page.locator('.prompt-row').first()).toBeVisible();
});
