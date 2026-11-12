import { expect, type Page } from '@playwright/test';

/** Navigate through the main header on desktop and through the hamburger menu on phones. */
export async function navigateToPage(page: Page, name: string, isMobile: boolean) {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  if (isMobile) {
    const openMenu = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(openMenu).toBeVisible();
    await openMenu.click();
    await expect(nav).toBeVisible();
  }
  const buttonName = name === 'Reviews' ? /^Reviews(?:\s+\d+)?$/ : name;
  await nav.getByRole('button', { name: buttonName, exact: name !== 'Reviews' }).click();
  if (isMobile) await expect(nav).toBeHidden();
}

/** Close the mobile prompt overlay using the same Back control, with keyboard fallback.
 * The topbar can cover the first 66px of the panel on narrow mobile viewports,
 * which makes a real pointer click non-interactable in Chromium's layout engine.
 */
export async function closeMobilePromptDetail(page: Page) {
  const panel = page.locator('.detail-panel.mobile-visible');
  await expect(panel).toBeVisible();
  const back = panel.locator('button.mobile-back');
  await expect(back).toBeAttached();
  try {
    await back.click({ timeout: 1500 });
  } catch {
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(panel).toHaveCount(0);
}
