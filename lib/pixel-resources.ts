/**
 * Tiny module store bridging the current template's route resources
 * (product / collection — the complete server-fetched objects) to the
 * PixelEvents component, which lives OUTSIDE the template's React
 * context (useResource is TemplateContext-scoped). ThemeTemplateClient
 * publishes on every template render; PixelEvents subscribes via
 * useSyncExternalStore.
 */

type Resources = Record<string, unknown>;

let current: Resources = {};
const listeners = new Set<() => void>();

export function publishPixelResources(resources: Resources): void {
  current = resources;
  for (const listener of listeners) listener();
}

export function subscribePixelResources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPixelResources(): Resources {
  return current;
}

const EMPTY: Resources = {};
export function getServerPixelResources(): Resources {
  return EMPTY;
}
