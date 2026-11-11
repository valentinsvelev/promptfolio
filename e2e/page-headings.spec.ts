import { test, expect, type Page } from '@playwright/test';

const pages = [
  ['Explore', 'explore', 'Explore.'],
  ['My prompts', 'mine', 'My prompts'],
  ['Collections', 'collections', 'Collections'],
  ['Teams', 'teams', 'Teams'],
  ['Reviews', 'reviews', 'Reviews'],
  ['Admin', 'admin', 'Admin'],
] as const;

async function expectSeparator(page: Page, kind: string, title: string) {
  const separator = page.locator(`main .workflow-masthead-${kind}`);
  await expect(separator).toBeVisible();
  await expect(separator.locator('h1')).toHaveText(title);
  await expect(separator.locator('.workflow-masthead-line')).toBeVisible();
  await expect(separator.locator('svg')).toHaveCount(0);
  const boundingBox = await separator.boundingBox();
  const lineBox = await separator.locator('.workflow-masthead-line').boundingBox();
  expect(boundingBox).not.toBeNull();
  expect(lineBox).not.toBeNull();
  if (boundingBox && lineBox) {
    expect(boundingBox.height).toBeCloseTo(30, 0);
    expect(lineBox.height).toBeCloseTo(2, 0);
    expect(Math.abs(lineBox.y + lineBox.height / 2 - boundingBox.y - boundingBox.height / 2)).toBeLessThan(2);
  }
  return separator;
}

test('every workspace page uses the same compact static gradient separator', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });

  for (const [tab, kind, title] of pages) {
    await test.step(tab, async () => {
      await nav.getByRole('button', { name: new RegExp(`^${tab}(?:\s+\d+)?$`) }).click();
      await expectSeparator(page, kind, title);
    });
  }

  await page.getByRole('link', { name: /View changelog for v/i }).click();
  await expectSeparator(page, 'changelog', 'Changelog');
  await expect(page.locator('main .page-heading')).toHaveCount(0);
});

test('public changelog also has the separator', async ({ page }) => {
  await page.goto('./#/changelog');
  await expectSeparator(page, 'changelog', 'Changelog');
});

test('gradient is static and the new spacing values apply', async ({ page }) => {
  await page.goto('./#/sign-in');
  await page.getByRole('button', { name: /Try the full demo workspace/i }).click();
  const info = await page.locator('.workflow-masthead-explore').evaluate(element => {
    const separatorStyle = getComputedStyle(element);
    const lineStyle = getComputedStyle(element.querySelector('.workflow-masthead-line')!);
    return {
      height: separatorStyle.height,
      gap: separatorStyle.getPropertyValue('--pf-masthead-bottom-gap').trim(),
      background: lineStyle.backgroundImage,
      mask: lineStyle.maskImage,
      animation: lineStyle.animationName,
    };
  });
  expect(info.height).toBe('30px');
  expect(info.gap).toBe('2px');
  expect(info.background).toContain('linear-gradient');
  expect(info.mask).toContain('linear-gradient');
  expect(info.animation).toBe('none');
});
