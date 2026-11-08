import { client, isDemo, loadData } from './api';
import type { AppData } from '../types';

// Keep this in step with the demo-data store in api.ts. Production uses RPCs.
const demoStorageKey = 'promptfolio-react-demo-v3';
const normalize = (value: string) => value.trim().toLocaleLowerCase();
const isReferenced = (data: AppData, name: string) => {
  const target = normalize(name);
  // Include historical versions and every proposal, even if its prompt is archived.
  return data.versions.some(v => normalize(v.category) === target) ||
    data.proposals.some(p => normalize(p.proposed_content.category) === target);
};

export async function deleteCategory(categoryName: string): Promise<string> {
  if (!isDemo) {
    const { data, error } = await client!.rpc('delete_category', { category_name: categoryName });
    if (error) throw new Error(error.message);
    return data as string;
  }
  const data = await loadData();
  const existing = data.categories.find(c => c.name === categoryName);
  if (!existing) throw new Error('Category not found.');
  if (isReferenced(data, existing.name)) throw new Error('Category is in use by a saved version or improvement proposal.');
  data.categories = data.categories.filter(c => c.name !== categoryName);
  localStorage.setItem(demoStorageKey, JSON.stringify(data));
  return existing.name;
}

export async function deleteUnusedCategories(): Promise<number> {
  if (!isDemo) {
    const { data, error } = await client!.rpc('delete_unused_categories');
    if (error) throw new Error(error.message);
    return data as number;
  }
  const data = await loadData();
  const initialCount = data.categories.length;
  data.categories = data.categories.filter(c => isReferenced(data, c.name));
  localStorage.setItem(demoStorageKey, JSON.stringify(data));
  return initialCount - data.categories.length;
}
