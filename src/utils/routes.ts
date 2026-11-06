import type { View } from '../types';

export type AuthRoute = 'sign-in' | 'sign-up';
export type Route = View | AuthRoute;

export function isAuthRoute(route: Route): route is AuthRoute {
  return route === 'sign-in' || route === 'sign-up';
}


// Explicit slugs allow user-facing URLs to differ from internal View names.
// Keep the unsupported 'notifications' view on Explore until a page exists.
const slugs: Record<View, string> = {
  explore: 'explore',
  mine: 'my-prompts',
  teams: 'teams',
  reviews: 'reviews',
  admin: 'admin',
  changelog: 'changelog',
  notifications: 'explore',
};

export function hashForView(view: View): string {
  return `#/${slugs[view]}`;
}

export function hashForRoute(route: Route): string {
  return isAuthRoute(route) ? `#/${route}` : hashForView(route);
}

export function routeFromHash(hash: string): Route {
  if (hash === '#/sign-in') return 'sign-in';
  if (hash === '#/sign-up') return 'sign-up';
  // The landing page is the sign-in form, but preserve existing URLs
  // for app sections and shared prompts until the visitor authenticates.
  if (!hash || !hash.startsWith('#/')) return 'sign-in';
  return viewFromHash(hash);
}

export function viewFromHash(hash: string): View {
  if (!hash.startsWith('#/')) return 'explore';
  const slug = hash.slice(2).split('?')[0].replace(/\/+$/, '').toLowerCase();
  switch (slug) {
    case 'my-prompts': return 'mine';
    case 'teams': return 'teams';
    case 'reviews': return 'reviews';
    case 'admin': return 'admin';
    case 'changelog': return 'changelog';
    default: return 'explore';
  }
}

/** A malformed app route falls back to Explore; auth fragments are not app routes. */
export function isKnownAppHash(hash: string): boolean {
  return /^#\/(?:explore|my-prompts|teams|reviews|admin|changelog|sign-in|sign-up)\/?(?:\?.*)?$/.test(hash);
}
