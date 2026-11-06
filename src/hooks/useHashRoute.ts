import { useCallback, useEffect, useState } from 'react';
import { hashForRoute, isKnownAppHash, routeFromHash, type Route } from '../utils/routes';

// Keep the GitHub Pages project base path and existing ?prompt=... sharing links.
function localUrl(hash: string): string {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

export function useHashRoute() {
  const [view, setCurrentView] = useState<Route>(() => routeFromHash(window.location.hash));

  useEffect(() => {
    const sync = () => {
      const current = window.location.hash;
      if (!current || (current.startsWith('#/') && !isKnownAppHash(current))) {
        // Replace—not push—so page-load normalization doesn't add a Back entry.
        window.history.replaceState(window.history.state, '', localUrl('#/sign-in'));
        setCurrentView('sign-in');
      } else {
        // Do not rewrite Supabase OAuth/password-recovery fragments such as
        // #access_token=...; Supabase needs to read them first.
        setCurrentView(routeFromHash(current));
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const change = useCallback((next: Route, replace: boolean) => {
    const hash = hashForRoute(next);
    if (window.location.hash !== hash) {
      window.history[replace ? 'replaceState' : 'pushState'](
        window.history.state, '', localUrl(hash),
      );
    }
    setCurrentView(next);
  }, []);

  const navigate = useCallback((next: Route) => change(next, false), [change]);
  const replace = useCallback((next: Route) => change(next, true), [change]);
  return [view, navigate, replace] as const;
}
