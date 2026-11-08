import { test, expect } from '@playwright/test';
import { EXPLORE_TABS, moveExploreTab, normalizeExplorePreferences } from '../src/utils/defaultExploreTab';

test('normalizes corrupt or partial preference data', () => {
  const normalized=normalizeExplorePreferences({defaultTab:'invalid',tabOrder:['Favorites','Favorites','Personal','???']});
  expect(normalized.defaultTab).toBe('All prompts');
  expect(normalized.tabOrder).toEqual(['Favorites','Personal','All prompts','My teams','Other teams']);
});

test('reordering does not mutate the original list', () => {
  const original=[...EXPLORE_TABS];
  const moved=moveExploreTab(original,4,-1);
  expect(moved).toEqual(['All prompts','Personal','My teams','Favorites','Other teams']);
  expect(original).toEqual([...EXPLORE_TABS]);
});
