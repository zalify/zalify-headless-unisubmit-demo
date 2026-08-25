/**
 * Per-store unstable_cache wrapper.
 *
 * unstable_cache fixes its key parts and tags at wrap time, so a single
 * wrapped function cannot carry per-tenant tags. storeCache() lazily
 * builds one cached function per store slug instead:
 *
 * - key parts include the slug → cache entries never collide across
 *   stores even for identical arguments;
 * - every base tag is emitted twice: bare (`products`) and scoped
 *   (`products:<slug>`). Bare tags keep the pre-multi-tenant
 *   /api/revalidate contract working (revalidate everything); scoped
 *   tags let &store=<slug> flush one tenant.
 *
 * The Map is module-level and bounded by the registry size + 'default'.
 */
import {unstable_cache} from 'next/cache';
import type {StoreConfig} from './store-config';

export function scopedTags(tags: readonly string[], slug: string): string[] {
  return tags.flatMap((tag) => [tag, `${tag}:${slug}`]);
}

export function storeCache<A extends unknown[], R>(
  keyBase: string,
  fn: (store: StoreConfig, ...args: A) => Promise<R>,
  options: {tags: readonly string[]; revalidate?: number},
): (store: StoreConfig, ...args: A) => Promise<R> {
  const perStore = new Map<string, (...args: A) => Promise<R>>();
  return (store: StoreConfig, ...args: A): Promise<R> => {
    let cached = perStore.get(store.slug);
    if (!cached) {
      cached = unstable_cache(
        (...inner: A) => fn(store, ...inner),
        [keyBase, store.slug],
        {
          revalidate: options.revalidate ?? 3600,
          tags: scopedTags(options.tags, store.slug),
        },
      );
      perStore.set(store.slug, cached);
    }
    return cached(...args);
  };
}
