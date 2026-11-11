import {expect,test} from '@playwright/test';

// Demo mode only: never connects to the production Supabase project.
test.beforeEach(async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:/Try the full demo workspace/i}).click();
});

test('create a personal collection, add a prompt and open it without per-prompt analytics',async({page})=>{
  await page.getByRole('button',{name:'Collections',exact:true}).click();
  // The redundant 'Prompt collections' heading was removed. Check the page's
  // shared gradient separator and its collection sidebar instead.
  await expect(page.locator('main .workflow-masthead-collections')).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Your collections'})).toBeVisible();
  await page.getByRole('button',{name:'New collection'}).click();
  await page.getByRole('textbox',{name:'Collection name'}).fill('Research workflow');
  await page.getByRole('textbox',{name:'Description'}).fill('Prompts for an analysis project.');
  await page.getByRole('button',{name:'Save collection'}).click();
  await expect(page.getByRole('heading',{name:'Research workflow'})).toBeVisible();
  await page.getByRole('button',{name:'Add prompts'}).click();
  await page.locator('.collection-candidate').filter({hasText:'Turn meeting notes into action items'}).getByRole('button',{name:'Add'}).click();
  await page.getByRole('button',{name:'Done'}).click();
  await expect(page.locator('.collection-item-main')).toContainText(['Turn meeting notes into action items']);
  await page.locator('.collection-item-main').first().click();
  await expect(page.locator('.detail-title')).toHaveText('Turn meeting notes into action items');
  await expect(page.getByRole('region',{name:'Prompt usage insights'})).toHaveCount(0);
});

async function openSettings(page:import('@playwright/test').Page){
  await page.locator('.profile-button').click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  return page.getByRole('region',{name:'Your prompt impact'});
}

test('settings show personal aggregate impact, excluding your own activity by default',async({page,isMobile})=>{
  // One deliberate open by the signed-in demo user should not inflate default adoption.
  await page.locator('.prompt-row').filter({hasText:'Turn meeting notes into action items'}).click();
  if(isMobile){
    // On mobile, selecting a prompt opens a full-screen detail panel over the top bar.
    // Close it before opening Settings; this does not undo the recorded open.
    await expect(page.locator('.detail-panel.mobile-visible')).toBeVisible();
    await page.getByRole('button',{name:'Back'}).click();
    await expect(page.locator('.detail-panel.mobile-visible')).toHaveCount(0);
  }
  const impact=await openSettings(page);
  await expect(impact).toBeVisible();
  await expect(impact.locator('.usage-metric').filter({hasText:'Opens'}).locator('strong')).toHaveText('0');
  // Settings uses a styled toggle button, not a native checkbox.
  const ownActivityToggle=impact.getByRole('button',{name:'Include my own activity'});
  await expect(ownActivityToggle).toHaveAttribute('aria-pressed','false');
  await ownActivityToggle.click();
  await expect(ownActivityToggle).toHaveAttribute('aria-pressed','true');
  await expect(impact.locator('.usage-metric').filter({hasText:'Opens'}).locator('strong')).toHaveText('1');
  // The impact summary now separates created/contributed counts with a middle dot.
  await expect(impact.locator('.usage-impact-scope')).toContainText(/\d+ created\s*·\s*\d+ contributed to/);
  await expect(impact).not.toContainText('Alex Morgan');
  await expect(impact).not.toContainText('Sam Taylor');
  await impact.getByRole('combobox',{name:'Impact period'}).selectOption('7');
  await expect(impact).toContainText('Unique people');
});

test('no usage dashboard appears on the Teams page',async({page})=>{
  await page.getByRole('button',{name:'Teams',exact:true}).click();
  await expect(page.getByRole('region',{name:/usage insights/i})).toHaveCount(0);
  const impact=await openSettings(page);
  await expect(impact).toBeVisible();
});
