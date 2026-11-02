import { useCallback, useEffect, useState } from 'react';
import { formatLocation, parseLocation, type WorkspaceLocation } from './navigation';

export function useWorkspaceLocation() {
  const [location, setLocation] = useState<WorkspaceLocation>(() =>
    typeof window === 'undefined' ? { view: 'new' } : parseLocation(window.location.hash));

  useEffect(() => {
    const sync = () => setLocation(parseLocation(window.location.hash));
    // A typed or linked hash opens at the top; back/forward keeps the browser's restored scroll.
    // Both fire popstate, so only the Navigation API tells them apart; without it scroll is left alone.
    const navigation = (window as { navigation?: EventTarget }).navigation;
    const linked = (event: Event) => {
      const { hashChange, navigationType } = event as Event & { hashChange?: boolean; navigationType?: string };
      if (hashChange && navigationType !== 'traverse') window.scrollTo(0, 0);
    };
    navigation?.addEventListener('navigate', linked);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      navigation?.removeEventListener('navigate', linked);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: WorkspaceLocation) => {
    const hash = formatLocation(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setLocation(next);
  }, []);

  return { location, navigate };
}
