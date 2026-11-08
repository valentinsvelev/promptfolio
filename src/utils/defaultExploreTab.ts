import type { Filter } from '../types';

export const EXPLORE_TABS: readonly Filter[] = [
  'All prompts', 'Personal', 'My teams', 'Other teams', 'Favorites',
];

export type ExplorePreferences = { defaultTab: Filter; tabOrder: Filter[] };

export function defaultExplorePreferences(): ExplorePreferences {
  return { defaultTab: 'All prompts', tabOrder: [...EXPLORE_TABS] };
}

export function normalizeExplorePreferences(value: unknown): ExplorePreferences {
  const fallback = defaultExplorePreferences();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as {defaultTab?:unknown; tabOrder?:unknown};
  const defaultTab = EXPLORE_TABS.find(tab => tab === candidate.defaultTab) || 'All prompts';
  const order: Filter[] = [];
  if (Array.isArray(candidate.tabOrder)) {
    for (const item of candidate.tabOrder) {
      const tab = EXPLORE_TABS.find(tab => tab === item);
      if (tab && !order.includes(tab)) order.push(tab);
    }
  }
  for (const tab of EXPLORE_TABS) if (!order.includes(tab)) order.push(tab);
  return { defaultTab, tabOrder: order };
}

export function moveExploreTab(order: readonly Filter[], index: number, step: -1 | 1): Filter[] {
  const next = [...order];
  const target = index + step;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
