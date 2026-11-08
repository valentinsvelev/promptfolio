import { client, isDemo } from './api';
import type { ExplorePreferences } from '../utils/defaultExploreTab';
import { defaultExplorePreferences, normalizeExplorePreferences } from '../utils/defaultExploreTab';

const storageKey = (id: string) => `promptfolio:explore-preferences:${id}`;
const oldDefaultKey = (id: string) => `promptfolio:default-explore-tab:${id}`;

/** A local fallback is only used for the built-in demo workspace. */
function readDemoPreferences(userId: string): ExplorePreferences {
  try {
    const saved = localStorage.getItem(storageKey(userId));
    if (saved) return normalizeExplorePreferences(JSON.parse(saved));
    // Keep the selection made with the earlier browser-only version.
    return normalizeExplorePreferences({defaultTab:localStorage.getItem(oldDefaultKey(userId))});
  } catch { return defaultExplorePreferences(); }
}

/** Load one account's preferences under Supabase row-level security. */
export async function loadExplorePreferences(userId: string): Promise<ExplorePreferences> {
  if (isDemo) return readDemoPreferences(userId);
  const { data, error } = await client!.from('explore_preferences')
    .select('default_tab, tab_order').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data) return normalizeExplorePreferences({defaultTab:data.default_tab, tabOrder:data.tab_order});
  // Migrate any browser-local default from the previous version on first sign-in.
  const legacyDefault = (() => { try { return localStorage.getItem(oldDefaultKey(userId)); } catch { return null; } })();
  const preferences = normalizeExplorePreferences({defaultTab:legacyDefault});
  if (legacyDefault && preferences.defaultTab !== 'All prompts') {
    await saveExplorePreferences(userId, preferences);
  }
  return preferences;
}

/** Persist default tab and order atomically for this account. */
export async function saveExplorePreferences(userId: string, choice: ExplorePreferences): Promise<void> {
  const preferences = normalizeExplorePreferences(choice);
  if (isDemo) {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(preferences)); }
    catch { throw new Error('Your browser could not save the demo preference.'); }
    return;
  }
  const { error } = await client!.from('explore_preferences').upsert({
    user_id: userId,
    default_tab: preferences.defaultTab,
    tab_order: preferences.tabOrder,
    updated_at: new Date().toISOString(),
  }, {onConflict:'user_id'});
  if (error) throw error;
}
