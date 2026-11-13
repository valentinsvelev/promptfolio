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

/** Close the mobile detail overlay using the X in the badge row.
 * Exercise a real pointer click: a keyboard fallback would mask a blocked button.
 */
export async function closeMobilePromptDetail(page: Page) {
  const panel = page.locator('.detail-panel.mobile-visible');
  await expect(panel).toBeVisible();
  const close = panel.locator('.status-row button.detail-mobile-close');
  await expect(close).toBeVisible();
  await expect(close).toHaveAccessibleName('Back');
  await expect(close).toBeInViewport();
  await close.click();
  await expect(panel).toHaveCount(0);
}
