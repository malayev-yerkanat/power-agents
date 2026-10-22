import { useCallback, useEffect, useState } from 'react';
import { formatLocation, parseLocation, type WorkspaceLocation } from './navigation';

export function useWorkspaceLocation() {
  const [location, setLocation] = useState<WorkspaceLocation>(() =>
    typeof window === 'undefined' ? { view: 'new' } : parseLocation(window.location.hash));

  useEffect(() => {
    const sync = () => setLocation(parseLocation(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
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
