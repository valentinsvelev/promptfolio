import {expect,test} from '@playwright/test';

test('New collection is in the left column beside the detail panel, not the header',async({page,isMobile})=>{
  await page.goto('./');
  await page.getByRole('button',{name:/Try the full demo workspace/i}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Collections'}).click();
  await expect(page.locator('.topbar').getByRole('button',{name:'New collection'})).toHaveCount(0);

  const left=page.locator('.collections-left-rail');
  const create=left.getByRole('button',{name:'New collection'});
  const sidebar=left.getByRole('complementary',{name:'Your collections'});
  const content=page.locator('.collection-content');
  await expect(create).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(content).toBeVisible();
  const buttonBox=await create.boundingBox();
  const sidebarBox=await sidebar.boundingBox();
  const contentBox=await content.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(buttonBox!.y+buttonBox!.height).toBeLessThan(sidebarBox!.y);
  if(!isMobile){
    expect(Math.abs(buttonBox!.y-contentBox!.y)).toBeLessThan(4);
    expect(sidebarBox!.x).toBeLessThan(contentBox!.x);
  }
  await create.click();
  const editor=page.getByRole('dialog');
  await expect(editor.getByRole('heading',{name:'Create a collection'})).toBeVisible();
  await editor.getByRole('button',{name:'Cancel'}).click();
  await expect(editor).toHaveCount(0);
});
