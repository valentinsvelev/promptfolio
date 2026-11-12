import { expect, test } from '@playwright/test';

async function enterDemo(page: import('@playwright/test').Page) {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  await expect(page).toHaveURL(/#\/explore$/);
}

test('mobile menu opens beside the logo and navigates without a second header row', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only navigation');
  await enterDemo(page);
  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(menu).toBeVisible();
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('button', { name: 'Collections', exact: true }).click();
  await expect(page).toHaveURL(/#\/collections$/);
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
});

test('mobile Explore tabs fit, actions are centered and the result count shares their row', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only layout');
  await enterDemo(page);
  const tabs = page.locator('.filters-bar .filter-list');
  await expect(tabs.getByRole('button')).toHaveCount(5);
  const edit = page.getByRole('button', { name: 'Edit Explore tabs' });
  await expect(edit).toBeVisible();
  await expect(edit.locator('.explore-edit-label')).toBeHidden();
  const overflow = await tabs.evaluate(element => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
  await expect(page.locator('.prompt-results .results-count')).toBeVisible();
  await expect(page.locator('.prompt-results .rows')).toBeVisible();
  const positions = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const toolbar = rect('.prompt-results .prompt-toolbar');
    const actions = rect('.prompt-results .prompt-toolbar-actions');
    const results = rect('.prompt-results .results-count');
    const rows = rect('.prompt-results .rows');
    const area = rect('.prompt-results .list-top-tools');
    return {
      toolbarTop: toolbar.top,
      toolbarBottom: toolbar.bottom,
      resultsTop: results.top,
      resultsBottom: results.bottom,
      rowsTop: rows.top,
      actionsCenter: (actions.left + actions.right) / 2,
      areaCenter: (area.left + area.right) / 2,
    };
  });
  // Results and toolbar buttons now occupy the same horizontal row on phones.
  expect(positions.resultsTop).toBeGreaterThanOrEqual(positions.toolbarTop - 2);
  expect(positions.resultsBottom).toBeLessThanOrEqual(positions.toolbarBottom + 2);
  expect(positions.rowsTop).toBeGreaterThan(positions.resultsBottom);
  // The action buttons must stay centered regardless of the results label on the left.
  expect(Math.abs(positions.actionsCenter - positions.areaCenter)).toBeLessThan(3);
});
