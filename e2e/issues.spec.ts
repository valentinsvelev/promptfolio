import { test, expect } from '@playwright/test';
import { navigateToPage } from './helpers/navigation';

async function enterDemo(page: import('@playwright/test').Page) {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(page.locator('.filter-chip')).toHaveCount(5);
}

async function openSettings(page: import('@playwright/test').Page) {
  await page.locator('.profile-button').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Default Explore tab' })).toBeVisible();
}

test('footer version links to changelog for signed-out visitors', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('link', { name: /View changelog for v/i }).click();
  await expect(page).toHaveURL(/#\/changelog$/);
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to library' }).click();
  await expect(page).toHaveURL(/#\/sign-in$/);
});

test('guest can open changelog without losing the guest library', async ({ page, isMobile }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Continue as guest/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);

  const changelogLink = page.getByRole('link', { name: /View changelog for v/i });
  await expect(changelogLink).toBeAttached();
  if (isMobile) {
    // The footer is far below the scrollable mobile library. Activating the
    // real link with the keyboard avoids Playwright's scroll/click stability
    // wait while still exercising the same anchor and navigation handler.
    await changelogLink.focus();
    await expect(changelogLink).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await changelogLink.click();
  }
  await expect(page).toHaveURL(/#\/changelog$/);
  await expect(page.getByRole('region', { name: 'Promptfolio changelog' })).toBeVisible();

  const back = page.getByRole('button', { name: 'Back to library' });
  if (isMobile) {
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await back.click();
  }
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.locator('.prompt-row')).toHaveCount(5);
});

test('default Explore tab selection is saved in the demo and restored after re-entry', async ({ page, isMobile }) => {
  await enterDemo(page);
  await openSettings(page);
  const options=page.getByRole('radiogroup', { name: 'Default Explore tab' });
  await expect(options.getByRole('radio', { name: 'All prompts' })).toHaveAttribute('aria-checked','true');
  await options.getByRole('radio', { name: 'Favorites' }).click();
  await expect(options.getByRole('radio', { name: 'Favorites' })).toHaveAttribute('aria-checked','true');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.filter-chip.selected')).toHaveText('Favorites');

  await page.locator('.filter-chip').filter({ hasText: 'Personal' }).click();
  await navigateToPage(page, 'My prompts', isMobile);
  await navigateToPage(page, 'Explore', isMobile);
  await expect(page.locator('.filter-chip.selected')).toHaveText('Favorites');

  await page.reload();
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(page.locator('.filter-chip.selected')).toHaveText('Favorites');
});

test('browser Back to Explore restores the saved default', async ({ page, isMobile }) => {
  await enterDemo(page);
  await openSettings(page);
  await page.getByRole('radio', { name: 'My teams' }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await navigateToPage(page, 'My prompts', isMobile);
  await page.goBack();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.locator('.filter-chip.selected')).toHaveText('My teams');
});

test('Edit reorders Explore tabs, saves the order and survives re-entry', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Edit Explore tabs' }).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Customize Explore tabs' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Move Favorites up' }).click();
  await dialog.getByRole('button', { name: 'Move Favorites up' }).click();
  await dialog.getByRole('radio', { name: 'Make Favorites the default tab' }).check();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const tabs=page.locator('.filter-list .filter-chip');
  await expect(tabs).toHaveText(['All prompts','Personal','Favorites','My teams','Other teams']);
  await expect(page.locator('.filter-chip.selected')).toHaveText('Favorites');

  await page.reload();
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(tabs).toHaveText(['All prompts','Personal','Favorites','My teams','Other teams']);
  await expect(page.locator('.filter-chip.selected')).toHaveText('Favorites');
});

test('Cancel does not persist edits; Reset returns to the standard order', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: 'Edit Explore tabs' }).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Move Favorites up' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.filter-list .filter-chip')).toHaveText(['All prompts','Personal','My teams','Other teams','Favorites']);

  await page.getByRole('button', { name: 'Edit Explore tabs' }).click();
  await dialog.getByRole('button', { name: 'Move Favorites up' }).click();
  await dialog.getByRole('button', { name: 'Reset' }).click();
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});
